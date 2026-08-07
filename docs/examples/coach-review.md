# Trener-człowiek jako reviewer — zmiany planu przez pull request

Plan mieszka w gicie, więc współpraca zawodnika z trenerem (albo z partnerem
treningowym) może korzystać z mechaniki code review: zmiana tygodnia to diff,
komentarz pada przy konkretnej linii, a akceptacja to approve + merge. Serwisy
treningowe dają trenerowi panel vendora; tu dostaje przepływ, który zna z pracy.

**To jest wzorzec pracy, nie funkcja produktu** — nie trzeba nic instalować
poza tym, co już jest: katalog treningowy w repozytorium na GitHubie
(prywatnym — w planie są dane o Tobie) i drugi człowiek z dostępem.

## Przepływ

1. **Zawodnik, po tygodniu:** `trainctl review` (co było, co przed nami)
   i ewentualnie `trainctl adapt` (propozycje korekt). Decyzja o zmianie
   zaczyna gałąź:

   ```
   git checkout -b tydzien-33
   # edycja trainctl.yaml (np. nowy wynik, korekta objętości)
   trainctl plan
   trainctl check
   git commit -am "tydzien 33: nowy wynik z 10 km, korekta stref"
   git push -u origin tydzien-33
   ```

2. **Pull request.** W opisie PR wklej wynik `trainctl diff` sprzed regeneracji
   — to jest streszczenie zmiany dla człowieka. `plan/PLAN.md` też się zmienia,
   a jego diff czyta się jak plan, nie jak YAML.

3. **Trener robi review:** komentarz przy wierszu tygodnia („ten akcent bym
   odpuścił, dwa tygodnie po infekcji"), prośba o zmianę albo approve.
   Rozmowa zostaje przypięta do konkretnej linii planu — za rok wiadomo,
   dlaczego tydzień 33 wyglądał inaczej.

4. **Merge = decyzja.** Gałąź scenariusza, która przegrała dyskusję, ginie
   bez śladu w planie właściwym.

## Strażnik w CI

Workflow z [ci-check.md](ci-check.md) na zdarzeniu `pull_request` sprawia, że
PR łamiący inwarianty (akcenty bez 48 h, trening w przeddzień startu) jest
czerwony, zanim trener w ogóle zacznie czytać — z ID reguły w wyniku.

## Co ułatwia review

- **Mały zakres PR-a**: jedna decyzja (jeden tydzień, jedna korekta profilu),
  nie „wszystko od ostatniego razu".
- **`plan/PLAN.md` w repo**: to jego diff czyta trener; `plan/plan.yaml` jest
  źródłem prawdy dla komend.
- **Opis zmiany po ludzku**: `trainctl why` dla spornej jednostki wkleja do
  dyskusji cel sesji i reguły z FOUNDATIONS — argumenty zamiast „tak czuję".
