# Weryfikacja multisport — 2026-11-04

Wynik: **PASS dla poniższego zakresu programowego**. To raport wykonanych
kontroli, nie potwierdzenie fizjologicznej skuteczności biblioteki treningów.

| Kontrola | Wynik |
| --- | --- |
| pnpm typecheck | PASS — wszystkie 6 pakietów |
| pnpm build | PASS — wszystkie 6 pakietów |
| Vitest — Node 22.18.0 | **1024/1024 testów**, **71/71 plików**; 483,96 s; kod 0, bez błędów procesów |
| Vitest — Node 24.14.1 | **1024/1024 testów**, **71/71 plików**; 365,32 s; kod 0, bez błędów procesów |
| pnpm simulate:multisport | PASS na Node 22 i 24 — **56 wywołań rzeczywistego CLI**, 4 izolowane katalogi, **128 plików FIT** przez Garmin SDK, **8 wersji ICS / 231 wpisów** przez ICAL.js; wariant --artifacts zachował pakiet odbiorowy |
| pnpm benchmark:multisport | PASS — 10 i 14 sesji, 3 akcenty, 3 dni dostępu do basenu |
| pnpm verify:distribution --online | PASS na Node 22 i 24 — 6 paczek z tarballi, 56 poleceń CLI, 128 FIT przez Garmin SDK, 8 wersji ICS / 231 wpisów przez ICAL.js, 11 wywołań MCP, odmowy v1 i completion |
| Żywe API Intervals.icu — pakiet Suunto | **PASS** — 3 sesje, zamiana i cofnięcie, każdy etap wysłany dwukrotnie; 6 zapisów, 2 usunięcia poprzedników; kontrola sparsowanych kroków i brak duplikatów |
| Sprzątanie próby API | **PASS** — usunięto 3 końcowe wpisy TEST S9PP, odczyt potwierdził 0 wpisów tej próby i niezmienione pozostałe treningi |
| node tools/plugin/render-skills.ts --check | PASS — źródła i generowane skille zgodne |
| git diff --check | PASS; komunikaty o LF/CRLF są informacyjne |

Środowisko: Windows, Node 22.18.0 oraz 24.14.1. Minimalną wersję pobrano do
izolowanego cache; systemowa instalacja Node 24 pozostała bez zmian. Typecheck
i build sześciu pakietów przeszły także na Node 22. Natywny loader Vitest omija ograniczenie
uprawnień esbuild do katalogu nadrzędnego; wykonuje ten sam zestaw testów.
Oba końcowe przebiegi używały `--configLoader native --maxWorkers=1 --minWorkers=1`
oraz reporterów dot/JSON. Część kontroli działała równolegle; czasy nie są benchmarkiem
porównującym wersje Node. Wyniki JSON znajdują się w lokalnym, ignorowanym przez Git
[`artifacts/node22-yrvcBC/validation-summary.json`](../artifacts/node22-yrvcBC/validation-summary.json).

Wcześniejszy przebieg bez ograniczenia procesów miał 969 poprawnych asercji, ale dwa
błędy RPC `Timeout calling onTaskUpdate` i kod 1. Kolejny przebieg z dwoma
procesami, równolegle z buildem i testem instalacji, miał 993 zaliczone testy,
lecz ponownie dwa błędy RPC i kod 1 (226,27 s). Powtórzenie z jednym procesem
również miało 993 zaliczone testy, lecz jeden błąd RPC i kod 1 (258,31 s).
Żadnego z tych przebiegów nie zaliczono jako PASS. Oddanie sterowania przez
`setImmediate` między przypadkami pozwoliło uzyskać poprawne przebiegi Node 24,
lecz nie wystarczyło w kontroli Node 22.18.0: 1024 zaliczone przypadki, jeden
błąd RPC, kod 1 i 490,26 s. Tego przebiegu również nie zaliczono jako PASS.

`tools/test/runner.ts` rozszerza teraz standardowy `VitestTestRunner` przez
[publiczne API Vitest 3](https://v3.vitest.dev/advanced/runner). Przed każdą
próbą testu oczekuje na potwierdzenie pustego `onTaskUpdate`, dając procesowi
roboczemu możliwość odebrania odpowiedzi przed kolejną synchroniczną operacją.
Zachowuje obsługę asercji, snapshotów, błędów i wszystkie dotychczasowe limity.
Kontrolna próba potwierdziła dwa poprawne przypadki (w tym zamrożoną datę)
oraz celową błędną asercję z kodem 1; pusta aktualizacja nie zalicza testów.
Pierwsze pełne wykonanie z nowym runnerem nie miało błędu RPC, lecz jeden test
przekroczył niezmieniony limit 30 s: 1023 PASS, 1 FAIL, 444,80 s, kod 1.
Test czterokrotnej regeneracji otrzymał dwutygodniowy plan zamiast ośmiu tygodni;
wszystkie asercje przesunięcia, ochrony, rekalibracji i idempotencji zachowano.
Pozostałe scenariusze nadal używają pełnego planu. Powtórzenie tego przypadku
na Node 22.18.0 przeszło w 5,54 s (całe uruchomienie 28,70 s).
Następnie pełne, końcowe przebiegi na obu wersjach zakończyły się kodem 0,
z 1024 zaliczonymi testami i bez błędów RPC — to wyniki w tabeli.
Nie deklarujemy, że domyślny pnpm check przeszedł w tym środowisku. Testy
macierzy Node 22/24 i Linux/Windows są zapisane w CI, lecz nie zostały tu
uruchomione na wszystkich platformach. Instalację z tarballi sprawdzono lokalnie
na Windows / Node 22.18.0 i 24.14.1. Ten sam test jest teraz w jobie CI dla Linux i Windows
z Node 22.18.0; nie deklarujemy wykonania tej zdalnej macierzy w tej sesji.

## Symulacja rzeczywistego CLI

Data symulowana: 2026-11-02. Każde z 56 poleceń zakończyło się kodem 0.

1. Nowy plan run/bike/swim: wszystkie sześć kierunków zamiany, prepare/apply,
   zachowanie decyzji po regeneracji, zaliczenie zamiennika, status, why,
   filtrowany tydzień, porównanie scenariusza i renegocjacja przygotowania;
   cofnięcie z archiwum, ID propozycji i objętość przed/po, spontaniczne pływanie
   zamiast biegu bez zmiany pliku planu, rzeczywisty sport, RPE i wykonane powtórzenia.
2. Migracja dotychczasowego planu z zawodami: zapis oryginałów, ponowny plan,
   dodanie roweru, nowy wynik biegowy, zmiana przyszłych biegów, check i eksport.
3. Duathlon run/bike/run: niezależne ID etapów, start kontrolny C, zakładki,
   wyjątek daty, T1/T2 w planie i HTML/ICS, check i eksport; zadeklarowane
   syntetyczne CSS daje serie basenowe ze stylem, przerwami i powtórzeniami.
4. Plan rowerowy: zmniejszenie liczby sesji, anulowania ICS, ponowne zwiększenie
   liczby sesji, reaktywacja tych samych ID z wyższym SEQUENCE, brak podwójnych
   aktywnych/anulowanych wpisów i identyczny ponowny eksport bez zmian;
   niejednoznaczne kopie z trzech źródeł, review z listą kandydatów oraz jawny
   wybór jednej aktywności bez dołączania pozostałych.

Eksporty FIT/HTML/ICS powstały. Kalendarz pierwszego scenariusza ma 48 aktywnych
sesji i 7 anulowanych poprzedników; wszystkie 55 UID są unikalne. Symulacja używa
katalogów tymczasowych, sprząta je i nie wykonuje wywołań sieciowych. Flaga
`--artifacts` zachowuje wyłącznie syntetyczne eksporty w nowym katalogu `artifacts/`.

## Instalacja gotowych paczek

`scripts/verify-distribution.ts` pakuje wszystkie sześć pakietów po buildzie,
instaluje archiwa poza workspace i sprawdza, że wejścia pakietów prowadzą do
`dist/*.js`, a zależności nie zawierają `workspace:`. Te same 56 poleceń
symulacji uruchamiają następnie zainstalowane CLI. Dodatkowe próby potwierdzają
odmowę nowych flag w v1 (`log`, `export`, `shift`) oraz flagi w completion.

Sonda `probe-distribution.mjs` uruchamia rzeczywisty proces zainstalowanego MCP
i wykonuje 11 wywołań narzędzi: init, plan, prepare/apply zamiany i jej cofnięcia,
zapis innego wykonanego sportu, review, regenerację, check oraz eksport.
Zależności sondy są rozwiązywane z instalacji testowej, nie z repozytorium.

Tryb offline nie miał kompletu archiwów zależności w lokalnym cache i zakończył
się jawnym błędem. Zaliczone wykonanie używało `--online`, co dopuszcza pobieranie
zależności z npm. Nie publikowano paczek ani danych treningowych; nie używano
konta Intervals.icu. Katalogi instalacji i danych syntetycznych są usuwane po teście.

Pierwsza kontrola instalacji na Node 22.18.0 przekroczyła dotychczasowy wspólny
limit 180 s dla symulacji; zakończyła się kodem 1 i nie została zaliczona.
Każde polecenie symulacji ma teraz własny limit 30 s, a cała sekwencja 10 minut.
Instalacja i pojedyncze kroki pakowania zachowują limit 180 s. Błąd wskazuje
polecenie przed próbą odczytu JSON. To limity narzędzia weryfikacji, bez zmiany
asercji lub limitów Vitest. Katalog danych syntetycznych pozostawiony przez
przerwany proces został usunięty po sprawdzeniu jego położenia i tożsamości.

## Niezależny odczyt FIT

Weryfikacja używa [oficjalnego Garmin FIT SDK](https://github.com/garmin/fit-javascript-sdk),
wersja **21.218.0**, przypięta jako zależność deweloperska w głównym pakiecie.
Wcześniejszy minimalny dekoder w `fit.test.ts` jest własnym kodem repozytorium;
nie był zewnętrznym potwierdzeniem zgodności.

`fit-sdk.test.ts` zawiera 19 przypadków: identyfikację sportu, metry i prędkość
biegu, bezdystansowy trenażer z mocą, basen 25/50 m, pięć stylów/ćwiczeń,
przerwy, powtórzenia, otwarte cele bez kalibracji i zachowanie biegu po migracji.
SDK odrzuca celowo uszkodzony i ucięty plik. Sprawdzane są również nazwy
z polskimi znakami, emoji i znakami zajmującymi trzy bajty UTF-8.

Trzy nowe przypadki odtworzyły błąd nazw przed poprawką: brak miejsca na końcowy
bajt zerowy lub przecięcie znaku. Koder zapisuje teraz pełne znaki mieszczące się
w limicie bajtów i zostawia terminator, zgodnie z
[definicją typu string w FIT](https://developer.garmin.com/fit/protocol/).

Symulacja odczytała przez SDK **128 plików FIT** z czterech scenariuszy. Sprawdza
CRC, typ pliku, sport zgodny z sesją, długość basenu, liczbę i indeksy kroków
oraz poprawne odwołania pętli. Ten sam test działa dla zainstalowanych paczek.
Wykonanie z tarballi również potwierdziło poprawny odczyt wszystkich 128 plików
przez SDK 21.218.0. Wynik bieżącego testu instalacji podano w tabeli.
Odczyt przez SDK potwierdza strukturę danych; działanie na fizycznym urządzeniu
pozostaje osobną próbą.

## Niezależny odczyt ICS i pakiet odbiorowy

[ICAL.js](https://github.com/kewisch/ical.js) **2.2.1** jest przypiętą zależnością
deweloperską. Dwanaście nowych testów sprawdza: granicę roku, dzień przestępny,
wyłączny koniec zdarzenia całodniowego, czas lokalny z przygotowaniem i przejściem
przez północ, anulowanie, UTC znaczników aktualizacji, tekst z LF/CRLF/CR,
polskie znaki i emoji w składanych liniach oraz dwie sesje na jednej dacie.
Uwzględniono też normalizację tekstu starego eksportu v1.

Testy odtworzyły utratę godziny i czasu oryginału w anulowaniu oraz brak obsługi
pojedynczego CR. Anulowania korzystają teraz z tej samej definicji terminu co
aktywne zdarzenia; oba eksportery korzystają ze wspólnego kodowania tekstu.
Testy cyklu kalendarza również odczytują pliki przez ICAL.js. Symulacja sprawdza
8 eksportów zawierających łącznie 231 wpisów (kolejne wersje są liczone osobno),
w tym UID, daty, czas trwania, anulowania i wersje po reaktywacji.
Ten sam wynik uzyskano po instalacji paczek poza repozytorium.

`pnpm simulate:multisport --artifacts` utworzył
[`artifacts/multisport-gJVbBe`](../artifacts/multisport-gJVbBe/README.md):
128 FIT, HTML, plany źródłowe, pięć plików ICS obrazujących zamianę i cykl
wycofania/przywrócenia oraz instrukcję po polsku. Wszystkie 148 plików
w manifeście sprawdzono ponownie przez SHA-256; `manifest.json` jest osobnym,
149. plikiem. Katalog jest lokalny i ignorowany przez Git; kolejne uruchomienie
tworzy nową nazwę. Na prośbę użytkownika próba w Google Calendar została
pominięta (`skipped`); próbę na zegarku odłożono (`deferred`) po decyzji o przejściu dalej.
README pakietu podaje dokładne parametry trzech wybranych FIT do porównania
na urządzeniu, odczytane przez SDK. Po aktualizacji instrukcji i statusu
odświeżono ich sumy i ponownie sprawdzono wszystkie 148 plików manifestu.
Odczyt parserem nie potwierdza zachowania konkretnego klienta lub urządzenia.

## Benchmark kalendarza

| Sesje | Akcenty | Dni basenu | Odwiedzone węzły | Czas lokalny | Wynik |
|---|---|---|---|---|---|
| 10 | 3 | 3 | 10 / 5000 | 295,2 ms | poprawny, deterministyczny |
| 14 | 3 | 3 | 14 / 5000 | 562,8 ms | poprawny, deterministyczny |

Czas jest pomiarem tej maszyny podczas pozostałych testów, nie gwarancją dla wszystkich kalendarzy.
Osobny test wymusza limit wyszukiwania i sprawdza oznaczenie nierozstrzygniętej
wykonalności. Test ograniczonego okna rezerwuje basen przed elastycznymi sesjami.

## Ważne scenariusze regresji

- Łączenie aktywności z trzech lub większej liczby źródeł: niezgodny łańcuch
  czasu, czasu trwania, dystansu albo powiązań z planem pozostaje rozdzielony.
  Kolejność wejścia i nazwy źródeł nie wybierają arbitralnej pary. Zgodne kopie
  nadal są liczone raz. Testy odtworzyły błąd przed poprawką; symulacja CLI
  sprawdza późniejsze jawne wskazanie jednego źródła.
- Wycofanie i reaktywacja wygenerowanych sesji po zmianie częstotliwości lub
  usunięciu/ponownym dodaniu dyscypliny. Atrapa synchronizacji potwierdza
  usunięcie własnych wycofanych wpisów, zachowanie cudzych oraz ponowny upsert.
- ICS wersjonuje zmiany treści po rekalibracji i ręcznej edycji, zachowuje
  wersje pominiętych sportów przy filtrowaniu i odtwarza identyczny eksport
  po usunięciu samego pliku ICS. Uszkodzony stan lub przepełniony SEQUENCE
  nie nadpisuje dotychczasowego kalendarza. Stan wersji i ICS używają wspólnej
  transakcji; oryginały zamian nie są reaktywowane przez generator.
- Pełna dotychczasowa suita biegania i wszystkie stare formaty konfiguracji.
- Migracja zachowująca jednostki, logi, źródłowy profil, zatwierdzone decyzje
  i bazę silnika biegania. Nowy wynik aktualizuje przyszłe niechronione biegi,
  a zamiennik i zapisany trening pozostają bez zmian.
- Starsze zawody bez estimatedRaceTimeSec: używana jest zachowana predykcja
  biegowa; pakiet startowy po migracji jest identyczny z eksportem v1.
- Oddzielny proces kończony między rename: zarówno resume, jak i rollback
  przywracają spójne pliki; późniejsza ręczna edycja blokuje nadpisanie.
- Wszystkie kierunki zamiany, odmowa niedostępnego wariantu jakościowego,
  kalibracja tylko właściwego sportu, zasoby, doświadczenie, sąsiedztwo akcentu
  i zawody. Łańcuch zamian nie odtwarza archiwalnego oryginału.
- Jawne cofnięcie przywraca dokładne kroki oryginału mimo zmiany kalibracji;
  nowe ID, zasoby, basen, czas i drugi człon zakładki pozostają kontrolowane.
  Test 100 operacji sprawdza, że identyfikatory nie rosną wraz z łańcuchem.
- Spontaniczny inny sport trafia do własnej objętości; adaptacja nie nadrabia
  oryginału. RPE, notatki i wykonane powtórzenia pływackie są widoczne w review.
- Niepełne jawne powiązanie aktywności nie daje pełnej sumy czasu/dystansu.
  Rozgrzewka, przerwy i send-off nie zwiększają czasu intensywnej pracy.
- Wyjątki dat zastępują okna tygodniowe również dla całych grup, T1/T2 są
  liczone raz, a jawny brak miernika mocy wyłącza liczbowy cel mocy.
- Przesunięcie przez generator nie staje się zatwierdzoną ręczną zmianą;
  nowa kalibracja nadal aktualizuje taką sesję, a ponowny plan jest idempotentny.
- Progresja do deklarowanego maksimum, lżejsze tygodnie, taper i powrót,
  pełne rozgrzewki/schłodzenia/przerwy przy skracaniu.
- Starty B/C i zakładki: zawody nie mogą stać się częścią zwykłej zakładki;
  duathlon zachowuje dwa odrębne etapy biegowe.
- Źródło + ID, kopie z różnymi offsetami czasowymi, jawne sumowanie kilku
  aktywności, blokada ponownego użycia i brak automatycznego dopasowania
  sportu odgadniętego z prędkości.
- FIT/TCX z częściami, pływanie bez GPS, dekoder Garmin FIT SDK,
  częściowy błąd publikacji i ochrona obcych zdalnych wpisów.
- Kreator PL/EN i listy sesji; przepływ MCP przez transport client/server.
- Nowe flagi w v1 kończą się instrukcją migracji bez wpisu do dziennika,
  przesunięcia lub eksportu niewłaściwej sesji. Stare wywołania pozostają poprawne.
- Kopia aktywności nie traci jawnego ID sesji na rzecz bogatszych metryk z innego
  źródła. Dopasowania jeden-do-wielu pozostają osobnymi kandydatami niezależnie
  od kolejności i nazw źródeł.
- Sprzątanie synchronizacji wymaga także prefiksu `trainctl-`; alias bez tego
  prefiksu nie uprawnia do usunięcia wpisu. MCP przyjmuje taki sam czas wykonania v2 jak
  CLI, również ułamki minut i czas powyżej 300 minut.

## Granice potwierdzenia

Nie wykonano próby na fizycznym zegarku ani importu do konkretnego klienta
kalendarza. Testy HTTP/provider używają atrap; dodatkowo przeprowadzono poniższą
próbę trzech syntetycznych sesji na żywym API Intervals.icu.
Próbę Google Calendar pominięto na prośbę użytkownika 2026-11-04.
Wcześniejsze próby uzyskania dostępu do interfejsu nie doprowadziły do importu.
Użytkownik wskazał Suunto 9 Peak Pro; generacja Garmin fēnix i dokładny model
„Suunto Sport” pozostają nieustalone. Dla 9 Peak Pro potwierdzono w dokumentacji
[obsługę SuuntoPlus Guides](https://www.suunto.com/Support/Product-support/suunto_9_peak_pro/suunto_9_peak_pro/suuntoplus-guides/)
oraz [kanał Intervals.icu → Suunto](https://forum.intervals.icu/t/upload-workouts-to-suunto-watches/9560).
Właściwa próba korzysta z adaptera `push`, Suunto app i Guides; sam odczyt FIT
przez Garmin SDK nie sprawdza tego kanału. Instrukcja pakietu odbiorowego
uwzględnia połączenie kont, aktualne daty i porównanie kroków każdej dyscypliny.
Odbiór zegarka ma status `deferred`; publikacja i odczyt przez API są potwierdzone.

Przygotowano osobny [pakiet próby Suunto 9 Peak Pro](../artifacts/suunto-9-peak-pro-uFW18I/README.md)
z terminami 5–7 listopada 2026 i trzema etapami: bieg/rower/basen, zamiana biegu
na rower, cofnięcie zamiany. Odczytowe uwierzytelnienie istniejącym kluczem
Intervals.icu przeszło; początkowa próba w ograniczonym środowisku nie uzyskała
połączenia, a ponowienie z dostępem sieciowym zakończyło się poprawnym odczytem.
Użytkownik potwierdził właściwe konto i brak połączenia Suunto. Następnie
wykonano próbę API opisaną poniżej, niezależną od synchronizacji urządzenia.

Lokalny przebieg wykonał 7 poleceń CLI oraz po dwa wywołania wspólnego handlera
push dla każdego etapu. Atrapa HTTP potwierdziła trzy aktywne wpisy, idempotencję,
usuwanie wyłącznie poprzednika tej próby i odtworzenie dokładnych kroków biegu.
Próba lokalna poprzedzała rzeczywistą publikację.

Żywe API przyjęło trzy etapy, każdy wysłany dwukrotnie: oryginał (bieg/rower/basen),
zamianę biegu na rower oraz przywrócenie biegu z archiwum. Wykonano 6 zapisów POST,
2 usunięcia DELETE ograniczone do testowych poprzedników i 18 odczytów GET.
Po każdym wysłaniu na koncie były dokładnie 3 wpisy tej próby; ponowienie
zachowało ich identyfikatory serwerowe. Usuwanie następowało po zapisie zamiennika.
Odczyt `workout_doc` potwierdził:

- bieg: 3 km rozgrzewki, 4 × (1 km + 120 s), 1 km schłodzenia; identyczne kroki
  po przywróceniu; tempa 319/259/390 s na km zgodnie ze składnią eksportera;
- rower: 2160 s / 137 W, a zamiennik 2400 s / 137 W;
- pływanie: 10 × (200 m / 132 s na 100 m + 20 s), łącznie 2000 m i 2840 s.

Serwerowa estymacja dystansu biegu obejmuje także ruch podczas przerw czasowych;
nie jest to wyłącznie suma 8 km odcinków dystansowych z opisu źródłowego.
Dowody zapisano w `api-sequence.json` i odpowiedziach `live-first.json` /
`live-repeat.json`. Końcowy zestaw obejmował przywrócony bieg 5 listopada,
rower 6 listopada i basen 7 listopada, wszystkie o 18:00, z oznaczeniem TEST S9PP.
Po decyzji użytkownika o przejściu dalej i odłożeniu połączenia Suunto usunięto
wszystkie 3 wpisy. Sprzątanie sprawdziło ID, nazwę, sport, termin i treść przed
usunięciem; odczyt końcowy potwierdził 0 wpisów tej próby i niezmienione pozostałe
treningi. Dowód: `cleanup.json`. Pierwsze uruchomienie pomocnika zatrzymało się
przed DELETE na porównaniu ścieżki bez prefiksu `/api/v1`; po poprawieniu tej
kontroli sprzątanie przeszło. Nie było to odrzucenie uprawnień ani błąd adaptera.
Przejście etapów w API nie potwierdza działania zegarka; wszystkie trzy etapy
odbioru urządzenia mają status `deferred`, bez deklarowania PASS.
Nie wykonano oceny biblioteki treningów z trenerem właściwej dyscypliny.

FIT send-off jest jawnie odrzucany; HTML/ICS zachowują opis. Tempo pływania obok
stylu jest opisowe. ICS używa lokalnego czasu bez strefy. Automatyczne FTP/CSS,
ZWO/ERG, jardy/wody otwarte i kilka szczytów sezonu nie należą do tego zakresu.

Kontrakt: [MULTISPORT.md](MULTISPORT.md). Parametry i źródła:
[MS-1–MS-5](science/MULTISPORT.md). Mapa planu: [PLAN-MULTISPORT](PLAN-MULTISPORT.md).
