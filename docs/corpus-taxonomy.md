# Taksonomia jednostek treningowych korpusu

Wyprowadzona ze skanu 50 planów (2020–2025, 189 tygodni). Korpus jest czysto
biegowy — zero jednostek rowerowych/pływackich nawet w okresach startów
triathlonowych (trener prowadził wyłącznie bieganie).

## Struktura pliku planu

```
Tydzień <PIERWSZY|DRUGI|TRZECI|CZWARTY|PIĄTY> <zakres dat>   ← nagłówek tygodnia
PN                                                            ← dzień (osobna linia)
6.10                                                          ← data d.mm (osobna linia
                                                                lub w linii dnia: "PT 4.09")
| <opis treningu>                                             ← trening (linie kontynuacji
                                                                bez markera)
```

Dzień bez opisu = **dzień wolny** (odpoczynek jest jawną częścią metodyki:
~2–3 dni/tydz.). Rok nie występuje w treści — wyprowadzany z nazwy pliku,
z obsługą przełomu roku (`GRUDZIEŃ-STYCZEŃ`) i rozlania na miesiąc sąsiedni
(np. 31.08 w planie wrześniowym).

## Typy segmentów (segment = człon opisu rozdzielony „+" na poziomie zdania)

| Typ | Wzorzec w korpusie | Atrybuty |
|-----|--------------------|----------|
| `warmup` | „3 kilometry (tempo rozgrzewkowe)" | dystans |
| `easy` | „15 km (w tempie spokojnym / bardzo spokojnym)", czasem jawne tempo „czyli 5:20-30 na km", czasem zakres „10-12 km" | dystans (zakres), intensywność, tempo?, pickups? |
| `pickups` (wariant easy) | „20 km (bardzo spokojnie, km numer 3,6,9,12,15 oraz 18 w tempie 4:15)" | jak easy + lista km i tempo wstawek |
| `steady` | „10 km (w tempie 4:30 na km)" — ciągły bieg w tempie | dystans, tempo |
| `progression` | „15 km w tempie narastającym (1-3 km 4:40, 4-6 km 4:35, …)" | dystans, kroki (od-do km, tempo) |
| `alternating` | „15 km biegu zmiennego (na zmianę 1 km w 4:10, na 1 km w 4:50)"; wariant „w takim schemacie: 300 m … i 100 m …" | dystans, tempa (szybkie/wolne), raster |
| `intervals` | „10*1 km (w tempie 4:15), przerwy 2 minutowe w marszu, po 5 odcinku przerwa 4 minutowa"; jednostka dystansowa (m/km) lub czasowa („20*1 minuta", „15*2 minuty"); wariant zagnieżdżony „10*(3 minuty + 1 minuta)" → flaga `nested` | powt., jednostka, tempo, przerwa (typ trucht/marsz, czas/dystans), przerwa śródseryjna |
| `steady_time` | „15 minut (w tempie 4:15 na km), przerwa 3 minutowa" — blok czasowy w tempie | czas, tempo, dystans wyliczony (approx) |
| `time_block` | goły człon czasowy w drabince minutowej „1 minuta + 2 minuty + …" (tempo podane zbiorczo) | czas; dystans nieznany |
| `hills` | „podbiegi: 15*200 metrów (spokojnie/szybko)"; wariant na czas „15*45 sekund (szybko)" → `rep_sec`, bez dystansu | powt., długość lub czas, kwalifikator |
| `hills_drills` | „podbiegi: 30 m skip A + 100 m podbiegu, 30 m wieloskok + …" | surowy łańcuch par ćwiczenie→podbieg |
| `drills` | „siła biegowa: 10*200 m (w tym 50 m skip A + 50 m wieloskok + …)", skip A/C/D, nożyce, żabki, wykroki | surowy opis, suma metrów |
| `strides` | „przebieżki", „po skipach 10*100 metrów (szybko)" | powt., długość |
| `cooldown` | „Na koniec treningu 1 km / 500 metrów truchtu" (niemal każda jednostka jakościowa) | dystans |
| `cross` | „10-12 km crossu (tempo takie abyś odczuł trening)", „50 minut Cross-u" — bieg terenowy wg odczucia | dystans lub czas, opis surowy |
| `strength_session` | „TRENING NA AWF, ĆWICZENIA SPRAWNOŚCIOWO-WZMACNIAJĄCE" (cały dzień siłowy) | opis surowy |
| `race` | „START W FALENICY / NA 100 KM / W ŁEMKOWYNIE"; warianty nietypowe: „ŁEMKOWYNA TRIAL.", „MARATON PARYŻ.", „STAR W…" (literówki) — fallback: cały człon wersalikami + słowo kluczowe | nazwa/dystans surowo |
| `strength_note` | „na zakończeniu każdego podbiegu wykonaj 20 przysiadów" | liczba, ćwiczenie |
| `unparsed` | wszystko, czego nie łapiemy — **zawsze zachowujemy raw** | surowy tekst |

## Konwencje zapisu temp

- „4:15 na km" → 255 s/km; zakres „4:25-30" → 265–270 s/km; „3:50-4:00" → 230–240;
  skrót „tempo 5:15-30" → 315–330.
- „w okolicach / mniej więcej X" → tempo przybliżone (flaga `approx`).
- Liczby dziesiętne po polsku: „2,5 km" → 2.5.

## Reguły metodyczne widoczne w korpusie (do potwierdzenia parserem)

- Tydzień typowy: 4–5 dni biegowych, 2–3 wolne; 1 długie wybieganie (20–30 km),
  1–2 akcenty jakościowe, podbiegi/siła biegowa ~1×/tydz.
- Cooldown 1 km truchtu po KAŻDEJ jednostce jakościowej (sygnatura trenera).
- Taper: tydzień startowy = krótkie spokojne + rozruch; po ultra 2–4 dni ciszy.
- Progresje temp w drabinkach co 5 s/km.

## Schemat JSON (wyjście parsera)

```jsonc
{
  "source_file": "…", "flags": ["recovered", "duplicate_suffix"],
  "anchors": [{"month": 10, "year": 2025}],
  "weeks": [{
    "label": "PIERWSZY", "range_raw": "6-12 PAŹDZIERNIK",
    "days": [{
      "weekday": "ŚR", "date": "2025-10-08",
      "workout": {                     // brak klucza = dzień wolny
        "raw": "…",
        "race": null,                  // albo {"raw": "START W …"}
        "segments": [{"type": "easy", "distance_km": [15, 15], "…": "…"}],
        "distance_km_est": [16.0, 16.0],
        "distance_complete": true,     // false gdy segment bez dystansu
        "quality": false               // czy zawiera akcent
      }
    }]
  }]
}
```
