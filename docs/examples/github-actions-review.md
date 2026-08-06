# Opcjonalnie: tygodniowy przegląd jako zadanie GitHub Actions

**To jest przykład, nie część produktu.** Domyślny model `trainctl` jest local-first:
katalog treningowy leży na Twoim dysku, klucz API nigdzie nie wyjeżdża, a
rozmowa z agentem jest kanałem, w którym zapadają decyzje. Ten plik jest dla
osób, które i tak trzymają katalog treningowy w repozytorium na GitHubie i chcą
w poniedziałek rano dostać powiadomienie zamiast pamiętać o `trainctl review`.

## Zanim to włączysz — trzy rzeczy, o których warto wiedzieć

1. **Klucz API trafia do sekretów GitHuba**, a Twoje dane treningowe i wellness
   (tętno spoczynkowe, sen, masa) przepływają przez runnery. To świadoma zmiana
   modelu bezpieczeństwa względem local-first. Na prywatnym repo jest to
   zwykle akceptowalne; na publicznym — nie rób tego.
2. **Bot nie zastąpi rozmowy.** Przegląd wygenerowany automatycznie nie zapyta,
   czy pominięty tydzień to była choroba, czy wał w robocie — a to jest różnica
   między „wróć ostrożnie" a „po prostu przestaw dni". Traktuj wynik jako
   przypomnienie, nie jako werdykt.
3. **Większość tygodni nie wymaga zmian** — dobrze napisany plan ma progresję i
   deload zaplanowane z góry. Jeśli powiadomienia zaczną być rutynowo puste,
   zmniejsz częstotliwość albo wyłącz je zupełnie. Powiadomienie, które się
   ignoruje, jest gorsze niż jego brak.

## Workflow

Zapisz jako `.github/workflows/review.yml` w repozytorium z katalogiem
treningowym. `trainctl` musi być dostępny — poniżej zakładam, że repo `trainctl` jest
sklonowane obok albo dodane jako submoduł.

```yaml
name: Przegląd tygodnia

on:
  schedule:
    - cron: '0 6 * * 1'   # poniedziałek 06:00 UTC
  workflow_dispatch:       # i na żądanie

permissions:
  contents: read
  issues: write

jobs:
  review:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: trainctl (silnik)
        uses: actions/checkout@v4
        with:
          repository: <twoje-konto>/trainctl
          path: .trainctl-engine

      - uses: actions/setup-node@v4
        with:
          node-version: '23'      # natywny type-stripping: bez kroku budowania

      - run: corepack enable && pnpm install --frozen-lockfile
        working-directory: .trainctl-engine

      - name: Przegląd
        id: review
        env:
          TRAINCTL_INTERVALS_API_KEY: ${{ secrets.TRAINCTL_INTERVALS_API_KEY }}
          NO_COLOR: '1'           # czysty tekst do komentarza
        run: |
          node .trainctl-engine/packages/cli/src/bin.ts review --days 7 > review.txt
          {
            echo 'body<<EOF'
            cat review.txt
            echo EOF
          } >> "$GITHUB_OUTPUT"

      - name: Komentarz w issue „Sezon"
        uses: peter-evans/create-or-update-comment@v4
        with:
          issue-number: 1         # issue, w którym prowadzisz sezon
          body: |
            ## Przegląd tygodnia — ${{ github.run_started_at }}

            ```
            ${{ steps.review.outputs.body }}
            ```
```

`NO_COLOR=1` jest tu istotne: bez tego do komentarza trafiłyby sekwencje ANSI.
`trainctl review` niczego nie zapisuje w planie (poza migawką `sync.json`), więc
workflow nie potrzebuje uprawnień do zapisu w repozytorium.

## Wariant bez GitHuba

To samo lokalnie, bez wysyłania czegokolwiek na zewnątrz:

- **Windows**: Harmonogram zadań → cotygodniowo → `trainctl review`
- **macOS/Linux**: `crontab -e` → `0 6 * * 1 cd ~/trening && trainctl review | tee -a review.log`

Albo po prostu poproś agenta w poniedziałek: „zrób przegląd tygodnia". Ta droga
jako jedyna zada Ci pytania, gdy coś w danych nie będzie się zgadzać.
