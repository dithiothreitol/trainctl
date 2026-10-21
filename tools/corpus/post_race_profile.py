# -*- coding: utf-8 -*-
"""Co trener planuje PO starcie na dystansie półmaratonu i dłuższym?

Pytanie pod regułę bloku przejściowego (docs/PLAN-v0.4.md, E2): makrocykl kończy
się dziś tygodniem startu, a dzień po starcie `today` mówi „poza planem". Zanim
silnik dostanie blok po starcie, mierzymy, jak trener z korpusu rozpisywał dwa
tygodnie po długich startach: objętość względem tygodni przed startem, liczbę
sesji i dzień pierwszego akcentu. Wzorzec z fazy 7: najpierw pomiar, potem kod.

Agregaty bez PII. Uruchomienie: python -I tools/corpus/post_race_profile.py
Wyjście: liczby na stdout + corpus/parsed/post-race-profile.json (gitignore).
"""
import io
import json
import re
import statistics
import sys
from datetime import date, timedelta
from pathlib import Path

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
ROOT = Path(__file__).resolve().parents[2]
QUALITY = {'intervals', 'hills', 'progression', 'alternating', 'steady', 'steady_time', 'time_block', 'pickups', 'hills_drills'}
MIN_RACE_KM = 21.0
HORIZON = 14


def race_km(workout):
    race = workout.get('race') or {}
    if isinstance(race.get('distance_km'), (int, float)):
        return float(race['distance_km'])
    raw = (race.get('raw') or workout.get('raw') or '').upper()
    if re.search(r'P[OÓ]{1}[ŁL]MARATON|HALF', raw):
        return 21.0975
    if re.search(r'MARATON', raw):
        return 42.195
    m = re.search(r'(\d{2,3})\s*KM', raw)
    return float(m.group(1)) if m else None


def km(workout):
    est = workout.get('distance_km_est')
    return est[1] if isinstance(est, list) and len(est) == 2 else 0.0


def main():
    plans = json.loads((ROOT / 'corpus' / 'parsed' / 'corpus.json').read_text(encoding='utf-8'))
    days = {}
    for p in plans:
        for wk in p['weeks']:
            for d in wk['days']:
                if d['date'] not in days or days[d['date']] is None:
                    days[d['date']] = d.get('workout')

    def at(d):
        return days.get(d.isoformat(), 'missing')

    rows = []
    for iso, w in sorted(days.items()):
        if not w or w.get('race') is None:
            continue
        distance = race_km(w)
        if distance is None or distance < MIN_RACE_KM:
            continue
        race_day = date.fromisoformat(iso)
        after = [at(race_day + timedelta(days=i)) for i in range(1, HORIZON + 1)]
        if any(x == 'missing' for x in after):
            continue  # plan miesięczny skończył się przed końcem okna — bez zgadywania
        before = [at(race_day - timedelta(days=i)) for i in range(8, 36)]  # 4 tygodnie przed tygodniem startu
        if sum(1 for x in before if x == 'missing') > 7:
            continue
        base = sum(km(x) for x in before if x and x != 'missing') / 4
        week1 = [x for x in after[:7] if x]
        week2 = [x for x in after[7:] if x]
        first_quality = next((i + 1 for i, x in enumerate(after)
                              if x and x.get('race') is None and any(s.get('type') in QUALITY for s in x.get('segments', []))), None)
        next_race = next((i + 1 for i, x in enumerate(after) if x and x.get('race') is not None), None)
        rows.append({
            'distance_km': round(distance, 1),
            'base_km': round(base, 1),
            'week1_ratio': round(sum(km(x) for x in week1) / base, 2) if base else None,
            'week2_ratio': round(sum(km(x) for x in week2) / base, 2) if base else None,
            'week1_sessions': len(week1),
            'week2_sessions': len(week2),
            'first_run_day': next((i + 1 for i, x in enumerate(after) if x), None),
            'first_quality_day': first_quality,
            'next_race_day': next_race,
        })

    def med(key, group=rows):
        values = [r[key] for r in group if r[key] is not None]
        return statistics.median(values) if values else None

    marathons = [r for r in rows if r['distance_km'] >= 40]
    halves = [r for r in rows if r['distance_km'] < 40]
    profile = {
        'races_measured': len(rows),
        'marathon_or_longer': len(marathons),
        'half': len(halves),
        'median': {k: med(k) for k in ['week1_ratio', 'week2_ratio', 'week1_sessions', 'week2_sessions', 'first_run_day', 'first_quality_day']},
        'median_marathon_or_longer': {k: med(k, marathons) for k in ['week1_ratio', 'week2_ratio', 'week1_sessions', 'first_run_day', 'first_quality_day']},
        'median_half': {k: med(k, halves) for k in ['week1_ratio', 'week2_ratio', 'week1_sessions', 'first_run_day', 'first_quality_day']},
        'quality_within_14_days': sum(1 for r in rows if r['first_quality_day'] is not None),
        'another_race_within_14_days': sum(1 for r in rows if r['next_race_day'] is not None),
    }
    out = ROOT / 'corpus' / 'parsed' / 'post-race-profile.json'
    out.write_text(json.dumps({'profile': profile, 'rows': rows}, ensure_ascii=False, indent=1), encoding='utf-8')
    print(json.dumps(profile, ensure_ascii=False, indent=1))


if __name__ == '__main__':
    main()
