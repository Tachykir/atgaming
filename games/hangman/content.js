'use strict';
// Ogromna baza słów do wisielca — tysiące haseł w wielu kategoriach

module.exports = {
  it: {
    label: '💻 IT / Programowanie',
    easy:   ['baza','serwer','petla','obiekt','klasa','zmienna','tablica','modul','warunek','blad','plik','okno','siec','host','port','dane','kurs','test','link','kod'],
    medium: ['javascript','komputer','algorytm','monitor','procesor','internet','klawiatura','programista','framework','debugger','interfejs','protokol','terminal','middleware','typescript','deployment','kubernetes','postgresql','microservice','repository'],
    hard:   ['programowanie','reaktywny','asynchroniczny','mikroserwis','refaktoryzacja','dekompilator','wielowatkowosc','polimorfizm','hermetyzacja','abstrakcja','dziedziczenie','enkapsulacja','architektura','implementacja','infrastruktura','konfiguracja','optymalizacja','konteneryzacja','orchestracja','automatyzacja'],
  },
  geography: {
    label: '🌍 Geografia',
    easy:   ['polska','morze','rzeka','miasto','europa','ocean','pustynia','wyspa','jezioro','wulkan','gora','kraj','las','pole','niebo','zima','lato','wiosna','jesien','deszcz'],
    medium: ['warszawa','kontynent','rownikowy','himalaje','atlantyk','sahara','amazonka','antarktyda','madagaskar','skandynawia','kaukaz','karaiby','patagonia','serengeti','kilimandżaro','stambul','singapur','melbourne','toronto','nairobi'],
    hard:   ['mezopotamia','geograficzny','archipelag','demograficzny','subsahara','transsyberia','katmandu','wenezuela','mozambik','kazachstan','uzbekistan','turkmenia','tadżykistan','kirgistan','azerbejdżan','gruzja','armenia','bułgaria','macedonii','chorwacja'],
  },
  animals: {
    label: '🐾 Zwierzęta',
    easy:   ['kot','pies','ryba','kon','kura','koza','wilk','zaba','orzel','bocian','lis','mis','byk','kret','karp','gad','ptak','mrówka','waz','slon'],
    medium: ['jelen','pingwin','delfin','gepard','krokodyl','flaming','kangur','strus','hipopotam','mandryl','goryl','szympans','orangutan','tapir','kałamarz','bawol','krewetka','rekin','meduza','ryjówka'],
    hard:   ['kameleon','salamandra','axolotl','mantaraja','jaguarundi','pantera','niedźwiedź','słoń morski','morswin','łasica','tchórz','wydra','borsuk','jenot','norka','piżmak','wiewiórka','popielica','orzesznica','okapi'],
  },
  sports: {
    label: '⚽ Sport',
    easy:   ['pilka','gol','bieg','skok','mecz','kort','basen','slalom','sprint','rekord','tenis','golf','boks','narty','lyzwy','rower','wioslo','start','meta','puchar'],
    medium: ['koszykowka','siatkowka','plywanie','szermierka','gimnastyka','lekkoatletyka','snowboard','triathlon','pentathlon','kolarstwo','wioslowanie','kajakarstwo','judo','taekwondo','sambo','kickboxing','sumo','curling','bobslej','biathlon'],
    hard:   ['mistrzostwa','olimpiada','multisport','quadratlon','heptathlon','decathlon','kombajn','paratriathlon','supercross','motocross','wakeboarding','kitesurfing','windsurfing','paragliding','hangliding','zorbing','highline','slacklining','freediving','speleologia'],
  },
  food: {
    label: '🍕 Jedzenie',
    easy:   ['pizza','zupa','ciasto','jajko','chleb','mleko','herbata','owoce','warzywa','makaron','ryż','mięso','ryba','ser','masło','cukier','sol','pieprz','olej','ocet'],
    medium: ['hamburger','spaghetti','omlet','tiramisu','sushi','pierogi','bigos','risotto','guacamole','bruschetta','carpaccio','lasagne','paella','couscous','ratatouille','tandoori','schnitzel','sauerkraut','stroganow','gazpacho'],
    hard:   ['bouillabaisse','profiterole','creme brulee','madeleine','pissaladiere','bouillabaisse','chateaubriand','consomme','veloute','béchamel','hollandaise','bordelaise','remoulade','gribiche','ravigote','chimichurri','mole negro','birria','pozole','chilaquiles'],
  },
  movies: {
    label: '🎬 Filmy i seriale',
    easy:   ['batman','titanic','avatar','shrek','matrix','frozen','hobbit','mulan','bambi','dumbo','alladin','tarzan','pinochio','dumbo','nemo','ratatuj','wall-e','cars','up','soul'],
    medium: ['gladiator','inception','joker','interstellar','parasite','forrest','schindler','braveheart','amadeus','platoon','goodfellas','departed','fightclub','memento','prestige','shining','exorcist','alien','blade','terminator'],
    hard:   ['andrei rublev','stalker','metropolis','nosferatu','potemkin','rashomon','ikiru','sansho','ugetsu','chinatown','vertigo','seventh seal','wild strawberries','solaris','8 polowa','dolce vita','amarcord','satyricon','casanova','orchestra rehearsal'],
  },
  history: {
    label: '📜 Historia',
    easy:   ['krol','bitwa','zamek','rycerz','miecz','tarcza','katapulta','armia','oblezenie','pokój','traktat','koronacja','dynastia','cesarstwo','kronika','latopis','herb','flaga','mapy','zbroja'],
    medium: ['napoleon','aleksander','cezar','hannibal','kleopatra','dariusz','leonidas','spartakus','attylla','czyngis','tamerlane','suleiman','mehmed','wladyslaw','kazimierz','bolesław','piastowie','jagiellon','habsburgi','romanow'],
    hard:   ['mezopotamia','akadyjski','sumeryjski','babilonski','asyryjski','hetycki','egipski','fenicki','kartaginczyk','hellenizm','helenistyczny','ptolemejski','seleukidzi','antygonidzi','attalidzi','lagidzi','perseusz','macedonski','korynczyk','beocja'],
  },
  science: {
    label: '🔬 Nauka',
    easy:   ['atom','gaz','ciecz','ciało','energia','siła','masa','ruch','fala','swiatlo','dźwięk','cieplo','zimno','magnet','prad','ogien','woda','ziemia','powietrze','próżnia'],
    medium: ['grawitacja','elektron','proton','neutron','izotop','molekula','reakcja','katalizator','osmoza','dyfuzja','parowanie','kondensacja','sublimacja','jonizacja','polaryzacja','interferencja','dyfrakcja','refrakcja','absorbcja','emisja'],
    hard:   ['kwantowy','relatywistyczny','elektromagnetyzm','termodynamika','astrofizyka','biofizyka','neurobiologia','epidemiologia','farmakokinetyka','immunologia','histologia','cytologia','biochemia','proteomika','genomika','metabolomika','transkryptomika','epigenetyka','bioinformatyka','nanotechnologia'],
  },
  music: {
    label: '🎵 Muzyka',
    easy:   ['gitara','piano','beben','flet','harfa','trąbka','skrzypce','organy','perkusja','wiolonczela','saksofon','klarnet','obój','fagot','tuba','harmonia','akordeon','lutnia','mandolina','cymbaly'],
    medium: ['beethoven','mozart','bach','chopin','wagner','mahler','brahms','schubert','liszt','debussy','ravel','satie','bartok','stravinski','prokofiew','szostakowicz','sibelius','dvorak','smetana','janacek'],
    hard:   ['dodekafonia','dodekafonizm','serializm','atonalnosc','politonalnosc','mikrotonalnosc','aleatoryzm','minimalizm','spektralizm','acousmatique','konkretyzm','glitch','lowercase','noise','drone','ambient','field recording','electroacoustic','musique concrete','spectral music'],
  },
  city: {
    label: '🏙️ Miasta świata',
    easy:   ['rzym','paryż','londyn','berlin','madryt','ateny','tokio','pekin','kair','delhi','lizbona','wiedeń','praga','oslo','sztokholm','helsinki','kopenhaga','dublin','amsterdam','bruksela'],
    medium: ['singapur','szanghaj','mumbaj','bangalore','lahore','dhaka','karachi','teheran','bagdad','rijad','dubaj','nairobi','addis abeba','lagos','kinszasa','johannesburg','kapsztad','casablanca','khartoum','algier'],
    hard:   ['ulan bator','aszchabad','duszambe','taszient','biszkek','nur-sultan','baku','tbilisi','erywań','nikozja','chisinau','mińsk','tallinn','ryga','wilno','bratysława','ljubljana','sarajewo','skopje','podgorica'],
  },
  nature: {
    label: '🌿 Przyroda',
    easy:   ['las','rzeka','gorka','pole','łąka','park','ogrod','kwiat','drzewo','trawa','lisc','owoc','nasiona','korzenie','gałąź','kora','pień','jałowiec','sosna','brzoza'],
    medium: ['tropikalny','sawanna','tajga','tundra','puszcza','mangrowe','koralowe','lodowiec','delta','ujście','kanion','plateu','baszt','gejzer','moczary','bagna','solnisko','wydmy','raf koralowych','lagunach'],
    hard:   ['fotosynteza','transpiracja','ewapotranspiracja','sedymentacja','erozja','denudacja','karstyfikacja','fluwioglacjalny','peryglacjalny','agroekosystem','biogeografia','fitosocjologia','limnologia','oceanografia','klimatologia','meteorologia','hydrologia','gleboznawstwo','fitocenoza','zoocenoza'],
  },
};
