/**
 * ═══════════════════════════════════════════
 *  MODUŁ GRY: WYŚCIG SŁÓW
 *  Plik: games/wordrace/index.js
 *
 *  Gracze dostają definicję/wskazówkę i muszą
 *  jak najszybciej wpisać poprawne słowo.
 *  Pierwszy kto wpisze poprawnie — dostaje punkty!
 * ═══════════════════════════════════════════
 */

module.exports = {
  meta: {
    id: 'wordrace',
    name: 'Wyścig Słów',
    icon: '⚡',
    description: 'Kto pierwszy wpisze poprawne słowo?',
    color: '#fcc05c',
    minPlayers: 2,
    maxPlayers: 8,
    supportsGameMaster: false,
    configSchema: {
      maxPlayers: { type: 'number', label: 'Maks. graczy',   min: 2, max: 20, default: 8 },
      rounds:     { type: 'number', label: 'Liczba rund',    min: 3, max: 20, default: 6 },
      roundTime:  { type: 'number', label: 'Czas rundy (s)', min: 10, max: 60, default: 20 },
    },
  },

  defaultContent: {
    general: {
      label: '🌐 Ogólne',
      easy: [
        { clue: 'Stolica Polski', answer: 'warszawa' },
        { clue: 'Największy ocean', answer: 'spokojny' },
        { clue: 'Autor Quo Vadis', answer: 'sienkiewicz' },
        { clue: 'Planeta najbliżej Słońca', answer: 'merkury' },
        { clue: 'Ile sekund ma minuta?', answer: '60' },
        { clue: 'Kolor nieba w dzień', answer: 'niebieski' },
        { clue: 'Stolica Niemiec', answer: 'berlin' },
        { clue: 'Ile nóg ma owad?', answer: '6' },
        { clue: 'Stolica Włoch', answer: 'rzym' },
        { clue: 'Największy kraj świata', answer: 'rosja' },
        { clue: 'Ile tygodni ma rok?', answer: '52' },
        { clue: 'Kto napisał Hamleta?', answer: 'szekspir' },
      ],
      medium: [
        { clue: 'Symbol chemiczny złota', answer: 'au' },
        { clue: 'Najwyższa góra świata', answer: 'everest' },
        { clue: 'Rok wybuchu II Wojny Światowej', answer: '1939' },
        { clue: 'Najdłuższa rzeka Afryki', answer: 'nil' },
        { clue: 'Język programowania węży', answer: 'python' },
        { clue: 'Firma za ChatGPT', answer: 'openai' },
        { clue: 'Kraj z Syrenką na fladze', answer: 'polska' },
        { clue: 'Polska odzyskała niepodległość w roku', answer: '1918' },
        { clue: 'Autor "W pustyni i w puszczy"', answer: 'sienkiewicz' },
        { clue: 'Najszybsze zwierzę lądowe', answer: 'gepard' },
      ],
      hard: [
        { clue: 'Pierwiastek o liczbie atomowej 79', answer: 'zloto' },
        { clue: 'Stolica Kazachstanu', answer: 'astana' },
        { clue: 'Twórca teorii względności', answer: 'einstein' },
        { clue: 'Rok urodzenia Kopernika', answer: '1473' },
        { clue: 'Algorytm sortowania Hoare\'a', answer: 'quicksort' },
        { clue: 'Miasto z Koloseum', answer: 'rzym' },
        { clue: 'Kto odkrył Amerykę w 1492?', answer: 'kolumb' },
      ],
    },
    science: {
      label: '🔬 Nauka',
      easy: [
        { clue: 'Wzór chemiczny wody', answer: 'h2o' },
        { clue: 'Ile nóg ma pająk?', answer: '8' },
        { clue: 'Najlżejszy pierwiastek', answer: 'wodor' },
        { clue: 'Ile zmysłów ma człowiek?', answer: '5' },
        { clue: 'Co produkuje fotosynteza?', answer: 'tlen' },
        { clue: 'Największa planeta układu słonecznego', answer: 'jowisz' },
        { clue: 'Ile chromosomów ma człowiek?', answer: '46' },
      ],
      medium: [
        { clue: 'Jednostka siły w układzie SI', answer: 'niuton' },
        { clue: 'Narząd produkujący insulinę', answer: 'trzustka' },
        { clue: 'Symbol pierwiastka żelazo', answer: 'fe' },
        { clue: 'Prędkość dźwięku w powietrzu (m/s)', answer: '340' },
        { clue: 'Twórca teorii ewolucji', answer: 'darwin' },
        { clue: 'Ile elektronów ma atom helu?', answer: '2' },
        { clue: 'Co to DNA? (skrót)', answer: 'kwas dezoksyrybonukleinowy' },
      ],
      hard: [
        { clue: 'Pierwiastek o symbolu Hg', answer: 'rtec' },
        { clue: 'Liczba Avogadro (zaokrąglona, potęga 10)', answer: '23' },
        { clue: 'Kto odkrył penicylinę?', answer: 'fleming' },
        { clue: 'Stała Plancka (nazwa)', answer: 'plancka' },
        { clue: 'pH krwi człowieka', answer: '7.4' },
      ],
    },
    geography: {
      label: '🌍 Geografia',
      easy: [
        { clue: 'Stolica Francji', answer: 'paryz' },
        { clue: 'Najdłuższa rzeka świata', answer: 'nil' },
        { clue: 'Kontynent z Australią', answer: 'australia' },
        { clue: 'Stolica Japonii', answer: 'tokio' },
        { clue: 'Największy kraj Afryki', answer: 'algieria' },
        { clue: 'Morze między Polską a Skandynawią', answer: 'baltyckie' },
      ],
      medium: [
        { clue: 'Stolica Australii (nie Sydney!)', answer: 'canberra' },
        { clue: 'Najwyższy szczyt Europy', answer: 'mont blanc' },
        { clue: 'Kraj z piramidami', answer: 'egipt' },
        { clue: 'Rzeka przecinająca Paryż', answer: 'sekwana' },
        { clue: 'Kraj z Amazonką', answer: 'brazylia' },
        { clue: 'Stolica Kanady (nie Toronto!)', answer: 'ottawa' },
      ],
      hard: [
        { clue: 'Najgłębsze jezioro świata', answer: 'bajkal' },
        { clue: 'Stolica Nowej Zelandii', answer: 'wellington' },
        { clue: 'Kraj z najdłuższą linią brzegową', answer: 'kanada' },
        { clue: 'Rzeka przez Kair', answer: 'nil' },
      ],
    },
    sports: {
      label: '⚽ Sport',
      easy: [
        { clue: 'Ile graczy w piłce nożnej na boisku?', answer: '11' },
        { clue: 'Sport z rakietą i lotką', answer: 'badminton' },
        { clue: 'Ile punktów za kosze w koszykówce?', answer: '2' },
        { clue: 'Gdzie odbyły się IO 2024?', answer: 'paryz' },
        { clue: 'Najważniejszy turniej tenisowy na trawie', answer: 'wimbledon' },
      ],
      medium: [
        { clue: 'Kto wygrał MŚ 2022?', answer: 'argentyna' },
        { clue: 'Rekordzista w złotych medalach olimpijskich', answer: 'phelps' },
        { clue: 'Kraj z formuły 1 — Ferrari', answer: 'wlochy' },
        { clue: 'Ile setów w meczu tenisa mężczyzn Wimbledon?', answer: '5' },
        { clue: 'Klub z Santiago Bernabeu', answer: 'real madryt' },
      ],
      hard: [
        { clue: 'Rekord świata 100m (kto go posiada)?', answer: 'bolt' },
        { clue: 'Rok pierwszych nowożytnych IO', answer: '1896' },
        { clue: 'Kraj z największą liczbą medali w historii IO', answer: 'usa' },
      ],
    },
  },

  createState(config) {
    return {
      rounds: [],
      currentRound: 0,
      roundTimer: null,
      roundWinner: null,
      answered: [],
    };
  },

  onStart({ room, content, io, helpers }) {
    const gs = room.gameState;
    const cat = content[room.config.category] || Object.values(content)[0];
    const pool = cat[room.config.difficulty] || cat.easy || [];
    const numRounds = Math.min(Number(room.config.rounds) || 6, pool.length || 6);
    gs.rounds = [...pool].sort(() => Math.random() - 0.5).slice(0, numRounds);

    if (!gs.rounds.length) {
      return helpers.emitError(room.id, 'Brak słów w tej kategorii!');
    }

    gs.currentRound = 0;
    io.to(room.id).emit('gameStarted', { room });
    helpers.startWordRaceRound(room.id);
  },

  onEvent({ event, data, socket, room, io, helpers }) {
    if (event === 'wordRaceAnswer') return _checkAnswer({ data, socket, room, io, helpers });
  },
};

function _checkAnswer({ data, socket, room, io, helpers }) {
  const gs = room.gameState;
  if (room.status !== 'playing') return;
  if (gs.answered.includes(socket.id)) return;

  const currentRound = gs.rounds[gs.currentRound];
  const guess = (data.answer || '').trim().toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, ''); // strip accents
  const correct = currentRound.answer.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  if (guess === correct) {
    gs.answered.push(socket.id);
    const pi = room.players.findIndex(p => p.id === socket.id);
    const points = Math.max(50, 200 - gs.answered.length * 30);
    room.players[pi].score += points;
    gs.roundWinner = socket.id;

    clearTimeout(gs.roundTimer);
    io.to(room.id).emit('wordRaceCorrect', {
      playerName: room.players[pi].name,
      answer: currentRound.answer,
      points,
      room,
    });

    setTimeout(() => helpers.nextWordRaceRound(room.id), 2500);
  } else {
    socket.emit('wordRaceWrong', { guess });
  }
}
