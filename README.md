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
| Candy Tumble | pay anywhere 6×5 | 8+ symboli gdziekolwiek, kaskady, bomby ×2–×100 w Free Spinach |
| Księga Faraona | automat 5×3 | 10 linii, Księga = Wild+Scatter, rozszerzający się symbol w Free Spinach |
| Hot 777 | klasyk 3×3 | 5 linii, Fire Respin, koło mnożników ×2–×10 |
| Crash | multiplayer | auto cash-out, P(≥x)=0,96/x |
| Ruletka | multiplayer | europejska, split/street/corner/six line |
| Pachinko | Plinko | 3 poziomy ryzyka, do 10 kulek |
| Coinflip | PvP / solo | wyzwania między graczami, solo ×1,96 |
| Texas Hold'em | stół | side-poty, timer tury, min-raise |
| Blackjack | stół | split, double, S17, BJ 3:2 |

**Zasady techniczne**
- Wypłata automatów to dokładnie to, co widać na planszy (ewaluacja linii / klastrów po stronie serwera).
- Domyślne RTP: automaty ≈ 95%, Pachinko ≈ 96%, Crash 96%, Coinflip solo 98% — skalibrowane symulacjami
  Monte Carlo (`games/casino/slot_engine.js → simulate()`). RTP każdej gry można zmienić w panelu admina.
- Wszystkie stawki pobierane są atomowo (`casino.debit`) — brak możliwości zejścia poniżej zera.
- Bonusy typu „licznik” (Pit Meter, kociołki, Speed/Sync Meter) grają za średnią stawkę z nabijania.

**Panel admina → 🎛️ Kasyno: RTP**
- Docelowe RTP per gra (50–120%). Automaty: wszystkie wypłaty × (cel / bazowe RTP); Pachinko: mnożniki pól;
  Crash: P(wybuch ≥ x) = RTP / x; Coinflip solo: wypłata 2 × RTP. Ruletka, blackjack i poker — tylko podgląd.
- Faktyczny RTP z gry (postawiono / wypłacono / rundy) per gra, zysk kasyna, historia zmian.
- 🧪 Symulacja 300 000 spinów automatu w osobnym wątku (nie blokuje serwera).
- Ustawienia zapisują się w bazie (`casino_settings`) i działają od razu, bez restartu.
- Logowanie hasłem tworzy sesję admina (bez wysyłania hasła z każdym żądaniem), 5 błędnych prób = blokada 10 min.
  W produkcji (`NODE_ENV=production`) bez `ADMIN_PASSWORD` panel jest wyłączony.

**Dzienny bonus, historia i osiągnięcia**
- 🎁 Dzienny bonus (dzień wg czasu polskiego): 2 000 → 10 000 AT$ za kolejne dni serii; przerwa zeruje serię.
- 📜 Historia gier gracza: stawki, wygrane, bonusy, wejścia i wyjścia ze stołów (ostatnie 30 dni / 200 wpisów).
- 🏆 14 osiągnięć z jednorazowymi nagrodami AT$ (pierwsza wygrana, 1 000 spinów, wygrana 250×, Crash 10×, milioner…),
  z paskami postępu i powiadomieniem na żywo w każdej grze (`casino/progress.js`).

**Scattery**
- Każdy automat ma własny motyw efektów scatterów: 🔥 żar (Dragon Hoard), 💫 kosmos (Lucky Fruits), 📚 runy (Arcane Academy),
  🌫️ mgła (Path of Gambling), 🌒 zaćmienie (Dual Blades), 💨 neon i błyskawice (Neon Racer), 🍭 konfetti (Candy Tumble),
  📖 złoty piasek i monety (Księga Faraona).
- Animacja scattera na planszy, wyskok przy lądowaniu z dzwonkiem coraz wyżej, licznik „2/3”, oczekiwanie na ostatni
  scatter (świecące bębny, cząsteczki, bicie serca), a przy wyzwoleniu bonusu błysk, promień łączący scattery i eksplozja.
- Konfiguracja w automacie: `scatter: { is: i => i === SCATTER, fx: 'fire', icon: '🔥', need: 3 }` (`public/js/casino-slotkit.js`).

**Aplikacja (PWA) i telefon w poziomie**
- Instalacja jako aplikacja (Android: „Zainstaluj aplikację”, iOS: instrukcja „Do ekranu początkowego”), pełny ekran,
  ikony, strona offline (`public/manifest.webmanifest`, `public/sw.js`, `public/js/pwa.js`).
- Wymuszony poziom: zainstalowana aplikacja startuje poziomo, w przeglądarce telefon w pionie widzi ekran
  „Obróć telefon” z przyciskiem pełnego ekranu (Android obraca i blokuje orientację).
- Kompaktowy układ poziomy dla telefonów: plansza na całą wysokość, pionowy panel z dużym przyciskiem SPIN.

**Niezawodność**
- Stan automatów (free spiny, bonusy, liczniki) zapisywany w bazie — przetrwa restart serwera.
- SIGTERM/SIGINT (deploy): zwrot AT$ z gier w toku (żetony przy stołach, zakłady ruletki/crash, otwarte wyzwania
  coinflip), zapis statystyk, zamknięcie bazy.
- Limit zdarzeń kasyna per połączenie (20/s), zapis JSON atomowy i z debounce.

**Struktura kodu kasyna**
```
casino/index.js               # fasada modułu (API używane przez gry)
casino/store.js               # portfele, statystyki, ustawienia, stan automatów (PostgreSQL / JSON)
casino/rtp.js                 # konfiguracja RTP ustawiana z panelu admina
casino/tracker.js             # faktyczne postawione/wypłacone AT$ per gra
casino/tables.js              # stałe stoły + stoły graczy
casino/games.js               # rejestr gier
casino/http.js                # API HTTP kasyna i panelu admina
casino/sockets.js             # sockety kasyna, limit zdarzeń, bezpieczne zamykanie
casino/simWorker.js           # symulacje RTP w osobnym wątku
lib/adminAuth.js              # logowanie admina (sesja, blokada prób)
games/casino/slot_engine.js   # wspólny silnik automatów (stawki, wypłaty, symulacja RTP)
games/casino/*.js             # logika poszczególnych gier
public/css/casino.css         # wygląd kasyna
public/js/casino-core.js      # lobby, helpery UI, wejście/wyjście ze stołów
public/js/casino-slotkit.js   # wspólny komponent UI automatów
public/js/casino-*.js         # interfejsy poszczególnych gier
public/js/admin-casino.js     # panel admina: RTP i statystyki kasyna
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
server.js              # serwer: pokoje gier, panel admina, socket.io
casino/                # kasyno AT$ (dane, RTP, stoły, API, sockety)
games/<gra>/index.js   # logika gier imprezowych (wisielec, quiz, szachy…)
games/casino/          # silniki gier kasyna i automatów
lib/                   # env, logowanie admina, sesje w bazie, serializacja pokoi
public/index.html      # znaczniki HTML i style strony
public/js/app/         # frontend gier imprezowych (core, gry, turniej, admin…)
public/js/casino-*.js  # frontend kasyna
public/css/            # casino.css, landscape.css (telefon w poziomie)
test/                  # testy (node:test) — npm test
scripts/check-syntax.js# sprawdzenie składni wszystkich plików — npm run lint
```

## 🧪 Testy
```bash
npm run lint   # składnia wszystkich plików JS
npm test       # RTP automatów (symulacje), matematyka gier, portfele, sesje, serializacja pokoi
```
GitHub Actions (`.github/workflows/ci.yml`) uruchamia oba przy każdym pushu.

## 🔐 Zmienne środowiskowe
| Zmienna | Opis |
|---|---|
| `DATABASE_URL` | PostgreSQL (Railway) — portfele, sesje, leaderboard, treści admina, ustawienia RTP |
| `ADMIN_PASSWORD` | hasło panelu admina (bez niego na produkcji panel jest wyłączony) |
| `SESSION_SECRET` | sekret sesji (bez niego serwer generuje losowy i zapisuje w bazie) |
| `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET`, `DISCORD_REDIRECT_URI` | logowanie przez Discord |
| `ALLOWED_ORIGINS` | dodatkowe domeny, z których wolno łączyć się z socket.io (po przecinku) |
