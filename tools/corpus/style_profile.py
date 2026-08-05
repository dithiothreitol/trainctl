# -*- coding: utf-8 -*-
"""Profil stylu trenera z korpusu — agregaty (bez PII) dla generatora mikrocykli.

Uzycie: python tools/corpus/style_profile.py
Wyjscie: corpus/parsed/style-profile.json + podsumowanie na stdout.
Wartosci trafiaja (recznie, z komentarzem pochodzenia) do
packages/core/src/engine/house-style.ts
"""
import json
import statistics
import sys, io
from collections import Counter, defaultdict
from pathlib import Path

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
ROOT = Path(__file__).resolve().parents[2]

WEEKDAYS = ['PN', 'WT', 'ŚR', 'CZ', 'PT', 'SB', 'ND']
LONG_RUN_MIN_KM = 18.0


def workout_kind(w: dict) -> str:
    types = {s['type'] for s in w['segments']}
    if w.get('race'):
        return 'race'
    if types & {'intervals', 'steady_time', 'time_block'}:
        return 'quality_intervals'
    if types & {'steady', 'progression', 'alternating', 'pickups'}:
        return 'quality_continuous'
    if types & {'hills', 'hills_drills', 'drills'}:
        return 'easy_hills'
    if types & {'cross', 'strength_session'}:
        return 'other'
    dist = w['distance_km_est'][1]
    if dist >= LONG_RUN_MIN_KM:
        return 'long'
    return 'easy'


def main():
    plans = json.loads((ROOT / 'corpus' / 'parsed' / 'corpus.json').read_text(encoding='utf-8'))
    rest = Counter()
    total = Counter()
    kind_by_day = defaultdict(Counter)
    long_kms = []
    long_share = []
    warm_km, cool_km = [], []
    quality_with_warmup = quality_total = quality_with_cooldown = 0
    weekly_quality = []
    weekly_workouts = []

    for p in plans:
        for wk in p['weeks']:
            q = 0
            n_workouts = 0
            week_km = 0.0
            week_long = 0.0
            for d in wk['days']:
                wd = d['weekday']
                total[wd] += 1
                w = d.get('workout')
                if not w:
                    rest[wd] += 1
                    continue
                n_workouts += 1
                kind = workout_kind(w)
                kind_by_day[wd][kind] += 1
                dist = (w['distance_km_est'][0] + w['distance_km_est'][1]) / 2
                week_km += dist
                if kind == 'long':
                    long_kms.append(dist)
                    week_long = max(week_long, dist)
                if kind in ('quality_intervals', 'quality_continuous'):
                    q += 1
                    quality_total += 1
                    for s in w['segments']:
                        if s['type'] == 'warmup':
                            quality_with_warmup += 1
                            if s.get('distance_km'):
                                warm_km.append(s['distance_km'][0])
                            break
                    for s in w['segments']:
                        if s['type'] == 'cooldown':
                            quality_with_cooldown += 1
                            if s.get('distance_km'):
                                cool_km.append(s['distance_km'][0])
                            break
            if n_workouts:
                weekly_quality.append(q)
                weekly_workouts.append(n_workouts)
                if week_long and week_km:
                    long_share.append(week_long / week_km)

    profile = {
        'rest_probability_by_weekday': {
            wd: round(rest[wd] / total[wd], 3) for wd in WEEKDAYS
        },
        'kind_distribution_by_weekday': {
            wd: dict(kind_by_day[wd].most_common()) for wd in WEEKDAYS
        },
        'long_run': {
            'median_km': round(statistics.median(long_kms), 1),
            'p90_km': round(sorted(long_kms)[int(0.9 * len(long_kms))], 1),
            'median_share_of_week': round(statistics.median(long_share), 3),
        },
        'quality': {
            'median_per_week': statistics.median(weekly_quality),
            'warmup_rate': round(quality_with_warmup / quality_total, 3),
            'cooldown_rate': round(quality_with_cooldown / quality_total, 3),
            'warmup_median_km': statistics.median(warm_km),
            'cooldown_median_km': statistics.median(cool_km),
        },
        'workouts_per_week_median': statistics.median(weekly_workouts),
    }
    out = ROOT / 'corpus' / 'parsed' / 'style-profile.json'
    out.write_text(json.dumps(profile, ensure_ascii=False, indent=1), encoding='utf-8')
    print(json.dumps(profile, ensure_ascii=False, indent=1))


if __name__ == '__main__':
    main()
