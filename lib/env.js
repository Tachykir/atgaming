/** Wspólne informacje o środowisku uruchomienia. */
'use strict';
const fs = require('fs');
const path = require('path');

// Wczytaj .env (lokalnie) ZANIM inne moduły odczytają zmienne środowiskowe
try {
  const envPath = path.join(__dirname, '..', '.env');
  if (fs.existsSync(envPath)) {
    for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
      const [key, ...rest] = line.split('=');
      if (key && !key.trim().startsWith('#') && rest.length && process.env[key.trim()] === undefined) process.env[key.trim()] = rest.join('=').trim();
    }
  }
} catch (e) {}
// Railway nie ustawia NODE_ENV samo z siebie — rozpoznajemy go po własnych zmiennych
const isProduction = process.env.NODE_ENV === 'production' || !!process.env.RAILWAY_ENVIRONMENT || !!process.env.RAILWAY_ENVIRONMENT_NAME;

// Dozwolone źródła połączeń socket.io (poza tą samą domeną): ALLOWED_ORIGINS="https://a.pl,https://b.pl"
function allowedOrigins() {
  const list = (process.env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
  try { if (process.env.DISCORD_REDIRECT_URI) list.push(new URL(process.env.DISCORD_REDIRECT_URI).origin); } catch (e) {}
  return list;
}

module.exports = { isProduction, allowedOrigins };
