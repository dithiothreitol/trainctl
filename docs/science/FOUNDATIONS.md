# Fundament naukowy silnika `trainctl`

**Status:** Faza 0 — research zakończony 2026-08-04
**Zakres:** bieganie (v1). Reguły dla triathlonu/ultra oznaczone jako ekstrapolacje.
**Zasada nadrzędna:** każde twierdzenie ma źródło. Tam, gdzie źródła nie udało się
otworzyć bezpośrednio, jest to jawnie zaznaczone. Sekcja 11 („DO WERYFIKACJI")
zbiera wszystko, czego nie potwierdzono z pierwszej ręki.

## Jak czytać ten dokument

Każde twierdzenie ma **siłę dowodów** w jednej z pięciu kategorii:

| Poziom | Znaczenie |
|--------|-----------|
| **A** | Meta-analiza / przegląd systematyczny RCT, spójny wynik, populacja adekwatna (amatorzy/trenowani biegacze) |
| **B** | Pojedyncze RCT dobrej jakości **lub** meta-analiza z istotnymi ograniczeniami (heterogeniczność, mała liczba badań) |
| **C** | Badanie obserwacyjne / kohortowe, duże N, ale bez randomizacji |
| **D** | Opis praktyki elity, narracyjny przegląd, case study, konsensus ekspercki bez badań kontrolowanych |
| **E** | Folklor treningowy — brak potwierdzenia w literaturze, mimo powszechnego stosowania |

**Klasyfikacja poziomu zawodnika** — używamy 6-stopniowej ramy McKay i in.: Tier 0
(sedentary), Tier 1 (recreationally active), Tier 2 (trained/developmental), Tier 3
(highly trained/national), Tier 4 (elite/international), Tier 5 (world class).
To istotne, bo **większość „klasycznych" badań o rozkładzie intensywności dotyczy
Tier 3–5, a docelowy użytkownik `trainctl` to Tier 1–2.**

> McKay AKA, Stellingwerff T, Smith ES, Martin DT, Mujika I, Goosey-Tolfrey VL, et al.
> *Defining Training and Performance Caliber: A Participant Classification Framework.*
> Int J Sports Physiol Perform. 2022;17(2):317–331.
> ⚠️ Ramę odczytano z opisów, nie z pełnego tekstu — patrz sekcja 11.

---

## 1. Rozkład intensywności (TID)

### 1.1 Skąd wzięło się „80/20"

Punktem wyjścia jest obserwacja Seilera i Kjerlanda: elitarni zawodnicy wytrzymałościowi
spędzają **zaskakująco mało czasu na progu**, mimo że intuicja i klasyczna preskrypcja
sugerowałyby odwrotnie. Praca oparta na 384 sesjach (37 siłowych, 347 wytrzymałościowych)
u 11 juniorów biegu narciarskiego przez 32 kolejne dni, ze strefami wyznaczonymi z VT1/VT2.

> Seiler SK, Kjerland GØ. *Quantifying training intensity distribution in elite endurance
> athletes: is there evidence for an "optimal" distribution?* Scand J Med Sci Sports.
> 2006;16(1):49–56. — **poziom D** (obserwacja praktyki, N=11)
> ⚠️ Cytowanie i opis metody z rekordów bibliograficznych i wtórnych opisów; pełnego
> tekstu nie otwarto.

Kluczowe rozróżnienie metodologiczne, które **musi trafić do kodu**: te same dane dają
inne liczby zależnie od metody kwantyfikacji. Stöggl i Sperlich podają przykład
elitarnego narciarza: **91% w strefach 1–2 metodą „time-in-zone", ale 77% w strefie 1
metodą „session-goal"**. Nie ma sensu porównywać „80/20" z jednego badania z „80/20"
z drugiego, jeśli metody się różnią.

> Stöggl TL, Sperlich B. *The training intensity distribution among well-trained and
> elite endurance athletes.* Front Physiol. 2015;6:295. doi:10.3389/fphys.2015.00295
> — **poziom D** (przegląd narracyjny)

Zakresy raportowane w tym przeglądzie:

| Model | Strefa 1 | Strefa 2 | Strefa 3 |
|-------|----------|----------|----------|
| Piramidalny (najczęstszy w badaniach retrospektywnych) | 70–95% | 2–22% | 2–11% |
| Spolaryzowany | 75–80% | 5–10% | 15–20% |

Autorzy tego przeglądu piszą wprost: *„an 'optimal' TID cannot be identified, and future
prospective randomized investigations […] will have to be designed to address this
question"*. To zdanie z 2015 r. jest nadal aktualne — patrz 1.4.

### 1.2 Elita: piramida w bazie, polaryzacja w sezonie

> Casado A, González-Mohíno F i in. *Training Periodization, Methods, Intensity
> Distribution, and Volume in Highly Trained and Elite Distance Runners:
> A Systematic Review.* Int J Sports Physiol Perform. 2022;17(6):820–.
> doi:10.1123/ijspp.2021-0435 — **poziom D** (10 badań, wszystkie obserwacyjne)
> ⚠️ Pełna lista autorów i strona końcowa — do weryfikacji (sekcja 11).

Wnioski: dominuje **TID piramidalny** w okresie przygotowawczym i przedstartowym,
z przejściem na **polaryzację w okresie startowym**; struktura „hard day–easy day";
sesje typu tempo ciągłe lub interwały przy vLT2 (strefa 2) **oraz** sesje w strefie 3
— każda co najmniej raz w tygodniu.

> Haugen T, Sandbakk Ø, Seiler S, Tønnessen E. *The Training Characteristics of
> World-Class Distance Runners: An Integration of Scientific Literature and
> Results-Proven Practice.* Sports Med Open. 2022;8. doi:10.1186/s40798-022-00438-7
> — **poziom D**

Liczby elity (Tier 5), przydatne jako *górna granica sanity-check*, nie jako cel:

- objętość w środku okresu przygotowawczego: **160–220 km/tyg** (maratończycy),
  **130–190 km/tyg** (bieżnia 5000/10 000 m)
- **11–14 sesji/tyg** w obu grupach
- **≥80% objętości przy niskiej intensywności przez cały rok**
- długie wybieganie: **75–165 min** u maratończyków, tempo **~1–2 km/h wolniej niż
  tempo maratońskie**; 45–120 min u biegaczy bieżniowych
- siłownia: **~2×/tyg** we wczesnym/średnim okresie przygotowawczym, **0–1×/tyg**
  w okresie startowym
- taper: **7–10 dni** przed głównym startem

### 1.3 RCT: polaryzacja u dobrze trenowanych

> Stöggl T, Sperlich B. *Polarized training has greater impact on key endurance
> variables than threshold, high intensity, or high volume training.* Front Physiol.
> 2014;5:33. doi:10.3389/fphys.2014.00033 — **poziom B**

48 zawodników (41 ukończyło), VO₂peak 62,6 ± 7,1 ml·kg⁻¹·min⁻¹, 9 tygodni, 4 grupy.
Zrealizowany TID (nie zamierzony):

| Grupa | LOW | LT | HIGH | ΔVO₂peak | p |
|-------|-----|----|------|----------|---|
| POL | 68 ± 12% | 6 ± 8% | 26 ± 7% | **+11,7 ± 8,4%** | <0,001 |
| HIIT | 43 ± 1% | 0% | 57 ± 1% | +4,8 ± 5,6% | <0,05 |
| THR | 46 ± 7% | 54 ± 7% | 0% | b.z. | >0,05 |
| HVT | 83 ± 6% | 16 ± 6% | 1 ± 1% | b.z. | >0,05 |

Zastrzeżenia autorów: uczestnicy **przed badaniem trenowali głównie HVT** (czyli grupa
HVT dostała bodziec, do którego była już zaadaptowana — to zawyża przewagę POL);
grupy różniły się objętością (POL 104 h vs HIIT 66 h przez 9 tyg.), więc nie jest to
czysty test TID przy równej objętości.

> Filipas L, Bonato M, Gallo G, Codella R. *Effects of 16 weeks of pyramidal and
> polarized training intensity distributions in well-trained endurance runners.*
> Scand J Med Sci Sports. 2022;32(3):498–511. doi:10.1111/sms.14101 — **poziom B**

60 dobrze trenowanych mężczyzn (56 ukończyło), 37 ± 6 lat, VO₂peak 68 ± 4, 16 tygodni,
4 ramiona: PYR, POL, PYR→POL (8+8), POL→PYR (8+8).
PYR ≈ 77/17/6; POL ≈ 80/6/14.

**Najlepszy wynik: PYR→POL** — 5 km TT ~1,5% (≈5 s przewagi), VO₂peak ~3,0%,
vBLa2 ~1,7%, vBLa4 ~1,5%. Autorzy wiążą efekt raczej z ekonomią biegu niż ze wzrostem
pułapu. To bezpośrednie potwierdzenie sekwencji obserwowanej u elity (1.2)
w warunkach randomizowanych.

### 1.4 Meta-analiza: przewaga polaryzacji jest mała, warunkowa i zanika u amatorów

> Silva Oliveira P, Boppre G, Fonseca H. *Comparison of Polarized Versus Other Types of
> Endurance Training Intensity Distribution on Athletes' Endurance Performance:
> A Systematic Review with Meta-analysis.* Sports Med. 2024;54(8):2071–2095.
> doi:10.1007/s40279-024-02034-z — **poziom A**

17 badań w przeglądzie, 14 w meta-analizie, 437 uczestników (317 M, 89 K, 31 nieokreślonych).
Poziomy: 7 badań highly trained/national, 9 trained/developmental, 1 sedentary.

| Wynik | SMD [95% CI] | p |
|-------|--------------|---|
| VO₂peak — ogółem | **0,24 [0,01; 0,48]** | 0,040 |
| VO₂peak — interwencje <12 tyg. | 0,40 [0,08; 0,71] | 0,01 |
| VO₂peak — interwencje ≥12 tyg. | 0,04 [−0,32; 0,40] | 0,83 |
| VO₂peak — highly trained | 0,46 [0,10; 0,82] | 0,01 |
| VO₂peak — trained/developmental | n.i. | 0,62 |
| **Time trial** | **−0,01 [−0,28; 0,25]** | **0,92** |
| Time to exhaustion | 0,30 [−0,20; 0,79] | 0,24 |
| Prędkość/moc na VT₂/LT₂ | 0,04 [−0,21; 0,29] | 0,75 |

**To jest najważniejsza tabela w całym rozdziale.** Wnioski wprost przekładalne na silnik:

1. Przewaga polaryzacji nad innymi modelami dotyczy **VO₂peak, nie wyniku** —
   dla time trialu efekt to dosłownie zero (SMD −0,01).
2. Przewaga występuje **tylko w interwencjach <12 tygodni** — czyli w horyzoncie
   krótszym niż typowy blok przygotowania do maratonu.
3. Przewaga występuje **tylko u highly trained**. U trained/developmental (Tier 2 —
   nasza grupa docelowa) różnicy nie ma.
4. Autorzy ostrzegają: *„several of the included reports did not disclose the
   percentage of TID"*, co czyni *„problematic to robustly state which model was
   in fact followed"*.

### 1.5 Amatorzy: sygnał sprzeczny z popularną narracją

> Festa L, Tarperi C, Skroce K, La Torre A, Schena F. *Effects of Different Training
> Intensity Distribution in Recreational Runners.* Front Sports Act Living. 2020;1:70.
> doi:10.3389/fspor.2019.00070 — **poziom B**

38 amatorów (VO₂max ~53 ml·kg⁻¹·min⁻¹, 3,2 ± 0,5 h/tyg., >4 lata treningu), 8 tygodni,
**wyrównany TRIMP** między grupami:

- **PET** (polarized): 77 / 3 / 20
- **FOC** (focused, próg-centryczny): 40 / 50 / 10

| Wynik | PET | FOC |
|-------|-----|-----|
| Prędkość 2 km | +3,5% | +3,0% |
| Prędkość @VO₂max | +3,2% | +4,0% |
| Prędkość @VT | +4,0% | +3,2% |
| Prędkość @RCT | +5,7% | +3,4% |
| Ekonomia biegu | −5,3% | −8,7% |
| **Łączny czas treningu** | **29,9 h** | **24,8 h** |

Brak istotnych różnic międzygrupowych (p > 0,05). Konkluzja autorów: FOC daje podobne
przyrosty **oszczędzając 17% czasu treningowego**.

**To wynik sprzeczny z popularną wersją „80/20"** i spójny z meta-analizą (1.4):
u amatorów strefa 2 nie jest „szarą strefą do unikania" — jest efektywna czasowo.
Ograniczenie: test 2 km, autorzy sami przyznają, że *„not directly representative
of a longer distance performance"* — czyli dla maratonu ten wynik nie przenosi się
automatycznie.

### 1.6 Co robią realne plany dla sub-elity

> Knopp M, Appelhans D, Schönfelder M, Seiler S, Wackerhage H. *Quantitative Analysis
> of 92 12-Week Sub-elite Marathon Training Plans.* Sports Med Open. 2024;10:50.
> doi:10.1186/s40798-024-00717-5 — **poziom D** (analiza treści planów, nie wyników)

92 plany, ostatnie 12 tygodni przed maratonem, model **5-strefowy**:

| Kategoria | Objętość | Strefy 1–2–3–4–5 | Najdłuższy bieg | Sesje/tyg. |
|-----------|----------|------------------|-----------------|------------|
| High | 107,7 ± 38,4 km | 15–67–10–5–3% | 35,2 ± 3,3 km | 6,8 ± 1,4 |
| Middle | 58,5 ± 17,9 km | 14–63–18–2–3% | 32,5 ± 3,8 km | 4,9 ± 0,9 |
| Low | 42,9 ± 14,1 km | 12–67–17–2–2% | 30,9 ± 4,1 km | 4,1 ± 0,9 |

⚠️ **Uwaga interpretacyjna:** w modelu 5-strefowym strefa 1 to bardzo lekkie truchty,
a strefa 2 to „easy/aerobowe". Sumy Z1+Z2 = 82% / 77% / 79% — czyli spójne z „~80%
niskiej intensywności". Nie należy czytać „strefa 1 = 15%" jako sprzeczności z 80/20.
Kształt jest **piramidalny** we wszystkich trzech kategoriach.

### 1.7 Rekomendacja dla silnika (proporcje stref)

Model 3-strefowy (LT1/LT2 jako granice) — praktyczna synteza:

| Faza | Z1 (<LT1) | Z2 (LT1–LT2) | Z3 (>LT2) | Uzasadnienie |
|------|-----------|--------------|-----------|--------------|
| Baza | 80–85% | 10–15% | 3–7% | piramida; Casado 2022, Knopp 2024 |
| Build | 78–82% | 12–18% | 5–8% | piramida z rosnącą Z2; Filipas 2022 (faza 1) |
| Peak/start | 78–82% | 5–8% | 12–18% | polaryzacja; Filipas 2022 (faza 2), Casado 2022 |

**Ale:** dla użytkownika z ≤4 sesjami/tyg. i ≤5 h/tyg. przewaga polaryzacji jest
nieudowodniona (1.4, 1.5). Silnik powinien traktować proporcje jako **domyślne, nie
sakralne**, i dopuszczać wariant „time-efficient" bliższy FOC (więcej Z2), gdy
budżet czasowy jest wąski.

---

## 2. Strefy i kalibracja bez laboratorium

### 2.1 LT1/LT2 — najlepsze dostępne dane dla amatorów

> Nuuttila O-P, Kaikkonen P, Sievänen H, Vasankari T, Kyröläinen H. *The accuracy of
> fixed intensity anchors to estimate lactate thresholds in recreational runners.*
> Eur J Appl Physiol. 2025;125(8):2161–2171. doi:10.1007/s00421-025-05748-8
> — **poziom B** (przekrojowe, ale N=165, dokładnie nasza populacja)

165 amatorów Tier 2: 64 K (36 ± 7 lat, VO₂max 44,1 ± 4,5), 101 M (36 ± 6 lat, 51,3 ± 5,9).

**Kotwice względne (średnia ± SD):**

| Parametr | LT1 K | LT1 M | LT2 K | LT2 M |
|----------|-------|-------|-------|-------|
| %HRmax | 83,6 ± 4,2 | 78,9 ± 4,4 | 91,7 ± 2,2 | 89,9 ± 2,4 |
| %HRR | 76,5 ± 6,1 | 71,3 ± 6,0 | 88,1 ± 3,1 | 86,3 ± 3,4 |
| %vPeak | 67,3 ± 4,4 | 64,6 ± 4,6 | 80,9 ± 4,0 | 80,8 ± 3,4 |
| %VO₂max | 75,3 ± 5,6 | 70,8 ± 5,1 | 87,8 ± 4,7 | 86,6 ± 3,6 |
| RPE (6–20) | 12,8 ± 1,5 | 12,3 ± 1,6 | 15,2 ± 2,2 | 15,5 ± 1,4 |

**Błąd bezwzględny (MAE) estymacji:**

| Kotwica | LT1 | LT2 |
|---------|-----|-----|
| Prędkość | **0,6 km/h** | **0,4 km/h** |
| HR | 4,9 bpm | 2,8 bpm |
| RPE → prędkość | 0,8 km/h | 0,8 km/h |
| RPE → HR | 7,4 bpm | 5,2 bpm |

Trzy wnioski dla silnika:

1. **Prędkość jest lepszą kotwicą niż HR** (MAE 0,4–0,6 km/h vs 2,8–4,9 bpm).
   RPE jest najgorsze.
2. **Różnice płciowe są istotne i duże na LT1**: kobiety mają LT1 przy 83,6%HRmax,
   mężczyźni przy 78,9% (p<0,001) — **prawie 5 pp różnicy**. Uniwersalna tabela
   stref jest błędem systematycznym dla kobiet.
3. **Jeśli HRmax/vPeak są szacowane, a nie zmierzone, błąd rośnie do 1,0 km/h
   i 8,4 bpm** — czyli wzory typu `220 − wiek` degradują cały łańcuch.

### 2.2 Zegarki: nie ufać wartościom LT z zegarka

> Lu C, Cui W, Zhu Z, Wu Y, Xing Q, Pan B, Shen Y. *Validity of smartwatch-derived
> estimates of lactate threshold heart rate and pace compared to graded exercise
> testing.* Front Physiol. 2025;16:1621996. doi:10.3389/fphys.2025.1621996
> — **poziom B**

100 amatorów; Huawei GT Runner (n=100), Garmin Forerunner 265/265s (n=23),
Coros Pace3 (n=17).

| Urządzenie | LT HR: MAE / bias | LT pace: MAE / MAPE / bias |
|------------|-------------------|----------------------------|
| Huawei | 10,66 bpm / +2,86 | 1,22 km/h / 12,70% / +0,98 |
| Garmin | 11,44 bpm / +6,28 | 2,17 km/h / 25,78% / +2,06 |
| Coros | 8,93 bpm / +5,44 | 1,93 km/h / 22,63% / +1,77 |

**Wszystkie urządzenia zawyżają tempo progowe** (bias +0,98 do +2,06 km/h).
Autorzy: *„their outputs may still lead to misclassification of physiological
training zones"*. **Reguła dla silnika: nie importować LT z zegarka jako źródła
kalibracji stref.** Wolno importować jako sygnał informacyjny z jawnym ostrzeżeniem.

### 2.3 Critical speed — protokoły terenowe

> Lipková L, Struhár I, Krajňák J, Puda D, Kumstát M. *Field-based tests for
> determining critical speed among runners and its practical application:
> a systematic review.* Front Sports Act Living. 2025;7:1520914.
> doi:10.3389/fspor.2025.1520914 — **poziom B** (19 badań, 285 uczestników, bez meta-analizy)

Zwalidowane protokoły:

- **Time trials:** dystanse 1200 / 2400 / 3600 m, albo czasy 3 / 7 / 12 min.
  2–3 próby (3 dla precyzji badawczej, 2 wystarczają w praktyce).
  Przerwa **30–60 min** między próbami (30 min działa). Kolejność:
  od najdłuższej do najkrótszej albo randomizowana.
- **3-min all-out test (3MT):** CS = średnia prędkość z **ostatnich 30 s**.
  Test-retest ICC > 0,90. **Zaniża D′ o ~16%** (konsekwentnie).
  Nieodpowiedni dla początkujących („best suited for experienced runners").

Walidacja krzyżowa: Broxterman i in. — 3MT terenowy vs bieżnia r = 0,92;
Galbraith i in. — CS terenowe 4,07 ± 0,28 m/s vs bieżniowe 4,05 ± 0,22 m/s.
Pettitt i in. — GPS 3MT daje wiarygodne predykcje na 1600–5000 m, błąd rośnie na 800 m.

Ograniczenia podane przez autorów: przewaga mężczyzn w próbach, brak standaryzacji
protokołów, brak weryfikacji fizjologicznej maksymalności wysiłku w terenie,
niejasna przenośność na populację nietrenującą.

### 2.4 VDOT — użyteczny, ale z systematycznym błędem u wolniejszych

Patrz sekcja 6.2 — VDOT ma MAE **1,11%** dla biegaczy sub-2:30 i **10,43%** dla
sub-5:00. Jako generator temp treningowych jest wygodny; jako predyktor wyniku dla
amatora — zawodny w przewidywalnym kierunku (za optymistyczny).

### 2.5 Talk test

Talk test jest szeroko opisywany jako przybliżenie VT1 (Foster, Persinger i in.),
ale **nie udało się otworzyć źródła pierwotnego z liczbami** — patrz sekcja 11.
W silniku traktować jako opisowy sanity-check dla użytkownika („powinieneś móc
prowadzić rozmowę"), **nie** jako metodę kalibracji.

### 2.6 Rekomendowana ścieżka kalibracji (bez laboratorium)

Kolejność preferencji, od najlepszej:

1. **Wynik startu z ostatnich 6–8 tygodni** (5 km–HM) → VDOT/CS → tempa.
2. **Time trial 2 próby** (np. 1200 m + 3600 m, 30 min przerwy) → CS + D′.
   Wymaga Tier 2+, doświadczenia w rozkładaniu sił.
3. **Zmierzone HRmax + vPeak** + kotwice %HRmax/%vPeak z tabeli 2.1
   **osobno dla płci**.
4. **Szacowane HRmax** — dopuszczalne tylko z jawną informacją o wzroście błędu
   (MAE do 1,0 km/h i 8,4 bpm).
5. **Wartości LT z zegarka** — tylko informacyjnie, nigdy jako źródło stref.

Rekalibracja: przy każdym nowym starcie; dodatkowo co 6–8 tygodni w bloku
(uzasadnienie: interwencje w badaniach z sekcji 1.3–1.5 dawały istotne zmiany
vLT1/vLT2 już po 8 tygodniach).

---

## 3. Progresja obciążeń i guardraile

### 3.1 Reguła 10% — nie ma dowodów

> Damsted C, Glad S, Nielsen RO, Sørensen H, Malisoux L. *Is there evidence for an
> association between changes in training load and running-related injuries?
> A systematic review.* Int J Sports Phys Ther. 2018;13(6):931–942.
> (PMC6253751) — **poziom B**

Cytat autorów: ***„no evidence exists for the use of the so-called '10% rule'"***.

Dane pierwotne, na których to opiera:

| Badanie | Ustalenie |
|---------|-----------|
| Buist i in. 2008 (RCT) | progresja 10%/tyg. → **20,8%** urazów; progresja 24%/tyg. → **20,3%** urazów. HR = 0,8 [0,6; 1,3] — **brak różnicy** |
| Nielsen i in. 2013 | biegacze z urazem zwiększali objętość o 31,6 ± 3,1%/tyg., bez urazu o 22,1 ± 2,1%; w tygodniu przed urazem wzrost o 86% większy niż w innych tygodniach (p = 0,026) |
| Nielsen i in. 2014 | >30% wzrostu vs <10%: **HR = 1,59 [0,96; 2,66]** dla urazów „distance-related" |

> Nielsen RO, Parner ET, Nohr EA, Sørensen H, Lind M, Rasmussen S. *Excessive
> Progression in Weekly Running Distance and Risk of Running-Related Injuries:
> An Association Which Varies According to Type of Injury.* J Orthop Sports Phys Ther.
> 2014;44(10). doi:10.2519/jospt.2014.5164 — **poziom C** (874 początkujących, 1 rok,
> 202 urazy)

⚠️ **Uczciwie:** HR = 1,59 ma **przedział ufności przechodzący przez 1,0** [0,96; 2,66].
To nie jest wynik istotny statystycznie. Powszechnie cytowane „ponad 30% to ryzyko"
jest nadinterpretacją — to sygnał kierunkowy, nie ustalony fakt. Autorzy przeglądu:
*„very limited evidence exists supporting that sudden change in training load is
associated with increased risk"*, a *„a clear threshold for injurious progression
remains undefined"*.

**Konsekwencja dla silnika:** ramp rate to **narzędzie zarządzania ryzykiem
i przewidywalności planu, nie zwalidowany próg urazowy.** Nie należy komunikować
użytkownikowi „przekroczyłeś bezpieczny próg" — należy komunikować „to duży skok
względem twojej bazy; to zwiększa niepewność adaptacji".

### 3.2 ACWR — krytyka metodologiczna

> Impellizzeri FM, McCall A, Ward P, Bornn L, Coutts AJ. *Training Load and Its Role
> in Injury Prevention, Part 2: Conceptual and Methodologic Pitfalls.*
> J Athl Train. 2020;55(9):893–901. doi:10.4085/1062-6050-501-19 — **poziom B**
> (komentarz metodologiczny)

Zarzuty:

1. **Brak podstawy fizjologicznej.** ACWR wyprowadzono z modelu Banistera bez
   uzasadnienia etiologicznego.
2. **Artefakty matematyczne.** Iloraz nie normalizuje licznika; sprzężenie
   matematyczne (mathematical coupling) tworzy szum. Po uwzględnieniu harmonogramu
   treningu związek ACWR–uraz **znika** — ACWR „przewiduje przyszłe obciążenie",
   nie uraz.
3. **Niespójność kierunku.** Badania raportują zależności U-kształtne, liniowe
   dodatnie, liniowe ujemne i odwrócone U — co przeczy tezie o stabilnej
   wartości predykcyjnej.
4. **Elastyczność metodologiczna.** Badacze manipulują mianownikiem (wykluczają
   niskie wartości chronic load), co przeczy założeniom samego ilorazu.
5. **„Sweet spot" jest artefaktem binowania.** Grupowanie danych ciągłych w koszyki
   tworzyło sztuczne progi; po usunięciu obserwacji odstających i traktowaniu
   danych jako ciągłych zależność zanika.

Rekomendacja autorów: opierać się na **klasycznych zasadach treningu (progresywne
przeciążenie) i reakcji zawodnika**, nie na metrykach typu ACWR.

**Decyzja dla `trainctl`:** **nie implementować ACWR jako guardraila blokującego.**
Można liczyć i pokazywać stosunek 7 d / 28 d jako **deskryptor** („twoje obciążenie
z ostatniego tygodnia to 1,35× średniej z 4 tygodni"), bez progów, bez „sweet spota",
bez języka ryzyka urazu. To uczciwie odzwierciedla stan dowodów.

### 3.3 Monotonia i strain (Foster)

> Haddad M, Stylianides G, Djaoui L, Dellal A, Chamari K. *Session-RPE Method for
> Training Load Monitoring: Validity, Ecological Usefulness, and Influencing Factors.*
> Front Neurosci. 2017;11:612. doi:10.3389/fnins.2017.00612 — **poziom B** (przegląd)

Wzory (potwierdzone z tego przeglądu):

```
sRPE (AU)   = RPE × czas_sesji_min
monotonia   = średnia_tygodniowa_TL / SD_dziennych_TL
strain      = tygodniowa_TL × monotonia
```

Walidacja sRPE: korelacje z Edwards' TRIMP r = 0,52–0,97; Banister TRIMP
r = 0,14–0,99; Lucia TRIMP r = 0,59–0,85; VO₂/VO₂max r = 0,75–0,80.
**Rozrzut r = 0,14–0,99 sam mówi, jak niestabilna jest ta walidacja.**

Czynniki zakłócające sRPE udokumentowane w przeglądzie: obecność innych osób,
cechy osobowości (ekstrawersja, neurotyzm, lęk, depresja), płeć, wiek, poziom
sprawności, muzyka, temperatura, wysokość, glikemia, kofeina/napoje energetyczne,
post (Ramadan), jakość tłumaczenia skali. Dodatkowo: *„time spent at high-intensity
and only marginally the session duration influenced the session's RPE"* — czyli sRPE
niedoważa długie spokojne sesje, co dla biegacza amatora jest istotnym błędem.

Źródło pierwotne: Foster C. *Monitoring training in athletes with reference to
overtraining syndrome.* Med Sci Sports Exerc. 1998;30(7):1164–1168 — **poziom D**.
⚠️ **Progu numerycznego monotonii (powszechnie cytowane „>2,0") nie udało się
potwierdzić w źródle pierwotnym** — patrz sekcja 11.

**Decyzja dla `trainctl`:** liczyć monotonię i strain, używać jako **sygnału
diagnostycznego przy generowaniu tygodnia** (unikać planów, gdzie wszystkie dni mają
identyczne obciążenie), ale **nie podawać progu numerycznego** jako granicy
bezpieczeństwa. Monotonia jest przydatna jako *cel projektowy planu*
(zróżnicuj dni), nie jako *alarm*.

### 3.4 Wzorzec progresji: falujący z tygodniem odciążenia — najlepszy zweryfikowany wynik

> Costa PB, Simão R, Perez AJ, et al. *A Randomized Controlled Trial Investigating the
> Effects of Undulatory, Staggered, and Linear Load Manipulations in Aerobic Training
> on Oxygen Supply, Muscle Injury, and Metabolism in Male Recreational Runners.*
> Sports Med Open. 2019;5:32. doi:10.1186/s40798-019-0200-5 — **poziom B**

88 amatorów (M, 20–35 lat), 8 tygodni (2 mezocykle × 4 tyg.), 30,1–43 km/tyg.,
70% VO₂max, łącznie 283,3 km. 4 grupy = {falujący, schodkowy} × {falujący, liniowy}.

| Grupa | ΔVO₂max | p | CK | LDH | wolny T/kortyzol |
|-------|---------|---|----|-----|------------------|
| **Und-Und** (falujący/falujący, **z redukcją w ostatnim tygodniu**) | **+22,15%** (d=1,14) | 0,01 | trend ↓ | trend ↓ | **↑ (p=0,02)** |
| Und-Lin | +16,01% | 0,02 | — | — | — |
| Sta-Und (bez redukcji) | +11,47% | 0,02 | — | — | — |
| Sta-Lin (bez redukcji) | +11,16% | 0,04 | **↑ (p=0,01)** | **↑ (p=0,02)** | **↓ (p=0,02)** |

Konkluzja autorów: amatorzy powinni stosować *„undulatory cycles weekly and monthly
with a decrease in volumes after 4 weeks"*; obciążenia liniowe tygodniowo
w połączeniu ze schodkowymi miesięcznie *„increase serum markers of protein catabolism
and muscle injury"*.

**To najbardziej bezpośrednio implementowalny wynik w całej sekcji 3:** mikrocykl
falujący + **tydzień odciążenia po 4 tygodniach** ma poparcie RCT u amatorów,
z dwukrotnie większym przyrostem VO₂max niż progresja bez odciążenia oraz z lepszym
profilem markerów uszkodzeń mięśni i stosunku anaboliczno-katabolicznego.

Zastrzeżenia: tylko mężczyźni, tylko 8 tygodni, niskie objętości (30–43 km/tyg.),
Δ+22% VO₂max jest bardzo duże — sugeruje niski poziom wyjściowy uczestników,
więc efekt raczej nie skaluje się na trenowanych.

### 3.5 Objętość i uraz: progi wydajnościowe bez kosztu urazowego

> Fokkema T, van Damme AADN, Fornerod MWJ, de Vos R-J, Bierma-Zeinstra SMA,
> van Middelkoop M. *Training for a (half-)marathon: Training volume and longest
> endurance run related to performance and running injuries.* Scand J Med Sci Sports.
> 2020;30:1692–1704. doi:10.1111/sms.13725 — **poziom C** (prospektywna kohorta,
> n=997: 556 HM + 441 M)

**Półmaraton — szybszy czas:**
- objętość >32 km/tyg.: β = −4,19 min [−6,52; −1,85]
- najdłuższy bieg >21 km: β = −3,87 min [−6,31; −1,44]
- tempo treningowe <5:15/km

**Maraton — szybszy czas:**
- objętość >65 km/tyg.: β = −14,09 min [−22,47; −5,72]
- tempo treningowe <5:15/km: β = −33,67 min [−40,40; −26,93]

**Maraton — wolniejszy czas:**
- objętość <40 km/tyg.: β = +6,33 min [0,18; 12,48]
- najdłuższy bieg <25 km: β = +13,44 min [5,34; 21,55]

**Urazy: „No associations between training characteristics and new RRIs during
follow-up"** — w obu grupach. Dodatkowo: biegi >35 km nie dawały dodatkowej korzyści
względem 30–35 km.

To ważny, kontrintuicyjny wynik: w tej kohorcie **wyższa objętość poprawiała wynik
bez podnoszenia ryzyka urazu**. Nie znaczy to, że objętość jest darmowa — znaczy,
że w zakresie realizowanym przez amatorów przygotowujących się do startu związek
objętość→uraz nie był wykrywalny.

### 3.6 Czynniki ryzyka urazu — stan wiedzy jest słaby

> Correia CK, Machado JM, Dominski FH, et al. *Risk factors for running-related
> injuries: An umbrella systematic review.* J Sport Health Sci. 2024;13(6):793–804.
> doi:10.1016/j.jshs.2024.04.011 — **poziom B** (13 przeglądów, 148 badań pierwotnych)

59 zidentyfikowanych czynników ryzyka; ze 131 wyników z podanym effect size:
23% duże, 29% średnie, 37% małe, 11% brak efektu.
Objętość tygodniowa: „medium to large associations". Przebyty uraz: czynnik
przyczyniający się. BMI: *„lacked a clear association"*.

**Zastrzeżenie autorów, kluczowe:** *„none of the SRs included presented a rating of
moderate or high confidence in quality"*. Cała ta literatura ma niską jakość.

### 3.7 Powrót po starcie

> Martínez-Navarro I, Montoya-Vieco A, Hernando C, Hernando B, Panizo N, Collado E.
> *The week after running a marathon: Effects of running vs elliptical training vs
> resting on neuromuscular performance and muscle damage recovery.* Eur J Sport Sci.
> 2021;21(12):1668–1674. doi:10.1080/17461391.2020.1857441 — **poziom B**

64 finiszerów maratonu (54 M, 10 K; 39 ± 4 lata; 3:35 ± 21 min), randomizacja
na mecie do RUN / ELIP / REST. RUN i ELIP: **40 min ciągłego wysiłku przy
95–105% HR odpowiadającego pierwszemu progowi ventylacyjnemu, w 48 h, 96 h i 144 h**
po biegu. Pomiary CK i LDH: przed, do 15 min po, oraz 24/48/96/144/192 h.

Wyniki: **brak efektu interwencji na markery uszkodzeń mięśni** (p > 0,05);
grupa RUN miała **lepszy skok (SJ) w 96 h**: 108,29 ± 10,64% vs 100,58 ± 9,16%
w REST (p = 0,020, d = 0,80).

Wniosek autorów: *„return to running at 48 h post-marathon does not seem to have
a negative impact on muscle damage recovery up to eight days post-race and it could
be recommended in order to speed up neuromuscular recovery"*.

**Implementacja:** po maratonie **48 h pełnej ciszy, potem lekkie bieganie
(Z1, ~40 min, tempo przy LT1) co 48 h**. Brak podstaw dla „2 tygodnie nic".
⚠️ Ekstrapolacja na ultra (100 km, Rzeźnik) **nie jest uzasadniona** tym badaniem —
skala uszkodzeń jest inna. Dla ultra konserwatywnie: dłuższa cisza, decyzja
per przypadek.

### 3.8 Powrót po chorobie

> Ruuskanen O, Valtonen M, Waris M, Luoto R, Heinonen OJ. *Sport and exercise during
> viral acute respiratory illness — Time to revisit.* J Sport Health Sci.
> 2023;13(5):663–665. doi:10.1016/j.jshs.2023.12.002 — **poziom D** (komentarz)

O regule „neck check": ***„This rule is nonscientific but may be partly useful."***

Bezwzględne przeciwwskazania do wysiłku: *„chest pain, syncope, shortness of breath,
and palpitations are absolute contraindications for exercise and indications for
cardiologic investigations"*.

Autorzy **nie podają protokołu stopniowego powrotu** — piszą, że
*„evidence-based clinical guidelines […] are lacking"* i decyzja powinna być
*„a personalized process between the athlete and the medical team"*.

**Implementacja:** silnik **nie może** udawać, że ma protokół medyczny.
Może: (a) wykryć lukę w logu, (b) zaproponować konserwatywny restart
(objętość × 0,5–0,6, zero Z3 przez pierwsze 5–7 dni, progresja jak po przerwie),
(c) wyświetlić listę objawów wymagających kontaktu z lekarzem — **cytując źródło**,
bez własnej porady medycznej. Reguła „neck check" **nie może być kodowana jako
logika decyzyjna** — jest jawnie oznaczona jako nienaukowa.

---

## 4. Jednostki treningowe i cel fizjologiczny

### 4.1 Easy run / bieg spokojny

Cel: objętość aerobowa przy minimalnym koszcie regeneracyjnym. Intensywność:
**<LT1**, czyli ok. 79%HRmax (M) / 84%HRmax (K), 65%/67% vPeak (2.1).

To zdecydowanie największy blok objętości (~80%, sekcja 1) i jednocześnie
**najsłabiej zbadana jednostka** — nie ma RCT „easy run vs nic", bo byłoby to
absurdalne. Uzasadnienie jest obserwacyjne (Haugen 2022, Casado 2022) plus
pośrednio: w badaniu Casado i in. objętość łatwych biegów była najlepszym
predyktorem wyników światowej klasy.

> Casado A, Hanley B, Ruiz-Pérez LM. *World-Class Long-Distance Running Performances
> Are Best Predicted by Volume of Easy Runs and Deliberate Practice of Short-Interval
> and Tempo Runs.* J Strength Cond Res. 2021 — **poziom C**
> ⚠️ Cytowanie z rekordów bibliograficznych; pełnego tekstu nie otwarto (sekcja 11).

### 4.2 Long run / długie wybieganie

Dane twarde (3.5, Fokkema 2020):

- HM: najdłuższy bieg **>21 km** → −3,87 min
- M: najdłuższy bieg **<25 km** → +13,44 min (kara); **>35 km nie daje dodatkowej
  korzyści** względem 30–35 km

Dane z praktyki: plany sub-elity mają najdłuższy bieg **30,9–35,2 km** (Knopp 2024,
1.6); elita **75–165 min** przy tempie ~1–2 km/h wolniej niż maratońskie
(Haugen 2022, 1.2).

**Reguła dla silnika:** długie wybieganie limitować **czasem, nie dystansem**
(spójne z praktyką elity, która operuje minutami) — z sufitem, ponad którym nie ma
udokumentowanej korzyści, a rośnie koszt. Dla maratonu: docelowo **30–35 km**
lub odpowiednik czasowy; **nie przekraczać 35 km**.
⚠️ Popularny sufit „nie więcej niż 3 h" **nie ma potwierdzenia w źródle naukowym**,
które udało się otworzyć — patrz sekcja 11. Wyprowadzenie 35 km z Fokkemy jest
solidniejsze.

### 4.3 Threshold / tempo

Cel: prędkość przy LT2 / maximal metabolic steady state. Intensywność: LT2 ≈
90%HRmax (M) / 92%HRmax (K), ~81% vPeak (2.1).

Formy: tempo ciągłe albo interwały przy vLT2 („medium and long aerobic intervals")
— obie stosowane przez elitę co najmniej raz w tygodniu (Casado 2022, 1.2).

Kluczowe: to jednostka, której **przewaga u amatorów jest niedoceniona**.
Grupa FOC (50% czasu w strefie 2) dorównała grupie polaryzowanej przy 17% mniejszym
nakładzie czasu (1.5). Dla użytkownika z limitem 4–5 h/tyg. sesja progowa jest
prawdopodobnie **najlepszym stosunkiem efektu do czasu**.

### 4.4 VO₂max / interwały

> Buchheit M, Laursen PB. *High-Intensity Interval Training, Solutions to the
> Programming Puzzle. Part I: Cardiopulmonary Emphasis.* Sports Med. 2013;43:313–338.
> doi:10.1007/s40279-013-0029-x
> Buchheit M, Laursen PB. *… Part II: Anaerobic Energy, Neuromuscular Load and
> Practical Applications.* Sports Med. 2013;43(10):927–954. — **poziom D**
> ⚠️ Pełnych tekstów nie udało się otworzyć (PDF nieczytelny dla narzędzia).
> Podane wyżej cytowanie jest potwierdzone; **konkretne parametry z tych prac
> nie zostały zweryfikowane** — patrz sekcja 11.

Co udało się zweryfikować niezależnie o parametrach interwałów: praca
Ferley i in. porównała interwały podbiegowe vs płaskie u dobrze trenowanych
(N=32, VO₂max 60,9 ± 8,5), 6 tygodni, 12 sesji interwałowych + 12 ciągłych:
oba warianty poprawiły Tmax, ale *„traditional level-grade training produces greater
gains"*.

> Ferley DD, Osborn RW, Vukovich MD. *The effects of uphill vs. level-grade
> high-intensity interval training on VO2max, Vmax, V(LT), and Tmax in well-trained
> distance runners.* J Strength Cond Res. 2013;27(6):1549–1559.
> doi:10.1519/JSC.0b013e3182736923 — **poziom B**

To osłabia popularną tezę o wyższości podbiegów jako *zamiennika* interwałów płaskich.
⚠️ Dokładnych parametrów protokołu (nachylenie, długości odcinków) nie udało się
odczytać z abstraktu.

Meta-analizy sieciowe o optymalnym czasie pracy (~140 s) i stosunku praca:przerwa
(~0,85) **nie zostały zweryfikowane z pełnego tekstu** — patrz sekcja 11.
Do momentu weryfikacji silnik powinien opierać parametry interwałów na
**korpusie trenerskim** (drabinki 1000/400/200 m są tam udokumentowane),
nie na niepotwierdzonych liczbach z literatury.

### 4.5 Podbiegi i strides

**Podbiegi:** korpus trenerski zawiera 15 × 100–200 m. Dowody naukowe:
Ferley i in. (4.4) — podbiegi działają, ale nie lepiej niż interwały płaskie.
Uzasadnienie jako *dodatkowa* jednostka o niższym obciążeniu ekscentrycznym
i wyższym bodźcu nerwowo-mięśniowym jest **poziom D** (praktyka).

**Strides (przebieżki):** literatura naukowa **nie zawiera badań nad samymi
strides**. Wszystkie wyniki, które podaje się jako uzasadnienie („2% poprawy
ekonomii"), pochodzą z badań nad **plyometrią i treningiem eksplozywnym**
— czyli z sekcji 7, nie z badań nad przebieżkami.
Klasyfikacja: **poziom D/E** — konsensus praktyczny bez bezpośrednich dowodów.
Silnik może wstawiać strides (są tanie i zgodne z praktyką korpusu), ale
**uzasadnienie w `trainctl why` musi być uczciwe**: „praktyka trenerska; brak
bezpośrednich badań", nie „udowodniono poprawę ekonomii".

### 4.6 „Norwegian method" / double threshold — hype vs dowody

> Casado A, Foster C, Bakken M, Tjelta LI. *Does Lactate-Guided Threshold Interval
> Training within a High-Volume Low-Intensity Approach Represent the "Next Step" in
> the Evolution of Distance Running Training?* Int J Environ Res Public Health.
> 2023;20(5):3782. doi:10.3390/ijerph20053782 — **poziom D** (przegląd narracyjny
> + case studies)

Parametry LGTIT (lactate-guided threshold interval training):

- cel laktatowy **2–4,5 mmol·L⁻¹**
- przykładowe sesje: **5 × 2 km @ 2,5 mmol, przerwa 1 min**;
  **10 × 1000 m @ 3,5 mmol, przerwa 1 min**; **25 × 400 m @ 3,5 mmol, przerwa 30 s**
- struktura tygodnia: **3–4 sesje LGTIT + 1 sesja VO₂max + reszta LIT**,
  łącznie **150–180 km/tyg.**

**Zastrzeżenia autorów, cytowane wprost:**

> *„The present article examined the current training regime of some of the best
> runners in the world and its derived potential physiological benefits on the basis
> of **only observational studies and reports**. Therefore, the assumptions stated
> previously should be taken cautiously since **no controlled studies have tested the
> efficacy of this training model**."*

Dodatkowo: charakterystyki opisano *„only in 1500 m and 5000 m runners"*,
a *„its applicability in other endurance events, such as the marathon, remains
uncertain"*. **Brak jakiejkolwiek wypowiedzi o zastosowaniu u sub-elity
lub amatorów.**

> Kelemen B, Benczenleitner O, Tóth L. *The Norwegian double-threshold method in
> distance running: Systematic literature review.* Sci J Sport Perform. 2024;3(1):38–46.
> doi:10.55860/NBXV4075 — **poziom D**
> ⚠️ Pełnej ekstrakcji nie uzyskano (PDF skompresowany). Potwierdzono, że przegląd
> istnieje i że dowody pochodzą głównie od elity, z jawnym ostrzeżeniem autorów
> o ograniczonej przenośności na amatorów.

**Werdykt dla silnika:** double threshold to **poziom D bez ani jednego badania
kontrolowanego**, opisany wyłącznie u zawodników 1500/5000 m robiących 150–180 km/tyg.
Wymaga pomiaru laktatu, którego użytkownik `trainctl` nie ma. **Nie implementować
w v1.** Jeśli kiedyś — jako jawnie eksperymentalny tryb dla użytkownika Tier 3+
z mleczanomierzem, z ostrzeżeniem o statusie dowodów. Wersja „double threshold
na czuja bez laktatu" to nie ta metoda, tylko dwie sesje progowe w jeden dzień
— bez żadnego wsparcia dowodowego.

---

## 5. Taper

### 5.1 Meta-analizy

> Bosquet L, Montpetit J, Arvisais D, Mujika I. *Effects of tapering on performance:
> a meta-analysis.* Med Sci Sports Exerc. 2007;39(8):1358–1365. — **poziom A**
> 27 z 182 badań spełniło kryteria.
> ⚠️ Pełnego abstraktu **nie udało się otworzyć** (403/402/CAPTCHA na wszystkich
> hostach). Główna konkluzja („2-tygodniowy taper z eksponencjalną redukcją objętości
> o 41–60%") jest spójnie raportowana we źródłach wtórnych, ale **dokładne effect
> size'y (ES = 0,59 dla 2 tygodni; ES = 0,72 dla redukcji 41–60%) pozostają
> niezweryfikowane** — patrz sekcja 11.

> Wang Z, Wang Y, Gao W, Zhong Y. *Effects of tapering on performance in endurance
> athletes: A systematic review and meta-analysis.* PLOS ONE. 2023;18(5):e0282838.
> doi:10.1371/journal.pone.0282838 — **poziom A** (14 badań, 174 zawodników)

| Parametr | Wynik |
|----------|-------|
| Time trial (pre vs post taper) | SMD = **−0,45**, p < 0,05 |
| Time to exhaustion | SMD = 1,28, p < 0,05 |
| **Czas trwania: 8–14 dni** | SMD = **−1,47** [−2,75; −0,19] — największy efekt |
| **Redukcja objętości 41–60%** | SMD = **−0,77** [−1,23; −0,30] |
| **Utrzymanie intensywności** | SMD = **−0,55** [−0,79; −0,31] |
| **Utrzymanie częstotliwości** | SMD = **−0,53** [−0,83; −0,25] |

Konwergencja obu meta-analiz na tej samej recepcie (2 tygodnie, −41–60% objętości,
intensywność i częstotliwość bez zmian) czyni to **jednym z najlepiej ustalonych
faktów w tym dokumencie**.

Ograniczenia podane przez autorów: mało RCT, dominacja kolarstwa i biegania,
przewaga mężczyzn, brak analizy według poziomu zawodnika.

### 5.2 Amatorzy: dłuższy i zdyscyplinowany taper wygrywa

> Smyth B, Lawlor A. *Longer disciplined tapers improve marathon performance for
> recreational runners.* Front Sports Act Living. 2021;3:735220.
> doi:10.3389/fspor.2021.735220 — **poziom C** (obserwacyjne, ale N ogromne)

**158 117 amatorów** (125 954 M, 32 163 K) ze Stravy, 2014–2017, ~23 tygodnie danych
treningowych na osobę. Tapery 1–4 tygodnie, klasyfikowane jako **„strict"**
(monotoniczny spadek objętości tydzień po tygodniu) vs **„relaxed"**
(spadki niekonsekwentne, z tygodniami wysokiej objętości w środku).

- **Strict 3-tygodniowy taper: mediana oszczędności 5 min 32,4 s (2,6%)**
  względem minimalnego taperu.
- Kobiety miały większą korzyść procentową niż mężczyźni w większości typów taperu.
- **64% amatorów stosuje tapery niezdyscyplinowane.**
- Autorzy: przejście z relaxed na strict przy tej samej długości poprawia wynik
  „considerably".

Ograniczenia: dane obserwacyjne bez kontroli na poziomie osoby, brak danych
o urazach/pogodzie/motywacji, selekcja (najszybszy maraton w roku), brak wnioskowania
przyczynowego.

**Uwaga:** to sugeruje **3 tygodnie dla maratonu u amatora**, dłużej niż optimum
8–14 dni z meta-analiz (5.1). Rozbieżność jest wyjaśnialna: meta-analizy pochodzą
głównie z krótszych dystansów i wyższych poziomów; maraton u amatora generuje
więcej uszkodzeń względem zdolności regeneracyjnej.

### 5.3 Praktyka planów i elity

- Plany sub-elity (Knopp 2024, 1.6): szczyt objętości **~4 tygodnie przed startem**,
  potem **22–31% spadku tygodniowo**, ostatni tydzień **~50% spadku** względem
  poprzedniego.
- Elita (Haugen 2022, 1.2): **7–10 dni**, przyjazd na miejsce 7–10 dni wcześniej.

### 5.4 Parametry według dystansu — rekomendacja silnika

Synteza (redukcja liczona od objętości szczytowej):

| Dystans | Długość taperu | Redukcja objętości | Intensywność | Częstotliwość | Podstawa |
|---------|----------------|--------------------|--------------|---------------|----------|
| 5–10 km | 7–10 dni | −40–50% | bez zmian | bez zmian | Wang 2023, Bosquet 2007 |
| Półmaraton | 10–14 dni | −45–55% | bez zmian | bez zmian | Wang 2023 |
| Maraton | **14–21 dni**, monotonicznie | −50–60%, ostatni tydzień ok. −50% wzgl. poprzedniego | bez zmian | bez zmian | Smyth 2021, Knopp 2024, Wang 2023 |
| Ultra (>50 km) | ekstrapolacja: ≥21 dni | ≥60% | bez zmian | bez zmian | **brak danych** — patrz sekcja 11 |

**Reguła nienaruszalna:** monotoniczny spadek objętości (każdy tydzień ≤ poprzedni)
+ **zachowanie intensywności i liczby sesji**. Oba te elementy mają niezależne
potwierdzenie meta-analityczne (SMD −0,55 i −0,53) i to one, nie sama redukcja
objętości, są najczęściej łamane przez amatorów.

Start „B" / start w treningu: brak danych o taperze dla startów pośrednich.
Rozsądna ekstrapolacja (poziom D): mini-taper 3–5 dni, redukcja 20–30%,
bez modyfikacji struktury makrocyklu.

---

## 6. Predykcja wyniku

### 6.1 Riegel

> Riegel PS. *Athletic Records and Human Endurance.* American Scientist.
> 1981;69(3):285–290. — **poziom D** (dopasowanie do rekordów świata)

```
T₂ = T₁ × (D₂ / D₁)^1,06
```

Zakres stosowalności podany przez autora: wysiłki **3,5–230 min**.
Wykładnik 1,06 wyprowadzono z rekordów świata w bieganiu, pływaniu, kolarstwie
i łyżwiarstwie szybkim.

⚠️ Cytowanie potwierdzone, ale **pełnego tekstu z 1981 r. nie otwarto**;
opis metody z rekordów bibliograficznych.

### 6.2 Riegel i VDOT zawodzą dla amatorów na maratonie — i to w przewidywalnym kierunku

> Vickers AJ, Vertosick EA. *An empirical study of race times in recreational
> endurance runners.* BMC Sports Sci Med Rehabil. 2016;8(1):26.
> doi:10.1186/s13102-016-0052-y — **poziom C** (ankieta internetowa, N=2303;
> 1443 trening / 721 walidacja)

Kluczowe ustalenie, cytowane wprost: wzór Riegla był
*„well-calibrated for races up to a half-marathon, but **dramatically underestimated
marathon time, giving times at least 10 min too fast for half of runners**"*.

Porównanie MSE na zbiorze walidacyjnym (N=156):

| Model | MSE | MSE z karą za przeszacowanie (×2) |
|-------|-----|-----------------------------------|
| Model 1 (jeden poprzedni start) | 227,6 | 646,1 |
| Model 2 (dwa poprzednie starty) | **208,3** | — |
| **Riegel** | **380,7** | **1429,8** |

Zmienne treningowe istotnie związane z prędkością (wszystkie p < 0,0005):
tempo/tempo runs (silniejszy związek na krótszych dystansach: ~6% na 5 km vs ~3,5%
na maratonie), interwały (~2–4%, stabilnie na wszystkich dystansach),
tygodniowy kilometraż (podobnie na wszystkich dystansach).

⚠️ Uwaga: krążąca w internecie wersja „Vickers i Vertosick przeanalizowali
2 mln wyników i ustalili wykładnik 1,07–1,09" jest **nieprawdziwa** — to była
ankieta na N=2303, a autorzy nie proponowali skorygowanego wykładnika, lecz
model regresyjny z kilometrażem. Podobnie tabele „wykładnik według kilometrażu:
1,04 / 1,06 / 1,09 / 1,12" pochodzą z blogów SEO, **nie z literatury** (sekcja 11).

> Oficial-Casado F, Priego-Quesada JI, Pérez-Soriano P. *Performance prediction
> equation for the Valencia Marathon […].* Front Physiol. 2025;16:1718298.
> doi:10.3389/fphys.2025.1718298 — **poziom C** (N = 7663 amatorów)

Model 1 (czas półmaratonu + płeć): R² = 0,85, MAE 5,67%.
Czas HM wyjaśnia 80% wariancji, płeć 5%. Mnożnik czasu HM ≈ 2,28,
przewaga mężczyzn ≈ 329 s.

**Porównanie z VDOT Danielsa według poziomu — najważniejsza tabela tej sekcji:**

| Kategoria | MAE Model 1 | MAE VDOT | Lepszy |
|-----------|-------------|----------|--------|
| sub-2:30 | 4,06% | **1,11%** | VDOT |
| sub-4:00 | **4,10%** | 5,96% | Model 1 |
| sub-5:00 | **5,56%** | **10,43%** | Model 1 |

**VDOT jest bardzo dokładny dla szybkich i coraz gorszy w miarę spadku poziomu** —
MAE 10,43% dla sub-5:00 to przy czasie 4:45:00 błąd blisko **30 minut**.
Dodanie zmiennych o rozkładzie tempa nie poprawiło modelu (R² pozostało 0,85):
*„half marathon performance already captures much of the influence of effort
distribution on outcome"*.

Ograniczenia podane przez autorów: równanie jest specyficzne dla maratonu w Walencji
(płaska trasa, 69–76 m przewyższenia), brak danych o objętości treningowej i historii
treningu.

### 6.3 Critical speed jako predyktor

> Lipková i in. 2025 (patrz 2.3) — CS z testów terenowych daje wiarygodne predykcje
> na **1600–5000 m**; błąd rośnie na 800 m. Model oparty na surowych danych
> treningowych (Smyth & Muniz-Pumares 2023) osiągnął **~7,67% błędu predykcji
> maratonu** — czyli gorzej niż równanie z Walencji (5,67%) i gorzej niż VDOT
> dla szybkich biegaczy.

### 6.4 Durability — dlaczego predykcja na ultra zawodzi systematycznie

> Hunter B, Maunder E, Jones AM, Gallo G, Muniz-Pumares D. *Durability as an index of
> endurance exercise performance: Methodological considerations.* Exp Physiol.
> 2025;110:1612–1624. doi:10.1113/EP092120 — **poziom B** (przegląd metodologiczny)

Definicja: *„the resilience to the deterioration of physiological variables and
performance during or following prolonged exercise"*.

Zmierzone skale degradacji:

| Zmienna | Spadek | Zakres indywidualny |
|---------|--------|---------------------|
| Critical power | **~10%** | ~1–31% |
| 20-min TT | ~2,9% | −8,5% do +1,1% |
| 6-min TT | ~10% | −31% do +1% |
| VO₂max | spada | — |
| Ekonomia biegu / sprawność | pogarsza się | — |

Metodologia: **potrzeba co najmniej ~120 min wysiłku poprzedzającego**, by durability
się ujawniła — *„40 and 80 min of cycling in the heavy domain had no effect on CP,
but after 120 min of cycling the CP decreased by ~10% on average"*.

> Koncepcja wprowadzona w: Maunder E, Seiler S, Mildenhall MJ i in. *The Importance
> of 'Durability' in the Physiological Profiling of Endurance Athletes.* Sports Med.
> 2021;51. doi:10.1007/s40279-021-01459-0 — **poziom D**
> ⚠️ Pełnego tekstu nie otwarto (paywall Springera); definicja i kontekst pochodzą
> z pracy Hunter i in. 2025, która ją cytuje. **Pełna lista autorów, tom/strony
> — do weryfikacji** (sekcja 11).

**Implikacja dla silnika — to jest mechanistyczne wyjaśnienie, dlaczego Riegel łamie
się na maratonie i ultra:** wzór Riegla zakłada stały wykładnik degradacji, ale
CP/CS **sama spada o ~10% po 2 h**, a rozrzut indywidualny to 1–31%.
Nie da się tego naprawić jednym wykładnikiem — to zmienna osobnicza,
którą trzeba **kalibrować z historii startów użytkownika**, nie zgadywać.

### 6.5 Rekomendacja: predykcja w `trainctl`

Hierarchia predyktorów (od najlepszego):

1. **Ostatni start na tym samym dystansie** ± korekta na trend formy.
2. **Dla maratonu: czas półmaratonu** (R² = 0,85, MAE 5,67%) — najlepszy pojedynczy
   predyktor u amatorów.
3. **VDOT** — tylko dla dystansów ≤HM i dla użytkowników szybszych niż ~4:00 maraton.
   **Powyżej 4:00 jawnie ostrzegać o zawyżaniu** (MAE do 10,43%).
4. **Riegel** — tylko do HM; **nigdy nie stosować bez ostrzeżenia dla maratonu**
   (za szybko o ≥10 min u połowy amatorów).
5. **Critical speed** — dla 1500–5000 m.

**Ultra:** nie podawać punktowej predykcji z żadnego z tych wzorów. Zamiast tego:
przedział + jawna informacja, że durability (spadek CS o 1–31% po 2 h) nie jest
znana bez historii startów użytkownika. Kalibracja `durability_factor` z korpusu
własnych startów ultra (Rzeźnik, 100 km, Łemkowyna) jest lepszą drogą niż
jakikolwiek wzór z literatury.

**Zawsze podawać przedział, nigdy pojedynczą liczbę.** MAE 5,67% na 3:30 to ±12 min.

---

## 7. Trening siłowy dla biegaczy

### 7.1 Ekonomia biegu — meta-analizy

> Balsalobre-Fernández C, Santos-Concejero J, Grivas GV. *Effects of Strength Training
> on Running Economy in Highly Trained Runners: A Systematic Review With Meta-Analysis
> of Controlled Trials.* J Strength Cond Res. 2016;30(8):2361–2368.
> doi:10.1519/JSC.0000000000001316 — **poziom A**

k=5, n=93. **SMD = −1,43 [−2,23; −0,64]**, p<0,001 (duży efekt), I²=61%.
Po usunięciu obserwacji odstającej (Paavolainen 1999, SMD −3,78):
**SMD = −1,06 [−1,56; −0,56]**, p<0,001, **I²=0%**.

Protokół w 4 z 5 badań: **40–70% 1RM (nie do upadku) + plyometria**, 2–3×/tyg.,
8–12 tygodni. Rekomendowany stosunek wytrzymałość:siła ≈ **3:1**.
⚠️ Sam abstrakt podaje SMD −1,42 [−2,23; −0,60] — drobna niespójność wewnętrzna
w publikacji.

> Denadai BS, de Aguiar RA, de Lima LCR, Greco CC, Caputo F. *Explosive Training and
> Heavy Weight Training are Effective for Improving Running Economy in Endurance
> Athletes: A Systematic Review and Meta-Analysis.* Sports Med. 2017;47(3):545–554.
> doi:10.1007/s40279-016-0604-z — **poziom A**

k=16, 20 efektów. Zmiana ekonomii biegu (% ± SD):

| Rodzaj | Δ RE | p |
|--------|------|---|
| Trening współbieżny ogółem | **−3,93 ± 1,19%** | <0,001 |
| Eksplozywny | **−4,83 ± 1,53%** | <0,001 |
| Ciężki | −3,65 ± 2,74% | 0,009 |
| Izometryczny | −2,20 ± 4,37% | 0,324 (n.i.) |

**Moderator czasu trwania: β = −0,83 ± 0,72, p = 0,02** — dłuższy program = większa
poprawa. To jeden z dwóch czystych sygnałów dose-response w całej tej literaturze.

> Blagrove RC, Howatson G, Hayes PR. *Effects of Strength Training on the Physiological
> Determinants of Middle- and Long-Distance Running Performance: A Systematic Review.*
> Sports Med. 2018;48(5):1117–1149. doi:10.1007/s40279-017-0835-7 — **poziom B**
> (przegląd narracyjny, 24 badania, PEDro 4–6)

- Ekonomia biegu: poprawa **2–8%** w 14/20 badań; większa przy szybszych prędkościach
- VO₂max: **bez zmian w 13/17 badań**
- vVO₂max: istotna poprawa tylko w 2/9 badań (3–4%, ES 0,42–0,49)
- Time trial: istotna w 8/12 badań; 1500–3000 m: 3–5% (ES 0,4–1,0);
  5–10 km: **2–4% (ES 1,06–1,5)**
- Masa ciała: bez zmian w 18/22 badań
- Dawka: 2–3×/tyg., minimum 4 tygodnie, najwięcej korzyści przy 6–14 tygodniach

> Llanos-Lagos C, Ramirez-Campillo R, Moran J, Sáez de Villarreal E. *Effect of
> Strength Training Programs in Middle- and Long-Distance Runners' Economy at Different
> Running Speeds: A Systematic Review with Meta-analysis.* Sports Med.
> 2024;54(4):895–932. doi:10.1007/s40279-023-01978-y — **poziom A**

| Metoda | ES [95% CI] | p | k |
|--------|-------------|---|---|
| Duże obciążenia (≥80% 1RM) | −0,266 [−0,516; −0,015] | 0,039 | 11 |
| **Kombinowana** | **−0,426 [−0,768; −0,083]** | **0,018** | 9 |
| Plyometria | −0,122 [−0,299; 0,054] | 0,167 (n.i.) | 11 |
| Submaksymalna (40–79% 1RM) | −0,365 [−0,875; 0,146] | 0,131 (n.i.) | 3 |
| Izometryczna | −0,269 [−0,790; 0,252] | 0,253 (n.i.) | 3 |

**Efekt zależny od prędkości — bardzo ważne dla preskrypcji:**
duże obciążenia lepsze przy prędkościach **>12 km/h** (β = −0,653, p = 0,021);
**plyometria działa TYLKO przy prędkościach ≤12 km/h** (ES = −0,307, p = 0,028;
brak efektu powyżej). Efekt dużych obciążeń rośnie z VO₂max (β = −0,040, p = 0,020).

**Moderator czasu trwania i częstotliwości: nieistotny dla żadnej metody (p > 0,111).**

> Llanos-Lagos C, i in. *The Effect of Strength Training Methods on Middle-Distance and
> Long-Distance Runners' Athletic Performance: A Systematic Review with Meta-analysis.*
> Sports Med. 2024;54(7):1801–1833. doi:10.1007/s40279-024-02018-z — **poziom A**

k=38, n=894. Wynik biegowy: duże obciążenia ES = −0,469 [−0,872; −0,066], p=0,029;
kombinowana ES = −1,035 [−1,967; −0,103], p=0,036 (ale I²=67,5%, certainty „very low");
plyometria n.i. (p=0,064).
**VO₂max, vVO₂max, MMSS, sprint: trywialne/nieistotne dla każdej metody (p>0,072).**
**Analiza moderatorów nie wykryła ŻADNEGO istotnego efektu** (p>0,166) —
ani płci, wieku, masy, poziomu, doświadczenia siłowego, czasu trwania,
częstotliwości, ani łącznej liczby sesji.

> Eihara Y, Takao K, Sugiyama T, Maeo S, Terada M, Kanehisa H, Isaka T. *Heavy
> Resistance Training Versus Plyometric Training for Improving Running Economy and
> Running Time Trial Performance: A Systematic Review and Meta-analysis.*
> Sports Med Open. 2022;8:138. doi:10.1186/s40798-022-00511-1 — **poziom A**

Ekonomia biegu: **HRT g = −0,32 [−0,55; −0,10]** (k=14, n=216);
**plyometria g = −0,13 [−0,47; 0,21]** (n.i., k=8, n=263).

Podgrupy HRT: **10–14 tyg. g = −0,45 [−0,83; −0,08]** vs 6–8 tyg. g = −0,21 (n.i.);
**≥90% 1RM lub ≤4RM: g = −0,31 [−0,61; −0,02]** vs <90% 1RM: g = −0,17 (n.i.).

> Berryman N, Mujika I, Arvisais D, Roubeix M, Binet C, Bosquet L. *Strength Training
> for Middle- and Long-Distance Performance: A Meta-Analysis.* Int J Sports Physiol
> Perform. 2018;13(1):57–63. doi:10.1123/ijspp.2017-0032 — **poziom A**
> (⚠️ istnieje erratum PMID 29517405, niezweryfikowane — sekcja 11)

Wynik ogółem: SMD = 0,52 [0,33; 0,70]. Koszt energetyczny lokomocji:
SMD = 0,65 [0,32; 0,98]. VO₂max: 0,03 [−0,16; 0,23], p=0,75 (**zero**).

**Najczystszy próg dawki w całej literaturze:**
**<24 sesji łącznie: SMD = 0,10 [−0,27; 0,47] (n.i.)** vs
**≥24 sesji: SMD = 0,63 [0,29; 0,97]** — różnica istotna (p<0,05).
Bieganie miało największy efekt z 4 sportów: SMD = 0,83 [0,31; 1,34].
Brak istotnej różnicy między poziomami zawodników.

> Zecchin A, de Lima LRC, Puggina EF, Tasinafo-Júnior MF. *Effects of resistance
> training on running economy: a systematic review and meta-analysis.* Retos.
> 2025;71:275–287. doi:10.47197/retos.v71.113574 — **poziom B**

k=8, n=80, **VO₂max 49,2 ± 4,7** (czyli amatorzy — nasza grupa!). 83 ± 7,5% 1RM,
2,3 ± 0,9 sesji/tyg., średnio 9 tyg. (6–14), średnio 21 sesji.
**d = −0,47, p = 0,003, I² = 0%.**
⚠️ **Każde pojedyncze badanie miało CI przechodzące przez zero** — istotność
osiągnął tylko wynik zbiorczy. Autorzy: *„The results presented here have limited
applicability to high performance runners"*.

### 7.2 Minimalna skuteczna dawka — synteza

| Parametr | Wartość | Źródło | Siła |
|----------|---------|--------|------|
| Częstotliwość | **2–3×/tyg.** | Balsalobre-Fernández 2016, Blagrove 2018 | D (opis praktyki badań, nie dose-response) |
| Minimum czasu | 4 tyg. (podłoga), **10–14 tyg. dla pełnego efektu** | Blagrove 2018; Eihara 2022 (g −0,45 vs −0,21) | B |
| **Próg łącznej liczby sesji** | **≥24 sesje** | Berryman 2018 (statystycznie testowany) | **A** |
| Intensywność (ciężkie) | **≥80% 1RM**, najlepiej ≥90% 1RM / ≤4RM | Llanos-Lagos 2024a; Eihara 2022 | B |
| Wariant „klasyczny" | 40–70% 1RM + plyometria, nie do upadku | Balsalobre-Fernández 2016 | A |
| Plyometria — kiedy | **tylko jeśli tempo docelowe ≤12 km/h** | Llanos-Lagos 2024a | B |
| Duże obciążenia — kiedy | **preferencyjnie jeśli tempo >12 km/h** | Llanos-Lagos 2024a | B |
| Stosunek do biegania | ~3:1 (siła ≈30% sesji) | Balsalobre-Fernández 2016 | D |
| Oczekiwana korzyść | RE −2 do −8%; TT 5–10 km: 2–4% | Blagrove 2018, Denadai 2017 | A |
| Czego NIE oczekiwać | wzrostu VO₂max (SMD 0,03), wzrostu masy | Berryman 2018, Blagrove 2018 | A |

⚠️ **Uczciwie o dose-response:** dwa z najnowszych i największych opracowań
(Llanos-Lagos 2024a i 2024b) **formalnie testowały** moderatory czasu trwania
i częstotliwości i **nie znalazły istotnego efektu**. „2–3×/tyg. przez 8–12 tygodni"
to **opis tego, co robiły udane badania**, nie zwalidowana relacja dawka–odpowiedź.
Jedyne dwa statystycznie potwierdzone progi dawki: regresja Denadai (dłużej = lepiej,
p=0,02) i próg ≥24 sesji Berrymana.

### 7.3 Urazy — najważniejsza korekta w tym dokumencie

> Lauersen JB, Bertelsen DM, Andersen LB. *The effectiveness of exercise interventions
> to prevent sports injuries: a systematic review and meta-analysis of randomised
> controlled trials.* Br J Sports Med. 2014;48(11):871–877.
> doi:10.1136/bjsports-2013-092538 — **poziom A** (ale patrz zastrzeżenie)

k=25 RCT, n=26 610, 3464 urazy.
**Trening siłowy: RR = 0,315 [0,207; 0,480], I²=0%** (k=**tylko 4 badania**).
Rozciąganie: RR = 0,963 [0,846; 1,095] — **zero efektu**.
Propriocepcja: RR = 0,550. Programy wieloskładnikowe: RR = 0,655.

⚠️ **KRYTYCZNE ZASTRZEŻENIE:** cztery badania dające RR = 0,315 to
Askling (elitarna piłka nożna, mm. dwugłowe), Coppack (rekruci wojskowi, ból
przedniej części kolana), Petersen (elitarna piłka nożna, mm. dwugłowe),
Waldén (piłka nożna dziewcząt, ACL). **Żadne nie dotyczyło biegaczy
długodystansowych i żadnego urazu biegowego.** Statystyka „−53% urazów przeciążeniowych"
(RR 0,527) to **wynik zbiorczy dla mieszanych interwencji**, nie dla samego treningu
siłowego (5 z 6 badań to programy wieloskładnikowe).

> Wu H, Brooke-Wavell K, Fong DTP, Paquette MR, Blagrove RC. *Do Exercise-Based
> Prevention Programs Reduce Injury in Endurance Runners? A Systematic Review and
> Meta-Analysis.* Sports Med. 2024;54(5):1249–1267. doi:10.1007/s40279-024-01993-7
> — **poziom A** (jedyna meta-analiza SPECYFICZNIE dla biegaczy)

k=9, n=1904 biegaczy. Tylko 4/9 badań stosowało ćwiczenia siłowe,
i to „relatively low volume and intensity".

- **Ryzyko urazu ogółem: log RR = −0,21 [−0,46; 0,047], p = 0,110 — NIEISTOTNE**
- Częstość urazów: log IRR = −0,15 [−0,45; 0,15], p = 0,329 — nieistotne
- **Podgrupa post-hoc, interwencje nadzorowane (k=3): log RR = −0,77 [−1,18; −0,37],
  p < 0,001 — istotne.** Compliance: nadzorowane ≥88%, nienadzorowane 47–72%.
- 7/9 badań: wysokie ryzyko błędu systematycznego.

**Werdykt:** twierdzenie „trening siłowy redukuje urazy biegowe o 2/3" jest
**nieuprawnione** — cytuje dane z piłki nożnej i wojska. Jedyna meta-analiza
na biegaczach **nie znalazła istotnego efektu**. To, co ma sygnał, to
**nadzór/compliance**, nie treść ćwiczeń.

**Implementacja:** silnik **nie może** obiecywać redukcji urazów.
Może uzasadniać siłownię ekonomią biegu i wynikiem (7.1) — tam dowody są mocne.

### 7.4 Interferencja i planowanie sesji

> Eddens L, van Someren K, Howatson G. *The Role of Intra-Session Exercise Sequence in
> the Interference Effect: A Systematic Review with Meta-Analysis.* Sports Med.
> 2018;48(1):177–188. doi:10.1007/s40279-017-0784-1 — **poziom A**

- Siła dynamiczna dolnych kończyn: siła-przed-wytrzymałością lepsza,
  **WMD = 6,91% [1,96; 11,87], p = 0,006**
- Siła izometryczna: bez różnicy (WMD −0,04%, p = 0,98)
- Hipertrofia: bez różnicy (WMD 1,15%, p = 0,40)
- **VO₂max i % tłuszczu: brak efektu kolejności (p > 0,05)**

> Vikestad V, Dalen T. *Effect of Strength and Endurance Training Sequence on Endurance
> Performance.* Sports (Basel). 2024;12(8):226. doi:10.3390/sports12080226 — **poziom B**

11/15 badań: brak istotnego efektu kolejności na wyniki wytrzymałościowe.
Rekomendacja: **≥6 h przerwy między sesjami**; uszkodzenia mięśni po sesji siłowej
mogą upośledzać wydolność do 48 h.
⚠️ Autorzy wprost: *„no studies on elite athletes"*.

> Silva GIC, i in. *Acute neuromuscular, physiological and performance responses after
> strength training in runners: A systematic review and meta-analysis.*
> Sports Med Open. 2022;8:105. doi:10.1186/s40798-022-00497-w — **poziom A**
> ⚠️ Pełnej listy autorów nie uzyskano (sekcja 11)

Po sesji siłowej: peak torque ↓ (p=0,003), CMJ b.z. (p=0,64), DOMS ↑ i CK ↑
(p<0,0001), RPE ↑ (p<0,0001); laktat/HR/VO₂/wentylacja b.z.
Negatywny wpływ na bieganie skupiony **w oknie <24 h**, szczególnie przy
≥80% 1RM / ≤6RM. Spadek wydolności *„relevant immediately after the session,
but irrelevant after 48h"*. Rekomendacja autorów: **sesje siłowe w dni naprzemienne**.

**Reguły dla solvera:**
- ≥6 h między sesją siłową i biegową tego samego dnia (Vikestad 2024)
- Sesja siłowa ciężka (≥80% 1RM) **nie w ciągu 24 h przed sesją jakościową**
  (Silva 2022)
- Kolejność w obrębie sesji **nie wpływa** na adaptację wytrzymałościową —
  wolno umieścić siłę po bieganiu, jeśli tak wygodniej (Eddens 2018)
- Preferowany wzorzec: siłownia w dniu łatwym lub po sesji jakościowej,
  nie przed nią

---

## 8. HRV-guided training (faza późniejsza)

### 8.1 RCT: sygnał jest, ale w procesie, nie w wyniku

> Kiviniemi AM, Hautala AJ, Kinnunen H, Tulppo MP. *Endurance training guided
> individually by daily heart rate variability measurements.* Eur J Appl Physiol.
> 2007;101(6):743–751. doi:10.1007/s00421-007-0552-2 — **poziom B**

n=26 zdrowych **mężczyzn** (8/9/9), 4 tygodnie. Reguła: HF-power HRV rano,
referencja = średnia 10-dniowa − SD. HRV ↑/bez zmian → sesja o wysokiej intensywności;
HRV istotnie poniżej referencji lub trend spadkowy ≥2 dni → niska intensywność/odpoczynek.
Vmax: HRV 15,5→16,4 km/h (p<0,001) vs predefined 15,1→15,7 (p=0,004);
różnica międzygrupowa p=0,048. VO₂peak: HRV 56→60 (p=0,002) vs predefined 54→55 (n.i.).

> Vesterinen V, Nummela A, Heikura I, Laine T, Hynynen E, Botella J, Häkkinen K.
> *Individual Endurance Training Prescription with Heart Rate Variability.*
> Med Sci Sports Exerc. 2016;48(7):1347–1354. doi:10.1249/MSS.0000000000000910
> — **poziom B**
> ⚠️ Uwaga: to **MSSE, nie Scand J Med Sci Sports** — częsty błąd w cytowaniach.

n=40 amatorów. Sesja MOD/HIT tylko jeśli HRV w granicach indywidualnego SWC.
**Grupa HRV wykonała mniej sesji jakościowych: 13,2 ± 6,0 vs 17,7 ± 2,5
(p=0,021, ES=0,98)**, a mimo tego: 3000 m +2,1 ± 2,0% (p=0,004) vs
+1,1 ± 2,7% (p=0,118, n.i.). Międzygrupowo ES=0,42 (mały).

> Javaloyes A, Sarabia JM, Lamberts RP, Moya-Ramon M. *Training Prescription Guided by
> Heart-Rate Variability in Cycling.* Int J Sports Physiol Perform. 2019;14(1):23–32.
> doi:10.1123/ijspp.2018-0122 — **poziom B**

n=17 kolarzy, 4 tyg. baseline + 8 tyg. HRV: peak power +5,1% (p=0,024),
moc @VT2 +13,9% (p=0,004), 40-min TT +7,3% (p=0,005). Grupa tradycyjna:
**brak istotnych poprawek w czymkolwiek**.

> Javaloyes A, Sarabia JM, Lamberts RP, Plews D, Moya-Ramon M. *Training prescription
> guided by heart rate variability vs. block periodization in well-trained cyclists.*
> J Strength Cond Res. 2020;34(6):1511–1518. doi:10.1519/JSC.0000000000003337
> — **poziom B**

n=20. HRV poprawiła VO₂max, peak power, moc@VT2, moc@VT1, 40-min TT.
Block periodization: tylko moc@VT2. Ale **końcowy poziom formy był podobny** —
autorzy mówią o „lepszym timingu bodźca", nie o większej adaptacji.

### 8.2 Meta-analizy: trzy z czterech mówią „nie lepiej"

> Manresa-Rocamora A, Sarabia JM, Javaloyes A, Flatt AA, Moya-Ramón M. *Heart Rate
> Variability-Guided Training for Enhancing Cardiac-Vagal Modulation, Aerobic Fitness,
> and Endurance Performance: A Methodological Systematic Review with Meta-Analysis.*
> Int J Environ Res Public Health. 2021;18(19):10299. doi:10.3390/ijerph181910299
> — **poziom A**

8 badań / 10 jednostek analizy, n=199 (106 HRV / 93 predefined):

| Wynik | SMD+ [95% CI] |
|-------|---------------|
| **HRV wagalna (RMSSD/SD1), stojąc** | **0,50 [0,09; 0,91]** — istotne, na korzyść HRV |
| HF power, stojąc | −0,60 [−1,15; −0,05] — na korzyść predefined |
| VO₂max | 0,13 [−0,12; 0,39] — n.i. |
| Wydolność @VT2 | 0,26 [−0,05; 0,57] — n.i. |
| **Wynik wytrzymałościowy** | **0,20 [−0,09; 0,48] — n.i.** |

> Düking P, Zinner C, Trabelsi K, Reed JL, Holmberg HC, Kunz P, Sperlich B.
> *Monitoring and adapting endurance training on the basis of heart rate variability
> monitored by wearable technologies: A systematic review with meta-analysis.*
> J Sci Med Sport. 2021;24(11):1180–1192. doi:10.1016/j.jsams.2021.04.012 — **poziom A**

8 badań / 9 interwencji, n=198. Parametry submaksymalne **g = 0,296 [0,031; 0,562],
p = 0,028** (istotne); wynik g = 0,079 (n.i., p = 0,597);
VO₂peak g = 0,171 (n.i., p = 0,130). Grupy HRV konsekwentnie wykonywały **mniej**
sesji o średniej/wysokiej intensywności i miały **mniej „negative responders"**.

> Granero-Gallegos A, González-Quílez A, Plews D, Carrasco-Poyatos M. *HRV-Based
> Training for Improving VO2max in Endurance Athletes. A Systematic Review with
> Meta-Analysis.* Int J Environ Res Public Health. 2020;17(21):7999.
> doi:10.3390/ijerph17217999 — **poziom B**

6 RCT, n=195. HRV ES = 0,402 [0,273; 0,531] vs kontrola ES = 0,215 [0,101; 0,329],
różnica p<0,0001. Amatorzy (ES 0,36) > elita (ES 0,17); kobiety (0,40) > mężczyźni (0,33).
⚠️ **I² = 94,24%**, jakość dowodów oceniona jako „unclear", brak ITT w kilku badaniach.
To jedyny outlier wśród czterech meta-analiz.

> Medellín-Ruiz JP, Rubio-Arias JÁ, Clemente-Suárez VJ, Ramos-Campo DJ.
> *Effectiveness of Training Prescription Guided by Heart Rate Variability Versus
> Predefined Training […].* Appl Sci. 2020;10(23):8532. doi:10.3390/app10238532
> — **poziom B**. Konkluzja autorów: HRV-guided **nie dało istotnej korzyści**
> ponad trening predefiniowany.

**Uczciwa synteza:** przewaga HRV-guided dotyczy **procesu**: mniej sesji
jakościowych przy tym samym lub lepszym wyniku, lepiej zachowana HRV wagalna
(SMD 0,50), mniej „non-responderów". **Nie ma potwierdzonej przewagi w wyniku
sportowym** (SMD 0,20, CI przechodzi zero). To argument za HRV jako
**narzędziem zarządzania ryzykiem przetrenowania**, nie za większymi przyrostami formy.

### 8.3 Co potrzebne do implementacji

**Wskaźnik:** RMSSD lub ln-RMSSD (lepsza rzetelność krótkoterminowa niż surowy RMSSD).
W przeglądzie Manresa-Rocamora: RMSSD w 62,5% badań, SD1 12,5%, HF 25%.

> Damoun N, Amekran Y, Taiek N, El Hangouche AJ. *Heart rate variability measurement
> and influencing factors: Towards the standardization of methodology.*
> Glob Cardiol Sci Pract. 2024;2024(4):e202435. doi:10.21542/gcsp.2024.35 — **poziom D**

**Protokół:** pomiar rano po przebudzeniu (87,5% badań); pozycja — supine 50%,
standing 37,5% w badaniach; **spójność pozycji u danej osoby ważniejsza niż wybór
pozycji**; okno 5 min (standard Task Force 1996), <60 s dopuszczalne dla RMSSD;
oddech w zakresie 9–24/min (poza tym wskaźniki częstotliwościowe się zniekształcają).

**Test ortostatyczny** — zalecany u dobrze trenowanych, bo pomiar supine podlega
*„parasympathetic saturation"* (efekt sufitu maskujący dalsze zmiany).
Krytyczne okno: **pierwsze 25–30 uderzeń po wstaniu**.

> Gronwald T, Schaffarczyk M, Hoos O. *Orthostatic testing for heart rate and heart
> rate variability monitoring in exercise science and practice.* Eur J Appl Physiol.
> 2024;124(12):3495–3510. doi:10.1007/s00421-024-05601-4 — **poziom D**

**Reguła decyzyjna** (spójna w badaniach, które udało się otworzyć):
HRV w granicach pasma → sesja jakościowa dozwolona; HRV poniżej pasma
(lub trend spadkowy ≥2 dni) → niska intensywność/odpoczynek.
⚠️ **Popularna operacjonalizacja „7-dniowa średnia krocząca ± 0,5 SD" NIE została
potwierdzona w źródle pierwotnym** — patrz sekcja 11. Kiviniemi używał
„średnia 10-dniowa − SD", Vesterinen „indywidualnie wyznaczony SWC" bez podanej stałej.

**Baseline:** Kiviniemi 10 dni; badania używały albo pojedynczej wartości dziennej
z ruchomą referencją (50%), albo średniej kroczącej 3–7 dni ze stałą referencją (50%).

### 8.4 Urządzenia

> Johansson H, Adderley E, Clarke S, McIntyre P, Reilly G, Caulfield B, Holden S.
> *An observational study of the reliability and concurrent validity of heart rate
> variability devices in athletes.* Front Physiol. 2026;16:1707318.
> doi:10.3389/fphys.2025.1707318 — **poziom B**

n=37 trenowanych (17 K, 20 M), RMSSD:

| Urządzenie | ICC [95% CI] | CV% | MAPE vs EKG |
|------------|--------------|-----|-------------|
| EKG 3-odprowadzeniowe (referencja) | 0,88 [0,77–0,93] | 14,22% | — |
| **Polar H10 (pas piersiowy)** | 0,90 [0,82–0,95] | 13,47% | **2,16%** |
| Aplikacja kamera smartfona (PPG) | 0,83 [0,69–0,91] | 14,6% | **17,49%** |

**MAPE 17,49% dla PPG z kamery jest zbyt duże** dla decyzji opartych na frakcjach SD
wewnątrzosobniczego. **Reguła: HRV-guided tylko z pasa piersiowego.**

### 8.5 Czynniki zakłócające (Damoun 2024, o ile nie podano inaczej)

| Czynnik | Efekt / zalecenie |
|---------|-------------------|
| Alkohol | abstynencja 24 h; ostra dawka ↓HRV (↑LF-norm, ↑LF/HF, ↓HF) |
| Sen | 7–9 h; deprywacja ↑aktywność sympatyczną; praca nocna ↑LF, ↑LF/HF |
| Kofeina | abstynencja 2 h; ⚠️ **efekt na RMSSD jest sporny** (część badań: brak zmian przy 3–6 mg/kg) |
| Temperatura | optimum 20–25°C; upał ↓HF, ↑LF/HF |
| Tempo oddechu | wskaźniki częstotliwościowe bardzo czułe; RMSSD/SDNN mniej; zakres 9–24/min |
| Choroba | ⚠️ **case report n=1**: standing RMSSD 20,8→4,2 ms (−80%), HR stojąc +22 bpm (Hottenrott 2021) |
| Cykl menstruacyjny | ⚠️ **case report n=2**: RMSSD niższy w późnej fazie lutealnej (p=0,005–0,045) (Dupuit 2025); inne badania nie potwierdzają — **kwestia nierozstrzygnięta** |
| Wysokość | baseline przesuwa się; spadek przez ~72 h, powrót ~9. dnia — wymaga re-baseline'u (Bahenský & Grosicki 2021) |

### 8.6 Wniosek dla `trainctl`

HRV-guided należy do fazy 5+ (wymaga danych wellness z intervals.icu).
**Realistyczna obietnica:** nie „szybszy progres", ale „mniej sesji jakościowych
wykonanych w złym momencie". Wymagania minimalne: pas piersiowy, ≥10 dni baseline,
stała pozycja i godzina pomiaru, ln-RMSSD, reguła pasma bez zmyślonej stałej
(0,5 SD niepotwierdzone — użyć „−1 SD" jak Kiviniemi lub wyznaczać SWC z danych
użytkownika i to udokumentować w ADR).

---

## 9. Kontekst pracownika biurowego

### 9.1 Przerywanie siedzenia — protokoły z dowodami

> Dunstan DW, Kingwell BA, Larsen R, et al. *Breaking Up Prolonged Sitting Reduces
> Postprandial Glucose and Insulin Responses.* Diabetes Care. 2012;35(5):976–983.
> doi:10.2337/dc11-1931 — **poziom B** (crossover RCT, n=19)

Protokół: 2 h siedzenia → napój testowy → 5 h obserwacji. Trzy warunki:
siedzenie nieprzerwane / **2 min chodzenia lekkiego (3,2 km/h) co 20 min** /
2 min chodzenia umiarkowanego (5,8–6,4 km/h) co 20 min. 14 przerw = 28 min łącznie.

- Glukoza iAUC: siedzenie 6,9 vs lekkie 5,2 (**−24%**, p<0,01) vs umiarkowane 4,9 (**−30%**, p<0,0001)
- Insulina iAUC: 828,6 vs 633,6 (**−23%**, p<0,0001) vs 637,6 (−23%, p<0,0001)
- **Lekkie i umiarkowane nie różniły się między sobą — liczyło się samo przerwanie,
  nie intensywność.**

> Yin M, Xu K, Deng J, et al. *Optimal Frequency of Interrupting Prolonged Sitting for
> Cardiometabolic Health: A Systematic Review and Meta-Analysis of Randomized Crossover
> Trials.* Scand J Med Sci Sports. 2024;34:e14769. doi:10.1111/sms.14769 — **poziom A**

13 crossover RCT, 211 uczestników. Bezpośrednie porównanie przerw
**wysokoczęstotliwościowych (≤30 min/blok)** vs **niskoczęstotliwościowych (>30 min)**:

- **Glukoza: HF lepsze, g = −0,30 [−0,57; −0,03], p = 0,03** (~11,8% redukcji)
- Insulina, trójglicerydy, ciśnienie, FMD: **brak różnicy** (low GRADE)
- **Modalność ma znaczenie:** przewaga HF dotyczy **tylko chodzenia** (g = −0,47,
  p<0,01), nie stania (n.i.) ani przysiadów/wspięć na palce (g = +0,21, n.i.)
- Średni czas przerwy w badaniach HF: **2,7 min (1–5 min)**

⚠️ Autorzy pokazują, że optimum **zależy od populacji i wyniku**: u chorych na T2DM
Homer i in. 2021 znaleźli lepszy efekt dla **6 min co 60 min** niż 3 min co 30 min —
odwrotnie do wzorca ogólnego. „Co 30 min" to sensowny default, nie prawo.

### 9.2 Ile aktywności „odrabia" siedzenie

> Ekelund U, Tarp J, Steene-Johannessen J, et al. *Dose-response associations between
> accelerometry measured physical activity and sedentary time and all cause mortality:
> systematic review and harmonised meta-analysis.* BMJ. 2019;366:l4570.
> doi:10.1136/bmj.l4570 — **poziom A** (8 badań, n=36 383)

Maksymalna redukcja ryzyka zgonu przy **~24 min/dzień MVPA** (HR 0,39 [0,26; 0,59]).
Istotny nadmiar ryzyka od **≥9,5 h/dzień** siedzenia (10 h: HR 1,48; 12 h: HR 2,92).
Różnica między referencją a 2. kwartylem to zaledwie **~5 min/dzień MVPA**.

> Ekelund U, Steene-Johannessen J, Brown WJ, et al. *Does physical activity attenuate,
> or even eliminate, the detrimental association of sitting time with mortality?
> A harmonised meta-analysis of data from more than 1 million men and women.*
> Lancet. 2016;388:1302–1310. doi:10.1016/S0140-6736(16)30370-1 — **poziom A**
> (13 badań, n=1 005 791)

- Najmniej aktywni + siedzenie >8 h/dzień: HR = 1,59 [1,52; 1,66]
- **Najbardziej aktywni (~60–75 min/dzień) + siedzenie >8 h: HR = 1,04 [0,99; 1,10]
  — nieodróżnialne od referencji**
- Najmniej aktywni + siedzenie <4 h: HR = 1,27 [1,22; 1,31] — **niska aktywność jest
  zła nawet u ludzi, którzy prawie nie siedzą**

⚠️ **Powszechne „30–40 min/dzień neutralizuje siedzenie" nie pochodzi z żadnej z tych
prac** — to zlepek dwóch różnych liczb: 24 min/dzień akcelerometrycznego MVPA dla
maksymalnej redukcji ryzyka (BMJ 2019) i ~60–75 min/dzień samoopisowej aktywności
umiarkowanej dla pełnej neutralizacji (Lancet 2016).

**Dobra wiadomość dla `trainctl`:** użytkownik trenujący do maratonu 4–6×/tyg. jest
w najwyższym kwartylu aktywności. Główny efekt zdrowotny ma już „za darmo".
Przerwy w siedzeniu to dla niego kwestia glikemii poposiłkowej i komfortu,
nie śmiertelności.

### 9.3 Exercise snacks / VILPA

> Islam H, Gibala MJ, Little JP. *Exercise Snacks: A Novel Strategy to Improve
> Cardiometabolic Health.* Exerc Sport Sci Rev. 2022;50(1):31–37.
> doi:10.1249/JES.0000000000000275 — **poziom D** (przegląd)

Definicja formalna: **izolowane bodźce intensywnego wysiłku ≤1 min każdy, powtarzane
w ciągu dnia** — planowane, w odróżnieniu od VILPA (incydentalne w życiu codziennym).

Protokoły opisane w tym przeglądzie (⚠️ liczby cytowane przez przegląd, nie wszystkie
prace pierwotne otwarto — sekcja 11):

| Badanie | Protokół | Wynik |
|---------|----------|-------|
| Jenkins 2019 | 3× dziennie intensywne wchodzenie po schodach (60 stopni), 1–4 h odstępu, 3 dni/tyg., 6 tyg. | VO₂peak +~5%, peak power +~12% |
| Little 2019 | 3× 20 s all-out na rowerze, 1–4 h odstępu, 6 tyg. | VO₂peak +~4%, TT 150 kJ +~9% |
| Rafiei 2020 | co godzinę 15–30 s intensywnych schodów przez 9 h siedzenia | insulina AUC −~17%, NEFA AUC −~21% |
| Caldwell 2021 | co godzinę 14–20 s schodów przez ~8,5 h | przepływ udowy +~32%, **FMD bez zmian** |
| Wolfe 2020 | co godzinę 5× 4 s maksymalny sprint rowerowy przez 8 h | trójglicerydy poposiłkowe −~31%, utlenianie tłuszczów +43% następnego dnia |

> Moore JM, Salmons H, Vinoskey C, Hooshmand S, Kressler J. *One minute of stair
> climbing and descending reduces postprandial insulin and glucose with 3-min improving
> insulin resistance following a mixed meal in young adults […].* J Exerc Sci Fit.
> 2024;22(3):266–270. doi:10.1016/j.jesf.2024.03.004 — **poziom B**

Po posiłku 650 kcal, schody w tempie własnym (90–110 stopni/min):
glukoza Δ: 1 min −14,0 mg/dL*, 3 min −18,4*, 10 min −10,0*;
insulina Δ: 1 min −1,8*, 3 min −2,8*, 10 min −1,1* (*p<0,05).
Insulin Sensitivity Index istotnie lepszy dopiero od **3 min**.
**1 minuta już działa na glukozę; 3 min potrzebne dla insulinooporności;
10 min nie było lepsze od 3.**

> Stamatakis E, Ahmadi MN, Gill JMR, et al. *Association of wearable device-measured
> vigorous intermittent lifestyle physical activity with mortality.* Nat Med.
> 2022;28(12):2521–2529. doi:10.1038/s41591-022-02100-x — **poziom C**
> (UK Biobank, n=25 241 osób nietrenujących, follow-up 6,9 lat, 852 zgony)

VILPA = bloki ≤1–2 min, ≥400 mg przyspieszenia, ≥12 kolejnych okien 10-sekundowych
klasyfikowanych jako intensywne.

- **Mediana 3 bloki/dzień:** zgony ogółem HR = 0,61 [0,50; 0,74];
  zgony CVD HR = 0,51 [0,35; 0,74]
- **Mediana 4,4 min/dzień:** zgony ogółem HR = 0,73 [0,63; 0,85];
  CVD HR = 0,66 [0,50; 0,88]
- Zależność niemal liniowa, bez plateau w obserwowanym zakresie

⚠️ **Kluczowe zastrzeżenie dla `trainctl`: badanie dotyczy osób, które NIE trenują.**
Nie ma podstaw twierdzić, że biegacz robiący 50 km/tyg. odniesie dodatkową korzyść
z VILPA. Przenoszenie tych HR na naszego użytkownika byłoby nieuczciwe.

### 9.4 Czy praca siedząca zmienia sposób trenowania? Prawdopodobnie nie

Dwa niezależne przeglądy systematyczne czynników ryzyka urazów biegowych
**w ogóle nie wspominają o siedzeniu, pracy biurowej ani zachowaniach sedentarnych**:

> Peterson B, Hawke F, Spink M, et al. *Biomechanical and musculoskeletal measurements
> as risk factors for running-related injury in non-elite runners: A systematic review
> and meta-analysis of prospective studies.* Sports Med Open. 2022;8:38.
> doi:10.1186/s40798-022-00416-z — **poziom A**
> Z 25 analiz zbiorczych tylko 2 istotne, obie trywialne/małe: siła wyprostu kolana
> (SMD −0,19 [−0,36; −0,02], „trivial"), prędkość przywodzenia w stawie biodrowym
> (MD −12,80°/s [−25,22; −0,38], d=0,32).

> van der Worp MP, ten Haaf DSM, van Cingel R, et al. *Injuries in Runners;
> A Systematic Review on Risk Factors and Sex Differences.* PLoS One.
> 2015;10(2):e0114937. doi:10.1371/journal.pone.0114937 — **poziom B**
> Zidentyfikowane czynniki: przebyty uraz (silne dowody), stosowanie wkładek
> (umiarkowane), wiek, BMI, doświadczenie, kilometraż, podłoże, częstość wymiany
> butów (wszystkie ograniczone).

O „skróconych zgięciaczach biodra od siedzenia": jedyne znalezione badanie to
przekrojowa praca Boukabache, Preece & Brookes (Musculoskelet Sci Pract.
2021;51:102282), raportująca **6,1° większy zakres wyprostu biodra** u osób
aktywnych/mało siedzących vs nieaktywnych/dużo siedzących.
⚠️ **Nie udało się otworzyć tej pracy (403 na trzech hostach)** — liczba pochodzi
z opisów. Nawet gdyby była prawdziwa: to korelacja przekrojowa w zakresie ruchu,
**nie udokumentowana ścieżka do urazu**.

**Werdykt: poziom E (folklor).** Twierdzenie „siedzisz cały dzień, więc musisz
trenować inaczej" nie ma poparcia w epidemiologii urazów biegowych. Silnik
**nie powinien** modyfikować struktury planu na podstawie liczby godzin przed
monitorem. Może natomiast optymalizować **okna czasowe** sesji (to kwestia
logistyki, nie fizjologii) — i to jest uczciwe uzasadnienie „świadomości biurka"
z SPEC §2.4.

### 9.5 Trening a praca umysłowa — dwukierunkowo

**Wysiłek → poznanie: efekt jest, ale mały, i „sweet spot" nie jest ustalony.**

> Chang YK, Labban JD, Gapin JI, Etnier JL. *The effects of acute exercise on cognitive
> performance: A meta-analysis.* Brain Res. 2012;1453:87–101.
> doi:10.1016/j.brainres.2012.02.068 — **poziom A**
> Efekt ogólny **g = 0,097**. W trakcie wysiłku g = 0,101 [0,041; 0,160];
> bezpośrednio po g = 0,108 [0,069; 0,147]; po opóźnieniu g = 0,103 [0,035; 0,170].
> Istotne moderatory: czas trwania, intensywność, typ zadania, sprawność.

> Chang YK, Ren FF, Li RH, Ai JY, Kao SC, Etnier JL. *Effects of acute exercise on
> cognitive function: A meta-review of 30 systematic reviews with meta-analyses.*
> Psychol Bull. 2025;151(2):240–259. doi:10.1037/bul0000460 — **poziom A**
> 30 przeglądów, 383 badania, 18 347 uczestników. **SMD = 0,33 [0,24; 0,42]**, p<0,001.
> Domeny: uwaga 0,37; funkcje wykonawcze 0,36; pamięć 0,23; przetwarzanie informacji 0,20.
> **Czas trwania, intensywność i typ wysiłku NIE moderowały efektu** — w napięciu
> z pracą z 2012 r. Najsilniejszy efekt: pomiar bezpośrednio po wysiłku (SMD 0,32).

⚠️ **Uczciwie:** kierunek efektu jest solidny i replikowany, ale twierdzenia
o konkretnym optymalnym okienku dawki (np. „20 min umiarkowanego dla najlepszej
koncentracji") **nie mają obecnie poparcia** — najnowszy meta-przegląd nie znalazł
moderacji przez intensywność ani czas trwania.

**Wysiłek wyczerpujący → poznanie: pogarsza.**

> Yao S, Lu H, Zhang L, Liu F, Ma F, Chi A. *Acute Exercise Fatigue Impairs Cognitive
> Control: Neurophysiological Mechanisms Revealed by ERP and ERSP Analyses.*
> Biology (Basel). 2025;14(12):1688. doi:10.3390/biology14121688 — **poziom B**
> n=35, test Stroopa przed/po przyrostowym teście do wyczerpania. Trafność w próbach
> niezgodnych ↓ istotnie; amplituda P3 na Fz ↓ (F(1,34)=5,979, p=0,020);
> amplituda N2 ↑ (F=9,933, p=0,003); moc alfa ciemieniowa ↓ (F=11,126, p=0,002).
> Interpretacja: **wykrywanie konfliktu zachowane, upośledzony etap alokacji zasobów
> i rozwiązywania.**

To realne uzasadnienie dla „nie planuj sesji do wyczerpania przed blokiem
wymagającej pracy umysłowej" — jedyne twarde w tym rozdziale.

**Praca umysłowa → wysiłek: pogarsza, przez percepcję, nie fizjologię.**

> Marcora SM, Staiano W, Manning V. *Mental fatigue impairs physical performance in
> humans.* J Appl Physiol. 2009;106(3):857–864. doi:10.1152/japplphysiol.91324.2008
> — **poziom B**

n=16, crossover: 90 min wymagającego zadania kognitywnego (AX-CPT) vs 90 min
neutralnych dokumentów, potem jazda do wyczerpania przy 80% peak power.

- **Czas do wyczerpania: 640 ± 316 s vs 754 ± 339 s (p = 0,003)** — spadek ~15%,
  13 z 16 osób krócej
- RPE istotnie wyższe w całym przebiegu (p = 0,007), tempo narastania RPE identyczne
  → zmęczeni psychicznie po prostu wcześniej osiągali sufit percepcyjny
- **Przy isotime ŻADNA zmienna fizjologiczna się nie różniła** (HR, objętość
  wyrzutowa, rzut serca, MAP, VO₂, wentylacja, laktat)
- Motywacja bez różnicy (p = 0,524; p = 0,126) — nie „mniej się starali"

> Van Cutsem J, Marcora S, De Pauw K, Bailey S, Meeusen R, Roelands B. *The Effects of
> Mental Fatigue on Physical Performance: A Systematic Review.* Sports Med.
> 2017;47(8):1569–1588. doi:10.1007/s40279-016-0672-0 — **poziom A**
> ⚠️ Oryginału nie otwarto; treść z podsumowania autorstwa współautora (sekcja 11).
> Wnioski: negatywny efekt na wytrzymałość, brak efektu na zmienne fizjologiczne,
> **brak efektu na siłę maksymalną, moc i pracę anaerobową**.

> Habay J, Uylenbroeck R, Van Droogenbroeck R, et al. *Interindividual Variability in
> Mental Fatigue-Related Impairments in Endurance Performance: A Systematic Review and
> Multiple Meta-regression.* Sports Med Open. 2023;9:14.
> doi:10.1186/s40798-023-00559-7 — **poziom A**
> 23 badania, 32 efekty, 437 uczestników. **g = −0,32 [−0,46; −0,18], p<0,001.**
> **Przedział predykcji −0,74 do +0,09** — bardzo duża zmienność międzyosobnicza.
> Płeć, wiek, BMI, poziom trenowania **nie moderowały** podatności.

**To jest najbardziej wartościowy wniosek sekcji 9 dla `trainctl`:** dzień intensywnej
pracy kognitywnej (a taki jest domyślny dzień naszego użytkownika) **obniża
wytrzymałość o ~15% przez podniesienie percepcji wysiłku, nie przez fizjologię**.
Konsekwencje praktyczne:

1. Sesja jakościowa **po** 8 h wymagającej pracy będzie się wydawać cięższa niż jest.
   Preskrypcja po tempie (a nie po RPE/HR) jest w tym kontekście **bezpieczniejsza**.
2. Sesja rano lub w porze lunchu unika tego efektu.
3. Zmienność międzyosobnicza jest ogromna (PI −0,74 do +0,09) — **to kandydat na
   parametr kalibrowany z logu użytkownika**, nie na stałą w kodzie.
4. Siła i moc **nie są dotknięte** — sesję siłową można bezpiecznie planować
   po pracy umysłowej.

### 9.6 Realizm behawioralny

> Nooijen CFJ, Blom V, Ekblom Ö, et al. *The effectiveness of multi-component
> interventions targeting physical activity or sedentary behaviour amongst office
> workers: a three-arm cluster randomised controlled trial.* BMC Public Health.
> 2020;20:1329. doi:10.1186/s12889-020-09433-7 — **poziom B**

n=263 pracowników biurowych, 23 klastry, 3 ramiona, 6 miesięcy.
**Oba realne interwencje NIE zmieniły istotnie obiektywnie mierzonego MVPA
(ratio 0,04 [−0,80; 0,82]) ani zachowań sedentarnych (ratio 1,16 [−1,66; 4,02]).**

Ostry kontrapunkt do ostrych efektów laboratoryjnych z 9.1–9.3: **przełożenie
„rób przerwy w siedzeniu" na trwałą zmianę zachowań pracownika biurowego
nie udało się w RCT.** Funkcja „exercise snacks" w `trainctl` powinna być projektowana
z założeniem niskiej adherencji — czyli jako coś taniego i opcjonalnego,
nie jako filar planu.

---

## 10. WNIOSKI DLA SILNIKA — reguły implementacyjne

Legenda siły: **A** meta-analiza spójna · **B** RCT / MA z ograniczeniami ·
**C** obserwacyjne · **D** praktyka/narracja · **E** folklor (nie implementować
jako fakt).

### 10.1 `zones/` — kalibracja i strefy

| # | Reguła | Wartości / parametry | Źródło | Siła |
|---|--------|----------------------|--------|------|
| Z-1 | Model 3-strefowy z granicami LT1/LT2 jako podstawa | Z1 <LT1, Z2 LT1–LT2, Z3 >LT2 | Casado 2022; Seiler 2006 | D |
| Z-2 | **Kotwice stref osobno dla płci** | LT1: 78,9%HRmax (M) / 83,6% (K); 64,6%vPeak (M) / 67,3% (K). LT2: 89,9%HRmax (M) / 91,7% (K); 80,8%vPeak (M) / 80,9% (K) | Nuuttila 2025 | **B** |
| Z-3 | Preferuj prędkość nad HR jako kotwicę | MAE prędkości 0,4–0,6 km/h vs HR 2,8–4,9 bpm | Nuuttila 2025 | **B** |
| Z-4 | Nie używać RPE do kalibracji stref | MAE RPE→HR 5,2–7,4 bpm (najgorsze) | Nuuttila 2025 | B |
| Z-5 | Ostrzegać, gdy HRmax/vPeak szacowane, nie mierzone | błąd rośnie do 1,0 km/h i 8,4 bpm | Nuuttila 2025 | B |
| Z-6 | **Nie importować LT z zegarka jako źródła stref** | bias tempa +0,98 do +2,06 km/h; MAPE 12,7–25,8% | Lu 2025 | **B** |
| Z-7 | Test CS terenowy: 2 próby | 1200 m + 3600 m (lub 3 min + 12 min), przerwa 30–60 min, od dłuższej do krótszej | Lipková 2025 | B |
| Z-8 | 3MT tylko dla Tier 2+; korygować D′ | CS = średnia z ostatnich 30 s; D′ zaniżone ~16% | Lipková 2025 | B |
| Z-9 | Rekalibracja | po każdym starcie; dodatkowo co 6–8 tyg. | Filipas 2022; Festa 2020 | D |

### 10.2 `engine/` — rozkład intensywności

| # | Reguła | Wartości / parametry | Źródło | Siła |
|---|--------|----------------------|--------|------|
| I-1 | Baza/build: TID **piramidalny** | Baza 80–85 / 10–15 / 3–7; Build 78–82 / 12–18 / 5–8 | Casado 2022; Knopp 2024 | D |
| I-2 | Peak/start: przejście na **polaryzację** | 78–82 / 5–8 / 12–18 | Filipas 2022 (PYR→POL najlepsze); Casado 2022 | **B** |
| I-3 | **Nie obiecywać przewagi polaryzacji dla wyniku** | TT: SMD −0,01 [−0,28; 0,25], p=0,92 | Silva Oliveira 2024 | **A** |
| I-4 | Dla Tier 1–2 dopuścić wariant Z2-heavy „time-efficient" | FOC 40/50/10 ≈ POL 77/3/20 przy −17% czasu | Festa 2020 | B |
| I-5 | Utrzymać ≥75% objętości w Z1 niezależnie od wariantu | ≥80% u elity; 77–82% w planach sub-elity | Haugen 2022; Knopp 2024 | D |
| I-6 | Zapisywać metodę kwantyfikacji TID w planie | ta sama sesja: 91% Z1-2 (time-in-zone) vs 77% Z1 (session-goal) | Stöggl & Sperlich 2015 | D |
| I-7 | „Hard day–easy day": ≥48 h między sesjami jakościowymi | — | Casado 2022 | D |
| I-8 | Liczba sesji jakościowych/tyg. | 2 (Z2 + Z3) przy ≥4 sesjach/tyg.; 1 przy 3 sesjach | Casado 2022 (≥1 Z2 i ≥1 Z3 tygodniowo u elity) | D |

### 10.3 `engine/` — objętość, progresja, guardraile

| # | Reguła | Wartości / parametry | Źródło | Siła |
|---|--------|----------------------|--------|------|
| P-1 | **Mikrocykl falujący, nie liniowy** | zmienne obciążenie dzienne i tygodniowe | Costa 2019 (ΔVO₂max +22,15% vs +11,16%) | **B** |
| P-2 | **Tydzień odciążenia po 4 tygodniach** | redukcja objętości w 4. tygodniu mezocyklu | Costa 2019 | **B** |
| P-3 | Ramp rate jako narzędzie planowania, **nie próg urazowy** | domyślnie ≤10%/tyg. dla przewidywalności; twardy limit ≤25–30% dla dużych skoków | Damsted 2018 („no evidence for the 10% rule"); Nielsen 2014 (HR 1,59 [0,96; 2,66] — **CI przez 1**) | **C, słabe** |
| P-4 | **Nie implementować ACWR jako guardraila** | wolno pokazywać 7d/28d jako deskryptor, bez progów i bez języka ryzyka urazu | Impellizzeri 2020 | **B** |
| P-5 | Monotonia/strain jako **cel projektowy tygodnia**, nie alarm | monotonia = mean(TL)/SD(TL); strain = TL_tyg × monotonia; **bez progu numerycznego** | Haddad 2017 (wzory); Foster 1998 (próg **niezweryfikowany**) | B / D |
| P-6 | sRPE liczyć, ale nie jako jedyną metrykę | sRPE = RPE × min; korelacje z TRIMP r = 0,14–0,99; niedoważa długie spokojne sesje | Haddad 2017 | B |
| P-7 | Progi objętości dla celu — HM | >32 km/tyg. → −4,19 min; najdłuższy bieg >21 km → −3,87 min | Fokkema 2020 | **C** |
| P-8 | Progi objętości dla celu — maraton | >65 km/tyg. → −14,09 min; <40 km/tyg. → +6,33 min; najdłuższy <25 km → +13,44 min | Fokkema 2020 | **C** |
| P-9 | Sufit objętości sanity-check | elita 130–220 km/tyg. — powyżej tego plan jest błędem, nie ambicją | Haugen 2022 | D |
| P-10 | Nie komunikować objętości jako czynnika ryzyka urazu w tym zakresie | „No associations between training characteristics and new RRIs" | Fokkema 2020 | C |

### 10.4 `engine/` — jednostki treningowe

| # | Reguła | Wartości / parametry | Źródło | Siła |
|---|--------|----------------------|--------|------|
| J-1 | Długie wybieganie: limit **czasowy**, nie dystansowy | maraton: docelowo 30–35 km; **nie >35 km** (brak dodatkowej korzyści); elita 75–165 min @ tempo maratońskie −1–2 km/h | Fokkema 2020; Haugen 2022 | **C** |
| J-2 | Długie wybieganie HM | >21 km | Fokkema 2020 | C |
| J-3 | Sesja progowa: tempo ciągłe LUB interwały @vLT2 | ≥1×/tyg. w bazie/build | Casado 2022 | D |
| J-4 | Sesja Z3: parametry z **korpusu trenerskiego**, nie z niezweryfikowanej literatury | drabinki 1000/400/200 m (korpus) | korpus; ⚠️ Buchheit & Laursen 2013 **nieotwarte** | D |
| J-5 | Podbiegi jako **dodatek**, nie zamiennik interwałów płaskich | „traditional level-grade training produces greater gains" | Ferley 2013 | **B** |
| J-6 | Strides: wstawiać, ale uzasadniać jako praktykę | **brak badań nad samymi strides**; nie przypisywać im „−2% ekonomii" | — | **D/E** |
| J-7 | **Double threshold: NIE w v1** | „no controlled studies have tested the efficacy of this training model"; opisane tylko u 1500/5000 m przy 150–180 km/tyg.; wymaga laktatu | Casado 2023 (cytat autorów) | **D** |

### 10.5 `engine/` — taper

| # | Reguła | Wartości / parametry | Źródło | Siła |
|---|--------|----------------------|--------|------|
| T-1 | **Utrzymać intensywność** przez cały taper | SMD −0,55 [−0,79; −0,31] | Wang 2023 | **A** |
| T-2 | **Utrzymać liczbę sesji** | SMD −0,53 [−0,83; −0,25] | Wang 2023 | **A** |
| T-3 | Redukować **tylko objętość** | 41–60%: SMD −0,77 [−1,23; −0,30] | Wang 2023; Bosquet 2007 | **A** |
| T-4 | **Spadek monotoniczny** (każdy tydzień ≤ poprzedni) | „strict" vs „relaxed": mediana −5:32,4 (2,6%) | Smyth 2021 (N=158 117) | **C** |
| T-5 | Długość według dystansu | 5–10 km: 7–10 dni, −40–50%; HM: 10–14 dni, −45–55%; maraton: **14–21 dni**, −50–60% | Wang 2023; Smyth 2021; Knopp 2024 | A / C |
| T-6 | Struktura ostatniego tygodnia | ~−50% względem tygodnia poprzedniego | Knopp 2024 | D |
| T-7 | Szczyt objętości | ~4 tyg. przed startem, potem −22–31%/tyg. | Knopp 2024 | D |
| T-8 | Ultra: brak danych — ekstrapolacja z ostrzeżeniem | ≥21 dni, ≥60% | **brak źródła** | **—** |
| T-9 | Start „B": mini-taper | 3–5 dni, −20–30%, bez zmian w makrocyklu | **brak źródła** | **—** |
| T-10 | Dzień **przed** startem B/C: wolne | korpus: 34/45 startów (76%) poprzedzone dniem bez treningu | korpus trenerski (n=1) | **korpus** |
| T-11 | Dzień **po** starcie B/C: długie wybieganie **zostaje**, spokojnie | korpus: 19/45 (42%) startów ma nazajutrz trening, dominuje ND long „bardzo spokojnie" po sobotnim starcie | korpus trenerski (n=1) | **korpus** |
| T-12 | Tydzień ze startem B/C **nie kasuje** akcentu tygodnia — start **jest** akcentem | korpus: brak dodatkowych sesji Z3 w tygodniach startowych | korpus; spójne z I-7 (≥48 h) | **korpus** |

### 10.6 `engine/` — reguły po starcie i po chorobie

| # | Reguła | Wartości / parametry | Źródło | Siła |
|---|--------|----------------------|--------|------|
| R-1 | Po maratonie: 48 h ciszy, potem lekkie bieganie | 40 min @95–105% HR na LT1, w 48/96/144 h | Martínez-Navarro 2021 | **B** |
| R-2 | Powrót w 48 h **nie szkodzi** regeneracji | brak wpływu na CK/LDH; SJ lepszy w 96 h (p=0,020, d=0,80) | Martínez-Navarro 2021 | B |
| R-3 | Ultra: **nie ekstrapolować R-1** | konserwatywnie dłuższa cisza, decyzja per przypadek | **brak źródła** | **—** |
| R-4 | Po chorobie: **nie kodować „neck check" jako logiki** | reguła jest „nonscientific" wg autorów | Ruuskanen 2023 | **D** |
| R-5 | Po chorobie: konserwatywny restart | objętość ×0,5–0,6, zero Z3 przez 5–7 dni, potem progresja jak po przerwie | ekstrapolacja | **—** |
| R-6 | Wyświetlać objawy wymagające lekarza, z cytowaniem | ból w klatce, omdlenie, duszność, kołatanie = bezwzględne przeciwwskazania | Ruuskanen 2023 | **D** |
| R-7 | Silnik **nie udziela porad medycznych** | brak evidence-based guidelines; decyzja „personalized process between athlete and medical team" | Ruuskanen 2023 | D |

### 10.7 `solver/` — ograniczenia renegocjacji tygodnia

| # | Ograniczenie | Wartość | Źródło | Siła |
|---|--------------|---------|--------|------|
| S-1 | ≥48 h między sesjami jakościowymi (Z3) | twarde | Casado 2022 (hard day–easy day) | D |
| S-2 | Chronić długie wybieganie | najwyższy priorytet po liczbie akcentów | Fokkema 2020 (największe β) | C |
| S-3 | Zachować liczbę akcentów przy przesuwaniu | — | Wang 2023 (T-2, analogia z taperu) | D |
| S-4 | Odstęp siła↔bieg tego samego dnia: **≥3 h udokumentowane** (ochrona mocy, SMD −0,28 przy tej samej sesji); „≥6 h" to zalecenie z dyskusji Vikestad, nie wynik — trzymamy 6 h jako margines inż. | ≥3 h (dowód) / 6 h (inż.) | Schumann 2022 (10.1007/s40279-021-01587-7, 43 badania); Vikestad & Dalen 2024 (zalecenie autorów) | **A** / D |
| S-5 | Ciężka sesja siłowa (≥80% 1RM) **nie <24 h przed sesją jakościową**; bieg SUBmaksymalny 24 h po sile jest OK (VO₂/HR/La bez zmian) | twarde dla jakości; deficyt momentu siły utrzymuje się do 48 h | de Carvalho e Silva 2022 (10.1186/s40798-022-00497-w, 19 badań) — korekta atrybucji z „Silva 2022" | **A−** |
| S-6 | Kolejność siła↔bieg w obrębie sesji: **swobodna** dla adaptacji tlenowej | miękkie | Eddens 2018 (VO₂max: brak efektu kolejności) | **A** |
| S-7 | Nie planować sesji do wyczerpania przed blokiem wymagającej pracy umysłowej | miękkie, preferencja | Yao 2025 (P3 ↓, p=0,020) | B |
| S-8 | Po dniu intensywnej pracy kognitywnej preferować preskrypcję **po tempie**, nie po RPE | miękkie | Marcora 2009 (RPE ↑ przy identycznej fizjologii); Habay 2023 (g=−0,32) | **A** |
| S-9 | Monotonia: różnicować obciążenie dzienne w tygodniu | miękkie, funkcja celu | Costa 2019 (P-1); Haddad 2017 | B |
| S-9a | **Długie wybieganie WOLNO stawiać nazajutrz po akcencie** — S-9 mówi o różnicowaniu obciążenia, nie o sąsiedztwie; spokojne długie po akcencie JEST różnicowaniem | brak kary w solverze | korpus: 52/73 długich z rozpoznanym dniem poprzednim wypada po akcencie, 16 po starcie (93%), z czego 73% czysto spokojne (`tools/corpus/long_run_profile.py`) | **A** (pomiar na 50 planach) |

### 10.8 `engine/` — trening siłowy

| # | Reguła | Wartości / parametry | Źródło | Siła |
|---|--------|----------------------|--------|------|
| F-1 | 2–3 sesje/tyg. jako domyślna dawka | — | Balsalobre-Fernández 2016; Blagrove 2018 | D (opis praktyki, nie dose-response) |
| F-2 | **Cel: ≥24 sesje łącznie w bloku** | <24: SMD 0,10 (n.i.); ≥24: SMD 0,63 [0,29; 0,97] | Berryman 2018 | **A** |
| F-3 | Blok **10–14 tyg.**, nie 6–8 | g −0,45 [−0,83; −0,08] vs −0,21 (n.i.) | Eihara 2022; Denadai 2017 (β=−0,83, p=0,02) | **A** |
| F-4 | Ciężkie obciążenia: **≥80% 1RM**, najlepiej ≥90%/≤4RM | ES −0,266 [−0,516; −0,015]; ≥90%: g −0,31 | Llanos-Lagos 2024a; Eihara 2022 | **A** |
| F-5 | Wariant kombinowany najsilniejszy dla ekonomii | ES −0,426 [−0,768; −0,083], p=0,018 | Llanos-Lagos 2024a | **A** |
| F-6 | **Plyometria tylko jeśli tempo docelowe ≤12 km/h** | ES −0,307 (p=0,028) ≤12 km/h; brak efektu >12 km/h | Llanos-Lagos 2024a | **B** |
| F-7 | Nie stosować treningu izometrycznego jako głównej metody | −2,20 ± 4,37%, p=0,324 (n.i.); ES −0,269 (n.i.) | Denadai 2017; Llanos-Lagos 2024a | **A** |
| F-8 | Oczekiwana korzyść: **ekonomia i wynik, nie VO₂max** | RE −2 do −8%; TT 5–10 km 2–4%; VO₂max SMD 0,03 [−0,16; 0,23] | Blagrove 2018; Berryman 2018 | **A** |
| F-9 | **Nie obiecywać redukcji urazów** | jedyna MA na biegaczach: log RR −0,21 [−0,46; 0,047], p=0,110 (n.i.) | Wu 2024 | **A** |
| F-10 | Nie cytować RR 0,315 jako danych o biegaczach | 4 badania z piłki nożnej i wojska, zero biegowych | Lauersen 2014 (analiza źródeł) | **A** |
| F-11 | Rozciąganie **nie** redukuje urazów | RR 0,963 [0,846; 1,095] | Lauersen 2014 | **A** |
| F-12 | Siłownia 2×/tyg. w bazie, 0–1×/tyg. w okresie startowym | — | Haugen 2022 | D |
| F-13 | **Taper: siłę odstawić całkiem** — 4 tyg. detrainingu siły przy utrzymanym bieganiu nie kasuje efektu, wynik 3000 m dalej się poprawiał | koszt energ.: −5,75% → −6,31%; 3000 m: −2,40% → −4,43% po 4 tyg. przerwy | Berryman, Mujika, Bosquet 2020 (10.3390/sports9010001, **n=8!**) | B− |
| F-14 | Utrzymanie poza blokiem: 1 sesja/tyg. wystarcza | 13 tyg. utrzymania zachowuje przyrost siły i CSA — **dane z kolarzy, ekstrapolacja** | Rønnestad 2010 (PMID 20799042) | B (pośredni) |
| F-15 | **Uczciwość wobec 34–45 lat**: w tej grupie wiekowej efekt na ekonomię jest NIEISTOTNY — moduł nie obiecuje sekund, tylko przenoszenie zakupów po schodach | 21–31,5 lat: g=−0,51 ist.; 34,1–44,8 lat: g=−0,12 [−0,41; 0,17] n.i. | Eihara 2022 (10.1186/s40798-022-00511-1) | **A−** |
| F-16 | Durability: siła podtrzymuje ekonomię w końcówce długiego wysiłku | RE po 90 min: +2,1% vs −0,6% kontroli (p=0,04); TTE @95% VO₂max +35% | Zanini 2025 (10.1249/MSS.0000000000003685; **1 RCT, n=28**) | B |
| F-17 | Wynik z siły potwierdzony tylko w LABORATORIUM na 1,5–10 km — **zero badań nad maratonem/HM i realnymi zawodami**; częsty konfundent: siłę DOKŁADANO do treningu (grupy różniły się całkowitym obciążeniem) | TT/TTE: ES −0,469 [−0,872; −0,066] (ciężka siła) | Llanos-Lagos 2024b (10.1007/s40279-024-02018-z, 38 badań, 894 os.); zastrzeżenie: Blagrove 2018 | **A−** |

### 10.9 Predykcja wyniku

| # | Reguła | Wartości / parametry | Źródło | Siła |
|---|--------|----------------------|--------|------|
| W-1 | **Zawsze przedział, nigdy pojedyncza liczba** | MAE 5,67% → ±12 min na 3:30 | Oficial-Casado 2025 | **C** |
| W-2 | Maraton u amatora: predyktor podstawowy = **czas HM** | R² 0,85, MAE 5,67%; mnożnik ≈2,28; przewaga M ≈329 s | Oficial-Casado 2025 | **C** |
| W-3 | **VDOT tylko dla ≤HM i dla szybszych niż ~4:00 maraton** | MAE: sub-2:30 1,11% · sub-4:00 5,96% · **sub-5:00 10,43%** | Oficial-Casado 2025 | **C** |
| W-4 | **Riegel nigdy dla maratonu bez ostrzeżenia** | „at least 10 min too fast for half of runners"; MSE 380,7 vs 227,6 | Vickers 2016 | **C** |
| W-5 | Riegel: stosować w zakresie 3,5–230 min | T₂ = T₁ × (D₂/D₁)^1,06 | Riegel 1981 | D |
| W-6 | Critical speed dla 1500–5000 m | błąd rośnie na 800 m | Lipková 2025 | B |
| W-7 | **Ultra: brak predykcji punktowej** | CS spada ~10% po 120 min, rozrzut indywidualny **1–31%** | Hunter 2025 | **B** |
| W-8 | `durability_factor` kalibrować z historii startów użytkownika | 20-min TT −2,9% (−8,5% do +1,1%); 6-min TT ~−10% (−31% do +1%) | Hunter 2025 | **B** |
| W-9 | Model może uwzględniać kilometraż jako predyktor | tempo ~6% na 5 km / ~3,5% na maratonie; interwały ~2–4%; kilometraż stabilnie (p<0,0005) | Vickers 2016 | C |
| W-10 | Nie używać zmiennych rozkładu tempa jako predyktora | dodanie ich nie poprawiło R² (0,85 → 0,85) | Oficial-Casado 2025 | C |
| W-11 | **Kalibracja stref = wynik biegu maksymalnego**; sprawdzian all-out jest równoważny startowi | VDOT liczy się z każdego biegu na czas na znanym dystansie | Daniels & Gilbert (Z-1) | D |
| W-12 | Rytm kalibracji: **co ~4 tygodnie** | korpus: 45 startów w 1231 dniach (8,7/rok), **mediana odstępu 28 dni**, p25 = 14 dni | korpus trenerski (n=1) | **korpus** |
| W-13 | **Preferuj prawdziwy start** nad sztucznym sprawdzianem; sprawdzian to fallback przy pustym kalendarzu startów | korpus: **0 wzmianek** o sprawdzianie/teście na czas w 1231 dniach — trener kalibruje wyłącznie startami | korpus trenerski (n=1) | **korpus** |

### 10.10 Tryb biurkowy (faza 5)

| # | Reguła | Wartości / parametry | Źródło | Siła |
|---|--------|----------------------|--------|------|
| B-1 | **Nie modyfikować struktury planu z powodu godzin siedzenia** | siedzenie nie występuje w żadnym z 2 przeglądów czynników ryzyka urazów biegowych | Peterson 2022; van der Worp 2015 | **A (nieobecność)** |
| B-2 | „Skrócone zgięciacze od siedzenia" = **folklor** | jedyne badanie: przekrojowe, 6,1° ROM, **nieotwarte**, zero ścieżki do urazu | Boukabache 2021 (niezweryfikowane) | **E** |
| B-3 | Przerwa w siedzeniu: **chodzenie**, ≤30 min interwał, 2–3 min | HF vs LF glukoza g −0,30 [−0,57; −0,03], p=0,03; **tylko dla chodzenia** | Yin 2024 | **A** |
| B-4 | Prosty protokół z dowodami: 2 min lekkiego chodu co 20 min | glukoza iAUC −24%, insulina −23% | Dunstan 2012 | **B** |
| B-5 | Exercise snack: 1 min schodów działa na glukozę, 3 min na insulinooporność | 10 min nie było lepsze niż 3 | Moore 2024 | **B** |
| B-6 | **Nie obiecywać biegaczowi korzyści zdrowotnych z VILPA** | dane z osób NIEtrenujących (n=25 241 non-exercisers) | Stamatakis 2022 | **C, zła populacja** |
| B-7 | Nie cytować „30–40 min neutralizuje siedzenie" | to zlepek: 24 min/dzień MVPA (BMJ 2019) i ~60–75 min/dzień (Lancet 2016) | Ekelund 2019, 2016 | **A** |
| B-8 | Projektować przerwy z założeniem niskiej adherencji | 6-mies. RCT nie zmienił MVPA (ratio 0,04) ani SB (ratio 1,16) | Nooijen 2020 | **B** |
| B-9 | Wysiłek → poznanie: efekt mały, **bez ustalonego optimum dawki** | SMD 0,33 [0,24; 0,42], ale czas/intensywność/typ **nie moderują** | Chang 2025 | **A** |
| B-10 | Praca umysłowa → wytrzymałość: **−15%, przez percepcję** | TTE 640 vs 754 s (p=0,003); zero różnic fizjologicznych przy isotime; g=−0,32 | Marcora 2009; Habay 2023 | **A** |
| B-11 | Sesję **siłową** można planować po pracy umysłowej — siła i moc są na nią odporne | brak efektu zmęczenia umysłowego na siłę maksymalną, moc i pracę anaerobową | Van Cutsem 2017 | A ⚠️ (oryginał nieotwarty) |

### 10.11 HRV-guided (faza 5+)

| # | Reguła | Wartości / parametry | Źródło | Siła |
|---|--------|----------------------|--------|------|
| H-1 | Obietnica: **mniej źle umiejscowionych sesji jakościowych**, nie większe przyrosty | wynik SMD 0,20 [−0,09; 0,48] (n.i.); HRV wagalna SMD 0,50 [0,09; 0,91] (istotne) | Manresa-Rocamora 2021 | **A** |
| H-2 | **Wymóg: pas piersiowy** | Polar H10 MAPE 2,16% vs kamera smartfona 17,49% | Johansson 2026 | **B** |
| H-3 | Wskaźnik: ln-RMSSD | RMSSD w 62,5% badań; lepsza rzetelność krótkoterminowa dla ln | Manresa-Rocamora 2021; Damoun 2024 | B / D |
| H-4 | Baseline ≥10 dni, stała pozycja i godzina | 87,5% badań: rano po przebudzeniu; okno 5 min (<60 s OK dla RMSSD) | Manresa-Rocamora 2021; Damoun 2024 | B / D |
| H-5 | Reguła pasma: **nie kodować „±0,5 SD"** — stała niepotwierdzona | użyć „średnia 10-dniowa − 1 SD" (Kiviniemi) albo SWC z danych użytkownika, z ADR | Kiviniemi 2007; ⚠️ Plews 2013 nieotwarte | **B / —** |
| H-6 | Decyzja: HRV w pasmie → Z2/Z3 dozwolone; poniżej pasma lub trend ↓ ≥2 dni → Z1/odpoczynek | — | Kiviniemi 2007; Vesterinen 2016 | **B** |
| H-7 | Test ortostatyczny dla Tier 3+ | supine podlega parasympathetic saturation; okno: pierwsze 25–30 uderzeń po wstaniu | Gronwald 2024 | D |
| H-8 | Wykluczać pomiary przy znanych zakłóceniach | alkohol <24 h, kofeina <2 h, temp. poza 20–25°C, oddech poza 9–24/min | Damoun 2024 | D |
| H-9 | Nie kodować reguł dla cyklu menstruacyjnego i choroby | dowody = case reports n=2 i n=1 | Dupuit 2025; Hottenrott 2021 | **D, bardzo słabe** |
| H-10 | Po zmianie wysokości: re-baseline | spadek ~72 h, powrót ~9. dnia | Bahenský & Grosicki 2021 | B |

### 10.13 `zones/heat.ts` — korekta tempa na temperaturę

| # | Reguła | Wartości / parametry | Źródło | Siła |
|---|--------|----------------------|--------|------|
| H-1 | Zależność wynik↔temperatura jest **kwadratowa**, nie liniowa: `strata_prędkości% = k·(T−T_opt)²` powyżej optimum | model wielomianowy 2. stopnia | El Helou 2012 (10.1371/journal.pone.0037407, **n=1 791 972**); Mantzios 2021 (krzywa U) | **C** |
| H-2 | Temperatura optymalna **rośnie** u wolniejszych, a parabola **jednocześnie się stromi** — jedno przesunięcie krzywej tego nie odda | M: P1 3,8 °C/k=0,0145 · Q1 6,0/0,034 · mediana 6,2/0,040 · Q3 7,4/0,048 | El Helou 2012 **Tab. S3** (suplement) | **C** |
| H-3 | Wolniejsi tracą **3–4,6× więcej** — ale **przy tym samym ΔT nad optimum**. W jednym biegu (ta sama temperatura bezwzględna) iloraz spada do ~2×, bo czołówka ma niższe optimum, więc jej ΔT jest większe i częściowo kompensuje łagodniejszą krzywą. **Nie mylić tych dwóch porównań** | +10 °C nad optimum: 1,44% (P1) vs 4,61% (Q3) = 3,2×; oba przy 20 °C: 3,8% vs 7,6% = 2,0× | El Helou 2012 Tab. S3; Nikolaidis 2019 (n=244 642); Vihma 2010 | **C** |
| H-4 | **Strata prędkości ≠ kara czasowa**: `kara% = s/(100−s)·100` | 21,4% straty prędkości = 27,3% kary czasu | arytmetyka; pułapka wskazana przy ekstrakcji Tab. S3 | — |
| H-5 | **Model milczy powyżej 25 °C** (dane: 1,7–25,2 °C); WBGT 21 °C to rekomendowany próg odwołania biegu masowego | odmowa liczby zamiast ekstrapolacji | El Helou 2012 (zakres danych); Roberts w Racinais 2015 | **C**/D |
| H-6 | Korekta to przesunięcie **średniej populacyjnej**, nie prognoza indywidualna | pogoda tłumaczy R²=0,17 (Berlin, n=668 509) do 0,33 (Mantzios) | Weiss 2024 (10.1371/journal.pone.0312097); Mantzios 2021 | **C** |
| H-7 | Aklimatyzacja: gros adaptacji w 7 dni, 6–10 dni do pełnej; decay ~2,5%/dzień | TT: ES 0,49; 10 dni ES 0,86 vs 5 dni 0,11 | Benjamin 2019 (10.3389/fphys.2019.01448, 35 badań); Daanen 2018 | **A** |
| H-8 | Efektu aklimatyzacji **nie wyrażać w s/km na trasie** — wszystkie liczby pochodzą z laboratoryjnych TT (głównie kolarskich) | „decay in competitive sporting performance remains to be clarified" | Racinais 2015 (cytat autorów); Lorenzo 2010 (rowery) | D |

### 10.12 Reguły „czego NIE robić" (anty-wzorce)

Te wpisy są równie ważne jak reguły pozytywne — chronią przed wpisaniem do kodu
rzeczy, które brzmią jak wiedza, a nią nie są.

| # | Anty-wzorzec | Dlaczego | Źródło |
|---|--------------|----------|--------|
| N-1 | ACWR ze „sweet spotem" 0,8–1,3 | artefakt binowania; związek znika przy danych ciągłych | Impellizzeri 2020 |
| N-2 | „Reguła 10%" jako próg bezpieczeństwa | RCT: 10% → 20,8% urazów, 24% → 20,3%, HR 0,8 [0,6; 1,3] | Buist 2008 via Damsted 2018 |
| N-3 | „>30% wzrostu = ryzyko urazu" jako fakt | HR 1,59 **[0,96; 2,66]** — CI przez 1,0 | Nielsen 2014 |
| N-4 | Monotonia >2,0 jako alarm | progu nie potwierdzono w źródle pierwotnym | — |
| N-5 | „Trening siłowy o 2/3 zmniejsza urazy biegowe" | dane z piłki nożnej/wojska; MA na biegaczach: n.i. | Lauersen 2014; Wu 2024 |
| N-6 | Rozciąganie jako prewencja urazów | RR 0,963 [0,846; 1,095] | Lauersen 2014 |
| N-7 | „Polaryzacja jest lepsza dla wyniku" | TT SMD −0,01; u trained/developmental brak różnicy | Silva Oliveira 2024 |
| N-8 | „Strefa 2 to szara strefa do unikania" | u amatorów FOC (50% Z2) = POL przy −17% czasu | Festa 2020 |
| N-9 | Riegel dla maratonu bez ostrzeżenia | ≥10 min za szybko u połowy amatorów | Vickers 2016 |
| N-10 | VDOT dla wolnych biegaczy | MAE 10,43% dla sub-5:00 (~30 min błędu) | Oficial-Casado 2025 |
| N-11 | „Wykładnik Riegla 1,04/1,06/1,09/1,12 wg kilometrażu" | pochodzi z blogów SEO, **nie z literatury** | — |
| N-12 | LT z zegarka jako źródło stref | bias +0,98 do +2,06 km/h | Lu 2025 |
| N-13 | Uniwersalne %HRmax dla obu płci | LT1: 78,9% (M) vs 83,6% (K), p<0,001 | Nuuttila 2025 |
| N-14 | „Neck check" jako logika decyzyjna | „nonscientific" wg autorów | Ruuskanen 2023 |
| N-15 | „Po maratonie 2 tygodnie nic" | powrót w 48 h nie szkodzi, przyspiesza regenerację nerwowo-mięśniową | Martínez-Navarro 2021 |
| N-16 | Double threshold dla amatora | zero badań kontrolowanych; opisane przy 150–180 km/tyg. + laktat | Casado 2023 |
| N-17 | „Siedzenie skraca zgięciacze → zmień trening" | brak w epidemiologii urazów biegowych | Peterson 2022; van der Worp 2015 |
| N-18 | „Strides poprawiają ekonomię o 2%" | to wyniki z badań nad plyometrią, nie nad strides | — |
| N-19 | Długie wybieganie >35 km dla maratonu | brak dodatkowej korzyści wobec 30–35 km | Fokkema 2020 |
| N-20 | Redukcja intensywności w taperze | utrzymanie intensywności ma niezależny efekt SMD −0,55 | Wang 2023 |
| N-21 | Wpisywanie sztucznych „sprawdzianów" do planu jako domyślnego mechanizmu kalibracji | trener z korpusu **ani razu** w 1231 dniach nie zaplanował sprawdzianu — kalibruje prawdziwymi startami co ~4 tyg. (W-12/W-13); sztuczny TT to fallback dla pustego kalendarza, nie metoda pierwszego wyboru | korpus trenerski (n=1) |
| N-22 | „Siła da Ci X minut w maratonie" | zero badań nad maratonem/HM i realnymi zawodami; dowody kończą się na 1,5–10 km w laboratorium (F-17); dodatkowo Blagrove: żadne badanie nie wykazało transferu RE→wynik | Llanos-Lagos 2024b; Blagrove 2018 |
| N-23 | „Mechanizm siły to dłuższy krok / sztywniejsza noga" jako fakt | żadne badanie nie mierzyło zmiennych biomechanicznych PODCZAS biegu po interwencji siłowej | Trowell 2020 (10.1007/s40279-019-01184-9) |
| N-24 | Reguła „≥6 h między siłą a bieganiem" jako wynik badań | to zalecenie z dyskusji (Vikestad); badania włączone używały odstępów 2–10 min; udokumentowane jest ≥3 h dla ochrony mocy | Schumann 2022 vs Vikestad 2024 |
| N-25 | Przelicznik „temperatura + punkt rosy > 130 → 1% na 10 punktów" (chart Hadleya) | pochodzi z **bloga** (2013), rozpowszechniony przez kalkulatory biegowe; zero recenzowanych publikacji, zero walidacji | — |
| N-26 | Stałe liniowe typu „+2 s/milę na °F", „+10 s/km na 5 °C" jako uniwersalne | zależność jest kwadratowa, a nachylenie różni się **3–4,6×** między elitą a amatorem; wartość trafna dla biegacza 4 h jest ~4,7× za duża dla czołówki | El Helou 2012; Vihma 2010 |
| N-27 | Człon wilgotności w korekcie tempa poniżej ~30 °C | efekt niezależny wykazano **tylko przy 36 °C** (Jenkins 2023, n=14); w dużych zbiorach obserwacyjnych to artefakt korelacji z temperaturą (r=−0,69). Wilgotność przewiduje DNF, nie czas | Jenkins 2023 (10.1113/EP090969); Vihma 2010 |
| N-28 | Osobny człon nasłonecznienia lub wiatru | „neither cloud cover nor low solar loads" nie zwiększają szansy na szybki maraton; wiatr z Bostonu jest specyficzny dla trasy punkt-punkt | Ely 2007b (PMID 17986912); Vihma 2010 |
| N-29 | Różnicowanie korekty cieplnej po płci | źródła sprzeczne: El Helou daje elitarnym kobietom T_opt 9,9 °C i stromszą krzywą, Vihma i Llewellyn nie wykrywają efektu u czołowych kobiet, Berlin 2024 — efekt silniejszy u mężczyzn | trzy sprzeczne zbiory |
| N-30 | Nazywanie „WBGT" wartości liczonej z T i RH z API pogodowego | WBGT wymaga temperatury globusa i termometru wilgotnego z wentylacją; progi ACSM i modele Ely/Mantzios są dla prawdziwego WBGT | Racinais 2015 |
| N-31 | Ekstrapolacja reguły maratońskiej na **ultra** | w ultra zależność się **odwraca** — najszybsi cierpią bardziej (Western States) | Bouscaren 2019 |

---

## 11. DO WERYFIKACJI

Rzeczy, których **nie** potwierdzono z pierwszej ręki. Nic z tej listy nie powinno
trafić do kodu jako fakt bez uprzedniego domknięcia.

### 11.1 Źródła, których nie udało się otworzyć (cytowanie potwierdzone, treść nie)

| Pozycja | Co dokładnie brakuje | Dlaczego |
|---------|----------------------|----------|
| **Bosquet i in. 2007, MSSE 39(8):1358–1365** | dokładne effect size'y (krążące ES=0,59 dla 2 tyg., ES=0,72 dla −41–60%) | 403/402/CAPTCHA na Ovid, PubMed, Semantic Scholar. Główna konkluzja spójna we źródłach wtórnych i zbieżna z Wang 2023 |
| **Buchheit & Laursen 2013, Part I i II** | wszystkie parametry programowania HIT (9 zmiennych, klasyfikacja sesji, cel czasu >90% VO₂max) | PDF nieczytelny dla narzędzia; Springer za paywallem |
| **Seiler & Kjerland 2006** | pełny tekst, dokładne rozkłady | tylko rekordy bibliograficzne i opisy wtórne |
| **Casado i in. 2022, IJSPP** | dokładne zakresy % stref, sekcja rekomendacji praktycznych, numer strony końcowej | humankinetics 403; PDF na squarespace nieczytelny |
| **Maunder i in. 2021, Sports Med 51:1619–1628** (durability) | definicja w oryginalnym brzmieniu, metody oceny | paywall Springera; definicja przejęta z cytującej pracy Hunter 2025 |
| **Riegel 1981, American Scientist** | pełny tekst, sposób wyprowadzenia wykładnika | tylko opisy wtórne |
| **Foster 1998, MSSE 30(7):1164–1168** | **próg numeryczny monotonii** (powszechnie cytowane „>2,0") | nie znaleziono w żadnym otwartym źródle. **Nie kodować progu.** |
| **Plews i in. 2013, Sports Med 43(9):773–781** | stała „±0,5 SD" dla SWC w HRV | dostępny tylko abstrakt; stała pochodzi ze źródeł praktycznych (Kubios, TrainingPeaks), nie z pracy naukowej |
| **Van Cutsem i in. 2017, Sports Med 47(8):1569–1588** | oryginał | wszystkie hosty zablokowane; treść z podsumowania współautora (Roelands, GSSI) |
| **Ludyga i in. 2016, Psychophysiology 53(11)** | effect size'y (g=0,35 / 0,22 / 0,54 / 0,67) | 6 prób dostępu, wszystkie nieudane; liczby ze opisów |
| **Boukabache i in. 2021, Musculoskelet Sci Pract 51:102282** | 6,1° różnicy w wyproście biodra, N | 403 na trzech hostach |
| **Nuuttila i in. 2017, Int J Sports Med 38(12):909–920** | wyniki HRV-guided vs block | PDF nieczytelny, PubMed CAPTCHA; dwa opisy podawały różne wersje wyniku Vmax |
| **McKay i in. 2022, IJSPP 17(2):317–331** | pełne kryteria numeryczne dla każdego tieru | tylko opisy; ramy używamy jako nomenklatury, nie jako progów |
| **Kelemen i in. 2024, Sci J Sport Perform 3(1):38–46** | liczba włączonych badań, konkretne parametry | PDF skompresowany, ekstrakcja nieudana |
| **Casado, Hanley, Ruiz-Pérez 2021, JSCR** (easy runs jako predyktor) | pełny tekst, współczynniki | tylko opisy bibliograficzne |
| **Ferley i in. 2013** | nachylenie podbiegu, długości odcinków, intensywności | abstrakt nie zawiera; pełny tekst niedostępny |
| **Jenkins i in. 2019** (exercise snacks, apnm-2018-0675) | oryginał | 403 ×2; liczby przez przegląd Islam 2022 |
| **Berryman i in. 2018 — erratum PMID 29517405** | czy któraś z liczb została skorygowana | erratum nieotwarte. **Zweryfikować przed użyciem F-2 (próg ≥24 sesji).** |
| **Silva i in. 2022, Sports Med Open 8:105** | pełna lista autorów | PMC zwrócił tylko „Silva GIC, et al." |
| **Nature Sci Rep 2025 (ML, 120 maratończyków)** | czy to RCT czy modelowanie; liczby | redirect na login Nature. **Nie użyto w tym dokumencie.** |
| **Talk test (Foster, Persinger i in.)** | liczby porównujące etapy talk testu z VT/RCT | PDF nieczytelny; PubMed CAPTCHA |
| **Meta-analiza sieciowa interwałów (BMC Sports Sci 2025, s13102-025-01191-6)** | optymalny czas pracy ~140 s, ratio 0,85 | redirect na login Springera. **Nie użyto liczb.** |
| **Meta-analiza „training determinants of marathon performance" (JSAMS 2019)** | współczynniki meta-regresji | jsams.org 403; ScienceDirect abstrakt niedostępny |
| **Kofeina a RMSSD** | czy istnieje meta-analiza i jaki wynik | PDF uszkodzony; kwestia pozostaje sporna |
| **Task Force 1996 (standardy HRV)** | oryginalne progi | cytowane wtórnie przez Damoun 2024 |
| **Balsalobre-Fernández 2016, JSCR 30(8)** | ES i CI metaanalizy (5 badań, 93 os.) | JSCR 402/403 na trzech hostach (re-check 2026-08-06). **Nie kodować liczb z tej pracy** — F-1 cytuje ją tylko jako opis praktyki |
| **Doma & Deakin 2013 (apnm-2012-0362) i Doma 2019 (Sports Med 49)** | prawdopodobne PIERWOTNE źródło reguły „6 h odstępu" | oba niedostępne (403/login). Dopóki nieotwarte, „6 h" pozostaje wartością inż. z marginesem, a dowodowe jest ≥3 h (Schumann 2022) — patrz S-4 |

### 11.2 Rzeczy, dla których **nie znaleziono żadnego źródła**

Te muszą być oznaczone w kodzie jako heurystyki, nie jako reguły oparte na dowodach:

1. **Taper i regeneracja dla ultra (>50 km).** Cała literatura o taperze i powrocie
   po starcie dotyczy dystansów ≤maraton. Reguły T-8 i R-3 to czysta ekstrapolacja.
   Dla użytkownika z historią ultra (Rzeźnik, 100 km, Łemkowyna) **korpus własnych
   startów jest lepszym źródłem niż literatura.**
2. **Taper przed startem „B"/kontrolnym.** Brak badań. Reguła T-9 to heurystyka.
3. **Sufit „3 godziny" dla długiego wybiegania.** Powtarzany wszędzie, nieodnaleziony
   w recenzowanym źródle. Wyprowadzenie 35 km z Fokkema 2020 jest solidniejsze
   i tak zostało zapisane (J-1).
4. **Bezpośrednie badania nad strides/przebieżkami.** Nie istnieją w przeszukanej
   literaturze. Wszystkie liczby przypisywane strides pochodzą z badań nad plyometrią.
5. **Protokół stopniowego powrotu po infekcji dróg oddechowych.** Autorzy komentarza
   w JSHS wprost stwierdzają, że *„evidence-based clinical guidelines […] are lacking"*.
   Reguła R-5 to heurystyka.
6. **Wpływ pracy siedzącej na wydolność następującego treningu.** Nie znaleziono
   wiarygodnego badania (jedyny kandydat — sapub.org — nieweryfikowalny).
7. **Wpływ snu pracownika biurowego na adaptację treningową.** Najsłabiej
   udokumentowany podtemat sekcji 9. Nooijen 2020 mierzył sen, ale go nie analizował.
8. **Czy istnieje RCT treningu siłowego na biegaczach elitarnych.** Nie znaleziono;
   trzy niezależne zespoły (Balsalobre-Fernández, Zecchin, Eihara) niezależnie
   zgłaszają tę samą lukę.

### 11.3 Znane niespójności w źródłach (do rozstrzygnięcia lub udokumentowania)

1. **Balsalobre-Fernández 2016:** abstrakt podaje SMD −1,42 [−2,23; −0,60],
   sekcja wyników −1,43 [−2,23; −0,64]. Rozbieżność w samej publikacji.
2. **Eihara 2022:** ekstrakcja dla HRT/time-trial dała „g = −0,24 [−1,04 do −0,55]" —
   przedział matematycznie niespójny z punktem. **Nie użyto tej liczby.**
   Wartość dla plyometrii (g −0,17 [−0,27; −0,06]) jest spójna.
3. **Chang 2012 vs Chang 2025:** g = 0,097 vs SMD = 0,33 dla tego samego zjawiska;
   2012 znajduje moderację przez intensywność i czas, 2025 jej nie znajduje.
   **Konsekwencja: nie kodować „optymalnej dawki wysiłku dla koncentracji".**
4. **Granero-Gallegos 2020 vs trzy pozostałe meta-analizy HRV.** Jedna znajduje
   istotną przewagę VO₂max (p<0,0001), trzy nie. Outlier ma I²=94,24%.
   **Przyjęto konkluzję większości** (H-1).
5. **Meta-analizy taperu (8–14 dni) vs Smyth 2021 (3 tygodnie u amatorów na maratonie).**
   Rozbieżność wyjaśnialna dystansem i poziomem; w T-5 rozstrzygnięto na korzyść
   dłuższego taperu **tylko dla maratonu**.
6. **Damsted i in. 2018 — DOI.** Automatyczna ekstrakcja podała
   `10.2519/jospt.2014.5164`, co jest w rzeczywistości DOI **Nielsen i in. 2014**
   (JOSPT). Praca Damsteda jest w Int J Sports Phys Ther i cytowana jest tu przez
   PMC6253751. **Nie używać podanego wcześniej DOI dla Damsteda.**
7. **Silva Oliveira 2024 — kompletność danych źródłowych.** Autorzy sami piszą,
   że część włączonych prac nie ujawniła procentowego TID, co czyni
   *„problematic to robustly state which model was in fact followed"*.
   Dotyczy to fundamentu całej sekcji 1.

### 11.4 Ograniczenia populacyjne — gdzie badania dotyczą kogoś innego niż nasz użytkownik

| Temat | Populacja w badaniach | Nasz użytkownik | Ryzyko |
|-------|----------------------|-----------------|--------|
| Rozkład intensywności (klasyka) | Tier 3–5, 130–220 km/tyg., 11–14 sesji | Tier 1–2, 30–70 km/tyg., 3–5 sesji | **Wysokie** — przeniesienie proporcji bez zastrzeżeń jest nadużyciem |
| Double threshold | 1500/5000 m, 150–180 km/tyg., z laktatem | maraton/ultra, bez laktatu | **Bardzo wysokie** — nie implementować |
| Prewencja urazów treningiem siłowym | piłka nożna, rekruci wojskowi | biegacze długodystansowi | **Bardzo wysokie** — nie cytować |
| VILPA i mortalność | osoby **nietrenujące** (n=25 241 non-exercisers) | biegacz w najwyższym kwartylu aktywności | **Wysokie** — nie obiecywać korzyści |
| Interferencja / kolejność sesji | głównie nietrenujący; „no studies on elite athletes" | Tier 1–2 | Średnie |
| HRV-guided | n=16–40 na badanie, często wyłącznie mężczyźni, ≤8 tyg. | oba płcie, horyzont sezonowy | Średnie |
| Costa 2019 (progresja falująca) | tylko mężczyźni, 8 tyg., 30–43 km/tyg., ΔVO₂max +22% (bardzo niska baza) | możliwe wyższe poziomy | Średnie — efekt prawdopodobnie mniejszy u trenowanych |
| Ekonomia biegu / siłownia | Zecchin 2025: VO₂max 49,2 (amatorzy) — **dobra zgodność**; Balsalobre-Fernández: VO₂max >60 | VO₂max ~45–60 | Niskie |
| Kalibracja LT1/LT2 | Nuuttila 2025: N=165, Tier 2, obie płcie — **doskonała zgodność** | — | **Niskie** |
| Taper u amatorów | Smyth 2021: N=158 117 amatorów — **doskonała zgodność** | — | **Niskie** |
| Progi objętości | Fokkema 2020: N=997 amatorów przed startem — **doskonała zgodność** | — | **Niskie** |

---

## 12. Rzeczy zaskakujące — lista do zapamiętania

Podsumowanie tego, co w tym researchu wyszło **sprzecznie z popularną wiedzą
treningową**:

1. **Polaryzacja nie poprawia wyniku** — poprawia VO₂peak (SMD 0,24), ale efekt
   na time trial to dosłownie zero (SMD −0,01). I tylko u highly trained,
   i tylko w interwencjach <12 tygodni.
2. **U amatorów trening próg-centryczny dorównał polaryzacji oszczędzając 17% czasu.**
   „Szara strefa" nie jest u amatorów strefą do unikania.
3. **Najlepszy schemat w RCT to PYR→POL, nie POL** — czyli piramida najpierw,
   polaryzacja przed startem. Zgodnie z praktyką elity, wbrew popularnej wersji „80/20".
4. **Reguła 10% ma RCT, który ją falsyfikuje** (20,8% vs 20,3% urazów przy 10% vs 24%).
   A „>30% = ryzyko" ma CI [0,96; 2,66] — przechodzi przez 1,0.
5. **„Trening siłowy zmniejsza urazy biegowe o 2/3" to statystyka z piłki nożnej
   i wojska.** Jedyna meta-analiza na biegaczach nie znalazła istotnego efektu.
   Za to sygnał ma **nadzór** (compliance 88% vs 47–72%).
6. **VDOT ma błąd 10,43% dla biegaczy powyżej 5 h w maratonie** — przy 4:45 to
   około 30 minut. Jest bardzo dobry (1,11%) dla sub-2:30.
7. **Zegarki systematycznie zawyżają tempo progowe** o 0,98–2,06 km/h.
   Garmin najbardziej (MAPE 25,78%).
8. **Kobiety mają LT1 przy prawie 5 pp wyższym %HRmax niż mężczyźni** (83,6% vs 78,9%).
   Wspólna tabela stref to błąd systematyczny.
9. **Powrót do biegania 48 h po maratonie nie szkodzi, a przyspiesza regenerację
   nerwowo-mięśniową** (SJ 108% vs 100% w 96 h).
10. **Długie wybiegania >35 km nie dają nic więcej niż 30–35 km** — ale <25 km
    kosztuje +13,44 min w maratonie.
11. **Wyższa objętość poprawiała wynik bez wykrywalnego wzrostu ryzyka urazu**
    w kohorcie 997 amatorów przed startem.
12. **Norweski double threshold nie ma ani jednego badania kontrolowanego** —
    autorzy głównego przeglądu piszą to wprost.
13. **Progresja falująca z tygodniem odciążenia po 4 tygodniach dała +22% VO₂max
    vs +11% dla liniowej** — i lepszy profil CK/LDH/testosteron-kortyzol.
14. **Dzień intensywnej pracy umysłowej obniża wytrzymałość o ~15%** — i to całkowicie
    przez percepcję wysiłku, przy identycznych HR, laktacie, VO₂ i rzucie serca.
    Siła i moc pozostają nietknięte.
15. **„Siedzenie skraca zgięciacze i psuje bieganie" nie występuje w żadnym
    z dwóch przeglądów systematycznych czynników ryzyka urazów biegowych.**
16. **Kolejność siła↔bieg w obrębie sesji nie wpływa na adaptację tlenową** —
    wpływa tylko na siłę dynamiczną (WMD 6,91%).
17. **HRV-guided nie daje większych przyrostów formy** (SMD 0,20, n.i.) — daje
    mniej sesji jakościowych przy tym samym wyniku i lepiej zachowaną HRV wagalną.
18. **1 minuta wchodzenia po schodach już poprawia glukozę poposiłkową**;
    10 minut nie było lepsze niż 3.
19. **Sześciomiesięczny RCT nie zmienił zachowań sedentarnych pracowników
    biurowych.** Ostre efekty laboratoryjne nie przekładają się na adherencję.
20. **Rozciąganie nie redukuje urazów** (RR 0,963 [0,846; 1,095]) — mimo że
    jest najczęściej zalecaną „prewencją".

---

*Dokument powstał 2026-08-04 w ramach Fazy 0. Kolejny przegląd: przy zamknięciu
Fazy 1 (weryfikacja pozycji z sekcji 11.1 potrzebnych do implementacji) oraz przy
każdej zmianie reguły w sekcji 10.*
