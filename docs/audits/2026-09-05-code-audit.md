# Audyt kodu i przydatności treningowej — 0.2.0

Data: 2026-09-05. Kod: commit `70b40c4`, tag `v0.2.0`.

**Wniosek: projekt ma użyteczny model lokalnego planu i uzasadnień, ale poprawność
przepływu treningowego nie jest jeszcze zapewniona. Najpierw należy naprawić
rozbieżności obciążeń, eksportu i stanu adaptacji. Część ustaleń dotyczy także
zmian dodanych przeze mnie do 0.2.0. Wcześniejsze testy nie uzasadniały twierdzenia,
że rozwiązanie jest kompletne.**

## Metoda i granice

Prześledzono profil → kalibrację → makrocykl → mikrocykle → siłę → dziennik/sync
→ adaptację → zapis propozycji → renegocjację → eksport FIT/intervals.icu.
Odczytano również predykcję, walidator i testy istotne dla tych przepływów.
Nie ograniczano się do README ani opisów funkcji.

Wnioski wykonawcze odtworzono na syntetycznych profilach bez kontaktu z kontem
treningowym, bez zmiany programu i bez modyfikacji rzeczywistego planu użytkownika.
Dołączony [skrypt](2026-09-05-reproduce.mjs) zakończył się powodzeniem: 13 prób,
obejmujących 12 grup ustaleń. Jego asercje potwierdzają **istnienie problemów**,
nie poprawność programu. Po ich naprawie odpowiednie asercje przestaną przechodzić.

Uruchomienie w repozytorium z zainstalowanymi zależnościami:

```sh
node docs/audits/2026-09-05-reproduce.mjs
```

Skrypt zapisuje syntetyczne plany wyłącznie w nowych katalogach systemowego TEMP.
Próby czasu odnoszą się do daty audytu; niektóre operacje celowo używają dat
historycznych albo jawnej daty symulacji.

585 testów i build przeszły przed publikacją tego samego kodu. W tym audycie
wykonano dodatkowe próby scenariuszowe, a nie ponowny pełny przebieg identycznego
zestawu. Analiza testów `improvements.test.ts` pokazuje m.in., że próba redukcji
sprawdza zachowanie przeszłości i istnienie zmian, ale nie ich zgodność z nową
bazą ani trwałość redukcji po późniejszej rekalibracji.

To audyt implementacji i jej konsekwencji produktowych. Nie jest walidacją
skuteczności fizjologicznej planów, przeglądem całej literatury ani pełnym audytem
bezpieczeństwa, współbieżności, protokołu FIT i usług zewnętrznych. Nie dowodzi
braku innych błędów. Priorytety poniżej odnoszą się do poprawności produktu,
nie do wyliczonego ryzyka urazu.

## Najważniejsze potwierdzone ustalenia

### A01 — wysoki: mikrocykl nie realizuje budżetu makrocyklu, a lint ukrywa część odstępstw

**Próba:** baza 10 km/tydzień, pięć dostępnych dni, cel HM. Pierwszy szkielet
przewiduje 11 km, ale jednostki sumują się do **19 km**: interwały 8 km, długie
4 km i bieg ciągły 7 km. Udział easy wynosi 63,2%, a walidator nie zgłasza dla
tego tygodnia żadnego problemu. Dodatkowa próba z bazą 5 km dała 17 km.
Przy bazie 45 km wystąpił również niedobór: cel 49 km, realizacja 41 km.

**Kod:** [macrocycle.ts:119](../../packages/core/src/engine/macrocycle.ts#L119)
wybiera liczbę akcentów z liczby dostępnych dni. [microcycle.ts:421](../../packages/core/src/engine/microcycle.ts#L421)
stosuje minimalne wielkości części głównych i stałą ramę rozgrzewki/schłodzenia.
Pozostała objętość trafia tylko do istniejących slotów easy. [validate.ts:314](../../packages/core/src/engine/validate.ts#L314)
tłumi ostrzeżenie I-5, gdy części główne są już krótkie. Nie sprawdza zgodności
`totalKm` z `skeleton.targetKm` jako osobnej reguły.

**Skutek:** ustawiony kilometraż i komunikat o progresji nie opisują faktycznie
wygenerowanego obciążenia. Nie jest to wyłącznie kosmetyka podsumowania.

**Naprawa:** ustalać wykonalny zestaw jednostek w ramach budżetu; przy zbyt małej
bazie ograniczyć ich liczbę/rodzaj albo odmówić danego wariantu. Pokazywać jawnie
docelową i rzeczywistą objętość oraz odstępstwo. Testować macierz baz i dostępności,
a nie tylko typowy profil z korpusu. Dokładne reguły doboru bodźców wymagają
osobnego uzasadnienia treningowego.

### A02 — wysoki, dotyczy 0.2.0: adaptacja odtwarza dawną progresję i nie zachowuje skutecznej bazy

**Próba:** profil 55 km, plan od 3 sierpnia, redukcja 5 września do bazy 20 km.
Tydzień 7 września otrzymuje cel **28 km**, faktycznie 25 km. Po zastosowaniu
redukcji i dodaniu nowego wyniku propozycja zawierająca wyłącznie rekalibrację
stref podnosi ten sam tydzień z **25 do 63 km**.

**Kod:** [proposals.ts:43](../../packages/cli/src/proposals.ts#L43) zmienia bazę
jedynie w kopii konfiguracji, po czym liczy plan od `plan.generatedAt`, nie od
punktu adaptacji. [applyProposal:95](../../packages/cli/src/proposals.ts#L95)
zapisuje plan, ale nie utrwala skutecznej bazy w stanie używanym przez kolejne
obliczenie. Kolejna rekalibracja ponownie czyta oryginalne 55 km z konfiguracji.

**Skutek:** etykieta działania „rekalibracja stref” nie ogranicza zmian do stref;
może cofnąć wcześniejszą decyzję o kilometrażu. Pełny diff jest widoczny, więc nie
jest to niewidoczna podmiana, lecz propozycja jest semantycznie błędna.

**Naprawa:** rozdzielić aktualizację temp od rekonstrukcji objętości, przechowywać
zatwierdzony stan obciążeń i kotwicę adaptacji. Zachować daty faz, ale nie naliczać
wstecz progresji na nowej bazie. Test sekwencji: redukcja → zastosowanie → nowy
wynik → rekalibracja bez niezamówionej zmiany kilometrażu.

### A03 — wysoki: starty zniekształcają ocenę wykonania i czas

**Próba:** wykonano wszystkie treningi oraz zaplanowany półmaraton kontrolny.
Plan ma 32 km treningowe i 0 km startu. Analiza zgłasza **166% wykonania** oraz
jednocześnie `post-race-recovery` i `raise-baseline`. Estymator samego startu
zwraca **15 minut**, czyli wyłącznie domyślne przygotowanie.

**Kod:** [microcycle.ts:226](../../packages/core/src/engine/microcycle.ts#L226)
i `buildTuneUp` zapisują dystans 0, bez dystansu segmentu startowego.
[execution.ts:24](../../packages/cli/src/execution.ts#L24) uwzględnia rzeczywiście
przebiegnięte kilometry; [adapt.ts:84](../../packages/core/src/engine/adapt.ts#L84)
dzieli je przez sumę planowaną. Estymator nie ma danych o dystansie startu.

**Naprawa:** osobno modelować kilometry treningowe, startowe i łączne; stosować
ten sam zakres po obu stronach porównania. Brak wiarygodnej estymacji czasu
zawodów powinien być oznaczony jako brak, zamiast 15 minut. Rozstrzygać sprzeczne
działania przed przedstawieniem propozycji. Obecnie `--prepare` odmawia zapisania
automatycznej łatki przy obecności regeneracji — to ogranicza skutek, ale nie
naprawia błędnej analizy.

### A04 — wysoki: plan, eksport i estymator opisują różne treningi

**Próby:**

- Podbiegi: plan **9 km**, FIT **12 km**. Eksport dodaje 15 zbiegów po 200 m,
  których nie uwzględniają kilometry planu ani estymator. To 3 km dodatkowej
  pracy pominiętej przy negocjowaniu czasu.
- Bieg zmienny 5 km: FIT i składnia intervals.icu tworzą dwie pary po 1+1 km,
  czyli **4 km**. Ostatni kilometr znika.
- Z kodu: powtórzenia eksportują przerwę po każdym odcinku, także ostatnim,
  podczas gdy estymator liczy `reps - 1` przerw. Progresja zaokrągla każdą
  tercję osobno i nie wyrównuje końcowego dystansu.

**Kod:** [microcycle.ts:88](../../packages/core/src/engine/microcycle.ts#L88),
[duration.ts:8](../../packages/core/src/engine/duration.ts#L8),
[fit.ts:190](../../packages/export/src/fit.ts#L190),
[fit.ts:221](../../packages/export/src/fit.ts#L221),
[workout-syntax.ts:80](../../packages/sync-intervalsicu/src/workout-syntax.ts#L80).

**Naprawa:** jeden rozwinięty model kroków pracy i odpoczynku dla sum, czasu,
FIT i intervals.icu; zachowanie reszty nieparzystego dystansu. Testy równości
znaczenia treningu między formatami, nie tylko obecności poprawnych rekordów.
Są to rozbieżności własnych konwerterów; nie testowano fizycznego zegarka.

### A05 — wysoki, częściowo 0.2.0: upływ czasu nie unieważnia propozycji

**Próba:** propozycja przygotowana dla 10 sierpnia daje się zastosować 5 września
przy niezmienionych plikach; w zapisanym skrypcie zmienia dziewięć dni wcześniejszych
niż dzień audytu. Ponadto `reschedule --date 2026-08-03 --block 2026-08-04 --apply`
przesuwa sierpniowy trening mimo wrześniowej daty systemowej.

**Kod:** [proposals.ts:102](../../packages/cli/src/proposals.ts#L102) kontroluje
wyłącznie hash danych, nie bieżącą datę. [commands.ts:909](../../packages/cli/src/commands.ts#L909)
ustala ochronę przeszłości względem wybranego `--date`, które jest jednocześnie
selektorem tygodnia.

**Naprawa:** odróżnić datę symulacji, wybór tygodnia i rzeczywisty moment zapisu.
Przed zapisem sprawdzać, czy zmieniane dni stały się przeszłością; historyczną
edycję dopuścić jako osobny, jawny tryb. Hash poprawnie chroni zmianę plików,
ale sam nie spełnia obietnicy ochrony przeszłości.

### A06 — wysoki: wpisane zawody znikają bez rozstrzygnięcia konfliktu

**Próba:** start B 21 listopada wypada z planu, bo jest w taperze przed HM
29 listopada. Z pary startów 12 i 13 września pozostaje tylko pierwszy.
`feasibilityWarnings` jest puste.

**Kod:** [macrocycle.ts:125](../../packages/core/src/engine/macrocycle.ts#L125)
przechowuje jedną imprezę na tydzień; przypisanie `tuneUp` do szkieletu wymaga
`!inTaper`. Dodatkowo jeden start gdziekolwiek w sezonie wyłącza fallback
sprawdzianów w całym planie przez warunek `tuneUps.length === 0` (linia 209).

**Naprawa:** nie usuwać wpisanego zobowiązania z kalendarza. Zwrócić jawny konflikt
do decyzji lub obsłużyć oba zdarzenia. Ocena luki w kalibracji powinna zależeć
od najbliższych pomiarów, a nie od pustki całego kalendarza.

### A07 — średni: preferowany dzień długiego działa tylko w renegocjacji

**Próba:** `longRunDay: sun`, dostępne sobota i niedziela; generator wybiera sobotę.

**Kod:** [microcycle.ts:395](../../packages/core/src/engine/microcycle.ts#L395)
korzysta z `style.longRunDayPreference`, nie z profilu.
[commands.ts:904](../../packages/cli/src/commands.ts#L904) uwzględnia profil dopiero
przy wywołaniu solvera.

**Naprawa:** wspólne rozstrzyganie preferencji przy generacji, adaptacji i
renegocjacji; gdy preferencji nie da się spełnić, komunikat z przyczyną.

### A08 — średni: blokada dnia nie obejmuje siłowni

**Próba:** zablokowany piątek nadal zawiera 35 minut siły.

**Kod:** [reschedule.ts](../../packages/core/src/solver/reschedule.ts) usuwa
zablokowane dni ze slotów biegowych, ale przy odtwarzaniu dni zachowuje `d.strength`.

**Naprawa:** zdefiniować zakres blokady w interfejsie i obsłużyć całą aktywność
dnia. Wspólna walidacja budżetu i blokady dla biegania i siły; przy braku miejsca
pokazać przeniesienie albo odpuszczenie. Nie wystarczy zmienić opis polecenia.

### A09 — średni: `shift` omija część reguł obowiązujących w `reschedule`

**Próba:** można przesunąć kontrolny start z soboty 8 sierpnia na niedzielę
9 sierpnia. To zmiana faktycznej daty imprezy, a nie zwykłej jednostki.

**Kod:** [planfile.ts:304](../../packages/cli/src/planfile.ts#L304) chroni tylko
`skeleton.raceDate`, czyli cel główny. Nie uwzględnia startów B/C. Ta ścieżka
nie kontroluje też `pinned` ani zapisanych budżetów czasu; `cmdShift` zapisuje
wynik bez pełnego `validatePlan`. Zbiór `QUALITY_KINDS` nie zawiera testu i startu.

**Naprawa:** wspólna kontrola ograniczeń dla każdej operacji zmieniającej plan;
zamiana powinna uwzględniać oba kierunki i sąsiedztwo między tygodniami.

### A10 — średni: dziennik przyjmuje nieprawidłowy kilometraż

**Próba:** `cmdLog` zwraca powodzenie dla `--km -5`, `--km abc` i `--km Infinity`.

**Kod:** [commands.ts:471](../../packages/cli/src/commands.ts#L471) wykonuje
`Number(opts.km)` bez sprawdzenia skończoności i zakresu. Poprawna walidacja RPE
kilka linii wcześniej nie obejmuje pozostałych danych.

**Naprawa:** walidacja liczb skończonych, nieujemności i sensu statusu przed zapisem.
Analogicznie sprawdzić konfigurację oraz czas. `NaN` i `Infinity` serializują się
w JSON do `null`, co później może uruchomić fallback do kilometrów planu.

### A11 — wysoki: czas całej sesji jest proponowany jako wynik sprawdzianu

**Próba:** trening obejmuje 3 km rozgrzewki, 5 km testu i 1 km schłodzenia.
Zapis wykonania 9 km w 54:00 daje sugestię wpisania wyniku **5 km w 54:00**.

**Kod:** [commands.ts:717](../../packages/cli/src/commands.ts#L717) bierze dystans
z segmentu testowego, ale czas z `log.timeSec` całego treningu. Identyfikacja
niezamkniętej kalibracji używa lokalnego dziennika, nie pełnego wspólnego modelu
wykonania, więc sam zsynchronizowany test nie zamyka tego przepływu.

**Naprawa:** osobny zapis wyniku odcinka pomiarowego z jego czasem i dystansem.
Bez niego poprosić o wynik, a nie podpowiadać gotową parę z niewłaściwego czasu.
Obecnie to sugestia dla użytkownika, nie automatyczne wpisanie wyniku do profilu.

### A12 — średni, ograniczenie: deklaracja zachowania częstotliwości nie jest realizowana

**Próba:** profil z siedmioma dostępnymi dniami i bazą 70 km: sześć sesji w peak,
pięć w taperze i cztery, wliczając zawody, w tygodniu startowym. Dwa ostatnie
tygodnie mają `keepFrequency: true`.

**Kod:** [macrocycle.ts:227](../../packages/core/src/engine/macrocycle.ts#L227)
ustawia flagę, lecz generator jej nie odczytuje. Liczba sesji wynika z kilometrażu;
tydzień startowy używa osobnego limitu trzech treningów przed zawodami.

**Naprawa:** określić, co dokładnie ma oznaczać utrzymanie częstotliwości w danym
planie, i przekazać tę liczbę do generatora. Jeżeli jest to tylko preferencja,
opisać odstępstwo. Sama różnica nie stanowi tu dowodu szkody treningowej —
potwierdzona jest niespójność deklarowanej reguły z zachowaniem.

## Funkcje, które warto rozważyć po naprawach

Poniższe propozycje wynikają z brakujących danych i przepływów w kodzie.
Nie są gotowymi protokołami treningowymi ani obietnicą poprawy wyniku.

| Priorytet | Funkcja | Konkretna podstawa w implementacji | Kryterium przydatności |
|---|---|---|---|
| 1 | Ocena wykonania celu jednostki i zapis pomiarów | `buildExecution` agreguje biegi po dacie i kilometrach. Krótki spokojny bieg w dniu interwałów może dostać status `done`; model wykonania nie ma odcinków. | Rozróżnia wykonanie, zamianę i częściowe wykonanie. Test ma własny wynik, a rozgrzewka nie zmienia kalibracji. Nie wnioskuje o interwałach z samego dystansu. |
| 2 | Warianty treningu na dostępny czas | Solver przenosi/usuwa całe `PlannedWorkout`; nie tworzy wariantów. Budżety są jednorazowe, przypisane do dat, zamiast stanowić wejście pierwotnej generacji. | Użytkownik dostaje pełny i krótszy wariant z opisem zachowanego celu, kosztu skrócenia i łącznego czasu. Parametry wariantów wymagają uzasadnienia treningowego. |
| 3 | Kontrolowany powrót po przerwie i okres po zawodach | `prepareProposal` odmawia przy `post-race-recovery`/`conservative-restart`; makrocykl kończy się na tygodniu celu. | Można zaplanować dalszy tydzień na podstawie jawnie potwierdzonych ograniczeń i przygotować diff do zatwierdzenia. Bez udawania diagnozy medycznej lub automatycznego powrotu po urazie. |
| 4 | Repertuar jednostek zależny od celu i doświadczenia | `planNormalWeek` dostaje szkielet i strefy, ale nie cel dystansowy ani historię konkretnych bodźców. Akcenty wybiera z kilku stałych konstrukcji, a długi jest zawsze spokojny. | Różnicowanie planu 5 km, HM i maratonu wykracza poza objętość, długość taperu i test. Zmiany mają konkretne uzasadnienie, bez losowego dodawania odmian. |
| 5 | Jawne zarządzanie aktualnością kalibracji | `computePlan` wybiera najwyższy VDOT z 540 dni; `calibrationChanged` porównuje listy wyników, nie zmianę ich aktualności wraz z czasem. `terrain` nie wpływa na obliczanie stref. | Pokazanie starego rekordu i świeżych wyników obok siebie; możliwość świadomego wyboru wyniku referencyjnego. Ostrzeżenie o zmianie ważności, bez arbitralnego automatycznego obniżania formy. |
| 6 | Tryb regularnego biegania i wejścia w trening bez daty zawodów | `TrainctlConfig` wymaga `goal`, generator kończy na starcie; brak odrębnego programu opartego na czasie i marszobiegu. A01 ujawnia niedopasowanie istniejących minimów do małych baz. | Plan pod regularność/liczbę sesji i dostępny czas; oddzielny zakres obsługiwanych poziomów. Nie używać jednego szablonu dla wszystkich profili. |
| 7 | Dziennik i rozwój siły oraz kontekst regeneracji | `strengthSession()` zwraca stałe 35 minut i ten sam opis. Brak modelu wykonania siły. Wellness jest pobierane, ale nie bierze udziału w przeglądzie trenerskim; RPE jest cytowane. | Możliwość zapisania wykonania siły i porównania subiektywnego przebiegu tygodni. Kontekst do rozmowy, bez wymuszania algorytmu obciążeń z HRV/RPE. |

Dodatkowe obserwacje statyczne: walidacja dat sprawdza głównie format regex,
`validatePlan` zakłada poprawność części zagnieżdżonych segmentów, a kalibracja
i predykcja mają różne polityki wyboru wyników. To obszary do dalszych osobnych
prób. Nie doliczono ich do potwierdzonych scenariuszy ani nie przedstawiono jako
udowodnionych awarii.

## Kolejność prac

1. **Spójne obciążenie i stan:** A01, A02, A03, A04, A11. Jedna semantyka
   dystansu/czasu i odrębne operacje zmiany stref oraz objętości.
2. **Niezawodność zmian kalendarza:** A05, A06, A07, A08, A09, A10, A12.
   Wspólne ograniczenia zapisu, pełny kalendarz zawodów, jawne odstępstwa.
3. **Domknięcie pętli treningowej:** wykonanie celu jednostki, osobny wynik testu,
   krótsze warianty, powrót i plan po starcie.
4. **Dopiero potem poszerzanie programu:** różne cele/poziomy, regularne bieganie,
   bogatszy tor siły i kontekst regeneracji.

Warunek odbioru napraw: testy z powyższych scenariuszy mają sprawdzać oczekiwane
zachowanie oraz niezmienność właściwych danych w sekwencji wielu operacji.
Liczba przechodzących testów sama w sobie nie jest kryterium gotowości.

W tym audycie utworzono wyłącznie raport i skrypt odtworzenia. Nie naprawiano
silnika, nie generowano planu użytkownika, nie wykonywano commita ani publikacji.
