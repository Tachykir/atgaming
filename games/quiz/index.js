/**
 * ═══════════════════════════════════════════
 *  MODUŁ GRY: QUIZ
 *  Plik: games/quiz/index.js
 * ═══════════════════════════════════════════
 */

module.exports = {
  meta: {
    id: 'quiz',
    name: 'Quiz',
    icon: '🧠',
    description: 'Szybkie pytania, punkty za refleks',
    color: '#7c5cfc',
    minPlayers: 1,
    maxPlayers: 8,
    supportsGameMaster: false,
    configSchema: {
      maxPlayers:   { type: 'number', label: 'Maks. graczy',     min: 2, max: 20, default: 8 },
      rounds:       { type: 'number', label: 'Liczba pytań',     min: 3, max: 20, default: 8 },
      questionTime: { type: 'number', label: 'Czas na pytanie (s)', min: 5, max: 60, default: 15 },
    },
  },

  defaultContent: {
    general: {
      label: '🌐 Ogólna wiedza',
      easy: [
        { question: 'Stolica Polski?', answers: ['Warszawa','Kraków','Gdańsk','Wrocław'], correct: 0, points: 100 },
        { question: 'Ile planet ma Układ Słoneczny?', answers: ['7','8','9','10'], correct: 1, points: 100 },
        { question: 'Ile bitów ma 1 bajt?', answers: ['4','8','16','32'], correct: 1, points: 100 },
        { question: 'Jakiego koloru jest morze?', answers: ['Zielonego','Niebieskiego','Czerwonego','Czarnego'], correct: 1, points: 100 },
        { question: 'Ile godzin ma doba?', answers: ['12','20','24','48'], correct: 2, points: 100 },
        { question: 'Stolica Francji?', answers: ['Lyon','Marsylia','Paryż','Bordeaux'], correct: 2, points: 100 },
        { question: 'Ile dni ma tydzień?', answers: ['5','6','7','8'], correct: 2, points: 100 },
        { question: 'Jaki kolor uzyskamy mieszając żółty i niebieski?', answers: ['Fioletowy','Zielony','Pomarańczowy','Brązowy'], correct: 1, points: 100 },
        { question: 'Ile miesięcy ma rok?', answers: ['10','11','12','13'], correct: 2, points: 100 },
        { question: 'Największy ocean świata?', answers: ['Atlantyk','Indyjski','Arktyczny','Spokojny'], correct: 3, points: 100 },
      ],
      medium: [
        { question: 'Rok założenia Google?', answers: ['1994','1996','1998','2000'], correct: 2, points: 200 },
        { question: 'Najdłuższa rzeka świata?', answers: ['Amazonka','Nil','Jangcy','Missisipi'], correct: 1, points: 200 },
        { question: 'Rok lądowania na księżycu?', answers: ['1965','1967','1969','1971'], correct: 2, points: 200 },
        { question: 'Autor Pana Tadeusza?', answers: ['Słowacki','Mickiewicz','Norwid','Krasicki'], correct: 1, points: 200 },
        { question: 'W którym roku Polska wstąpiła do UE?', answers: ['2000','2002','2004','2006'], correct: 2, points: 200 },
        { question: 'Najwyższy szczyt świata?', answers: ['K2','Kangchenjunga','Mount Everest','Lhotse'], correct: 2, points: 200 },
        { question: 'Kto napisał "Hamlet"?', answers: ['Dickens','Szekspir','Molière','Cervantes'], correct: 1, points: 200 },
        { question: 'Ile kości ma ludzki szkielet?', answers: ['186','206','226','246'], correct: 1, points: 200 },
        { question: 'Co oznacza skrót HTML?', answers: ['HyperText Markup Language','HighTech Machine Learning','HyperTransfer Meta Link','HyperText Media Language'], correct: 0, points: 200 },
        { question: 'Gdzie urodził się Napoleon?', answers: ['Francja','Włochy','Korsyka','Sardynia'], correct: 2, points: 200 },
      ],
      hard: [
        { question: 'Kto namalował Monę Lisę?', answers: ['Michał Anioł','Rembrandt','Da Vinci','Picasso'], correct: 2, points: 300 },
        { question: 'Symbol chemiczny złota?', answers: ['Go','Gd','Au','Ag'], correct: 2, points: 300 },
        { question: 'Rok urodzenia Mikołaja Kopernika?', answers: ['1453','1473','1493','1513'], correct: 1, points: 300 },
        { question: 'Ile wynosi liczba Avogadro (w przybliżeniu)?', answers: ['6.02×10²²','6.02×10²³','6.02×10²⁴','6.02×10²⁵'], correct: 1, points: 300 },
        { question: 'Który kraj ma największą liczbę ludności?', answers: ['Indie','USA','Chiny','Indonezja'], correct: 0, points: 300 },
        { question: 'Co to jest osmoza?', answers: ['Ruch elektronów','Przenikanie wody przez półprzepuszczalną membranę','Spalanie węgla','Rozkład białek'], correct: 1, points: 300 },
        { question: 'Stolica Australii?', answers: ['Sydney','Melbourne','Brisbane','Canberra'], correct: 3, points: 300 },
        { question: 'Rok wybuchu I Wojny Światowej?', answers: ['1910','1912','1914','1916'], correct: 2, points: 300 },
      ],
    },
    science: {
      label: '🔬 Nauka',
      easy: [
        { question: 'Symbol chemiczny wody?', answers: ['HO','H2O','OH2','H3O'], correct: 1, points: 100 },
        { question: 'Przybliżone g na Ziemi?', answers: ['7.8','9.8','11.2','6.7'], correct: 1, points: 100 },
        { question: 'Ile zmysłów ma człowiek (tradycyjnie)?', answers: ['3','4','5','6'], correct: 2, points: 100 },
        { question: 'Co robi fotosynteza?', answers: ['Trawi pokarm','Przetwarza światło w energię','Pompuje krew','Filtruje powietrze'], correct: 1, points: 100 },
        { question: 'Najszybsze zwierzę lądowe?', answers: ['Lew','Gepard','Antylopa','Koń'], correct: 1, points: 100 },
        { question: 'Z czego składa się woda?', answers: ['Wodór i tlen','Węgiel i tlen','Azot i tlen','Wodór i azot'], correct: 0, points: 100 },
        { question: 'Ile serce człowieka bije razy na minutę (średnio)?', answers: ['40-50','60-80','100-120','140-160'], correct: 1, points: 100 },
      ],
      medium: [
        { question: 'Ile chromosomów ma człowiek?', answers: ['23','44','46','48'], correct: 2, points: 200 },
        { question: 'Prędkość światła to około?', answers: ['200 000 km/s','300 000 km/s','400 000 km/s','500 000 km/s'], correct: 1, points: 200 },
        { question: 'Kto sformułował teorię ewolucji?', answers: ['Newton','Pasteur','Darwin','Mendel'], correct: 2, points: 200 },
        { question: 'Ile protonów ma atom węgla?', answers: ['4','6','8','12'], correct: 1, points: 200 },
        { question: 'Co to jest DNA?', answers: ['Rodzaj białka','Kwas dezoksyrybonukleinowy','Lipid komórkowy','Enzym trawienny'], correct: 1, points: 200 },
        { question: 'Który narząd produkuje insulinę?', answers: ['Wątroba','Nerki','Trzustka','Żołądek'], correct: 2, points: 200 },
        { question: 'Masa atomowa tlenu?', answers: ['8','14','16','18'], correct: 2, points: 200 },
        { question: 'Ile wynosi pH wody destylowanej?', answers: ['5','6','7','8'], correct: 2, points: 200 },
      ],
      hard: [
        { question: 'Kto odkrył penicylinę?', answers: ['Pasteur','Curie','Fleming','Koch'], correct: 2, points: 300 },
        { question: 'Który pierwiastek ma symbol Fe?', answers: ['Fluorek','Fosfor','Żelazo','Ferm'], correct: 2, points: 300 },
        { question: 'Co to jest kwasar?', answers: ['Rodzaj komety','Aktywne jądro galaktyki','Czarna dziura','Gwiazda neutronowa'], correct: 1, points: 300 },
        { question: 'Kto odkrył radioaktywność?', answers: ['Einstein','Curie','Becquerel','Bohr'], correct: 2, points: 300 },
        { question: 'Ile wynosi stała Plancka (h) w przybliżeniu?', answers: ['6.63×10⁻³²','6.63×10⁻³⁴','6.63×10⁻³⁶','6.63×10⁻³⁰'], correct: 1, points: 300 },
        { question: 'Co to jest mitoza?', answers: ['Podział komórki z wymianą genów','Prosty podział komórki','Synteza białka','Rozpad ATP'], correct: 1, points: 300 },
      ],
    },
    sports: {
      label: '⚽ Sport',
      easy: [
        { question: 'Ile graczy w drużynie piłkarskiej?', answers: ['9','10','11','12'], correct: 2, points: 100 },
        { question: 'W ilu setach gra się w siatkówce (do wygrania)?', answers: ['2','3','4','5'], correct: 1, points: 100 },
        { question: 'Jak zdobywa się punkty w boksie?', answers: ['Gole','Nokauty i punkty','Kosze','Trójki'], correct: 1, points: 100 },
        { question: 'Ile zawodników gra w koszykówce (na boisku)?', answers: ['4','5','6','7'], correct: 1, points: 100 },
        { question: 'Gdzie jest siedziba FIFA?', answers: ['Paryż','Londyn','Zurych','Rzym'], correct: 2, points: 100 },
      ],
      medium: [
        { question: 'Gdzie odbyły się Igrzyska 2020?', answers: ['Pekin','Paryż','Tokio','Rio'], correct: 2, points: 200 },
        { question: 'Kto zdobył największą liczbę złotych medali olimpijskich?', answers: ['Phelps','Bolt','Lewis','Spitz'], correct: 0, points: 200 },
        { question: 'Jak nazywa się najważniejszy turniej tenisowy?', answers: ['Davis Cup','Wimbledon','Roland Garros','US Open'], correct: 1, points: 200 },
        { question: 'Ile pól ma szachownica?', answers: ['48','56','64','72'], correct: 2, points: 200 },
        { question: 'Gdzie odbyły się Igrzyska 2024?', answers: ['Londyn','Paryż','Los Angeles','Tokyo'], correct: 1, points: 200 },
        { question: 'Kto wygrał Roland Garros mężczyzn 2023?', answers: ['Djokovic','Alcaraz','Nadal','Tsitsipas'], correct: 0, points: 200 },
      ],
      hard: [
        { question: 'Kto wygrał MŚ 2022?', answers: ['Francja','Brazylia','Argentyna','Niemcy'], correct: 2, points: 300 },
        { question: 'Rekord świata na 100m (mężczyźni)?', answers: ['9.58 s','9.72 s','9.81 s','9.94 s'], correct: 0, points: 300 },
        { question: 'Który klub wygrał Ligę Mistrzów 2023?', answers: ['Bayern','PSG','Man City','Real Madryt'], correct: 2, points: 300 },
        { question: 'Ile medali zdobyła Polska na IO 1980 w Moskwie?', answers: ['20','28','32','38'], correct: 2, points: 300 },
      ],
    },
    movies: {
      label: '🎬 Filmy',
      easy: [
        { question: 'W którym filmie gra hobbit Frodo?', answers: ['Hobbit','Władca Pierścieni','Narnia','Gwiezdne Wojny'], correct: 1, points: 100 },
        { question: 'Kto gra Tonyego Starka / Iron Mana?', answers: ['Chris Evans','Chris Hemsworth','Robert Downey Jr.','Mark Ruffalo'], correct: 2, points: 100 },
        { question: 'Jak nazywa się słynny rekin z filmu z 1975?', answers: ['Shark','Jaws','Bite','Fin'], correct: 1, points: 100 },
        { question: '"Niech Moc będzie z tobą" — z jakiego to filmu?', answers: ['Star Trek','Avatar','Star Wars','Dune'], correct: 2, points: 100 },
        { question: 'Kto reżyserował Harrrego Pottera (pierwsze filmy)?', answers: ['Spielberg','Columbus','Cuaron','Yates'], correct: 1, points: 100 },
      ],
      medium: [
        { question: 'Który film zdobył Oscara za najlepszy film 2023?', answers: ['Tár','Elvis','All Quiet on the Western Front','Everything Everywhere All at Once'], correct: 3, points: 200 },
        { question: 'Ile filmów ma trylogia Ojca Chrzestnego?', answers: ['2','3','4','5'], correct: 1, points: 200 },
        { question: 'Kto zagrał Jokera w filmie z 2019?', answers: ['Heath Ledger','Joaquin Phoenix','Jack Nicholson','Jared Leto'], correct: 1, points: 200 },
        { question: 'W którym roku premierę miał Titanic?', answers: ['1995','1997','1999','2001'], correct: 1, points: 200 },
        { question: 'Kto zreżyserował Interstellar?', answers: ['Spielberg','Nolan','Scott','Villeneuve'], correct: 1, points: 200 },
      ],
      hard: [
        { question: 'Kto zagrał główną rolę w "Milczeniu owiec"?', answers: ['Meryl Streep','Julia Roberts','Jodie Foster','Glenn Close'], correct: 2, points: 300 },
        { question: 'Który film Kubricka jest adaptacją powieści Stephena Kinga?', answers: ['2001: Odyseja Kosmiczna','Lśnienie','Full Metal Jacket','Mechaniczna Pomarańcza'], correct: 1, points: 300 },
        { question: 'Ile filmów Bonda powstało przed Danielem Craigiem?', answers: ['18','20','21','23'], correct: 2, points: 300 },
      ],
    },
    it: {
      label: '💻 Technologia',
      easy: [
        { question: 'Co znaczy CPU?', answers: ['Central Power Unit','Central Processing Unit','Computer Processing Unit','Core Program Unit'], correct: 1, points: 100 },
        { question: 'Jaki system OS robi Apple?', answers: ['Linux','Windows','macOS','Android'], correct: 2, points: 100 },
        { question: 'Co to jest RAM?', answers: ['Pamięć masowa','Pamięć operacyjna','Procesor','Karta graficzna'], correct: 1, points: 100 },
        { question: 'Co to jest URL?', answers: ['Adres internetowy','Format pliku','Rodzaj bazy danych','Protokół sieciowy'], correct: 0, points: 100 },
        { question: 'Ile bitów ma adres IPv4?', answers: ['8','16','32','64'], correct: 2, points: 100 },
      ],
      medium: [
        { question: 'W jakim roku powstał Python?', answers: ['1985','1989','1991','1995'], correct: 2, points: 200 },
        { question: 'Co to jest API?', answers: ['Aplikacja','Interfejs programistyczny','Algorytm','Protokół'], correct: 1, points: 200 },
        { question: 'Kto stworzył Linux?', answers: ['Gates','Torvalds','Ritchie','Stallman'], correct: 1, points: 200 },
        { question: 'Ile bitów ma adres IPv6?', answers: ['64','96','128','256'], correct: 2, points: 200 },
        { question: 'Co oznacza CSS?', answers: ['Computer Style Sheets','Cascading Style Sheets','Creative Style System','Core Style Syntax'], correct: 1, points: 200 },
        { question: 'Jaka jest złożoność Quicksort (średnia)?', answers: ['O(n)','O(n log n)','O(n²)','O(log n)'], correct: 1, points: 200 },
      ],
      hard: [
        { question: 'Co to jest CAP theorem?', answers: ['Teoria procesorów','Consistency, Availability, Partition tolerance','Cryptographic Algorithm Protocol','Cache-Aside Pattern'], correct: 1, points: 300 },
        { question: 'Który protokół używa port 443?', answers: ['HTTP','FTP','HTTPS','SSH'], correct: 2, points: 300 },
        { question: 'Co to jest deadlock?', answers: ['Błąd pamięci','Zakleszczenie procesów','Przepełnienie bufora','Nieskończona pętla'], correct: 1, points: 300 },
        { question: 'Który algorytm haszowania jest bezpieczny w 2024?', answers: ['MD5','SHA-1','SHA-256','CRC32'], correct: 2, points: 300 },
      ],
    },
    history: {
      label: '📜 Historia',
      easy: [
        { question: 'W którym roku wybuchła II Wojna Światowa?', answers: ['1935','1937','1939','1941'], correct: 2, points: 100 },
        { question: 'Kto był pierwszym prezydentem USA?', answers: ['Lincoln','Jefferson','Washington','Adams'], correct: 2, points: 100 },
        { question: 'W którym roku upadł mur berliński?', answers: ['1985','1987','1989','1991'], correct: 2, points: 100 },
        { question: 'Kto był władcą Egiptu?', answers: ['Cesarz','Faraon','Król','Sułtan'], correct: 1, points: 100 },
        { question: 'Gdzie stacjonowała armia Aleksandra Wielkiego?', answers: ['Rzym','Macedonia','Sparta','Ateny'], correct: 1, points: 100 },
      ],
      medium: [
        { question: 'Polska odzyskała niepodległość w roku?', answers: ['1916','1918','1920','1922'], correct: 1, points: 200 },
        { question: 'Kto był ostatnim carem Rosji?', answers: ['Aleksander II','Aleksander III','Mikołaj II','Piotr I'], correct: 2, points: 200 },
        { question: 'W którym roku odkryto Amerykę?', answers: ['1392','1492','1592','1692'], correct: 1, points: 200 },
        { question: 'Gdzie podpisano traktat wersalski?', answers: ['Berlin','Londyn','Wersal','Paryż'], correct: 2, points: 200 },
        { question: 'Kto był przywódcą ZSRR podczas II WŚ?', answers: ['Lenin','Trocki','Stalin','Chruszczow'], correct: 2, points: 200 },
      ],
      hard: [
        { question: 'W którym roku miała miejsce rewolucja francuska?', answers: ['1779','1789','1799','1809'], correct: 1, points: 300 },
        { question: 'Jak nazywało się pierwsze polskie królestwo?', answers: ['Piastowie','Królestwo Polskie','Polska Piastowska','Królestwo Gniezno'], correct: 0, points: 300 },
        { question: 'Kto był przywódcą Hunów?', answers: ['Czyngis-chan','Attyla','Tamerlane','Batu-chan'], correct: 1, points: 300 },
        { question: 'W którym roku zakończono budowę Wielki Mur Chiński?', answers: ['1368','1449','1644','1878'], correct: 2, points: 300 },
      ],
    },
  },

  createState(config) {
    return {
      questions: [],
      currentQuestion: 0,
      answeredPlayers: [],
      questionTimer: null,
    };
  },

  onStart({ room, content, io, helpers }) {
    const gs = room.gameState;
    const cat = content[room.config.category] || Object.values(content)[0];
    const pool = cat[room.config.difficulty] || cat.medium || [];
    const numQ = Math.min(Number(room.config.rounds) || 8, pool.length || 8);
    gs.questions = [...pool].sort(() => Math.random() - 0.5).slice(0, numQ);

    if (!gs.questions.length) {
      return helpers.emitError(room.id, 'Brak pytań w tej kategorii! Dodaj pytania w panelu admina.');
    }

    gs.currentQuestion = 0;
    gs.answeredPlayers = [];
    io.to(room.id).emit('gameStarted', { room });
    helpers.startQuizQuestion(room.id);
  },

  onEvent({ event, data, socket, room, io, helpers }) {
    if (event === 'quizAnswer') return _quizAnswer({ data, socket, room, io, helpers });
  },
};

function _quizAnswer({ data, socket, room, io, helpers }) {
  const gs = room.gameState;
  if (room.status !== 'playing') return;
  if (gs.answeredPlayers.includes(socket.id)) return;

  gs.answeredPlayers.push(socket.id);
  const q = gs.questions[gs.currentQuestion];
  const pi = room.players.findIndex(p => p.id === socket.id);

  if (data.answerIndex === q.correct) {
    const bonus = Math.max(0, 3 - gs.answeredPlayers.length) * 50;
    room.players[pi].score += q.points + bonus;
    socket.emit('answerResult', { correct: true, points: q.points + bonus });
  } else {
    socket.emit('answerResult', { correct: false, points: 0 });
  }

  io.to(room.id).emit('playerAnswered', {
    playerName: room.players[pi]?.name,
    answeredCount: gs.answeredPlayers.length,
    totalPlayers: room.players.length,
  });

  if (gs.answeredPlayers.length === room.players.length) {
    clearTimeout(gs.questionTimer);
    helpers.endQuizQuestion(room.id);
  }
}
