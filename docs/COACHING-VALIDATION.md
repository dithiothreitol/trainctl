# Weryfikacja kompletnych jednostek treningowych

Data: 2026-11-04. Środowisko: Windows, Node 24.14.1.
Zakres: zmiany wydania 0.6.0 względem v0.5.0.

## Wyniki

| Sprawdzenie | Wynik |
| --- | --- |
| `pnpm typecheck` | PASS, wszystkie pakiety |
| `pnpm build` | PASS, wszystkie pakiety |
| `pnpm test` | 1076/1076 testów, 75 plików, bez pominiętych testów |
| Macierz nowych struktur | 432 kombinacje sportu, celu, doświadczenia, kalibracji i czasu |
| Baseny i CSS | 81 kombinacji długości basenu, CSS, celu i czasu |
| `pnpm simulate:coaching` | 17 wywołań rzeczywistego CLI, 72 jednostki, 22 różne identyfikatory przepisów |
| `pnpm simulate:multisport --artifacts` | 56 wywołań CLI, wszystkie 6 kierunków zamiany |
| Dekodowanie FIT oficjalnym SDK | 128 plików; osobne testy notatek, RPE, mocy przerw i UTF-8 |
| Eksporty kalendarzowe | 8 plików, 231 zdarzeń sprawdzonych niezależnym parserem |
| Gotowy plugin | 40 wywołań CLI, 58 wywołań MCP przez stdio |
| Odkrywanie MCP | 22/22 narzędzia wykonane, 50 zasobów, 2 prompty |

Przypadki sprawdzają m.in. zachowanie celu i kroków po zapisie, odczycie,
zamianie i przywróceniu, brak mieszania kalibracji sportów, daty pomiarów,
pełne powtórzenia, budżety czasu, rozgrzewkę i schłodzenie, odmowę skrócenia
niszczącego akcent, cele po uproszczeniu jednostki oraz obsługę starszego YAML.
MCP i CLI udostępniają te same dane coaching, effort i recovery.

Symulacje używają izolowanych danych syntetycznych. Nie aktualizują konta
Intervals.icu, kalendarza użytkownika ani fizycznych urządzeń.

## Przykłady i ślady lokalnego uruchomienia

- [Rower — HTML](../artifacts/coaching-Z1Dp6c/bike.html), [rzeczywisty tekst CLI](../artifacts/coaching-Z1Dp6c/bike.txt).
- [Pływanie — HTML](../artifacts/coaching-Z1Dp6c/swim.html), [rzeczywisty tekst CLI](../artifacts/coaching-Z1Dp6c/swim.txt).
- [Bieg po rowerze — HTML](../artifacts/coaching-Z1Dp6c/run.html).
- [Podsumowanie symulacji celów i struktur](../artifacts/coaching-Z1Dp6c/summary.json).
- [Wynik weryfikacji pluginu](../artifacts/coaching-reaudit-i7Yj0Z/plugin/result.json).
- [Pełny zapis wywołań pluginu](../artifacts/coaching-reaudit-i7Yj0Z/plugin/transcript.json).

Pliki w artifacts są lokalnymi wynikami i nie są wersjonowane. Przykłady można
odtworzyć poleceniem `pnpm simulate:coaching`; katalog wynikowy jest wypisywany
na końcu. Plugin buduje `pnpm plugin:build`; otrzymaną ścieżkę pluginu przekazuje
się do `node scripts/verify-plugin.mjs ŚCIEŻKA_PLUGINU`.

## Granice potwierdzenia

Testy potwierdzają działanie kodu i formatów. Parametry biblioteki, progi wyboru,
fala zakładek oraz RPE są jawnie opisanymi decyzjami inżynierskimi, nie wynikiem
indywidualnej walidacji fizjologicznej. Podstawy i parametry opisuje
[MS-6](science/MULTISPORT.md).

Nie wykonano niezależnego przeglądu całej biblioteki przez trenerów ani próby
na fizycznym Garminie/Suunto. FIT zapisuje notatki do 254 bajtów UTF-8 i może
je skracać; ich wyświetlanie zależy od urządzenia. Pełne instrukcje pozostają
w CLI/MCP, HTML, Markdown, ICS oraz opisie wysyłanym do Intervals.icu.

## Ponowny audyt

Ponownie wykonano przegląd kodu, pełne testy, kontrolę typów i budowę.
Wykryto i poprawiono następujące niespójności:

- Ułamkowe tempo, np. 119.8 s/100 m, było wyświetlane jako 1:60. Zaokrąglenie
  odbywa się teraz przed rozdzieleniem minut i sekund. CLI oraz eksport
  Intervals.icu używają tego samego formatowania pracy i odpoczynku. Model
  nadal zachowuje dokładną wartość liczbową.
- Interwały biegowe i czasowe interwały pływackie mogły otrzymać uzasadnienie
  spokojnej jednostki. Opis odpowiada teraz mocniejszym odcinkom i RPE.
  Jednostka bez kontekstu fazy nie przedstawia już fazy bazowej jako znanej.
- Reguły MS kierowały do dokumentu biegowego FOUNDATIONS. Odnośniki i dane
  CLI/MCP wskazują teraz MULTISPORT dla wersji pakietu. Nowe reguły opisane
  w dokumentacji są dostępne pod tagiem v0.6.0.

Dodatkowe niezależne próby:

| Próba | Wynik |
| --- | --- |
| Pływanie: różne CSS, baseny i budżety co 15 sekund | 16 920 kombinacji, bez naruszenia budżetu, schematu lub braku części głównej |
| Skracanie treningów | 2808 prób: 1650 poprawnych wyników, 1158 jawnych odmów z powodu budżetu; bez nieoczekiwanych wyjątków i zmian oryginału |
| Instalacja sześciu rzeczywistych paczek poza repozytorium | PASS: 56 poleceń CLI, 11 wywołań MCP, 128 FIT, 8 ICS / 231 zdarzeń |
| Plugin po poprawkach | PASS: 40 CLI, 58 MCP, wszystkie 22 narzędzia |

Próba instalacji offline wykazała brak commander w lokalnym magazynie.
Powtórzenie z dostępem do publicznego rejestru npm zakończyło się sukcesem.
Sieć służyła pobraniu zależności; nie wykonywano operacji na kontach treningowych.

Skrypty i wyniki niezależnych prób: [pływanie](../artifacts/coaching-reaudit-i7Yj0Z/pool-result.json),
[skracanie](../artifacts/coaching-reaudit-i7Yj0Z/shorten-result.json).
Granice potwierdzenia dotyczące oceny trenerskiej i fizycznych urządzeń pozostają aktualne.

## Czytelność terminala i skala intensywności

Oddzielone, kolorowe sekcje obejmują cel, intensywność, przebieg, uzasadnienie,
wskazówki i dostosowanie. Etapy mają własne nagłówki i osobno opisane przerwy.
Czas jest podawany w minutach i sekundach, a style pływackie są lokalizowane.
Skala RPE 1–10 zaznacza zakres najmocniejszego zaplanowanego etapu. Nie jest
średnią całej jednostki ani pomiarem stref fizjologicznych. Przy braku RPE
interfejs podaje ten brak; nie wyprowadza RPE z mocy, tempa ani starego planu.

Weryfikacja po zmianie widoku: `pnpm typecheck`, `pnpm build`, 1076 testów
w 75 plikach oraz `pnpm simulate:coaching` zakończone poprawnie. Nowe testy
sprawdzają kompletność instrukcji, cele i przerwy, szerokości 24–112 kolumn,
ASCII, brak kolorów, lokalizację PL/EN oraz niezmienność danych treningu.

[Galeria zaktualizowanych przykładów](examples/coaching-terminal/index.html)
zawiera siedem renderów rzeczywistego wyjścia CLI. [Pełny zestaw ZIP](examples/coaching-terminal.zip).
Symulacja: `artifacts/coaching-iyXosl/summary.json`.
