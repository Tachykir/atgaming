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
  configSchema: {
    maxPlayers: { type: 'number', label: 'Maks. graczy', min: 2, max: 20, default: 10 },
    rounds:     { type: 'number', label: 'Liczba rund',  min: 3, max: 20, default: 8 },
  },
};

const defaultContent = {};

// FIX #10: Dodano createState() żeby server.js mógł zainicjować gameState
function createState(config) {
  return {
    wl: null, // inicjalizowane w onStart
  };
}

// FIX #10: Zmieniono sygnaturę z (room, io) na ({ room, io })
function onStart({ room, io }) {
  room.wl = {
    round: 0,
    maxRounds: Number(room.config?.rounds) || 8,
    psychicIndex: 0,
    phase: 'clue',  // clue | guessing | reveal
    spectrum: null,
    targetZone: null,
    clue: null,
    guesses: {},
    teamGuess: null,
    scores: {},
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
  wl.spectrum = SPECTRUMS[Math.floor(Math.random() * SPECTRUMS.length)];
  wl.targetZone = 15 + Math.floor(Math.random() * 71);
  // Psychic rotuje co rundę — inkrementuj PRZED ustawieniem (nie po)
  wl.psychic = room.players[wl.psychicIndex % room.players.length]?.id;
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
    targetZone: wl.phase === 'reveal' ? wl.targetZone : null,
  };
  io.to(room.id).emit('wavelengthState', state);
  if (extraEvent) io.to(room.id).emit(extraEvent.name, extraEvent.data);
}

// FIX #10: Zmieniono sygnaturę z (room, socket, event, data, io) na ({ event, data, socket, room, io })
function onEvent({ event, data, socket, room, io }) {
  const wl = room.wl;
  if (!wl) return;

  if (event === 'wavelengthClue') {
    if (socket.id !== wl.psychic) return;
    if (wl.phase !== 'clue') return;
    const clue = String(data.clue || '').trim().slice(0, 40);
    if (!clue) return;
    wl.clue = clue;
    wl.phase = 'guessing';
    emitState(room, io);
  }

  if (event === 'wavelengthGuess') {
    if (wl.phase !== 'guessing') return;
    if (socket.id === wl.psychic) return; // Psychic nie zgaduje
    const val = Math.max(0, Math.min(100, Number(data.value) || 50));
    const player = room.players.find(p => p.id === socket.id);
    if (!player) return;
    wl.guesses[socket.id] = { value: val, name: player.name };
    // Jeśli wszyscy non-psychic zagadali → oblicz team guess
    const nonPsychic = room.players.filter(p => p.id !== wl.psychic);
    if (nonPsychic.length > 0 && nonPsychic.every(p => wl.guesses[p.id] !== undefined)) {
      const avg = nonPsychic.reduce((s, p) => s + wl.guesses[p.id].value, 0) / nonPsychic.length;
      wl.teamGuess = Math.round(avg);
    }
    emitState(room, io);
  }

  if (event === 'wavelengthLock') {
    if (socket.id !== wl.psychic) return;
    if (wl.phase !== 'guessing') return;
    if (wl.teamGuess === null) {
      const nonPsychic = room.players.filter(p => p.id !== wl.psychic);
      if (nonPsychic.length === 0) {
        wl.teamGuess = 50;
      } else {
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

  const dist = Math.abs((wl.teamGuess || 50) - wl.targetZone);
  let pts = 0;
  if (dist <= 10) pts = 4;
  else if (dist <= 20) pts = 3;
  else if (dist <= 30) pts = 2;
  else if (dist <= 40) pts = 1;

  room.players.forEach(p => {
    wl.scores[p.id] = (wl.scores[p.id] || 0) + pts;
  });

  emitState(room, io, { name: 'wavelengthReveal', data: { targetZone: wl.targetZone, teamGuess: wl.teamGuess, pts, dist } });

  setTimeout(() => {
    if (!room.wl) return;
    if (wl.round >= wl.maxRounds) {
      room.status = 'finished';
      const sorted = room.players
        .map(p => ({ ...p, score: wl.scores[p.id] || 0 }))
        .sort((a, b) => b.score - a.score);
      room.players = sorted;
      io.to(room.id).emit('gameOver', { room, sorted });
    } else {
      wl.psychicIndex = (wl.psychicIndex + 1) % room.players.length;
      startRound(room, io);
    }
  }, 5000);
}

module.exports = { meta, defaultContent, createState, onStart, onEvent };
