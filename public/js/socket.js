// socket.js — Socket.IO połączenie i globalne zmienne
const socket = io();
let toastTimer = null;
// Zmienne kasyna — globalne, uzywane we wszystkich modulach
let casinoWallet = null, casinoDiscordId = null, casinoSocketToken = null;
let casinoTableId = null, casinoIsObserver = false, casinoMyHand = [];
let casinoTableData = null, casinoCdMax = 15;
// Socket bazowe
socket.on('connect', () => { if(typeof S !== 'undefined') S.playerId = socket.id; });
socket.on('error', ({message}) => showToast(message, 'error'));
