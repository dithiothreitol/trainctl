# MS-1–MS-5: zasady planowania wielu sportów

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

Spokojny rower używa 65% zadeklarowanego FTP; wariant jakościowy 90% FTP,
5 min rozgrzewki, 4 powtórzenia z 60 s odpoczynku, 5 min schłodzenia.
Pływanie korzysta z CSS+12 s/100 m w spokojnych seriach, CSS w seriach jakościowych,
20 s przerwy oraz odcinków 2 długości dla techniki, 4 dla zwykłych serii i 8 dla
długich. Ćwiczenia techniczne mają otwarty cel intensywności. Te różnice i liczby
są ustawieniami programu; rzeczywisty koszt techniki może istotnie odbiegać od estymacji.
Bez kalibracji powstają otwarte kroki czasowe. Wyniki przyszłe są pomijane.

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
