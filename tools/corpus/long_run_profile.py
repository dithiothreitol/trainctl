# -*- coding: utf-8 -*-
"""Jak trener BUDUJE długie wybieganie?

SPEC §8 przyznaje uproszczenie silnika: „długie wybieganie zawsze czysto
spokojne (trener wplata wstawki tempowe)". To zdanie nigdy nie zostało
zmierzone — tu je sprawdzamy, ZANIM cokolwiek zmienimy w silniku. Wzorzec
z fazy 7: najpierw pomiar na korpusie, potem decyzja (tam korpus obalił
hipotezę o sprawdzianach).

UWAGA METODOLOGICZNA: „najdłuższy bieg tygodnia" to za mało — w tygodniach
o małej objętości najdłuższym biegiem bywa sesja interwałowa. Długim
wybieganiem nazywamy tylko bieg, który jest najdłuższy w tygodniu ORAZ
ma co najmniej LONG_MIN_KM, ORAZ jego trzon nie jest pracą odcinkową.

Uruchomienie: python tools/corpus/long_run_profile.py
Wyjście: liczby na stdout + corpus/parsed/long-run-profile.json (gitignore).
"""
import datetime
import json
import os
import statistics
from collections import Counter

LONG_MIN_KM = 16.0
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
CORPUS = os.path.join(ROOT, 'corpus', 'parsed', 'corpus.json')

with open(CORPUS, encoding='utf-8') as f:
    plans = json.load(f)

# Plany z korpusu nachodzą na siebie — deduplikacja po dacie (jak w parse_plans.py).
by_date = {}
for plan in plans:
    for week in plan['weeks']:
        for day in week['days']:
            if 'workout' in day and day.get('date'):
                by_date[day['date']] = day

def km(day):
    est = day['workout'].get('distance_km_est')
    return est[1] if isinstance(est, list) and len(est) == 2 else 0

def types(day):
    return [s.get('type') for s in day['workout'].get('segments', [])]

# Praca odcinkowa = to NIE jest długie wybieganie, choćby było najdłuższe w tygodniu.
REP_WORK = {'intervals', 'hills', 'pickups'}

weeks = {}
for date, day in by_date.items():
    d = datetime.date.fromisoformat(date)
    monday = (d - datetime.timedelta(days=d.weekday())).isoformat()
    best = weeks.get(monday)
    if best is None or km(day) > km(best):
        weeks[monday] = day

candidates = [d for d in weeks.values() if km(d) >= LONG_MIN_KM]
rep_sessions = [d for d in candidates if any(t in REP_WORK for t in types(d))]
longs = [d for d in candidates if not any(t in REP_WORK for t in types(d))]

print(f'dni z treningiem (po dedupie): {len(by_date)}')
print(f'tygodni: {len(weeks)}')
print(f'najdłuższy bieg ≥{LONG_MIN_KM:.0f} km: {len(candidates)}')
print(f'  z tego praca odcinkowa (NIE długie): {len(rep_sessions)}')
print(f'  prawdziwych długich wybiegań: {len(longs)}')
dist = [km(d) for d in longs]
print(f'mediana długiego: {statistics.median(dist):.1f} km '
      f'(min {min(dist):.0f}, max {max(dist):.0f})')

# --- klasyfikacja struktury długiego ----------------------------------------
EASY_TYPES = {'easy', 'warmup', 'cooldown'}

def classify(day):
    ts = types(day)
    if 'progression' in ts:
        return 'narastające'
    if 'alternating' in ts:
        return 'zmienne'
    if 'steady' in ts:
        return 'w tempie (steady)'
    if all(t in EASY_TYPES for t in ts):
        return 'czysto spokojne'
    return f'inne ({",".join(sorted(set(ts)))})'

kinds = Counter(classify(d) for d in longs)
print()
print('struktura długiego wybiegania:')
for k, v in kinds.most_common():
    print(f'  {k:22s} {v:4d}   {100 * v / len(longs):.0f}%')

pure = kinds.get('czysto spokojne', 0)
print()
print(f'=> czysto spokojne: {100 * pure / len(longs):.0f}%')
print(f'=> z jakąkolwiek pracą szybszą: {100 * (len(longs) - pure) / len(longs):.0f}%')

# --- dzień tygodnia i sąsiedztwo --------------------------------------------
wd = Counter(d.get('weekday') for d in longs)
print()
print('dzień długiego:', dict(wd.most_common()))

after_quality = after_race = 0
for d in longs:
    prev_date = (datetime.date.fromisoformat(d['date']) - datetime.timedelta(days=1)).isoformat()
    prev = by_date.get(prev_date)
    if not prev:
        continue
    if prev['workout'].get('race'):
        after_race += 1
    elif prev['workout'].get('quality'):
        after_quality += 1
n = len(longs)
print(f'nazajutrz po STARCIE   : {after_race} z {n} ({100 * after_race / n:.0f}%)')
print(f'nazajutrz po AKCENCIE  : {after_quality} z {n} ({100 * after_quality / n:.0f}%)')

# --- czy „szybsze" długie są dłuższe czy krótsze od spokojnych? -------------
easy_km = [km(d) for d in longs if classify(d) == 'czysto spokojne']
fast_km = [km(d) for d in longs if classify(d) != 'czysto spokojne']
if easy_km and fast_km:
    print()
    print(f'mediana km — czysto spokojne: {statistics.median(easy_km):.1f}, '
          f'z pracą szybszą: {statistics.median(fast_km):.1f}')

examples = {}
for d in longs:
    k = classify(d)
    if k != 'czysto spokojne' and k not in examples:
        examples[k] = d['workout']['raw'][:230]
print()
print('po jednym przykładzie każdego wzorca:')
for k, v in examples.items():
    print(f'  [{k}] {v}')

out = {
    'longRuns': len(longs),
    'excludedRepSessions': len(rep_sessions),
    'medianKm': statistics.median(dist),
    'structure': dict(kinds),
    'weekday': dict(wd),
    'dayAfterRace': after_race,
    'dayAfterQuality': after_quality,
    'medianKmPureEasy': statistics.median(easy_km) if easy_km else None,
    'medianKmWithFaster': statistics.median(fast_km) if fast_km else None,
    'examples': examples,
}
dest = os.path.join(ROOT, 'corpus', 'parsed', 'long-run-profile.json')
with open(dest, 'w', encoding='utf-8') as f:
    json.dump(out, f, ensure_ascii=False, indent=2)
print(f'\nzapisano: {dest}')
