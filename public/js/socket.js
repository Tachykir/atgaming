// socket.js — Socket.IO połączenie i globalne zmienne
const socket = io();
let toastTimer = null;
// Zmienne kasyna — globalne, uzywane we wszystkich modulach
let casinoWallet = null, casinoDiscordId = null, casinoSocketToken = null;
let casinoTableId = null, casinoIsObserver = false, casinoMyHand = [];
let casinoTableData = null, casinoCdMax = 15;

// Zmienne globalne aplikacji
let S = { playerId: null, roomId: null, room: null, playerName: null, selectedGame: null, isHost: false, isGM: false };
let games = [], content = {}, configSchemas = {};
let adminPwd = null;
let chatOpen = false, chatUnread = 0, chatResizing = false;
let isDragging = false;
let H = {}; // Hangman state

// Socket bazowe
socket.on('connect', () => { if(typeof S !== 'undefined') S.playerId = socket.id; });
socket.on('error', ({message}) => showToast(message, 'error'));
