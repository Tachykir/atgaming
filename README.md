# 🎮 GameNight — Multiplayer Games

Platforma gier multiplayer (Wisielec, Quiz) z Socket.io.

## Gry
- 🪓 **Wisielec** — zgaduj litery na zmianę z innymi graczami
- 🧠 **Quiz** — szybkie pytania, punkty za refleks i poprawną odpowiedź

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
