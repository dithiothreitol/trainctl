# Lint planu w CI katalogu treningowego

Plan jest kodem (`plan/plan.yaml` w gicie), więc może mieć testy jak kod.
`trainctl check` sprawdza inwarianty silnika i spójność pliku, a kodem wyjścia
mówi CI, czy tydzień się broni:

- **błąd (kod 1)** — plik jest wewnętrznie niespójny: sumy tygodnia nie zgadzają
  się z dniami, data nie pasuje do pozycji w tygodniu, zniknął dzień startu.
  Takich stanów nie wytwarza żadna komenda `trainctl` — to ślad ręcznej edycji.
- **ostrzeżenie (kod 0, z `--strict`: 1)** — plan łamie regułę metodyczną:
  akcenty bez 48 godzin przerwy (I-7), trening w przeddzień startu (T-10),
  długie wybieganie w taperze (T-5), siła obok akcentu (S-5). To bywa świadoma
  decyzja — dlatego domyślnie nie blokuje.

Każde ustalenie niesie ID reguły z [FOUNDATIONS](../science/FOUNDATIONS.md) §10.

## Kiedy to ma sens

Po każdej **ręcznej** edycji `plan/plan.yaml`. Komendy (`shift`, `reschedule
--apply`) same pilnują spójności i ostrzegają przy odstępstwach — lint jest
siatką pod edycję w edytorze, merge gałęzi scenariuszy i poprawki „na szybko"
z telefonu przez GitHub.

## Workflow

Zapisz jako `.github/workflows/check.yml` w repozytorium z katalogiem
treningowym (założenia jak w [github-actions-review.md](github-actions-review.md):
silnik sklonowany obok):

```yaml
name: Lint planu

on:
  push:
    paths: ['plan/**', 'trainctl.yaml']
  pull_request:
    paths: ['plan/**', 'trainctl.yaml']

jobs:
  check:
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
          node-version: '23'

      - run: corepack enable && pnpm install --frozen-lockfile
        working-directory: .trainctl-engine

      - name: trainctl check
        env:
          NO_COLOR: '1'
        run: node .trainctl-engine/packages/cli/src/bin.ts check
```

`check` niczego nie zapisuje i nie potrzebuje klucza API — czyta wyłącznie
`plan/plan.yaml`, więc workflow działa też na publicznym repo bez sekretów.
Kto chce, żeby ostrzeżenia również blokowały merge, dodaje `--strict`.

## Wariant bez GitHuba

Hook przed commitem w katalogu treningowym:

```
# .git/hooks/pre-commit
trainctl check || exit 1
```

Albo po prostu `trainctl check` po każdej ręcznej edycji — wynik jest ten sam,
różnica polega tylko na tym, kto pamięta o uruchomieniu.
