/**
 * WAVELENGTH — AT Gaming
 * Jedna osoba (psychic) daje wskazówkę-słowo na skali między dwoma przeciwieństwami.
 * Reszta gracze przesuwają wskaźnik. Punkty za trafienie.
 * Polskie nazwy i pojęcia.
 */
'use strict';

const SPECTRUMS = [
  ['Zimny','Gorący'],
  ['Cichy','Głośny'],
  ['Nudny','Ekscytujący'],
  ['Tani','Drogi'],
  ['Słaby','Silny'],
  ['Smutny','Wesoły'],
  ['Stary','Nowy'],
  ['Mały','Duży'],
  ['Wolny','Szybki'],
  ['Brzydki','Piękny'],
  ['Prosty','Skomplikowany'],
  ['Bezpieczny','Niebezpieczny'],
  ['Zły','Dobry'],
  ['Naturalny','Sztuczny'],
  ['Miękki','Twardy'],
  ['Spokojny','Energiczny'],
  ['Bliski','Daleki'],
  ['Krótki','Długi'],
  ['Lekki','Ciężki'],
  ['Mroczny','Jasny'],
  ['Rzadki','Pospolity'],
  ['Poważny','Śmieszny'],
  ['Logiczny','Absurdalny'],
  ['Zdrowy','Niezdrowy'],
  ['Znany','Tajemniczy'],
];

const meta = {
  id: 'wavelength',
  name: 'Wavelength',
  icon: '📡',
  description: 'Psychic daje wskazówkę, gracze trafiają w skalę',
  minPlayers: 2,
  maxPlayers: 10,
  supportsGameMaster: false,
};

const defaultContent = {};

function onStart(room, io) {
  room.wl = {
    round: 0,
    maxRounds: room.config?.rounds || 8,
    psychicIndex: 0,
    phase: 'clue',  // clue | guessing | reveal
    spectrum: null,
    targetZone: null,  // 0–100 (środek strefy)
    clue: null,
    guesses: {},     // socketId -> { value: 0-100, name }
    teamGuess: null, // finalna zgrana pozycja
    scores: {},      // socketId -> punkty
  };
  room.players.forEach(p => { room.wl.scores[p.id] = 0; });
  startRound(room, io);
}

function startRound(room, io) {
  const wl = room.wl;
  wl.round++;
  wl.phase = 'clue';
  wl.clue = null;
  wl.guesses = {};
  wl.teamGuess = null;
  // Losuj spektrum
  wl.spectrum = SPECTRUMS[Math.floor(Math.random() * SPECTRUMS.length)];
  // Losuj cel (strefa 15-85 żeby nie być na samym brzegu)
  wl.targetZone = 15 + Math.floor(Math.random() * 71);
  // Psychic rotuje co rundę
  wl.psychicIndex = (wl.psychicIndex) % room.players.length;
  wl.psychic = room.players[wl.psychicIndex]?.id;

  emitState(room, io);
}

function emitState(room, io, extraEvent) {
  const wl = room.wl;
  const state = {
    round: wl.round,
    maxRounds: wl.maxRounds,
    phase: wl.phase,
    spectrum: wl.spectrum,
    clue: wl.clue,
    guesses: wl.guesses,
    teamGuess: wl.teamGuess,
    scores: wl.scores,
    psychic: wl.psychic,
    players: room.players.map(p => ({ id: p.id, name: p.name })),
    // Cel tylko w fazie reveal
    targetZone: wl.phase === 'reveal' ? wl.targetZone : null,
  };
  io.to(room.id).emit('wavelengthState', state);
  if (extraEvent) io.to(room.id).emit(extraEvent.name, extraEvent.data);
}

function onEvent(room, socket, event, data, io) {
  const wl = room.wl;
  if (!wl) return;

  if (event === 'wavelengthClue') {
    if (socket.id !== room.players.find(p => p.id === wl.psychic)?.id) return;
    if (wl.phase !== 'clue') return;
    const clue = String(data.clue || '').trim().slice(0, 40);
    if (!clue) return;
    wl.clue = clue;
    wl.phase = 'guessing';
    emitState(room, io);
  }

  if (event === 'wavelengthGuess') {
    if (wl.phase !== 'guessing') return;
    const val = Math.max(0, Math.min(100, Number(data.value) || 50));
    const player = room.players.find(p => p.id === socket.id);
    if (!player) return;
    // Psychic nie zgaduje
    if (socket.id === room.players.find(p => p.id === wl.psychic)?.id) return;
    wl.guesses[socket.id] = { value: val, name: player.name };
    // Jeśli wszyscy niezepsychic zagadali → przejdź do team guess
    const nonPsychic = room.players.filter(p => p.id !== wl.psychic);
    if (nonPsychic.length > 0 && nonPsychic.every(p => wl.guesses[p.id] !== undefined)) {
      // Średnia jako team guess
      const avg = nonPsychic.reduce((s, p) => s + wl.guesses[p.id].value, 0) / nonPsychic.length;
      wl.teamGuess = Math.round(avg);
    }
    emitState(room, io);
  }

  if (event === 'wavelengthLock') {
    // Psychic zatwierdza team guess
    if (socket.id !== room.players.find(p => p.id === wl.psychic)?.id) return;
    if (wl.phase !== 'guessing') return;
    if (wl.teamGuess === null) {
      const nonPsychic = room.players.filter(p => p.id !== wl.psychic);
      if (nonPsychic.length === 0) { wl.teamGuess = 50; }
      else {
        const guessed = nonPsychic.filter(p => wl.guesses[p.id] !== undefined);
        if (guessed.length === 0) return;
        wl.teamGuess = Math.round(guessed.reduce((s, p) => s + wl.guesses[p.id].value, 0) / guessed.length);
      }
    }
    revealRound(room, io);
  }
}

function revealRound(room, io) {
  const wl = room.wl;
  wl.phase = 'reveal';

  // Punktacja: odległość od środka strefy (±10 = 4 pkt, ±20 = 3 pkt, ±30 = 2 pkt, ±40 = 1 pkt)
  const dist = Math.abs((wl.teamGuess || 50) - wl.targetZone);
  let pts = 0;
  if (dist <= 10) pts = 4;
  else if (dist <= 20) pts = 3;
  else if (dist <= 30) pts = 2;
  else if (dist <= 40) pts = 1;

  // Punkty dla wszystkich NIE-psychic (oni zgadywali) i dla psychica (dobrze podał wskazówkę)
  room.players.forEach(p => {
    wl.scores[p.id] = (wl.scores[p.id] || 0) + pts;
  });

  emitState(room, io, { name: 'wavelengthReveal', data: { targetZone: wl.targetZone, teamGuess: wl.teamGuess, pts, dist } });

  // Po 5 sekundach następna runda lub koniec
  setTimeout(() => {
    if (!room.wl) return;
    if (wl.round >= wl.maxRounds) {
      // Koniec gry
      const sorted = Object.entries(wl.scores).sort((a, b) => b[1] - a[1]);
      const winner = room.players.find(p => p.id === sorted[0]?.[0]);
      io.to(room.id).emit('gameOver', {
        reason: `Koniec! Zwycięzca: ${winner?.name || '?'} (${sorted[0]?.[1]} pkt)`,
        scores: wl.scores,
        players: room.players.map(p => ({ id: p.id, name: p.name, score: wl.scores[p.id] || 0 })),
      });
    } else {
      wl.psychicIndex = (wl.psychicIndex + 1) % room.players.length;
      startRound(room, io);
    }
  }, 5000);
}

module.exports = { meta, defaultContent, onStart, onEvent };
