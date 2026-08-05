# -*- coding: utf-8 -*-
"""Jak trener wplata STARTY w plan — agregaty (bez PII) pod reguly W-11..W-13.

Pytanie badawcze fazy 7: czy trener planuje "sprawdziany" (time trial), czy
zamiast tego uzywa prawdziwych startow jako kalibracji formy? Wynik idzie do
docs/science/FOUNDATIONS.md sekcja 10 (W-11..W-13) i do ADR.

Uzycie: python tools/corpus/race_profile.py
Wyjscie: corpus/parsed/race-profile.json + podsumowanie na stdout.
"""
import json
import re
import statistics
import sys, io
from collections import Counter
from datetime import date
from pathlib import Path

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
ROOT = Path(__file__).resolve().parents[2]

WEEKDAYS = ['PN', 'WT', 'ŚR', 'CZ', 'PT', 'SB', 'ND']
# slownictwo "sprawdzianu" — sprawdzamy, czy w ogole wystepuje
TT_WORDS = re.compile(r'sprawdzian|kontroln|na czas|test\b|próba czasowa', re.I)


def parse(d: str) -> date:
    y, m, dd = (int(x) for x in d.split('-'))
    return date(y, m, dd)


def main():
    plans = json.loads((ROOT / 'corpus' / 'parsed' / 'corpus.json').read_text(encoding='utf-8'))

    # dedupe po dacie: pliki miesieczne zachodza na siebie
    by_date = {}
    for p in plans:
        for wk in p['weeks']:
            for d in wk['days']:
                w = d.get('workout')
                if not w:
                    by_date.setdefault(d['date'], None)
                    continue
                prev = by_date.get(d['date'])
                if prev is None:
                    by_date[d['date']] = {'weekday': d['weekday'], **w}

    days = dict(sorted(by_date.items()))
    dates = list(days)

    races = [(dt, v) for dt, v in days.items() if v and v.get('race') is not None]
    tt_hits = [dt for dt, v in days.items() if v and TT_WORDS.search(v.get('raw', ''))]

    weekday_of_race = Counter(v['weekday'] for _, v in races)

    # odstepy miedzy kolejnymi startami [dni]
    race_dates = [parse(dt) for dt, _ in races]
    gaps = [(b - a).days for a, b in zip(race_dates, race_dates[1:]) if (b - a).days > 0]

    # co dzien przed i po starcie
    before, after = Counter(), Counter()
    for dt, _ in races:
        i = dates.index(dt)
        for off, counter in ((-1, before), (1, after)):
            j = i + off
            if 0 <= j < len(dates):
                nb = days[dates[j]]
                counter['wolne' if nb is None else 'trening'] += 1

    # dystanse startow, jesli parser je wychwycil
    named = Counter()
    for _, v in races:
        m = re.search(r'START\s+(?:W|NA)\s+([^.,]+)', v.get('raw', ''), re.I)
        if m:
            named[m.group(1).strip().lower()] += 1

    profile = {
        'days_covered': len(dates),
        'span': [dates[0], dates[-1]],
        'races_total': len(races),
        'race_time_trial_mentions': len(tt_hits),
        'races_per_year': round(len(races) / ((parse(dates[-1]) - parse(dates[0])).days / 365.25), 1),
        'weekday_distribution': {wd: weekday_of_race[wd] for wd in WEEKDAYS if weekday_of_race[wd]},
        'gap_days': {
            'median': statistics.median(gaps) if gaps else None,
            'min': min(gaps) if gaps else None,
            'max': max(gaps) if gaps else None,
            'p25': sorted(gaps)[len(gaps) // 4] if gaps else None,
        },
        'day_before': dict(before),
        'day_after': dict(after),
        'recurring_events': dict(named.most_common(8)),
    }
    out = ROOT / 'corpus' / 'parsed' / 'race-profile.json'
    out.write_text(json.dumps(profile, ensure_ascii=False, indent=1), encoding='utf-8')
    print(json.dumps(profile, ensure_ascii=False, indent=1))


if __name__ == '__main__':
    main()
