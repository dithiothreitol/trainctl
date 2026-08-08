# Opcjonalnie: trener odzywa się pierwszy — odprawa z harmonogramu agenta

**To jest przykład, nie część produktu.** Domyślnie rozmowę zaczyna człowiek:
pyta „jak mi poszło?", a agent woła `trainctl_review`. Ten plik jest dla osób,
które chcą odwrócić kolejność — w poniedziałek rano to trener ma się odezwać
pierwszy, jak robi to prawdziwy trener na czacie.

Różnica względem [przeglądu w GitHub Actions](github-actions-review.md) jest
zasadnicza: tam wynik produkuje bot, który nie umie dopytać. Tu przegląd
uruchamia się w **kanale agentowym**, więc po relacji może paść pytanie „ten
pominięty czwartek to choroba czy robota?" — i odpowiedź coś zmienia. Dlatego
jeśli rozważasz oba warianty, zacznij od tego.

## Zasady, które obowiązują nadal

1. **Zgoda przed włączeniem.** AGENTS.md każe agentowi *zaproponować* cykliczną
   odprawę, nie włączyć ją po cichu. To samo dotyczy Ciebie — włączasz świadomie,
   wiedząc, co będzie się działo bez Twojego udziału.
2. **Odprawa relacjonuje i proponuje — nie stosuje.** `trainctl_review` jest
   read-only (poza migawką synchronizacji). Każda zmiana planu nadal przechodzi
   przez rozmowę i diff, który zatwierdzasz.
3. **Powiadomienie, które się ignoruje, jest gorsze niż jego brak.** Dobrze
   napisany plan ma progresję i deload z góry; większość tygodni nie wymaga
   niczego. Jeśli poniedziałkowa wiadomość zaczyna być rutynowo pusta, zmniejsz
   częstotliwość albo wróć do modelu „człowiek pyta pierwszy".

## Claude Code: zadanie cykliczne

Claude Code potrafi uruchamiać zaplanowane zadania (routines / scheduled
agents). W katalogu treningowym poproś agenta wprost:

> Załóż cotygodniowe zadanie: w poniedziałek o 7:00 uruchom `trainctl_review`
> w tym katalogu i zrelacjonuj mi wynik po ludzku — co za nami, co przed nami,
> najwyżej dwie rzeczy do zrobienia. Jeśli w minionym tygodniu są wpisy
> z RPE albo notatkami, przytocz je i dopytaj o kontekst, zanim cokolwiek
> zaproponujesz.

Agent ma wtedy do dyspozycji AGENTS.md z katalogu treningowego, więc rytuał
odprawy (dopytywanie o kontekst, zakaz przeliczania odczuć na liczby) obowiązuje
także w biegu zaplanowanym.

## Bez harmonogramu agenta: cron + tryb jednorazowy

Każde środowisko z cronem może wysłać odprawę np. na terminal albo do skrzynki:

```bash
# poniedziałek 06:30 — przegląd tygodnia do pliku, który czytasz przy kawie
30 6 * * 1  cd /sciezka/do/my-training && npx trainctl review > ~/odprawa.txt
```

albo przez agenta w trybie nieinteraktywnym (Claude Code):

```bash
30 6 * * 1  cd /sciezka/do/my-training && \
  claude -p "trainctl_review i zrelacjonuj wynik; przytocz wpisy z RPE/notatkami z minionego tygodnia" >> ~/odprawa.md
```

Wariant z `claude -p` daje relację w języku trenera zamiast surowego raportu,
ale bez otwartej rozmowy — dopytanie o kontekst i decyzje nadal wymagają sesji
interaktywnej. Traktuj wynik jako zaproszenie do rozmowy, nie werdykt.
