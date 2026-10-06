# 🎮 GameNight — Multiplayer Games

Platforma gier multiplayer (Wisielec, Quiz) z Socket.io.

## Gry
- 🪓 **Wisielec** — zgaduj litery na zmianę z innymi graczami
- 🧠 **Quiz** — szybkie pytania, punkty za refleks i poprawną odpowiedź

---

## 🎰 Kasyno AT$

Wirtualna waluta AT$ (start 100 000, cotygodniowe doładowanie), logowanie przez Discord.

| Gra | Typ | Opis |
|---|---|---|
| Lucky Fruits | automat 5×3 | 20 linii, Wild, Scatter → Free Spiny ×3 |
| Path of Gambling | automat 5×5 | 30 linii, Pit Meter, sticky Lock / Valdo z mnożnikami |
| Jackpot Frenzy | cluster 5×10 | kociołki, mini-gry, progresywne jackpoty (× stawka) |
| Dragon Hoard | automat 4×5 | rozszerzający się Wild, Hold & Win, Grand ×1000 |
| Arcane Academy | cluster 7×7 | kaskady z mnożnikiem do ×10, interaktywny Bonus Pick |
| Dual Blades | 2 × 3×3 | Shadow Blade, Sync Bonus ×2, Sync Meter |
| Neon Racer | automat 5×3 | wygrane w obie strony, Speed Meter → Turbo ×3 |
| Crash | multiplayer | auto cash-out, P(≥x)=0,96/x |
| Ruletka | multiplayer | europejska, split/street/corner/six line |
| Pachinko | Plinko | 3 poziomy ryzyka, do 10 kulek |
| Coinflip | PvP / solo | wyzwania między graczami, solo ×1,96 |
| Texas Hold'em | stół | side-poty, timer tury, min-raise |
| Blackjack | stół | split, double, S17, BJ 3:2 |

**Zasady techniczne**
- Wypłata automatów to dokładnie to, co widać na planszy (ewaluacja linii / klastrów po stronie serwera).
- RTP automatów ≈ 95%, Pachinko ≈ 96%, Crash 96% — skalibrowane symulacjami Monte Carlo
  (`games/casino/slot_engine.js → simulate()`).
- Wszystkie stawki pobierane są atomowo (`casino.debit`) — brak możliwości zejścia poniżej zera.
- Bonusy typu „licznik” (Pit Meter, kociołki, Speed/Sync Meter) grają za średnią stawkę z nabijania.

**Struktura kodu kasyna**
```
casino.js                     # portfele, stoły, statystyki (PostgreSQL / JSON)
games/casino/slot_engine.js   # wspólny silnik automatów (stawki, wypłaty, symulacja RTP)
games/casino/*.js             # logika poszczególnych gier
public/css/casino.css         # wygląd kasyna
public/js/casino-core.js      # lobby, helpery UI, wejście/wyjście ze stołów
public/js/casino-slotkit.js   # wspólny komponent UI automatów
public/js/casino-*.js         # interfejsy poszczególnych gier
```

Testy lokalne bez Discorda: uruchom z `DEV_LOGIN=1` i wejdź na `http://localhost:3000/auth/dev-login?name=Tester`.

---

## 🚀 Uruchomienie lokalnie

```bash
npm install
npm run dev
# Otwórz http://localhost:3000
```

---

## ☁️ Deployment na Railway (krok po kroku)

### 1. Wgraj kod na GitHub
1. Utwórz konto na [github.com](https://github.com) jeśli nie masz
2. Kliknij **"New repository"** → nadaj nazwę (np. `gamenight`)
3. Zaznacz **"Public"** → **"Create repository"**
4. Wgraj pliki: przeciągnij pliki projektu lub użyj:
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin https://github.com/TWOJ-LOGIN/gamenight.git
   git push -u origin main
   ```

### 2. Połącz z Railway
1. Wejdź na [railway.app](https://railway.app) → zaloguj się przez GitHub
2. Kliknij **"New Project"** → **"Deploy from GitHub repo"**
3. Wybierz swoje repo `gamenight`
4. Railway automatycznie wykryje Node.js i uruchomi `npm start`
5. Po chwili pojawi się zielony status ✅

### 3. Pobierz publiczny URL
1. W Railway kliknij na swój projekt
2. Zakładka **"Settings"** → sekcja **"Domains"**
3. Kliknij **"Generate Domain"**
4. Dostaniesz URL w stylu: `gamenight.up.railway.app` 🎉

---

## 💰 Koszty
Railway daje **5$/miesiąc kredytów za darmo** — dla hobbystycznego projektu z małym ruchem to powinno wystarczyć.

---

## 📁 Struktura projektu
```
gamenight/
├── server.js          # Serwer + logika gier (Node.js + Socket.io)
├── public/
│   └── index.html     # Frontend (cały UI w jednym pliku)
├── package.json
└── .gitignore
```
