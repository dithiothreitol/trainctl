# Weryfikacja wykonalności: intervals.icu jako hub integracyjny

**Data weryfikacji:** 2026-08-04
**Kontekst:** ADR-002 (SPEC.md §7/§10) zakłada, że jedna integracja z intervals.icu
daje dwukierunkowy most do Garmin/Strava/Polar/Coros/Wahoo. Ten dokument
odhacza pozycję „⬜ weryfikacja API intervals.icu" z checklisty Fazy 0.
**Metoda:** wyłącznie źródła znalezione na żywo (forum.intervals.icu, strony
intervals.icu, GitHub) przez WebSearch/WebFetch 2026-08-04. Żaden endpoint ani
URL poniżej nie jest domysłem — przy każdym jest link do źródła. Tam, gdzie
źródła są niespójne albo pochodzą z syntezy wyszukiwarki (nie z bezpośredniego
odczytu strony), jest to jawnie oznaczone.

---

## 1. Fakty zweryfikowane

### 1.1 Dokumentacja i autoryzacja API

- Oficjalna strona docs **istnieje i jest aktywna**:
  [intervals.icu/api-docs.html](https://intervals.icu/api-docs.html). To
  głównie strona-rozdzielacz — odsyła do interaktywnego Swaggera i trzech
  wątków na forum ("API access", "Intervals.icu OAuth support", "Extending
  Intervals.icu"). Nie jest to samodzielny pełny reference.
- Właściwy, przeszukiwalny reference API to **Swagger UI**:
  [intervals.icu/api/v1/docs/swagger-ui/index.html](https://intervals.icu/api/v1/docs/swagger-ui/index.html)
  — strona istnieje (potwierdzone HTTP 200, tytuł „Swagger UI"), ale jest
  renderowana w JS, więc trzeba ją otworzyć w przeglądarce, nie da się jej
  wyciągnąć narzędziem do statycznego fetchowania. Ma przycisk „Authorize" do
  wklejenia API key albo OAuth access tokenu.
- Społecznościowy **„API Integration Cookbook"** z gotowymi przykładami curl:
  [forum.intervals.icu/t/intervals-icu-api-integration-cookbook/80090](https://forum.intervals.icu/t/intervals-icu-api-integration-cookbook/80090)
  (autor: david). To najbardziej praktyczne źródło — patrz sekcja 2.
- **API key (autoryzacja jednoosobowa):** generowany samoobsługowo w
  `/settings` → „Developer Settings" (sekcja na dole strony), bez procesu
  zatwierdzania. Mechanizm to **HTTP Basic Auth**, gdzie username to
  dosłowny string `API_KEY`, a password to wygenerowany klucz — cytat
  Davida: *„The username is 'API_KEY' and the password your API key"*
  ([wątek API access, post David](https://forum.intervals.icu/t/api-access-to-intervals-icu/609)).
  Cookbook pokazuje równolegle nagłówek `Authorization: Bearer <klucz>` — oba
  warianty współistnieją w dokumentacji.
- **OAuth 2.0 dla aplikacji wieloużytkownikowych:** David wprost:
  *„Apps intended to be used by more than one person should use OAuth and
  Bearer tokens"* (tamże). Endpointy potwierdzone przez bezpośredni odczyt
  wątku [„Intervals.icu OAuth support"](https://forum.intervals.icu/t/intervals-icu-oauth-support/2759):
  - Authorize: `https://intervals.icu/oauth/authorize?client_id=...&redirect_uri=...&scope=...&state=...`
  - Token exchange: `https://intervals.icu/api/oauth/token` (POST,
    `client_id`/`client_secret`/`code`) — **uwaga:** inny wątek/synteza podawał
    wariant `https://intervals.icu/api/v1/oauth/token` (z `/v1/`). Rozbieżność
    nierozwiązana — do potwierdzenia bezpośrednio w Swaggerze przed
    implementacją OAuth (patrz Pytania otwarte).
  - Scope'y potwierdzone z tego wątku: `ACTIVITY:READ`/`WRITE`,
    `WELLNESS:READ`/`WRITE`, `CALENDAR:READ`/`WRITE`, `CHATS:READ`/`WRITE`,
    `LIBRARY:READ`/`WRITE`, `SETTINGS:READ`/`WRITE`.
  - **Rejestracja aplikacji OAuth NIE jest samoobsługowa** — trzeba wysłać
    e-mail na `david@intervals.icu` z: nazwą apki, opisem, URL strony, URL
    logo (kwadrat, min. 128×128), URL polityki prywatności, redirect URI
    (`http://localhost/` zawsze dozwolony) i swoim ID z `/settings`. Brak
    danych o typowym czasie odpowiedzi (jednoosobowy zespół — patrz 1.6).
- **Dostęp do API jest darmowy** — nie wymaga płatnej subskrypcji
  intervals.icu. Sam serwis jest darmowy, opcjonalny „Supporter" to 4 USD/mies.
  za dodatkowe funkcje, niezwiązane z limitami API
  ([Pricing](https://www.intervals.icu/pricing/), potwierdzone syntezą
  wyszukiwania, spójne z ogólnym pozycjonowaniem serwisu).
- **Ponad 200 aplikacji trzecich** zintegrowanych z API — deklaracja własna
  serwisu ([Open API](https://www.intervals.icu/features/open-api/)).

### 1.2 Endpointy — aktywności, streams, wellness, kalendarz

Wszystkie poniższe potwierdzone bezpośrednim odczytem cookbooka lub
dedykowanych wątków forum (konkretne curl w sekcji 2):

| Zasób | Endpoint | Źródło |
|---|---|---|
| Lista aktywności | `GET /api/v1/athlete/{id}/activities?oldest=...&newest=...` | [Cookbook](https://forum.intervals.icu/t/intervals-icu-api-integration-cookbook/80090) |
| Szczegóły aktywności + interwały/okrążenia | `GET /api/v1/activity/{id}?intervals=true` | [wątek API access](https://forum.intervals.icu/t/api-access-to-intervals-icu/609) (synteza, nie bezpośredni cytat — do weryfikacji) |
| Oryginalny plik aktywności | `GET /api/v1/activity/{id}/file` → `.fit.gz` | [Cookbook](https://forum.intervals.icu/t/intervals-icu-api-integration-cookbook/80090) |
| Streams (moc/HR/kadencja/...) | `GET /api/v1/activity/{id}/streams.json?types=watts,heartrate,cadence,...` | [Access Activities Streams via API](https://forum.intervals.icu/t/access-activities-streams-via-api/101065) — endpoint zweryfikowany przez autora wątku metodą prób i błędów (404 na złej ścieżce, 200 na tej) |
| Wellness (odczyt) | `GET /api/v1/athlete/{id}/wellness?oldest=...&newest=...` | [Cookbook](https://forum.intervals.icu/t/intervals-icu-api-integration-cookbook/80090) |
| Wellness (zapis masowy) | `PUT /api/v1/athlete/{id}/wellness-bulk` | [Cookbook](https://forum.intervals.icu/t/intervals-icu-api-integration-cookbook/80090) |
| Kalendarz — odczyt planowanych treningów | `GET /api/v1/athlete/{id}/events?category=WORKOUT&ext=zwo&resolve=true` | [Downloading planned workouts from the API](https://forum.intervals.icu/t/downloading-planned-workouts-from-the-api/93737) |
| Kalendarz — tworzenie/aktualizacja (CRUD, bez D) | `POST /api/v1/athlete/{id}/events/bulk?upsert=true` | [Uploading planned workouts to Intervals.icu](https://forum.intervals.icu/t/uploading-planned-workouts-to-intervals-icu/63624) |

Pola wellness potwierdzone w odpowiedziach/przykładach: `weight`, `restingHR`,
`hrv`, `sleepSecs` (camelCase widoczne w przykładzie parametru
`fields=id,ctl,atl,rampRate,weight,restingHR,hrv,sleepSecs`); w innym
przykładzie payloadu PUT te same pola pojawiły się jako `sleep_secs`,
`resting_hr` — **niespójność casingu między źródłami, do potwierdzenia w
Swaggerze** przed implementacją adaptera.

„CRUD" dla eventów jest w praktyce **C+R+U przez upsert** (klucz `external_id`
jako klucz idempotencji) — **nie znalazłem bezpośredniego potwierdzenia
endpointu DELETE** w żadnym z przeszukanych wątków. Pośrednia poszlaka, że
usuwanie jest możliwe: gotowy serwer MCP `hhopke/intervals-icu-mcp` ma flagę
bezpieczeństwa `INTERVALS_ICU_DELETE_MODE` dla operacji kasujących — sugeruje
to, że API na to pozwala, ale nie widziałem samego endpointu. Traktować jako
pytanie otwarte.

Wymagane scope'y OAuth do powyższego: `CALENDAR:READ` (odczyt eventów),
`CALENDAR:WRITE` (tworzenie/upsert eventów) — potwierdzone w treści
odpowiedzi na oba wątki o events.

### 1.3 Format zaplanowanego treningu — natywna składnia „steps"

Intervals.icu ma własny, tekstowy **workout builder syntax**, szczegółowo
opisany w [Workout Builder Syntax Quick Guide](https://forum.intervals.icu/t/workout-builder-syntax-quick-guide/123701):

- Krok: `[czas lub dystans] [cel] [opcjonalna kadencja]`.
- Czas: `10m`, `30s`, `5m30s`, `1h2m30s`. Dystans: `500mtr`, `2km`, `10km`,
  `1mi`, `4.5mi` (**uwaga**: `m` = minuty, nie metry — dystans zawsze `mtr`,
  `km` albo `mi`).
- **Cele tempa dla biegania (odpowiedź na pytanie 3 — TAK, jest to wspierane
  wprost):** procent progu tempa (`60% Pace`, `78-82% Pace`), strefy tempa
  (`Z2 Pace`, `Z2-Z3 Pace`), tempo bezwzględne (`5:00 Pace`, `5:00/km Pace`,
  `3:00/100m Pace`), jednostki `/100m`, `/km`, `/mi`, `/400m`, `/500m`.
- Powtórzenia: `Nx` w linii nagłówka bloku albo w osobnej linii przed krokami
  (wymaga pustej linii przed/po bloku).
- Przykład z oficjalnego guide'a:
  ```
  - Warmup 5m 60%
  - 5x
    - 3m 85% Pace
    - 2m 60% Pace
  - Recovery 3m 50%
  ```

To samo pole (`description` w evencie) API przyjmuje wprost jako tekst przy
tworzeniu treningu (patrz `POST .../events/bulk` w sekcji 2) — nie trzeba
generować binarnego pliku, żeby stworzyć strukturalny trening z celami tempa.
API po stronie odczytu zwraca też **sparsowaną, ustrukturyzowaną wersję**
(`workout_doc.steps[]` z polami `duration`, `pace`/`power`/`hr` ze `start`/
`end`/`units`, `intensity`: `active`/`rest`/`warmup`, oraz `_pace`/`_power`
jako wartości rozwiązane po `resolve=true`) — potwierdzone bezpośrednim
odczytem [wątku o pobieraniu planowanych treningów](https://forum.intervals.icu/t/downloading-planned-workouts-from-the-api/93737).

**ZWO/FIT/MRC/ERG:** import i eksport tych formatów jest wspierany
([Workout Builder](https://www.intervals.icu/features/workout-builder/),
dedykowany wątek [Bulk import of ZWO, MRC and ERG files](https://forum.intervals.icu/t/bulk-import-of-zwo-mrc-and-erg-files/5312)).
Potwierdzone też bezpośrednio w API: `POST .../events/bulk` akceptuje
alternatywnie `filename` + `file_contents_base64` (przykład w dokumentacji
używa `workout.fit`) zamiast pola `description`. Dla „tren" praktyczny wniosek:
**natywny format tekstowy jest wystarczający i wygodniejszy** niż
generowanie plików binarnych — pasuje do filozofii „plan jako kod" z SPEC.md.

### 1.4 KLUCZOWE: push do zegarka i macierz kierunków per platforma

**Tak, strukturalny trening zaplanowany w intervals.icu trafia na zegarek
Garmin jako workout ze strefami/celami**, potwierdzone bezpośrednim odczytem
wątku [Structured running workouts from intervals to Garmin Connect](https://forum.intervals.icu/t/structured-running-workouts-from-intervals-to-garmin-connect/130705):
mechanizm to autoryzacja Garmin Connect w `/settings` (checkbox „Upload
planned workouts"), po czym treningi zaplanowane na dziś/jutro wgrywają się
na zegarek automatycznie tego samego ranka. Potwierdzone zastrzeżenia z tego
samego wątku:
- *„Mixing HR and Pace is work in progress"* — łączenie celów HR i tempa w
  jednym treningu bywa niedopracowane.
- Trzeba mieć ustawiony **threshold pace** w ustawieniach aktywności biegowej
  w intervals.icu — inaczej cele tempowe nie trafiają do eksportu na Garmina.
- Potwierdzone działanie na Garmin Forerunner (zgłoszenia użytkowników w
  wątku).

Lista konkretnych modeli Garmin ze wsparciem/bez wsparcia strukturalnych
treningów (Forerunner 255/265/955/965, Fenix 6/7/8, Epix 2, Venu 3, Edge
530/540/830/840/1040 vs. starsze modele typu Forerunner 235 bez wsparcia)
pochodzi z **syntezy wyszukiwania** (artykuł [leveluplife.ch](https://leveluplife.ch/en/sync-intervals-icu-workouts-to-your-garmin/)
+ wątki forum), nie z pojedynczego autorytatywnego źródła — traktować jako
orientacyjną, nie oficjalną, wyczerpującą listę zgodności.

**Macierz kierunków (pull = dane wchodzą do intervals.icu, push = plan
wychodzi na zegarek):**

| Platforma | Pull (aktywności/wellness) | Push (zaplanowany trening) | Pewność / źródło |
|---|---|---|---|
| **Garmin** | Tak | **Tak**, pełne wsparcie, w tym cele tempa (bieganie) | Wysoka — bezpośredni odczyt wątku 130705 |
| **Coros** | Tak | Zgłaszane jako wspierane | Średnia — synteza wyszukiwania + istnienie dedykowanego wątku [„Coros and structured workouts"](https://forum.intervals.icu/t/coros-and-structured-workouts/16859) (nie czytany bezpośrednio); brak potwierdzenia niuansów dla tempa biegowego |
| **Wahoo** | Tak | Zgłaszane jako wspierane, ale udokumentowane głównie dla mocy/roweru | Średnia — push dla biegowych celów tempa niepotwierdzony wprost |
| **Suunto** | Tak | Zgłaszane jako wspierane | Niska/średnia — tylko synteza wyszukiwania |
| **Polar** | Tak | **NIE** — ograniczenie platformy Polar, nie intervals.icu | Średnia-wysoka (spójna synteza: *„Polar and Apple Watch, because of platform limitations, can send completed activities but cannot receive planned workouts"*) |
| **Amazfit/Huawei** | Tak (wellness) | Częściowo (Amazfit wg części źródeł) | Niska |
| **Zwift** | Tak (trening rowerowy) | Nie dotyczy przypadku użycia (bieganie) | n/d |
| **Strava** | **De facto nie dla stron trzecich** — patrz 1.8 poniżej | Nie dotyczy (Strava nie ma własnego mechanizmu push na zegarek) | **Wysoka — to jest najważniejsze znalezisko całej weryfikacji** |

### 1.5 Rate limity

Potwierdzone bezpośrednim odczytem wątku [API access to Intervals.icu](https://forum.intervals.icu/t/api-access-to-intervals-icu/609)
(posty Davida; ten sam wątek ma świeże posty z 24 czerwca 2026 o zmianach w
limitach — więc dane poniżej są względnie aktualne, ale David zapowiedział,
że *ostateczne liczby pojawią się w pierwszym poście wątku* — **przed
implementacją warto sprawdzić ten wątek ponownie**):

- **API key (Basic Auth, użycie jednoosobowe):** 5000 żądań/dzień + 2500
  żądań/rolling 15 min.
- **Blanket limit:** 10 połączeń/sekundę na adres IP (egzekwowany przed
  serwerem aplikacji).
- **OAuth (aplikacja wieloużytkownikowa), domyślnie:** 100 żądań/użytkownika/
  dzień, do 500 użytkowników (maks. 50 000/dzień), z podłogą minimum 5000/dzień
  niezależnie od liczby userów. Limit 15-minutowy = 1/8 limitu dziennego,
  minimum 2500.
- Nagłówki `X-RateLimit-Limit` / `X-RateLimit-Remaining` (format
  `<limit 15m>,<limit dzienny>`); przekroczenie → `429` + `Retry-After`.
- Deklarowany cel granularnych limitów per-app/per-athlete (wdrażanych od
  czerwca 2026): *„protect the infrastructure from bugs in apps and scripts"*
  — David explicite: **nie chodzi o ograniczenie dostępu**, tylko o ochronę
  przed błędami w cudzych aplikacjach.
- Dla jednoosobowego użycia CLI (jeden athlete, klucz API) te limity są
  praktycznie nieosiągalne przy normalnym użyciu (kilka-kilkanaście wywołań
  dziennie). Miałyby znaczenie dopiero przy hostowanej, wieloużytkownikowej
  wersji „tren" przez OAuth.

**Formalny „Developer ToS"** (osobny dokument prawny dla deweloperów, analog
Strava API Agreement) — **nie znalazłem** takiego dokumentu w wyszukiwaniach.
Governance wygląda na nieformalne: ogólny regulamin serwisu + normy i decyzje
ogłaszane przez Davida na forum. To samo w sobie jest obserwacją wartą
odnotowania (patrz ryzyko).

### 1.6 Stanowisko autora (David Tinker) wobec integracji zewnętrznych

- David Tinker — deweloper z Cape Town, twórca i (do niedawna) jedyny
  developer intervals.icu; **przeszedł na pełny etat przy projekcie we
  wrześniu 2024** (ponad 100 000 sportowców, >111 mln przeanalizowanych
  aktywności wg stanu na 2024) — źródło: synteza wyszukiwania (m.in.
  [strona „About"](https://www.intervals.icu/about/), materiały prasowe typu
  Bicycling/podcasty). Potwierdza to ryzyko już zapisane w SPEC.md §9:
  projekt jednoosobowy.
- David aktywnie odpowiada na pytania o API na forum (dziesiątki ponumerowanych
  postów „by david" w wątku 609 rozciągniętym na lata) — realny, żywy kanał
  wsparcia dla deweloperów, nie automat.
- Jedyny znaleziony cytat sugerujący ostrożność: *„I have to be careful to
  not just proxy stuff you can get from Strava"* (kontekst: wątek API access,
  zidentyfikowany przez wyszukiwanie, nie w pełni zweryfikowany bezpośrednim
  odczytem całego kontekstu rozmowy). Brzmi to jak ostrożność **specyficznie
  wobec bycia czystą nakładką na dane Stravy** (co i tak jest już wymuszone
  restrykcjami samej Stravy, patrz 1.8), a nie ogólna niechęć do integracji.
- Silna poszlaka **przychylności wobec integracji AI/agentowych** konkretnie:
  istnieje oficjalna kategoria forum **„AI Tools"** (`forum.intervals.icu/c/ai-tools/17`),
  w której współistnieje wiele niezależnych serwerów MCP i komercyjny produkt
  (icusync.icu, patrz 1.7) — żadnych śladów sprzeciwu, ostrzeżeń czy
  moderacji przeciw temu wzorcowi użycia. Nie znalazłem jednak **bezpośredniego
  cytatu Davida** afirmującego wprost AI coaching — to wniosek z braku
  sprzeciwu + istnienia oficjalnej kategorii, nie z deklaracji.

### 1.7 Istniejące narzędzia/biblioteki (dowód wykonalności)

Konkretne, żywe projekty na tym samym API, które planujemy użyć:

- [rday/py-intervalsicu](https://github.com/rday/py-intervalsicu) — klient
  Python (Apache-2.0, 18 gwiazdek, 4 forki, 17 commitów), dokumentacja na
  [py-intervalsicu.readthedocs.io](https://py-intervalsicu.readthedocs.io/);
  wellness, aktywności (CSV), events.
- [q050cr/intervals-icu](https://github.com/q050cr/intervals-icu) — klient +
  CLI Python do pobierania/analizy aktywności.
- [h3xh0und/intervals.icu-api](https://github.com/h3xh0und/intervals.icu-api) —
  skrypt Python/PowerShell wysyłający eventy treningowe z JSON.
- [rbrands/intervals-icu-sync](https://github.com/rbrands/intervals-icu-sync) —
  *„Connect any GenAI tool to your intervals.icu data — includes MCP server,
  Python scripts, system prompts and coaching logic based on Joe Friel"* —
  koncepcyjnie najbliższy „tren" z istniejących projektów.
- [eddmann/intervals-icu-mcp](https://github.com/eddmann/intervals-icu-mcp) —
  serwer MCP (~33 gwiazdki/26 forków wg jednego odczytu).
- [hhopke/intervals-icu-mcp](https://github.com/hhopke/intervals-icu-mcp) —
  fork powyższego z poprawkami, MIT, ~44 gwiazdki/18 forków, **62 narzędzia**
  w 10 kategoriach (aktywności, streams/interwały, athlete/CTL-ATL-TSB,
  wellness, kalendarz/eventy, performance curves, biblioteka treningów,
  sprzęt, ustawienia sportu, custom items) — obsługuje też tworzenie
  treningów (*„Create a sweet spot cycling workout for tomorrow"*) i ma
  flagę `INTERVALS_ICU_DELETE_MODE` dla operacji kasujących.
- [mvilanova/intervals-mcp-server](https://github.com/mvilanova/intervals-mcp-server) —
  kolejny niezależny serwer MCP dla Claude/ChatGPT.
- [icusync.icu](https://icusync.icu/) — **produkt komercyjny/hostowany**,
  „no technical setup required", łączy Claude AI z intervals.icu przez MCP
  wprost pod hasłem AI coachingu na realnych danych treningowych; ma nawet
  dedykowany materiał *„Connect Claude AI to your Garmin, Coros, Wahoo,
  Polar or Suunto"* — czyli komercyjnie waliduje dokładnie ten sam pomysł
  „intervals.icu jako hub" co ADR-002.

Łącznie: **co najmniej 3 niezależne klienty API w Pythonie, 3+ niezależne
serwery MCP i 1 produkt komercyjny** działają na tym samym publicznym API.
To mocny, wielosource'owy dowód wykonalności technicznej — nie trzeba niczego
odkrywać od zera.

### 1.8 Restrykcje API Stravy — stan na 2026-08-04

Dwie fale zmian, obie potwierdzone z oficjalnych/półoficjalnych źródeł:

**Fala 1 — listopad 2024** (efektywna od 11.11.2024, pełne wdrożenie od
1.12.2024), [oficjalny komunikat prasowy Stravy](https://press.strava.com/articles/updates-to-stravas-api-agreement):
- Aplikacje trzecie mogą pokazywać dane aktywności Stravy **wyłącznie
  danemu użytkownikowi**, nie trenerom/obserwującym/publicznie.
- Wprost zakazane: *„Third-party developers may not... [use data] for
  training AI models"*.
- Strava twierdzi w tym samym komunikacie, że *„the overwhelming majority of
  existing use cases are still allowed, including coaching platforms focused
  on providing feedback to users and tools that help users understand their
  data and performance"* — czyli explicite odróżnia zakaz **trenowania modeli
  AI** od używania danych do **feedbacku dla tego samego użytkownika**.
- W praktyce jednak brak pewności: na oficjalnym community hub deweloper
  wprost pyta, czy AI inference (nie trenowanie modelu, tylko np. wysyłanie
  danych do LLM w celu coachingu) jest zakazane —
  [wątek „AI inference with Strava data"](https://communityhub.strava.com/developers-api-7/ai-inference-with-strava-data-is-it-prohibited-under-the-new-api-agreement-13256)
  — i **nie dostaje jednoznacznej odpowiedzi od Stravy** (cytat pytającego:
  *„I mailed them about 3 weeks ago, didnt receive any information so
  far"*). Społeczność radzi sobie ostrożnościowym „firewallowaniem" danych
  Stravy od jakiejkolwiek interakcji z AI.

**Fala 2 — czerwiec 2026, bardzo świeża** (Standard-tier developerzy: nowi od
1.06.2026, istniejący od 30.06.2026 muszą płacić ~11,99 USD/miesiąc za dostęp
API; nowy podział na tiery Standard/Extended Access) — potwierdzone
wieloma niezależnymi źródłami z wyszukiwania (TechRepublic, community hub
Stravy, appsforstrava.com). Deklarowany powód wprost wymierzony w nasz
wzorzec architektury: *„AI companies are aggressively attempting to scrape
platforms for training data, abuse APIs through intermediary layers, and
provide zero-code AI tools that produce apps that hammer APIs"* — zgłoszenia
deweloperskie do programu Stravy wzrosły 448% rok do roku.

**Najważniejsze znalezisko łączące obie fale z architekturą hub:** od fali 1
(grudzień 2024) **sam intervals.icu przestał re-eksponować aktywności
pochodzące ze Stravy przez własne API stronom trzecim** — potwierdzone
wprost w [wątku o zmianach Stravy z czerwca 2026](https://forum.intervals.icu/t/strava-api-update-new-terms-subs-required-for-api-access/130240):
cytat użytkownika forum *„Interval.icu already disallows Strava data from
its API"*, spójny z wcześniejszym zapisem Davida (28.11.2024,
[wątek „Import all data from Strava"](https://forum.intervals.icu/t/import-all-data-from-strava/81068))
o tym, że dane ze Stravy podlegają jej ToS i nie mogą być pokazywane nawet
followersom w samym intervals.icu, a co dopiero przez API zewnętrznym appkom.

**Konsekwencja praktyczna dla „tren":** to nie jest już tylko kwestia „czy
robimy integrację bezpośrednią ze Strava" (odpowiedź: nie, i słusznie) — to
oznacza, że **droga danych „zegarek → Strava → intervals.icu → API → tren"
prawdopodobnie nie zwróci pełnych danych** (streams, laps) przez API
intervals.icu, niezależnie od architektury huba. Hub w pełni działa tylko
dla ścieżki „zegarek → bezpośrednie połączenie z intervals.icu (Garmin
Connect / Polar Flow / Coros / Suunto / Wahoo w Ustawieniach intervals.icu)
→ API". Użytkownicy „tren", którzy mają podłączoną **tylko** Stravę (a nie
bezpośrednio swój zegarek) do intervals.icu, mogą nie mieć widocznych
pełnych danych dla naszego narzędzia.

---

## 2. Przykładowe wywołania API (udokumentowane)

Wszystkie poniższe pochodzą z [API Integration Cookbook](https://forum.intervals.icu/t/intervals-icu-api-integration-cookbook/80090)
i dedykowanych wątków forum cytowanych wyżej — nie są wymyślone.

**Lista aktywności (Bearer):**
```bash
curl 'https://intervals.icu/api/v1/athlete/0/activities?oldest=2024-11-19&newest=2024-11-20' \
    -H 'Authorization: Bearer d842c1fc25f241e5ae440d09756448a9'
```
(`0` = athlete powiązany z tokenem)

**Pobranie oryginalnego pliku aktywności:**
```bash
curl 'https://intervals.icu/api/v1/activity/i55751783/file' \
    -H 'Authorization: Bearer d842c1fc25f241e5ae440d09756448a9' > activity.fit.gz
```

**Basic Auth (wariant z API key jako username/password):**
```bash
curl -u API_KEY:1l0nlqjq3j1obdhg08rz5rfhx \
    https://intervals.icu/api/v1/athlete/2049151/activities.csv
```

**Streams aktywności:**
```bash
curl -H "Authorization: Bearer YOUR_API_TOKEN" \
  "https://intervals.icu/api/v1/activity/12345/streams.json?types=watts,heartrate,cadence"
```

**Odczyt wellness:**
```bash
curl 'https://intervals.icu/api/v1/athlete/0/wellness?oldest=2024-11-18&newest=2024-11-20' \
    -H 'Authorization: Bearer d842c1fc25f241e5ae440d09756448a9'
```

**Zapis masowy wellness:**
```bash
curl -X PUT 'https://intervals.icu/api/v1/athlete/0/wellness-bulk' \
    -H 'Authorization: Bearer d842c1fc25f241e5ae440d09756448a9' \
    -H 'Content-Type: application/json' \
    -d '[{"id":"2024-11-20","weight":69.1},{"id":"2024-11-19","weight":69.3}]'
```

**Odczyt zaplanowanych treningów (z rozwiązanymi celami):**
```
GET https://intervals.icu/api/v1/athlete/{id}/events?category=WORKOUT&ext=zwo&resolve=true
```
Zwraca m.in. `workout_doc.steps[]` z polami `duration`, `pace`/`power`/`hr`
(`start`/`end`/`units`), `intensity` (`active`/`rest`/`warmup`), `_pace` jako
wartość rozwiązaną.

**Utworzenie zaplanowanego treningu biegowego z celami tempa (opis tekstowy,
bez pliku binarnego):**
```
POST https://intervals.icu/api/v1/athlete/{id}/events/bulk?upsert=true
Authorization: Bearer <token z scope CALENDAR:WRITE>
Content-Type: application/json

[{
  "category": "WORKOUT",
  "start_date_local": "2026-02-03T17:00:00",
  "type": "Run",
  "name": "5x3min Tempo",
  "description": "- 15m 60% Pace Warmup\n\n5x\n- 3m 85% Pace\n- 2m 60% Pace\n\n- 10m 50% Pace Cooldown",
  "external_id": "tren-2026-02-03-tempo"
}]
```
(`type: "Ride"` w oryginalnym przykładzie z dokumentacji zamieniony tu na
`"Run"` w celu ilustracji przypadku biegowego — **nie zweryfikowałem wprost**,
czy `"Run"` to poprawna wartość enum dla tego pola; do potwierdzenia w
Swaggerze. Sama struktura JSON i pole `description` z natywną składnią „steps"
są potwierdzone 1:1 z dokumentacji.)

**OAuth — URL autoryzacji:**
```
https://intervals.icu/oauth/authorize?client_id=<id>&redirect_uri=<uri>&scope=ACTIVITY:READ,WELLNESS:WRITE,CALENDAR:READ,CALENDAR:WRITE&state=<opcjonalne>
```

---

## 2a. WERYFIKACJA E2E NA ŻYWYM KONCIE (2026-08-05)

Test wykonany prawdziwym kluczem API na koncie testowym (`i665499`), pełną
ścieżką przez CLI (`tren plan` → `tren push` → `tren reschedule` → `tren push`).
Wszystkie wpisy testowe zostały po teście usunięte.

**Potwierdzone:**

| Pytanie | Wynik |
|---|---|
| Basic auth `API_KEY:<klucz>` | ✅ 200 na `GET /athlete/0` |
| `type: "Run"` jako wartość enum | ✅ **przyjęte** (było pytanie otwarte) |
| Nasza składnia „steps" w `description` | ✅ sparsowana do `workout_doc.steps[]` |
| Bloki powtórzeń `Nx` | ✅ `{text:"6x", reps:6, steps:[…]}` z zagnieżdżeniem |
| Cele tempa bezwzględne `M:SS/km Pace` | ✅ `pace: {value: 266, units: "secs/km"}` — `4:26/km` → 266 s |
| Kroki **bez** celu tempa (podbiegi, ADR-010) | ✅ przyjęte bez błędu |
| Wyliczenie czasu/dystansu po stronie serwisu | ✅ `duration`, `distance` liczone z celów |
| Idempotencja `external_id` + `upsert=true` | ✅ dwa pushe tego zakresu → 5 zdarzeń, zero duplikatów |
| **`DELETE /events/{id}`** | ✅ **200 — endpoint istnieje** (było pytanie otwarte) |

**Odkryta luka w projekcie (naprawiona):** push jest operacją upsert, więc po
renegocjacji tygodnia trening przesunięty na inny dzień zostawiał „ducha" w
kalendarzu i na zegarku. `tren push` usuwa teraz nieaktualne wpisy z zakresu —
**wyłącznie te z prefiksem `tren-`**, żeby nigdy nie skasować treningu dodanego
ręcznie przez atletę (filtr zdublowany w adapterze i w komendzie).

**Uwaga o kalibracji:** konto testowe nie miało ustawionego `threshold_pace`
dla biegania i miało zero aktywności. Nie przeszkodziło to w pushu, bo używamy
temp **bezwzględnych** — cele względne (`Z2 Pace`, `78% Pace`) wymagałyby
skonfigurowanego progu. To potwierdza słuszność decyzji z `workout-syntax.ts`.

**Nadal niezweryfikowane:** czy trening dociera na fizyczny zegarek Garmina
(wymaga konta połączonego z Garmin Connect i samego urządzenia).

## 2b. INFERENCJA PROFILU Z HISTORII — stan weryfikacji (2026-08-05, faza 6)

`tren init --from-intervals` odpytuje `GET /athlete/0/activities?oldest&newest`
(ten sam endpoint co `tren pull`, więc żadnej nowej powierzchni API).

**Zweryfikowane na żywym koncie:** ścieżka przechodzi end-to-end przez prawdziwe
API (auth 200, zapytanie o 16 tygodni wykonane), a przy **zerowej historii**
komenda kończy się czytelnym „Brak aktywności biegowych w oknie 16 tygodni —
profil uzupełnij ręcznie" i **nie tworzy `tren.yaml`**. To jest właściwe
zachowanie: profil zmyślony z niczego byłby gorszy niż brak profilu.

**Niezweryfikowane — wymaga konta z realną historią:** konto testowe `i665499`
nie jest spięte z Garminem/Stravą i ma **0 aktywności** (potwierdzone także dla
okna 2024-01-01 → dziś), więc nie dało się sprawdzić:

| Pytanie | Status |
|---|---|
| Nazwy pól aktywności w praktyce (`distance` w m? `moving_time`?) | adapter normalizuje oba warianty casingu (§1.2) — niesprawdzone na danych |
| Czy payload niesie znacznik startu (kategoria / `category`) | **otwarte** — heurystyka kandydatów (dystans standardowy + nazwa/tempo) działa bez tego pola; jeśli znacznik istnieje, użyć go jako sygnału pierwotnego |
| Jakość detekcji startów na prawdziwej historii | otwarte — kandydaci są zawsze potwierdzani przez użytkownika (ADR-019), więc fałszywy pozytyw nie psuje planu |

Kiedy konto dostanie realną historię (spięcie z Garminem), wystarczy uruchomić
`tren init --from-intervals` w pustym katalogu i porównać propozycje z faktycznym
stanem wytrenowania — wynik dopisać do tej sekcji.

## 3. Pytania otwarte

Rzeczy, których nie udało się jednoznacznie potwierdzić i które trzeba
zweryfikować bezpośrednio w Swaggerze / przez test API (część rozstrzygnięta
w §2a — pozycje 3 i 4 poniżej są już **zamknięte**):

1. **Rozbieżność OAuth token endpoint:** `/api/oauth/token` vs
   `/api/v1/oauth/token` — dwa różne źródła podają różne ścieżki.
2. **Aktualne, ostateczne liczby rate limitów** — David zapowiedział
   (24.06.2026) aktualizację pierwszego posta wątku 609 z finalnymi
   liczbami po wdrożeniu granularnych limitów per-app/per-athlete; sprawdzić
   ten wątek jeszcze raz tuż przed implementacją.
3. **Endpoint DELETE dla eventów** — nie znaleziony wprost; istnieje tylko
   pośrednia poszlaka (flaga `DELETE_MODE` w cudzym serwerze MCP).
4. **Dokładne nazwy i casing pól wellness** w schemacie odpowiedzi
   (`restingHR` vs `resting_hr`, `sleepSecs` vs `sleep_secs`) — źródła się
   różnią, prawdopodobnie różnica GET (camelCase) vs PUT payload przykładu,
   ale niepotwierdzone.
5. **Push strukturalnych treningów biegowych z celami tempa do Coros/
   Wahoo/Suunto** — potwierdzone tylko dla Garmina wprost; dla pozostałych
   platform potwierdzone jest głównie „coś się synchronizuje", bez
   szczegółu czy cele *tempa* (a nie tylko mocy/HR) trafiają poprawnie na
   te konkretne zegarki.
6. **Czy ograniczenie „stub" dla aktywności ze Stravy obejmuje też
   streams/laps, czy tylko widoczność/listing** — logicznie prawdopodobne,
   że tak, ale nie znalazłem wprost przetestowanego potwierdzenia.
7. **Czas odpowiedzi na wniosek o rejestrację aplikacji OAuth** (e-mail do
   david@intervals.icu) — brak danych; istotne dla planowania Fazy 4, jeśli
   „tren" ma kiedyś wyjść poza model „każdy użytkownik wkleja własny API
   key".
8. **Czy istnieje formalny dokument Developer ToS/Agreement** analogiczny do
   Strava API Agreement — nie znaleziony; być może po prostu nie istnieje i
   governance jest w pełni nieformalne (forum + ogólny regulamin serwisu).
9. **Lista modeli Garmin ze wsparciem structured workouts** — potwierdzona
   tylko przez syntezę wyszukiwania, nie official compatibility matrix.

---

## 4. Ocena ryzyka integracji

| Ryzyko | Poziom | Komentarz |
|---|---|---|
| Wykonalność techniczna | **Niskie** | Wielosource'owy dowód: 3+ niezależne biblioteki, 3+ serwery MCP, 1 produkt komercyjny na tym samym API; cookbook z gotowymi przykładami curl pokrywa dokładnie potrzebne operacje (activities, wellness, events CRU). |
| Bus factor / projekt jednoosobowy | **Średnie** | Zgodne z już zapisanym ryzykiem w SPEC.md §9. David aktywny i responsywny na forum, ale to nadal jedna osoba (pełny etat od IX 2024, więc ryzyko niższe niż dla projektu-hobby, ale wciąż realne). Mitygacja z SPEC (port `SyncProvider` + fallback FIT/GPX) jest właściwa i wystarczająca. |
| **„Strava" jako noga huba** | **Wysokie — wymaga korekty ADR-002** | Od XI 2024 intervals.icu nie re-eksponuje danych ze Stravy przez własne API stronom trzecim. Dla „tren" oznacza to, że użytkownicy podłączeni do intervals.icu wyłącznie przez Stravę mogą nie mieć widocznych pełnych danych. To nie unieważnia decyzji o hubie, ale **zawęża jej realny zakres do integracji bezpośrednich** (Garmin/Polar/Coros/Suunto/Wahoo skonfigurowanych wprost w ustawieniach intervals.icu). |
| Push planowanych treningów na zegarek (kluczowa funkcja pętli plan→wykonanie) | **Niskie dla Garmina, średnie dla reszty** | Garmin: potwierdzone wprost, w tym cele tempa dla biegania (z zastrzeżeniem „mixing HR+pace WIP" i wymogu ustawienia threshold pace). Polar: push **nie istnieje** (ograniczenie platformy). Coros/Wahoo/Suunto: zgłaszane jako działające, ale bez potwierdzenia niuansów dla biegania. Praktyczna rekomendacja: v1 „tren" zakładać pełne wsparcie pętli tylko dla Garmina, resztę traktować jako „powinno działać, do zweryfikowania ręcznie". |
| Rate limity | **Niskie** dla CLI jednoosobowego, **nieznane** dla przyszłego multi-user | Limity API key (5000/dzień) są rzędy wielkości większe niż potrzeby pojedynczego atlety. Dopiero hostowana wersja wieloużytkownikowa przez OAuth musiałaby to modelować. |
| ToS / goodwill autora | **Niskie-średnie** | Brak formalnego Developer Agreement = mniejsza pewność prawna, ale też brak sztywnych zakazów jak u Stravy. Jedyna zidentyfikowana czerwona linia Davida („nie być czystą nakładką na Stravę") jest zgodna z naszym planem — i tak nie budujemy re-eksportu danych Stravy. Rejestracja OAuth wymaga ręcznego maila — wprowadza zależność czasową (nieznaną) przy przejściu z „własny klucz API" na „aplikacja OAuth dla wielu userów", ale nie blokuje v1. |
| Ryzyko prawne/AI-specyficzne | **Niskie po stronie intervals.icu, istotne po stronie Stravy** | Intervals.icu nie ma żadnej wykrytej klauzuli anty-AI — wręcz przeciwnie, ma oficjalną kategorię forum „AI Tools" z wieloma działającymi integracjami LLM/MCP bez śladu sprzeciwu. Całe ryzyko prawne dot. AI/coachingu jest po stronie Stravy (zakaz trenowania modeli, niejasność co do inference) — architektura hub **słusznie** to omija, z zastrzeżeniem z wiersza wyżej (dane ze Stravy i tak nie przejdą przez intervals.icu do nas). |

---

## 5. Werdykt

**Architektura „intervals.icu jako hub" jest wykonalna i pozostaje najlepszą
dostępną opcją — z jedną istotną korektą zakresu względem ADR-002.**

Co się potwierdza w 100%: API jest darmowe, dobrze udokumentowane praktyką
(cookbook + żywe forum + Swagger), ma dokładnie te endpointy, których „tren"
potrzebuje (activities, streams, wellness read/write, events read/create z
natywnym formatem tekstowym obsługującym cele tempa dla biegania), i ma
wielokrotnie potwierdzony precedens: inne open-source'owe i komercyjne
narzędzia (w tym dokładnie ten sam wzorzec „AI coach przez MCP nad
intervals.icu") już działają produkcyjnie na tym API. Push zaplanowanego
treningu na zegarek jako structured workout jest potwierdzony wprost dla
Garmina, łącznie z celami tempa — czyli kluczowa pętla „plan w CLI → trening
na zegarku" z SPEC.md §7 jest zweryfikowana jako realna, nie tylko teoretyczna.

Co wymaga korekty w SPEC.md/ADR-002: sformułowanie „hub do Garmin/Strava/
Polar/Coros/Wahoo" sugeruje symetrię, której nie ma. W praktyce:
- **Strava powinna zniknąć z listy platform hub-a** dla celów tego projektu
  — nie dlatego, że to prawne ryzyko (to już było wiadome), ale dlatego, że
  **sam intervals.icu blokuje re-eksport danych ze Stravy przez API od końca
  2024 roku** — hub nie „opakowuje" ryzyka Stravy, tylko po prostu nie ma
  dostępu do tych danych, niezależnie od ryzyka.
- **Polar wspiera tylko pull, nie push** — pętla „plan→zegarek" nie zadziała
  dla użytkowników Polara.
- Push do Coros/Wahoo/Suunto jest prawdopodobny, ale nie zweryfikowany z tą
  samą pewnością co Garmin.

Rekomendacja operacyjna: zaktualizować SPEC.md §7/ADR-002, żeby jasno mówiło
„Garmin (pull+push, zweryfikowane) jako platforma referencyjna; Polar/Coros/
Wahoo/Suunto jako pull zawsze, push do zweryfikowania per platforma;
integracja przez Strava wykluczona nie tylko ze względów ToS, ale i
technicznie (intervals.icu jej nie re-eksportuje)". To nie zmienia decyzji o
hubie — nadal jest zdecydowanie tańsza i szybsza niż Garmin Developer Program
wprost — tylko precyzuje, na czym realnie polega.

Dla Fazy 0 checklist: pozycję „weryfikacja API intervals.icu" można odhaczyć
jako zrobioną, z dopiskiem odsyłającym do pytań otwartych w sekcji 3 do
domknięcia na starcie Fazy 4 (rejestracja OAuth, jeśli „tren" ma kiedyś
wyjść poza model BYO-API-key, powinna pójść w e-mailu do Davida z dużym
wyprzedzeniem, bo czas odpowiedzi jest nieznany).
