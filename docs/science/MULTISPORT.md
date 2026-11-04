# MS-1–MS-6: zasady planowania wielu sportów

Kod rozróżnia wyniki badań od parametrów przyjętych przez implementację.
Testy potwierdzają obliczenia, ochronę danych i spójność kalendarza. Nie są
badaniem skuteczności treningu, bezpieczeństwa klinicznego ani prognozą urazów.

## Podstawa i granice przenoszenia dowodów

- [Tanaka 1994, przegląd cross-training](https://pubmed.ncbi.nlm.nih.gov/7871294/):
  transfer adaptacji między sportami jest ograniczony i zależy od specyfiki oraz
  wytrenowania. Nie wynika z niego uniwersalny przelicznik czasu lub kilometrów.
- [Millet i in., modelowanie transferu u triathlonistów](https://pubmed.ncbi.nlm.nih.gov/11774068/):
  obserwacje sportowców wyczynowych nie uzasadniają jednakowych reguł dla
  początkującego biegacza i doświadczonego pływaka.
- [Wang i in. 2023, metaanaliza taperu wytrzymałościowego](https://pmc.ncbi.nlm.nih.gov/articles/PMC10171681/):
  wyniki wspierają zmniejszenie objętości przy utrzymaniu intensywności i częstości.
  W badanych protokołach korzystny był zakres redukcji 41–60%; nie jest to
  spersonalizowany przepis dla każdego dystansu, poziomu i dyscypliny.
- Bieganie nadal używa dotychczasowego silnika i źródeł z [FOUNDATIONS](FOUNDATIONS.md).
  Opisy modułów: [rower](CYCLING.md), [pływanie](SWIMMING.md).

## MS-1 — dawka, struktura i kalendarz (parametry inżynierskie)

Punktem wyjścia są osobne minuty i częstość treningu sportów. Długa jednostka
ma wagę 1.5 dla roweru i 1.25 dla pozostałych sportów, pozostałe wagę 1.
Czas dzieli się proporcjonalnie z limitem maxSessionMinutes. To wybór szablonu,
nie zalecenie wynikające wprost z badania. Nie sumuje się kilometrów różnych sportów.

Struktury i cele jednostek opisuje MS-6 poniżej. Kalibracja FTP/CSS wymaga
daty i źródła, nie starszych niż 180 dni względem daty oceny. Przy braku
wiarygodnego pomiaru generator podaje instrukcje RPE, bez wymyślania mocy lub CSS.
Wyniki przyszłe są pomijane.

Kalendarz obejmuje przygotowanie i przejścia dokładnie raz. Wspólne ograniczenia
obejmują dni, zasoby, okna, limity dnia/tygodnia, przypięcia i grupy.
Wyszukiwanie jest deterministyczne, z pierwszeństwem bardziej ograniczonych jednostek,
cofaniem wyborów i limitem 5000 odwiedzonych węzłów. Nieprzydzielone sesje są
raportowane. Wyczerpanie limitu nie jest dowodem niewykonalności. Enumerowane
okna nie gwarantują globalnego optimum wszystkich możliwych godzin.

## MS-2 i MS-5 — zamiana dyscypliny

Każdy z sześciu kierunków ma osobno zapisany utracony element specyficzny.
Zamiana może zachować ogólny cel tlenowy albo jakościowy; nie oznacza wykonania
oryginalnej pracy technicznej, ekonomii ruchu lub tolerancji obciążeń udarowych.
Dawka jest ograniczona profilem docelowym, zajętym czasem, kalendarzem i ostatnimi
wykonaniami tego sportu. Okno historii to 28 dni. Brak regularnego doświadczenia
lub przynajmniej 3 potwierdzonych treningów ogranicza zamiennik do spokojnych
20 min biegu/pływania albo 40 min roweru. Są to progi operacyjne, nie gwarancje bezpieczeństwa.

Wariant jakościowy wymaga regularnego doświadczenia lub historii, właściwej
kalibracji, minimum 20 min oraz braku sąsiedniego akcentu na tej samej lub sąsiedniej
dacie. W ciągu 7 dni do zawodów jest wyłączony. Kalibracja FTP/CSS musi mieć źródło
i datę nie starszą niż 180 dni; wynik biegowy korzysta z limitu 540 dni.
Okresy ważności są decyzjami inżynierskimi. Nie ma automatycznego wyznaczania FTP/CSS.
Podgląd zapisuje cel oryginału i alternatywy, elementy zachowane/utracone i ograniczenia.

## MS-3 — korekta zadeklarowanego budżetu

Dwa zamknięte tygodnie ocenia się osobno dla każdego sportu. Każda sesja musi mieć
potwierdzone wykonanie z czasem albo jawne pominięcie. Brak telemetrii to unknown.
Done bez wskazanej aktywności i bez czasu jest deklaracją wykonania zaplanowanej dawki;
modified bez czasu nie wystarcza. Jawne powiązania aktywności wykorzystują ich dane,
a nie czas z planu. Kopie z różnych źródeł są liczone raz, części wybrane jawnie sumowane.

Udział wykonanego czasu 25–95% pozwala zaproponować redukcję przyszłych niechronionych
sesji. Nie ma automatycznego zwiększania ani zastosowania propozycji. Granice te są
inżynierskie. Zamienniki, grupy, historia i przypięcia są chronione. Baza pozostaje
oddzielna dla sportu; jawna zmiana profilu zastępuje poprzednią bazę.

## MS-4 — progresja, intensywność, taper i powrót

Domyślny wzrost wynosi zero. Użytkownik deklaruje progressionPercent (0–10%) i
peakWeeklyMinutes. Co czwarty tydzień ma 80% wyliczonej objętości; szczyt nie
przekracza deklarowanego maksimum. Sesja jakościowa wymaga kalibracji oraz
częstości co najmniej 3 sesji/tydzień; domyślnie najwyżej jedna dla regularnego
lub wytrenowanego profilu, najwyżej dwie przy jawnej konfiguracji.

Przed celem A domyślnie przez 14 dni czas maleje do 50%; zachowana zostaje
częstość i intensywność pozostałych akcentów, z uwzględnieniem dnia zawodów.
Start B zmniejsza tygodniową dawkę do 75% i rezerwuje kolejny dzień na odpoczynek;
C nie uruchamia tego zmniejszenia. Po A nowe szablony mają 50% czasu i spokojne
jednostki; domyślna przerwa to 2 pełne dni dla biegu i 1 dla roweru/pływania.
Profil może określić taperDays i recoveryDays. Konkretne liczby, cykl lżejszych
tygodni i przerwy po starcie są parametrami inżynierskimi, a nie uniwersalną receptą.

Migrowane bieganie zachowuje dotychczasowe reguły powrotu i progresji w silniku
biegowym. Ogólny domyślny okres powrotu nie nadpisuje jego jednostek; jawne
recoveryDays w profilu jest dodatkowym ograniczeniem kalendarza.

## Formaty i zakres eksportu

- [Garmin FIT Workout](https://developer.garmin.com/fit/file-types/workout/) i
  [oficjalny profil SDK](https://github.com/garmin/fit-javascript-sdk/blob/main/src/profile.js):
  typy sportów, waty z kodowaniem +1000, długość basenu, styl, przerwy i powtórzenia.
- [Intervals.icu Workout Builder](https://www.intervals.icu/features/workout-builder/)
  i [składnia](https://forum.intervals.icu/t/workout-builder-syntax-quick-guide/123701):
  typ sportu, waty, metry, pętle.

Formaty nie uzasadniają parametrów fizjologicznych. FIT z send-off jest jawnie
odrzucany; HTML/ICS zachowują opis. Cele tempa pływania obok stylu są opisowe.
Nie wykonano próby na fizycznym urządzeniu ani oceny biblioteki z trenerem.

## MS-6 — kompletna instrukcja i biblioteka jednostek

Każda nowo generowana jednostka wytrzymałościowa ma tytuł, cel, uzasadnienie
wyboru, kryteria wykonania i wskazówki dostosowania. Kroki zawierają odczuwany
wysiłek RPE 1–10 oraz opis techniki. Rozgrzewka, część główna i schłodzenie
są oddzielne. Starty zachowują odrębny protokół; silnik biegowy zachowuje swoje
pierwotne segmenty i otrzymuje opis celu. Starsze zapisane jednostki bez
metadanych pozostają czytelne.

Podstawy organizacji treningu:
- [USA Triathlon — struktura sesji pływackiej](https://www.usatriathlon.org/training-tips/what-do-i-do-in-the-pool): rozgrzewka, część główna, ćwiczenia umiejętności i spokojne zakończenie; technika wymaga konkretnych wskazówek.
- [British Cycling — RPE](https://www.britishcycling.org.uk/knowledge/training-plans/supporting-documents/article/izn20151119-Training-Plans-Supporting-Documents-Related-Rate-of-Perceived-Exertion-Scale---RPE-0/1000): odczuwany wysiłek może prowadzić trening bez znanego FTP lub stref tętna.

Te źródła wspierają strukturę oraz sposób komunikowania intensywności. **Nie
walidują poniższych konkretnych dawek, progów doboru ani całego generatora.**

### Rower

| Przepis | Odcinek pracy | Przerwa | Moc | Maksymalna liczba odcinków |
| --- | --- | --- | --- | --- |
| Tempo w bazie | 6 min | 2 min | 80% FTP | 3–5; 2 w lżejszym tygodniu |
| Dłuższa praca podprogowa | 8 min | 3 min | 88% FTP | 3–4 |
| Próg, zawodnik wytrenowany | 6 min | 3 min | 95% FTP | 3–4 |
| Moc tlenowa, zawodnik wytrenowany | 3 min | 3 min | 110% FTP | 4–5 |
| Pobudzenie w taperze | 1 min | 2 min | 100% FTP | 3 |

Przepisy progowe i mocy tlenowej wybierane są w fazie budowy dla wytrenowanych
z celem do 40 km roweru; dłuższe cele korzystają z pracy podprogowej. To jawny
heurystyczny podział, bez modelowania profilu trasy czy specjalizacji kolarskiej.
Przerwy mają cel 50% FTP i RPE 1–2. Rozgrzewka akcentu zajmuje do 10 min,
schłodzenie do 5 min; oba są rezerwowane przed doborem powtórzeń. Większy budżet
nie wydłuża dowolnie odcinka pracy: pozostały czas to spokojna jazda.

### Pływanie

Serie spokojne mają zwykle 4 długości, długie 8, przy CSS+12 s/100 m. Serie
w pobliżu CSS mają 4 długości i CSS+5 w bazie lub CSS+2 w budowie, z 20 s
odpoczynku. Dla wytrenowanych z celem do 1500 m co drugi tydzień budowy może
zawierać krótkie odcinki jednej długości przy CSS−4, z 30 s odpoczynku. Taper
używa 4 odcinków po 2 długości przy CSS. Liczba powtórzeń jest ograniczona
recepturą, doświadczeniem i czasem; nie jest dopasowywana do wyczerpania.

Rozgrzewka i schłodzenie rezerwują około 18% i 10% czasu, po zaokrągleniu
do pełnych długości basenu. Technika obejmuje konkretny opis pozycji i wydechu
lub luźnego powrotu ramienia, następnie przeniesienie umiejętności do kraula.
Ćwiczenie nie narzuca tempa; jego czas jest estymacją na podstawie CSS+35.
Brak CSS lub zbyt mały budżet na pełne długości daje kroki czasowe z RPE.
Zakończenie odcinka następuje przy ścianie; estymacja czasu nie przewiduje
dokładnie czasu pojedynczej długości zawodnika.

### Granice, zamiany i skracanie

- Początkujący i faza regeneracji nie otrzymują mocnej jednostki.
- Gdy nie mieszczą się co najmniej dwa pełne odcinki wraz z rozgrzewką,
  odpoczynkiem i schłodzeniem, generator jawnie zmienia cel na spokojny.
- Skracanie zachowuje rozgrzewkę, schłodzenie i pełne powtórzenia. Dla akcentu
  musi zostać co najmniej połowa pierwotnej pracy jakościowej i dwa odcinki.
  Skracanie techniki zachowuje ćwiczenie oraz pływanie po ćwiczeniu.
- Odpoczynek naliczany jest po każdym powtórzeniu, również ostatnim.
- Zakładki mają cel kontroli przejścia rower–bieg. Zadeklarowane czasy stanowią
  pułap; czterotygodniowa fala to 75%, 87.5%, 100%, 70%. Dotychczasowe
  ograniczenia kalendarza i wyłączenie zakładek przed głównym startem pozostają.
- Brak pomiarów nie uruchamia automatycznie akcentów w planie. RPE prowadzi
  sesje spokojne oraz jawnie wywołane treningi; zamiana jakościowa nadal wymaga
  aktualnej kalibracji docelowej dyscypliny.
- Kryteria wykonania są wskazówkami, nie automatyczną oceną techniki z czujnika.

### Przenoszenie instrukcji

CLI today/why oraz MCP przekazują cel i pełne kroki; week pokazuje krótszą
wersję. JSON i YAML przechowują coaching oraz effort/recovery kroków.
Markdown, HTML, ICS i opis Intervals.icu zachowują pełny tekst. FIT zachowuje
moc/tempo/odpoczynek i RPE w nazwie oraz notatkach kroku. Pole notatki ma limit
254 bajtów UTF-8; dłuższa instrukcja pozostaje w HTML/CLI. RPE jest opisem,
nie alarmem fizjologicznym; tempo pływania pozostaje opisowe obok celu stylu.
Wyświetlanie notatek zależy od urządzenia.

Biblioteka wymaga jeszcze niezależnego przeglądu przez trenerów biegania,
kolarstwa, pływania i triathlonu oraz prób na fizycznych zegarkach. Wyników
testów technicznych nie należy przedstawiać jako takiego zatwierdzenia.
