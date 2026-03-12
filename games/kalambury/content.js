'use strict';
// Ogromna baza haseł do kalamburów — rysowanie

module.exports = {
  animals: {
    label: '🐾 Zwierzęta',
    easy: ['kot','pies','ryba','kura','krowa','slon','zaba','orzel','lew','kon','panda','zebra','lis','jez','krolik','swinka','owca','koza','byk','kaczka','pingwin','delfin','rekin','krokodyl','flaming','kangur','strus','hipopotam','goryl','papuga'],
    medium: ['gepard','szympans','orangutan','mandryl','tapir','bawol','bison','los','renifer','wilk','mors','foka','lew morski','manat','dugon','narwal','beluga','orka','morswinia','platypus','koala','wombat','echidna','kiwi','tucan','kameleon','gekon','legwan','komodo','anaconda'],
    hard: ['axolotl','mantaraja','jaguarundi','okapi','fossa','numbat','quokka','wombat','thylacine','tasmanian devil','cassowary','binturong','pangolin','aardvark','tapir','capybara','peccary','maned wolf','spectacled bear','mountain tapir'],
  },
  objects: {
    label: '🏠 Przedmioty',
    easy: ['krzeslo','stol','okno','drzwi','lampa','telefon','ksiazka','zegarek','klucz','butelka','kubek','talerz','szklanka','widelec','noz','lyzka','torebka','parasol','plecak','buty'],
    medium: ['pralka','lodowka','rower','latarka','komputer','gitara','balon','kamera','mikroskop','teleskop','periskop','akordeon','termometr','metronom','sejf','kalkulator','drukarki','skaner','projektor','router'],
    hard: ['stetoskop','defibrylator','magnetometr','spektrometr','interferometr','oscyloskop','galwanometr','potencjometr','multimetr','anemometr','barometr','hipsometr','piranometr','aktynometr','uderzeniometr'],
  },
  activities: {
    label: '🏃 Czynności',
    easy: ['bieganie','spanie','jedzenie','picie','pisanie','skakanie','plywanie','latanie','czytanie','spiewanie','tanczenie','rysowanie','malowanie','gotowanie','sprzatanie','mycie','czesanie','ubieranie','granie','ogladanie'],
    medium: ['zonglerka','akrobatyka','nurkowanie','wspinaczka','medytowanie','kaligrafia','majsterkowanie','ogrodnictwo','wędkowanie','polowanie','narciarstwo','surfowanie','żeglowanie','koniu','strzelectwo','zapasy','szermierka','lekkoatletyka','kajakarstwo','alpinizm'],
    hard: ['ekstremalny slalom','parkour','base jumping','wingsuit','highline','freediving','speleologia','geocaching','orienteering','triathlon','multisport','obstacle race','adventure racing','speed climbing','bouldering','lead climbing','top rope','trad climbing','ice climbing','mixed climbing'],
  },
  food: {
    label: '🍕 Jedzenie i napoje',
    easy: ['pizza','banan','jablko','chleb','jajko','ciasto','lody','zupa','ryba','herbata','kawa','mleko','ser','maslo','miod','dżem','ketchup','musztarda','cukier','sol'],
    medium: ['hamburger','spaghetti','waffel','omlet','sushi','pierogi','bigos','tiramisu','guacamole','croissant','bruschetta','ratatouille','creme brulee','pancakes','cheesecake','brownie','macaron','eclair','profiterole','mille-feuille'],
    hard: ['bouillabaisse','chateaubriand','consomme','veloute','bechamel','hollandaise','bordelaise','remoulade','gribiche','ravigote','chimichurri','mole negro','birria','pozole','chilaquiles','tamales','enchiladas','quesadillas','ceviche','tiradito'],
  },
  movies: {
    label: '🎬 Filmy i seriale',
    easy: ['batman','titanic','lion king','toy story','frozen','avatar','shrek','nemo','up','coco','mulan','aladdin','tarzan','pinocchio','dumbo','ratatouille','wall-e','brave','moana','encanto'],
    medium: ['jurassic park','star wars','matrix','gladiator','inception','harry potter','lord of the rings','spider-man','iron man','thor','guardians','avengers','black panther','wonder woman','aquaman','flash','shazam','joker','batman v superman','suicide squad'],
    hard: ['schindler list','forrest gump','silence of the lambs','amadeus','blade runner','2001 space odyssey','clockwork orange','apocalypse now','deer hunter','coming home','platoon','born fourth of july','heaven earth','full metal jacket','bridge kwai','longest day','great escape','great dictator','modern times','city lights'],
  },
  sports: {
    label: '⚽ Sport i dyscypliny',
    easy: ['pilka nozna','koszykowka','tenis','golf','boks','narty','plywanie','lyzwy','rower','siatkowka','badminton','ping pong','bowling','szachy','bilard','darts','warcaby','hula hop','frisbee','skakanka'],
    medium: ['lekkoatletyka','szermierka','gimnastyka','judo','taekwondo','zapasy','wioslowanie','kajakarstwo','snowboard','triathlon','pentathlon','kolarstwo','biathlon','skoki narciarskie','bobslej','curling','sumo','aikido','bjj','muay thai'],
    hard: ['pentatlon nowoczesny','decathlon','heptathlon nowoczesny','paratriathlon','duathlon','aquathlon','zimowy triathlon','ekstremum triathlon','himalajizm','alpinizm wysokogórski','high-altitude climbing','base jumping','speed riding','speed flying','kite landboarding','kite buggying','snow kiting','speed skydiving','accuracy parachuting','canopy piloting'],
  },
  professions: {
    label: '👔 Zawody',
    easy: ['lekarz','nauczyciel','kucharz','policjant','strazak','pilot','kierowca','piekarz','fryzjer','sprzedawca','aktor','spiewak','muzyk','malarz','rzezbiarz','fotograf','rezyser','dziennikarz','pisarz','poeta'],
    medium: ['chirurg','ortopeda','neurolog','kardiolog','onkolog','psychiatra','stomatolog','okulista','dermatolog','laryngolog','radiolog','anestezjolog','patolog','ginekolog','pediatra','internista','gastroenterolog','nefrolog','urolog','endokrynolog'],
    hard: ['biotechnolog','nanotechnolog','bioinformatyk','neurokognitywista','kryminalistyk','psycholingwista','paleobotanik','paleoantropolog','geoarcheolog','limnolog','oceanograf','klimatolog','glacjolog','wulkanolog','sejsmolog','geomorfolog','hydrologik','pedolog','agronom','fitosocjolog'],
  },
  places: {
    label: '🏛️ Miejsca i budynki',
    easy: ['dom','szkola','kosciol','park','sklep','rynek','most','zamek','muzeum','teatr','kino','basen','stadion','szpital','hotel','lotnisko','dworzec','biblioteka','restauracja','kawiarnia'],
    medium: ['piramida','sfinks','koloseum','panteon','partenon','akropol','forum romanum','wawel','wersal','luwr','ermitaz','met','guggenheim','tate','uffizi','prado','rijksmuseum','louvre','hermitage','moma'],
    hard: ['angkor wat','borobudur','prambanan','tikal','teotihuacan','chichen itza','machu picchu','tiwanaku','nazca','stonehenge','carnac','newgrange','skara brae','lascaux','altamira','cappadocia','petra','palmyra','hierapolis','ephesus'],
  },
  nature: {
    label: '🌿 Przyroda i rośliny',
    easy: ['drzewo','kwiat','trawa','les','rzeka','gora','morze','ocean','jezioro','desert','volcano','tsunami','tornado','deszcz','snieg','tęcza','chmura','slonce','ksiezyc','gwiazdy'],
    medium: ['tropikalny','sawanna','tajga','tundra','bagna','mangrowe','reef','lodowiec','delta','kanion','gejzer','wydmy','solnisko','laguna','atol','klif','fjord','mesas','gorge','ravine'],
    hard: ['fotosynteza','bioluminescencja','mutualizm','pasozytnictwo','komensalizm','amensalizm','predacja','kompetycja','sukcesja ekologiczna','nisza ekologiczna','habitat','ekosystem','biom','biosfera','litosfera','hydrosfera','atmosfera','pedosfera','kriosfera','antroposfera'],
  },
  vehicles: {
    label: '🚗 Pojazdy i transport',
    easy: ['samochod','autobus','pociag','samolot','okret','rower','motocykl','taksowka','ambulans','straz','policja','tramwaj','metro','helikopter','lodz','kajak','statek','promien','ciagnik','kombajn'],
    medium: ['rakieta','wahadlowiec','satelita','stacja kosmiczna','balonik','sterowiec','poduszkowiec','hydroplan','catamaran','trimaran','gondola','dhow','junk','longship','galera','trireme','birema','monoreme','pentekonter','liburna'],
    hard: ['submarina','batyskaf','hov','bathysphere','deepsea challenger','alvin','nautile','mir','shinkai','jiaolong','nereus','hybrid rov','glider underwater','auv','uuv','supercavitating torpedo','hydrofoil','ekranoplan','ground effect vehicle','wing in ground effect'],
  },
};
