# Rower, pływanie i multisport — schemat sesji v2

Wersja v2 obsługuje samodzielny rower, samodzielne pływanie oraz mieszane tygodnie.
Cele mogą być bazowe, jednodyscyplinowe albo wieloetapowe (np. triathlon, duathlon).
Każda sesja ma trwałe ID. Na jednej dacie może być kilka sesji; dziennik,
zamiana, przesunięcie i eksport identyfikują konkretną sesję.

## Początek

```sh
trainctl init --sports run,bike,swim
# W terminalu uruchomi się kreator; --template zapisuje szablon.
trainctl plan
trainctl week
trainctl check
```

`init --sports bike` i `init --sports swim` nie wymagają danych biegowych.
Kreator zbiera profile, doświadczenie, sprzęt, basen, kalibrację, okna czasu i etapy celu.
Wartości 90 min i 2 sesje w szablonie to przykładowe dane do edycji.
Zwykłe `init` nadal tworzy profil dotychczasowego silnika biegowego v1.

Przykładowa konfiguracja v2:

```yaml
schemaVersion: 2
language: pl
athlete:
  sports:
    run:
      weeklyMinutes: 90
      sessionsPerWeek: 2
      easyPaceSecPerKm: 360
      preparationMinutes: 10
      # Zamiast easyPace można podać results w dotychczasowym formacie.
    bike:
      weeklyMinutes: 120
      sessionsPerWeek: 2
      experience: regular
      resources: [bike, trainer, powerMeter]
      peakWeeklyMinutes: 160
      progressionPercent: 5
      ftpWatts: 220
      maxSessionMinutes: 90
      preparationMinutes: 10
      calibration: {date: "2026-10-20", source: "własny test FTP"}
    swim:
      weeklyMinutes: 60
      sessionsPerWeek: 2
      cssSecPer100m: 120
      poolLengthM: 25
      resources: [pool]
      experience: regular
      preparationMinutes: 15
      daysAvailable: [tue, thu, sat]
      calibration: {date: "2026-10-21", source: "własny test CSS"}
goal:
  kind: base
  name: Baza mieszana
  date: "2026-12-27"
time:
  weeklyMinutes: 400
  weekdayMinutes: 90
  weekendMinutes: 150
maxSessionsPerDay: 2
priorities: [swim, bike, run]
brick:
  day: sat
  bikeMinutes: 45
  runMinutes: 20
  transitionMinutes: 5
sync:
  files: ./activities
```

`weeklyMinutes` oznacza czas samych sesji danej dyscypliny. Budżety `time`
obejmują także przygotowanie i przejścia. `maxSessionMinutes` ogranicza czas
jednej jednostki. `priorities` określa pierwszeństwo przy częściowym rozstawieniu w ciasnym kalendarzu.
Nierozstawione sesje są wymieniane w ostrzeżeniach; solver nie obiecuje optimum.
Wyszukiwanie cofa nietrafione wybory i ma limit 5000 węzłów. Wyczerpanie limitu
jest odróżniane od braku wariantu w przeszukanych oknach.

Opcjonalne `availability` zawiera okna z polami `day`, `start`, `minutes`,
`sports`. Jeżeli je podasz, muszą obejmować dostępność **wszystkich** planowanych
dyscyplin. Przykład wpisu: `{day: tue, start: "18:00", minutes: 60, sports: [swim]}`.

`availabilityExceptions` zastępuje tygodniowe okna i `daysAvailable` dla wskazanej
daty treningowej. Pusta lista zamyka datę; nie zmienia terminu zawodów.
Wyjątki respektują generowanie, zamiana, cofnięcie zamiany, renegocjacja i desk:

```yaml
availabilityExceptions:
  "2026-11-10": []
  "2026-11-11":
    - {start: "18:00", minutes: 60, sports: [swim, bike]}
```

Przy jawnej liście `resources` cele mocy wymagają `powerMeter` (także dla trenażera
mierzącego moc). Bez niego powstaje trening czasowy z otwartym celem; sama
deklaracja FTP nie oznacza dostępu do miernika. Pominięcie całego `resources`
zachowuje zgodność ze starszym profilem v2 i nie deklaruje braku sprzętu.

Cel wielosportowy zastępuje sekcję `goal`:

```yaml
goal:
  kind: multisport
  name: Triathlon
  date: "2027-05-23"
  legs:
    - {id: swim, sport: swim, distanceM: 750, estimatedMinutes: 20}
    - {id: bike, sport: bike, distanceM: 20000, estimatedMinutes: 50}
    - {id: run, sport: run, distanceM: 5000, estimatedMinutes: 30}
  transitionsSec: [180, 120] # T1, T2; deklarowany czas, nie zalecenie
```

Dla duathlonu użyj `run/bike/run` z różnymi ID etapów. Cel jednodyscyplinowy
ma `kind: race`, `sport`, `distanceM`, `estimatedMinutes`. Szacowany czas startu
jest jawnym wejściem użytkownika. Nie powstaje ze wzoru przenoszącego formę
między sportami. Etapy zawodów są stałe, a limit zwykłych sesji dnia/tygodnia
nie obcina zawodów.
`transitionsSec` ma dokładnie o jeden element mniej niż lista etapów. Przejścia
są liczone raz w zajętym czasie, oddzielnie od objętości sportów; widać je również
w HTML i opisie kalendarza ICS. Bez tej deklaracji czas przejść wynosi zero.

## Zamiana jednostki w dowolnym z sześciu kierunków

```sh
trainctl week
trainctl replace --session <id> --to-sport bike --minutes 50 --reason "brak dostępu do bieżni" --prepare
trainctl replace --apply <id-propozycji>
trainctl log --session <id-zamiennika> --status done --minutes 40 --rpe 3
trainctl plan
trainctl check
```

`--minutes` to dostępny czas z przygotowaniem. Profil docelowego sportu musi
już istnieć w `athlete.sports`; można go dopisać także przy jednym sporcie
głównym. Nie ma przelicznika kilometrów biegu na rower czy pływanie.
Podgląd pokazuje oryginał, alternatywę i utracony cel specyficzny dla dyscypliny.
Cel jakościowy może zostać zachowany przy właściwej kalibracji, doświadczeniu
i wolnym miejscu między akcentami. W pozostałych przypadkach powstaje spokojna
alternatywa z jawną informacją o utraconym celu. Opcja `--variant endurance|quality`
pozwala wskazać wariant; niedostępny wariant jakościowy jest odrzucany.
Propozycja zawiera kierunek, zachowane/utracone elementy, ograniczenia i czas przed/po.
Pokazuje też tygodniowe minuty i znany dystans przed/po osobno dla sportów oraz
łączny czas zajęty w kalendarzu. Historia zapisuje ID zastosowanej propozycji.

Oryginał przechodzi do `archive`; zamiennik dostaje nowe ID i `replacesSessionId`.
Ponowna zamiana tworzy kolejny element łańcucha. Aktywna jest tylko ostatnia sesja.
Regeneracja zachowuje zamienniki i zatwierdzone zmiany. Wykonany zamiennik nie
tworzy drugiego, niezrealizowanego oryginału w przeglądzie.

Zapisane, przeszłe, przypięte jednostki i zawody są chronione. Zmiana profilu,
planu, dziennika, migawki aktywności albo dnia unieważnia przygotowaną propozycję.
Propozycje leżą w `plan/proposals/`; nie są automatycznie zatwierdzane.
Stary schemat v1 jawnie odrzuca flagi sesji i nowych sportów, podając polecenie
migracji. Nie ignoruje `--actual-sport`, `--session`, `--sport` ani danych serii.

Cofnięcie odtwarza treść bezpośredniego poprzednika z archiwum:

```sh
trainctl replace --session <id-aktywnego-zamiennika> --restore
trainctl replace --apply <id-propozycji-cofnięcia>
```

Zachowuje zapisane kroki, dawkę i kalibrację oryginału oraz obecne miejsce w
kalendarzu. Sprawdza aktualne okna, zasoby i limity; nie przelicza treningu na
podstawie nowego FTP/CSS/VDOT. Przy niezgodnym basenie, braku sprzętu lub czasu
odmawia. Przywrócona sesja otrzymuje nowe ID i `restoresSessionId`; wcześniejsze
ID pozostają w archiwum, żeby eksport nie wznawiał anulowanych wydarzeń.

Jeżeli inny sport został już wykonany, zapisz fakty bez przepisywania planu:

```sh
trainctl log --session <id-planowanego-biegu> --actual-sport bike --minutes 40 --rpe 4 --note "Deszcz"
trainctl review
```

`--sport` wybiera sport **planowanej** sesji, `--actual-sport` określa wykonany.
Wymagany jest rzeczywisty dodatni czas albo jawnie przypisane aktywności z czasem.
Review pokazuje oba sporty, zamiany, RPE i notatki. Objętość trafia wyłącznie do
wykonanej dyscypliny. Adaptacja nie zmienia bazy sportu, którego historia w tym
okresie zawiera świadomą zamianę; nie nadrabia automatycznie oryginału.

Wykonanie pływania może zawierać liczbę powtórzeń poszczególnych kroków:
`log --session <id-pływania> --sets 1=6,2=4 --minutes 25 --meters 800`.
Numery kroków zaczynają się od 1. Czas, dystans i liczby powtórzeń są osobnymi
danymi wykonania. Zapis części serii nie zakłada wykonania całego treningu ani
nie wylicza czasu lub dystansu z planu; pominięte wartości pozostają nieznane.

Tydzień, status i review podają udziały planowanej intensywności osobno dla sportów.
Metoda `prescribed-step-role-v1` liczy czas odcinków pracy, rozgrzewki/schłodzenia,
techniki, zawodów i odpoczynku. Przerwy między powtórzeniami i pozostały czas
send-off należą do odpoczynku. Interwały bez celu liczbowego i mieszane segmenty
biegu bez podziału czasu trafiają do kategorii nieokreślonej. Dla zachowanego
biegania używane są źródłowe segmenty i estymacja czasu; to nie pomiar stref
fizjologicznych ani intensywności faktycznego wykonania.

## Migracja dotychczasowego planu

```sh
trainctl migrate --prepare
trainctl migrate --apply <id-propozycji>
```

Migracja kopiuje oryginalne pliki do `plan/migrations/<id>/`, zachowuje źródłowy
plan i profil w `legacy`, a wpisy dziennika wiąże z ID sesji. Bieganie i siła
stają się osobnymi sesjami. Ręczne edycje, przypięcia i zatwierdzone skrócenia są
chronione; zwykłe wygenerowane sesje mogą być aktualizowane. Struktura, opisy
i dane biegowe pozostają w `legacyWorkout`. Migracja nie
przepisuje ich na ogólne szablony v2. Można je potem jawnie skracać i zamieniać.

Po migracji dodaj profil roweru/pływania do konfiguracji, następnie uruchom
`plan`. Planowanie tych sportów działa obok dotychczasowego silnika biegowego.
Nowy wynik w `athlete.sports.run.results` aktualizuje niechronione przyszłe biegi;
oryginalny profil kilometrowy pozostaje w `athlete.sports.run.running`.
Nowy profil v2 z `running.recentWeeklyKm` i wynikami również korzysta z pełnego
silnika biegania. Sam profil minutowy pozwala tworzyć otwarte jednostki czasowe.
Budżet musi zmieścić sumę zadeklarowanych sesji. Nowy cel wymaga `plan --fresh`;
historia i zatwierdzone sesje pozostają chronione. `--fresh` nie omija migracji.

Zapis wielu plików ma trwały dziennik i blokadę procesu. Po przerwaniu procesu
kolejny odczyt przywraca ostatni kompletny stan. Zamiast tego można jawnie użyć
`migrate --recover resume` lub `migrate --recover rollback`. Odzyskiwanie
odmawia nadpisania pliku ręcznie zmienionego po przerwaniu. Test dotyczy
przerwania procesu, nie awarii zasilania ani odporności każdego systemu plików.

## Pozostałe komendy

| Komenda | Zachowanie v2 |
| --- | --- |
| `today`, `week`, `why` | Sesje i sumy oddzielnie dla sportów, ID, powiązania i reguły |
| `log --session ID` | Czas, `--meters` lub `--km`, RPE, notatka; opcjonalnie jawne `--activity ID1,ID2`; `--test-time` dla biegu testowego/startu |
| `shift --session ID --to DATA` | Przenosi sesję, a zakładkę jako całą grupę; sprawdza kalendarz |
| `shorten --session ID --minutes N` | Propozycja skrócenia; pływanie zachowuje pełne powtórzenia i przerwy |
| `reschedule --block DATA --date DATA` | Propozycja rozstawienia tygodnia; `--time DATA=N`, `--pin ID`, `--preparation N --sport bike`, `--strategy long|quality`, `--apply ID` |
| `adapt --prepare` | Osobna propozycja redukcji czasu dla sportu, wyłącznie z kompletnych danych |
| `review` | Dziennik i aktywności; brak danych pozostaje nieznany, nie oznacza opuszczenia |
| `push`, `pull` | Typy Run/Ride/Swim, tożsamość sesji i zachowanie części plików multisportowych |
| `export --what all` | FIT per sesja, kalendarz ICS i samodzielny HTML |
| `check`, `diff`, `status` | Spójność kalendarza, porównanie `diff --plan PLIK`, ważność propozycji i stan sesji |

Wszystkie funkcje są dostępne przez wspólne handlery CLI/MCP, m.in.
`trainctl_replace`, `trainctl_migrate`. Interfejs ma komunikaty PL/EN.

W terminalu dostępne są także `week --interactive` oraz wybór sesji w `log`,
`shift`, `replace` i `export` bez flag. MCP i JSON korzystają z tych samych handlerów.

Dodatkowe zawody zapisuje się jako listę `tuneUpGoals`: struktura jak `goal`,
z polem `priority: B` albo `C`, bez zmiany głównego celu A. Daty muszą być
różne i nie późniejsze od głównego celu. Zakładka nie może przejąć etapu zawodów.

## Granice obsługi i metodyki

- Nowe generatory są deterministycznymi szablonami z deklarowanej objętości.
  Obsługują zadeklarowaną progresję, limit szczytu, lżejsze tygodnie, akcenty,
  taper i powrót. Parametry są opisane w [MS-1–MS-5](science/MULTISPORT.md);
  nie deklarujemy fizjologicznej walidacji całej biblioteki.
- Migrowane bieganie zachowuje dotychczasową progresję, powrót po zawodach,
  bazę i rekalibrację. Biegowy pakiet startowy z tabelą cieplną nadal jest dostępny.
- VDOT dotyczy tylko biegania, FTP tylko roweru, CSS tylko pływania. Bez liczbowej
  kalibracji sesja jest czasowa z otwartym celem intensywności.
- FIT obsługuje moc, dystans basenowy, styl, odpoczynek i pętle. Przy stylu tempo
  pływania jest opisem, a nie drugim wykonywalnym celem. Eksport `sendoffSec`
  jest jawnie odrzucany; pełny opis pozostaje w HTML/ICS. Nie deklarujemy testu
  na fizycznym zegarku. Testy i symulacja sprawdzają pliki zewnętrznym dekoderem
  Garmin FIT SDK: integralność, sport, jednostki, długość basenu i pętle.
- `push` najpierw zapisuje komplet nowych jednostek, potem usuwa wyłącznie
  rozpoznane własne, nieaktualne wpisy. Błąd lub częściowy zapis nie usuwa oryginału.
  Automatyczne testy używają atrap API; nie wykonują publikacji na żywym koncie.
- Ponowny eksport FIT sprząta tylko pliki zapisane we własnym manifeście.
  Zmniejszenie liczby sesji lub usunięcie sportu przenosi przyszłe niechronione
  jednostki do archiwum. `push` może wtedy usunąć własne nieaktualne wpisy,
  a ICS zawiera ich anulowania. Po przywróceniu konfiguracji wygenerowane
  sesje wracają z tymi samymi ID; oryginały zamienionych jednostek nie wracają.
  Chronione sesje nadal podlegają kontroli zgodności z profilem i kalendarzem.
- Eksport ICS zapisuje wersje zdarzeń w `plan/calendar.json`. Zachowaj ten plik
  razem z planem: zmiana treści, anulowanie lub reaktywacja zwiększa `SEQUENCE`
  tego samego UID. Dotyczy to także rekalibracji i ręcznej edycji YAML.
  Ponowny eksport bez zmian daje identyczny plik; filtrowanie nie kasuje historii
  pominiętych sesji. Uszkodzony zapis wersji blokuje eksport zamiast zerować licznik.
  Pola `DTSTAMP` i `LAST-MODIFIED` zapisują czas aktualizacji eksportowanej treści
  w UTC; starty pozostają lokalnymi godzinami bez strefy. Znaczenie tych pól opisuje
  [RFC 5545, §3.8.7](https://www.rfc-editor.org/rfc/rfc5545.html#section-3.8.7.2).
  Obsługa ponownego importu i anulowań zależy od klienta kalendarza.
  Anulowanie zachowuje także godzinę, typ daty i czas oryginału. Niezależny parser
  ICAL.js sprawdza eksporty, w tym UTF-8, nowe linie i kolejne wersje zdarzeń.
  `pnpm simulate:multisport --artifacts` zachowuje syntetyczne ICS, FIT i HTML
  w nowym katalogu `artifacts/`, wraz z instrukcją ręcznej próby i manifestem.
- FIT/TCX zachowuje osobne części z `parentActivityId`, `partIndex` i `startTime`.
  TCX z typem `Other` pozostaje nierozpoznany. Czas bez informacji o strefie
  korzysta z dotychczasowych reguł importera. Niejednoznaczne dopasowania
  aktywności wymagają jawnego wskazania w dzienniku.
- Identyfikatory aktywności są rozdzielone według źródeł. Kopie są scalane
  tylko przy zgodnym sporcie, czasie z jawną strefą, czasie trwania i dystansie.
  Dopasowanie musi być wzajemnie jednoznaczne w całej powiązanej grupie źródeł.
  Jeśli A pasuje do B, a B do C, lecz A nie pasuje do C, wszystkie trzy zapisy
  pozostają osobno. Dotyczy to również sprzecznych powiązań z sesjami planu;
  wybór jednego zapisu w `log --activity` nie dołącza pozostałych. Dwie podobne
  aktywności z jednego źródła nie są arbitralnie przypisywane do jednej kopii.
  Jawne powiązanie z sesją jest zachowywane również z mniej szczegółowej kopii.
  Bez takich danych dopasowanie pozostaje niejednoznaczne. Typ odgadnięty
  z prędkości nie daje automatycznego zaliczenia treningu.

## Weryfikacja

```sh
pnpm typecheck
pnpm exec vitest run --configLoader native
pnpm simulate:multisport
pnpm build
pnpm verify:distribution --online
```

Symulacja uruchamia rzeczywistą binarkę CLI w osobnym katalogu tymczasowym:
utworzenie planu, sześć kierunków zamiany, zatwierdzenie, regeneracja, dziennik,
walidacja i eksport. Nie odczytuje ani nie zmienia planu użytkownika, nie używa sieci.
Testy obejmują też MCP, migrację, zakładki, zawody, import części aktywności,
dekodowanie FIT i błąd częściowej publikacji.
