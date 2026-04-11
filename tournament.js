/**
 * MODUŁ TURNIEJOWY
 * ─────────────────────────────────────────────────────────────
 * Tryb: Faza grupowa (round-robin każdy z każdym) → Eliminacje (drabinka)
 * Gracze: dowolna liczba (min 3), dostosowuje się automatycznie
 * Gra: host wybiera przed każdym meczem (może zmieniać!)
 * Punktacja W/L — awans/odpadnięcie
 *
 * STATUS MECZU: pending | picking | playing | done | bye
 */

const tournaments = {};

function uid() {
  return 'T' + Math.random().toString(36).substring(2, 6).toUpperCase();
}

function nextPow2(n) {
  let p = 1; while (p < n) p *= 2; return p;
}

function buildGroupMatches(players) {
  const matches = [];
  let idx = 0;
  for (let i = 0; i < players.length; i++) {
    for (let j = i + 1; j < players.length; j++) {
      matches.push({
        id: `g${idx++}`,
        phase: 'group',
        p1: slim(players[i]),
        p2: slim(players[j]),
        winner: null, loser: null,
        roomId: null, gameType: null,
        status: 'pending',
      });
    }
  }
  return matches;
}

function buildPlayoffRound(advancers, roundNum) {
  const n = nextPow2(advancers.length);
  const seeds = [...advancers];
  while (seeds.length < n) seeds.push(null);

  return Array.from({ length: n / 2 }, (_, i) => {
    const p1 = seeds[i], p2 = seeds[n - 1 - i];
    const bye = !p1 || !p2;
    return {
      id: `pr${roundNum}_${i}`,
      phase: 'playoff',
      playoffRound: roundNum,
      slot: i,
      p1: p1 ? slim(p1) : null,
      p2: p2 ? slim(p2) : null,
      winner: bye ? (p1 || p2) : null,
      loser: null,
      roomId: null, gameType: null,
      status: bye ? 'bye' : 'pending',
    };
  });
}

function slim(p) { return { id: p.id, name: p.name }; }
function sanitize(t) { return JSON.parse(JSON.stringify(t)); }

module.exports = {
  tournaments,

  create({ hostId, hostName }) {
    const t = {
      id: uid(),
      hostId, hostName,
      status: 'lobby',
      players: [{ id: hostId, name: hostName, groupWins: 0, groupLosses: 0, eliminated: false }],
      matches: [],
      currentMatchId: null,
      playoffAdvancers: 2,   // host może zmienić w lobby
      groupStandings: {},
      _playoffRound: 0,
      champion: null,
      createdAt: Date.now(),
    };
    tournaments[t.id] = t;
    return sanitize(t);
  },

  join(tournamentId, playerId, playerName) {
    const t = tournaments[tournamentId];
    if (!t)                   return { error: 'Turniej nie istnieje' };
    if (t.status !== 'lobby') return { error: 'Turniej już trwa' };
    if (t.players.find(p => p.id === playerId)) return { error: 'Już jesteś w tym turnieju' };
    t.players.push({ id: playerId, name: playerName, groupWins: 0, groupLosses: 0, eliminated: false });
    return { ok: true, tournament: sanitize(t) };
  },

  leave(tournamentId, playerId) {
    const t = tournaments[tournamentId];
    if (!t || t.status !== 'lobby') return null;
    t.players = t.players.filter(p => p.id !== playerId);
    if (t.hostId === playerId && t.players.length > 0) t.hostId = t.players[0].id;
    return sanitize(t);
  },

  setAdvancers(tournamentId, count) {
    const t = tournaments[tournamentId];
    if (!t || t.status !== 'lobby') return null;
    // Need at least 2 in playoff, at most all-but-one players
    const max = Math.max(2, t.players.length - 1);
    t.playoffAdvancers = Math.max(2, Math.min(count, max));
    return sanitize(t);
  },

  startGroup(tournamentId) {
    const t = tournaments[tournamentId];
    if (!t) return { error: 'Nie znaleziono turnieju' };
    if (t.players.length < 3) return { error: 'Potrzeba min. 3 graczy' };

    t.status = 'group';
    t.matches = buildGroupMatches(t.players);
    t.groupStandings = {};
    t.players.forEach(p => {
      t.groupStandings[p.id] = { wins: 0, losses: 0, points: 0, name: p.name };
    });

    // Pierwszy mecz → picking
    const first = t.matches[0];
    first.status = 'picking';
    t.currentMatchId = first.id;

    return { ok: true, tournament: sanitize(t) };
  },

  pickGame(tournamentId, gameType) {
    const t = tournaments[tournamentId];
    if (!t) return { error: 'Brak turnieju' };
    const m = t.matches.find(m => m.id === t.currentMatchId);
    if (!m || m.status !== 'picking') return { error: 'Brak meczu do konfiguracji' };
    m.gameType = gameType;
    m.status = 'playing';
    return { ok: true, match: m, tournament: sanitize(t) };
  },

  attachRoom(tournamentId, matchId, roomId) {
    const t = tournaments[tournamentId];
    if (!t) return;
    const m = t.matches.find(m => m.id === matchId);
    if (m) m.roomId = roomId;
  },

  recordResult(tournamentId, matchId, winnerId) {
    const t = tournaments[tournamentId];
    if (!t) return { error: 'Brak turnieju' };
    const m = t.matches.find(m => m.id === matchId);
    if (!m || m.status === 'done' || m.status === 'bye') return { error: 'Mecz już rozegrany' };

    const winner = [m.p1, m.p2].find(p => p?.id === winnerId);
    const loser  = [m.p1, m.p2].find(p => p && p.id !== winnerId);
    if (!winner) return { error: 'Nieznany zwycięzca' };

    m.winner = winner; m.loser = loser;
    m.status = 'done'; m.roomId = null;
    t.currentMatchId = null;

    // Standings fazy grupowej
    if (t.groupStandings) {
      if (t.groupStandings[winner.id]) { t.groupStandings[winner.id].wins++; t.groupStandings[winner.id].points += 3; }
      if (loser && t.groupStandings[loser.id]) t.groupStandings[loser.id].losses++;
    }
    // Player stats
    const wp = t.players.find(p => p.id === winner.id);
    const lp = t.players.find(p => p.id === loser?.id);
    if (wp && t.status === 'group') wp.groupWins++;
    if (lp && t.status === 'group') lp.groupLosses++;
    if (lp && t.status === 'playoff') lp.eliminated = true;

    // Następny pending mecz tej fazy
    const nextPending = t.matches.find(m2 => m2.phase === t.status && m2.status === 'pending');
    if (nextPending) {
      nextPending.status = 'picking';
      t.currentMatchId = nextPending.id;
      return { ok: true, nextMatch: nextPending, tournament: sanitize(t) };
    }

    if (t.status === 'group') return this._startPlayoff(t);
    if (t.status === 'playoff') return this._advancePlayoff(t);
    return { ok: true, tournament: sanitize(t) };
  },

  _startPlayoff(t) {
    t.status = 'playoff';
    const sorted = Object.entries(t.groupStandings)
      .map(([id, s]) => ({ id, name: s.name, points: s.points, wins: s.wins }))
      .sort((a, b) => b.points - a.points || b.wins - a.wins || Math.random() - .5);

    const adv = Math.min(t.playoffAdvancers, sorted.length);
    const advancers = sorted.slice(0, adv);
    const advIds = new Set(advancers.map(a => a.id));
    t.players.forEach(p => { if (!advIds.has(p.id)) p.eliminated = true; });

    t._playoffRound = 1;
    const pMatches = buildPlayoffRound(advancers, 1);
    t.matches.push(...pMatches);

    // Auto-resolve byes
    pMatches.filter(m => m.status === 'bye').forEach(m => {
      const w = t.players.find(p => p.id === m.winner?.id);
      // byes don't count as real wins
    });

    const first = pMatches.find(m => m.status === 'pending');
    if (first) {
      first.status = 'picking';
      t.currentMatchId = first.id;
    } else {
      // All byes — the single winner with most byes is champion (edge case: 1 advancer)
      const winners = pMatches.map(m => m.winner).filter(Boolean);
      if (winners.length === 1) {
        t.champion = winners[0];
        t.status = 'finished';
        return { ok: true, tournamentDone: true, tournament: sanitize(t) };
      }
    }

    return { ok: true, phaseChange: 'playoff', advancers, tournament: sanitize(t) };
  },

  _advancePlayoff(t) {
    const round = t._playoffRound;
    const roundMatches = t.matches.filter(m => m.phase === 'playoff' && m.playoffRound === round);
    const allDone = roundMatches.every(m => m.status === 'done' || m.status === 'bye');
    if (!allDone) return { ok: true, tournament: sanitize(t) };

    const winners = roundMatches.map(m => m.winner).filter(Boolean);
    if (winners.length === 1) {
      t.champion = winners[0];
      t.status = 'finished';
      return { ok: true, tournamentDone: true, tournament: sanitize(t) };
    }

    t._playoffRound++;
    const next = buildPlayoffRound(winners, t._playoffRound);
    t.matches.push(...next);

    const first = next.find(m => m.status === 'pending');
    if (first) { first.status = 'picking'; t.currentMatchId = first.id; }

    return { ok: true, tournament: sanitize(t) };
  },

  get(id) { return tournaments[id] ? sanitize(tournaments[id]) : null; },
  list()  { return Object.values(tournaments).filter(t => t.status !== 'finished').map(sanitize); },
  delete(id) { delete tournaments[id]; },
};
