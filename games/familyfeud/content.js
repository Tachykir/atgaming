'use strict';
// Wielka baza pytań do Family Feud

function q(question, answers) { return { question, answers }; }
function a(text, aliases, points) { return { text, aliases: aliases || [], points }; }

module.exports = {
  general: {
    label: '🎯 Ogólne',
    questions: [
      q('Podaj popularne imię dla psa', [a('Burek',['burek'],35), a('Reksio',['reks'],25), a('Azor',[],18), a('Max',['maks'],12), a('Fafik',[],10)]),
      q('Co ludzie robią gdy nudzą się w domu?', [a('Oglądają TV',['tv','telewizja'],40), a('Grają w gry',['gry komputerowe'],25), a('Śpią',['spia','drzemka'],18), a('Jedzą',['jedza','przekaski'],10), a('Scrollują telefon',['telefon','social media'],7)]),
      q('Podaj kolor, który nie jest w tęczy', [a('Różowy',['rozowy'],35), a('Brązowy',['brazowy'],28), a('Czarny',[],20), a('Biały',['bialy'],10), a('Szary',[],7)]),
      q('Rzecz, którą zawsze gubisz w domu', [a('Klucze',['klucz'],42), a('Telefon',[],25), a('Okulary',[],18), a('Pilot',['pilot tv'],10), a('Skarpetki',[],5)]),
      q('Co robisz jako pierwsze rano?', [a('Patrzę w telefon',['telefon','sprawdzam telefon'],38), a('Idę do łazienki',['lazienka','mycie'],28), a('Piję kawę',['kawa','herbata'],20), a('Wstaję z łóżka',['wstaje'],10), a('Jem śniadanie',['sniadanie'],4)]),
      q('Najgorsza rzecz w pracy/szkole', [a('Wczesne wstawanie',['wczesnie wstac'],35), a('Trudny szef/nauczyciel',['szef','nauczyciel'],25), a('Monotonia',['nuda'],18), a('Konflikty z ludźmi',['kłótnie','problemy'],12), a('Dużo pracy',['za dużo pracy'],10)]),
      q('Podaj popularną aplikację na telefon', [a('TikTok',[],32), a('Instagram',[],28), a('WhatsApp',[],20), a('YouTube',[],12), a('Facebook',[],8)]),
      q('Co robisz przed snem?', [a('Oglądam telefon',['telefon','social media'],38), a('Oglądam serial',['serial','tv'],25), a('Czytam',['czytanie','ksiazka'],18), a('Słucham muzyki',['muzyka'],12), a('Modlę się',['modlitwa'],7)]),
      q('Ulubiona przekąska Polaków', [a('Chipsy',['chipsy','chips'],38), a('Słonecznik',['pestki'],22), a('Paluszki',[],18), a('Popcorn',[],12), a('Precle',[],10)]),
      q('Popularny sport w Polsce', [a('Piłka nożna',['pilka nozna','futbol'],42), a('Siatkówka',['siatkowka'],25), a('Koszykówka',['koszykowka'],15), a('Tenis',[],10), a('Lekkoatletyka',[],8)]),
      q('Co robiłbyś mając milion złotych?', [a('Kupił dom',['dom','mieszkanie'],35), a('Podróżował',['podroz','wakacje'],28), a('Zainwestował',['inwestycja','biznes'],18), a('Kupił samochód',['auto','samochod'],12), a('Oszczędzał',['oszczednosci'],7)]),
      q('Rzecz, którą ludzie kłamią w CV', [a('Języki obce',['angielski','jezyki'],38), a('Umiejętności',['skills','kompetencje'],25), a('Doświadczenie',['staż','lata pracy'],20), a('Hobby',[],12), a('Wykształcenie',[],5)]),
      q('Co robisz gdy masz wolne popołudnie?', [a('Gram w gry',['gry','gaming'],32), a('Oglądam filmy',['film','netflix'],25), a('Śpię',['drzemka','odpoczywam'],20), a('Wychodzę z przyjaciółmi',['znajomi','friends'],15), a('Ćwiczę',['cwiczenia','sport'],8)]),
      q('Powód dla którego nie odbierasz telefonu', [a('Jestem zajęty',['zajety'],35), a('Nie widzę kto dzwoni',['nieznany'],25), a('Nie chce mi się',['lenistwo'],22), a('Jestem w złym nastroju',['nastroj'],12), a('Głośność wyciszona',['cisza'],6)]),
      q('Co lubisz w weekendy?', [a('Długi sen',['spanie','sen'],38), a('Relaks w domu',['relaks'],22), a('Wyjście z ludźmi',['przyjaciele','bar'],18), a('Sport/ruch',['sport','bieganie'],12), a('Gotowanie',['kulinaria'],10)]),
    ],
  },

  food_drink: {
    label: '🍕 Jedzenie i napoje',
    questions: [
      q('Ulubiona kuchnia świata w Polsce', [a('Polska',['polskie jedzenie'],35), a('Włoska',['wloska','pizza pasta'],28), a('Azjatycka',['azja','chinska','japońska'],18), a('Meksykańska',['meksyk'],12), a('Amerykańska',['burger','fast food'],7)]),
      q('Co ludzie zamawiają na pizzę?', [a('Ser',['mozzarella','ser'],35), a('Salami/pepperoni',['pepperoni','kielbasa'],28), a('Szynka',['szynka ham'],20), a('Pieczarki',['grzyby'],10), a('Oliwki',[],7)]),
      q('Bez czego nie możesz żyć (jedzenie)?', [a('Kawa',['kawa'],35), a('Chleb',[],25), a('Mięso',['mieso'],18), a('Czekolada',[],12), a('Mleko/nabiał',['nabiał'],10)]),
      q('Co zamawiasz w restauracji?', [a('Schabowy',[],32), a('Pierogi',[],25), a('Stek',[],20), a('Makaron/pasta',['pasta'],15), a('Sałatka',[],8)]),
      q('Napój w których Polacy piją najwięcej?', [a('Kawa',['kawa'],38), a('Herbata',['herbata'],28), a('Piwo',['piwo'],18), a('Woda',['woda mineralna'],12), a('Sok',[],4)]),
      q('Co gotuje się za długo?', [a('Zupa',['rosol'],35), a('Bigos',[],25), a('Żebro/żeberka',['zeberka','mięso'],20), a('Kasza',[],12), a('Pierogi',[],8)]),
      q('Najsmaczniejszy deser?', [a('Lody',['lody'],35), a('Ciasto czekoladowe',['czekolada'],25), a('Sernik',[],18), a('Naleśniki',[],12), a('Tiramisu',[],10)]),
      q('Najpopularniejszy fast food w Polsce?', [a('McDonald\'s',['mcdonalds','mac'],40), a('KFC',[],25), a('Burger King',['bk'],15), a('Kebab',[],12), a('Pizza Hut',[],8)]),
      q('Co jesz na śniadanie?', [a('Kanapki',['chleb z maslem'],35), a('Jajecznica',['jajka'],25), a('Płatki zbożowe',['platki'],18), a('Owsianka',[],12), a('Twarożek',['serek'],10)]),
      q('Owoc, który lubisz najbardziej', [a('Truskawka',['truskawki'],32), a('Jabłko',['jablko'],28), a('Banan',[],18), a('Mango',[],12), a('Winogrono',['winogrona'],10)]),
    ],
  },

  lifestyle: {
    label: '🏠 Styl życia',
    questions: [
      q('Gdzie spędzasz urlop?', [a('Morze/plaża',['morze','plaz'],38), a('Góry',['gory'],25), a('Zagranica',['zagraniczne wakacje'],18), a('W domu',['dom','staycation'],12), a('Jeziora',['mazury'],7)]),
      q('Ulubiony gatunek muzyki', [a('Pop',[],32), a('Rock',[],22), a('Hip-hop/Rap',['hip hop','rap'],18), a('Elektroniczna',['edm','techno','house'],15), a('Klasyczna',[],13)]),
      q('Co lubisz w kinie?', [a('Akcja',['film akcji'],35), a('Komedia',[],25), a('Horror',[],18), a('Dramat',[],12), a('Sci-fi',['scifi'],10)]),
      q('Jak wydajesz wolny czas?', [a('Social media',['instagram','tiktok'],38), a('Granie w gry',['gry'],22), a('Czytanie',[],18), a('Sport',[],12), a('Gotowanie',[],10)]),
      q('Dlaczego ludzie nie śpią w nocy?', [a('Telefon',['scrollowanie'],38), a('Myśli/stres',['stres','myślenie'],25), a('Serial',['netflix','ogladanie'],18), a('Kawę za późno',['kawa'],12), a('Hałas',[],7)]),
      q('Ulubiony rodzaj filmów?', [a('Komedie',['komedia'],32), a('Filmy akcji',['akcja'],25), a('Horrory',['horror'],18), a('Dramaty',['dramat'],15), a('Animacje',[],10)]),
      q('Co robisz gdy masz zły dzień?', [a('Jem coś smacznego',['jedze','comfort food'],35), a('Słucham muzyki',['muzyka'],25), a('Śpię',['odpoczynam'],20), a('Dzwonię do przyjaciela',['dzwonie','rozmawiam'],12), a('Płaczę',['placze'],8)]),
      q('Co sprawia, że jesteś szczęśliwy?', [a('Rodzina',['bliscy'],38), a('Pieniądze',[],22), a('Miłość',['partner','zwiazek'],18), a('Zdrowie',[],12), a('Praca/kariera',[],10)]),
      q('Jaką muzykę słuchasz w samochodzie?', [a('Radio',['stacja'],35), a('Spotify/playlist',['spotify','playlisty'],28), a('Podcasty',[],18), a('Audiobook',[],12), a('Cisza',[],7)]),
      q('Ulubione hobby Polaków?', [a('Gotowanie',['kulinaria'],30), a('Sport/siłownia',['cwiczenia'],25), a('Gaming/gry',['gry'],20), a('Czytanie',['ksiazki'],15), a('Ogrodnictwo',[],10)]),
    ],
  },

  technology: {
    label: '💻 Technologia',
    questions: [
      q('Pierwsza aplikacja którą otwierasz rano?', [a('Instagram',[],32), a('WhatsApp',['wiadomosci'],25), a('TikTok',[],18), a('YouTube',[],15), a('SMS/Telefon',['sms'],10)]),
      q('Bez czego nie możesz wyjść z domu?', [a('Telefon',[],55), a('Klucze',[],22), a('Portfel',['karta'],15), a('Słuchawki',[],5), a('Powerbank',[],3)]),
      q('Ulubiona platforma streamingowa?', [a('Netflix',[],42), a('YouTube',[],25), a('Disney+',[],15), a('HBO Max',['max'],12), a('Prime Video',['amazon'],6)]),
      q('Co robiłbyś bez internetu?', [a('Nudził się',['nudze sie'],35), a('Czytał książki',['czytanie'],25), a('Był bardziej produktywny',['praca','productywnosc'],18), a('Wyszedł do ludzi',['kontakty'],12), a('Rozmawiał przez telefon',['telefon'],10)]),
      q('Najpopularniejsza wyszukiwarka?', [a('Google',[],85), a('Bing',[],8), a('DuckDuckGo',[],4), a('Yahoo',[],2), a('Inne',[],1)]),
      q('Co kupujesz online najczęściej?', [a('Ubrania/buty',['odziez','buty'],38), a('Elektronika',['sprzet'],25), a('Książki',[],18), a('Jedzenie',['zakupy spozywcze'],12), a('Kosmetyki',[],7)]),
      q('Który portal społecznościowy jest najpopularniejszy?', [a('Facebook',[],35), a('Instagram',[],28), a('TikTok',[],20), a('YouTube',[],12), a('Twitter/X',['twitter','x'],5)]),
      q('Co cię irytuje w technologii?', [a('Rozładowany telefon',['bateria'],38), a('Wolny internet',['laguje'],25), a('Spam/reklamy',['reklamy','spam'],18), a('Brak zasięgu',['zasieg'],12), a('Aktualizacje',['update'],7)]),
    ],
  },

  nature_animals: {
    label: '🐾 Zwierzęta i natura',
    questions: [
      q('Ulubione zwierzę domowe Polaków?', [a('Pies',[],48), a('Kot',[],35), a('Rybki',[],8), a('Chomik',[],5), a('Królik',[],4)]),
      q('Czego boisz się w naturze?', [a('Pająki',[],38), a('Węże',[],25), a('Burza',[],18), a('Psy/duże zwierzęta',['psy'],12), a('Ciemność/las nocą',['ciemnosc'],7)]),
      q('Ulubione zwierzę egzotyczne?', [a('Lew',[],32), a('Tygrys',[],22), a('Delfin',[],18), a('Goryl',[],15), a('Orka',[],13)]),
      q('Najpiękniejszy kwiat?', [a('Róża',[],42), a('Tulipan',[],22), a('Orchidea',[],18), a('Słonecznik',[],10), a('Lilia',[],8)]),
      q('Co lubisz robić w naturze?', [a('Spacer',['chodzic','marsz'],38), a('Grzybobranie',[],25), a('Biwak',['camping'],18), a('Piknik',[],12), a('Wspinaczka',['wspinanie'],7)]),
      q('Najniebezpieczniejsze zwierzę?', [a('Komar',[],35), a('Rekin',[],25), a('Lew',['zwierz lądowy'],18), a('Wąż jadowity',['waz'],12), a('Pająk',[],10)]),
      q('Ulubiona pora roku?', [a('Lato',[],45), a('Wiosna',[],28), a('Jesień',['jesien'],18), a('Zima',[],9)]),
      q('Co jest najpiękniejsze w naturze?', [a('Zachód słońca',['zachod slonca'],38), a('Góry',[],22), a('Morze/ocean',['morze'],18), a('Las',[],12), a('Wodospad',[],10)]),
    ],
  },

  polska: {
    label: '🇵🇱 Polska',
    questions: [
      q('Najpopularniejsze miasto w Polsce poza Warszawą?', [a('Kraków',['krakow'],42), a('Gdańsk',['gdansk'],22), a('Wrocław',['wroclaw'],18), a('Poznań',['poznan'],12), a('Łódź',['lodz'],6)]),
      q('Ulubione polskie jedzenie?', [a('Pierogi',[],42), a('Bigos',[],22), a('Żurek',[],15), a('Schabowy',[],12), a('Kiełbasa',[],9)]),
      q('Znany Polak na świecie?', [a('Kopernik',[],35), a('Chopin',[],28), a('Jan Paweł II',['jp2','papież'],20), a('Marie Curie',['maria curie'],12), a('Lech Wałęsa',['walesa'],5)]),
      q('Rzecz, którą Polacy lubią narzekać?', [a('Pogoda',[],35), a('Polityka',['rzad'],28), a('Ceny',[],18), a('Kolejki',['urzedy'],12), a('Drogi',[],7)]),
      q('Gdzie w Polsce warto pojechać?', [a('Tatry',['gory','zakopane'],35), a('Kraków',['krakow'],25), a('Mazury',[],18), a('Trójmiasto',['gdansk','sopot'],12), a('Wrocław',['wroclaw'],10)]),
      q('Polskie tradycje na Święta Bożego Narodzenia?', [a('Choinka',[],35), a('Wigilia',['kolacja'],25), a('Kolędy',[],18), a('Prezenty',[],12), a('Karp',[],10)]),
      q('Co Polacy piją na imprezach?', [a('Piwo',[],42), a('Wódka',[],28), a('Wino',[],18), a('Gin tonic',['gin'],8), a('Nalewka',[],4)]),
      q('Ulubiony serial polski?', [a('Klan',[],28), a('M jak Miłość',['m jak milosc'],25), a('Na Wspólnej',['wspolna'],18), a('1670',[],15), a('Belfer',[],14)]),
    ],
  },

  sport: {
    label: '⚽ Sport',
    questions: [
      q('Ulubiony sport Polaków?', [a('Piłka nożna',['futbol'],42), a('Siatkówka',[],25), a('Skoki narciarskie',['skoki'],15), a('Tenis',[],10), a('Lekkoatletyka',[],8)]),
      q('Najbardziej irytuje w sporcie?', [a('Kontrowersyjne decyzje sędziów',['sed','sewdzia'],38), a('Drogi bilet',[],22), a('Przegrana ulubionej drużyny',['przegrana'],18), a('Hałas',['krzyki'],12), a('Transfer ulubionego zawodnika',['transfer'],10)]),
      q('Kto jest najlepszym piłkarzem wszech czasów?', [a('Messi',[],42), a('Ronaldo',['cr7'],38), a('Pelé',[],12), a('Maradona',[],5), a('Zidane',[],3)]),
      q('Ulubiona dyscyplina zimowa?', [a('Narty',['narciarstwo'],42), a('Skoki narciarskie',['skoki'],25), a('Snowboard',[],15), a('Łyżwy',[],10), a('Biathlon',[],8)]),
      q('Ulubiony klub sportowy w Polsce?', [a('Legia Warszawa',['legia'],32), a('Lech Poznań',['lech'],22), a('Wisła Kraków',['wisla krakow'],15), a('Górnik Zabrze',['gornik'],12), a('Cracovia',[],9)]),
      q('Co sprawia że sport jest fajny?', [a('Emocje',['dreszczyk'],38), a('Rywalizacja',[],25), a('Wspólne kibicowanie',['kibicowanie'],18), a('Kondycja fizyczna',['sport wyczynowy'],12), a('Zarobki zawodników',[],7)]),
      q('Co ogląda się w TV sportowym?', [a('Liga Mistrzów',['lm','champions league'],35), a('Premier League',['epl','anglia'],25), a('Skoki',['skoki narciarskie'],18), a('Formuła 1',['f1'],12), a('Siatkówka',[],10)]),
    ],
  },

  school_work: {
    label: '📚 Szkoła i praca',
    questions: [
      q('Ulubiony przedmiot szkolny?', [a('WF',['wychowanie fizyczne'],35), a('Matematyka',[],22), a('Historia',[],18), a('Biologia',[],12), a('Plastyka',[],13)]),
      q('Najgorszy przedmiot szkolny?', [a('Matematyka',[],35), a('Chemia',[],22), a('Fizyka',[],18), a('Łacina',[],15), a('Polski',[],10)]),
      q('Co robisz gdy masz dużo pracy?', [a('Prokrastynuję',['odwlekam','prokrastynacja'],38), a('Pracuję w nocy',['noc'],22), a('Robię listę zadań',['lista'],18), a('Proszę o pomoc',[],12), a('Rezygnuję z czegoś',[],10)]),
      q('Ulubiony rodzaj pracy?', [a('Zdalna',['home office','praca zdalna'],42), a('Hybrydowa',[],28), a('W biurze',[],18), a('Freelance',[],8), a('Własna firma',[],4)]),
      q('Co irytuje w szkole?', [a('Wczesne wstawanie',['rano'],38), a('Zadania domowe',['praca domowa'],25), a('Nieprzyjemni nauczyciele',['nauczyciel'],18), a('Klasówki/egzaminy',['testy'],12), a('Długie godziny',[],7)]),
      q('Co motywuje do pracy?', [a('Pieniądze',['wynagrodzenie','pieniadze'],42), a('Pasja',[],22), a('Rozwój zawodowy',['awans'],18), a('Atmosfera',[],12), a('Misja firmy',[],6)]),
    ],
  },
};
