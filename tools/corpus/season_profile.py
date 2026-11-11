# -*- coding: utf-8 -*-
"""Pomiary pod silnik 0.7 (docs/PLAN-v0.7.md, etap 1): jak trener buduje sezon.

Cztery pytania z punktów „Nauka" planu, każde przed zmianą kodu:
  A. liczba biegów i najdłuższy bieg spokojny względem długiego (B1, B2),
  B. trajektoria objętości przed startem docelowym ≥ półmaraton (B3),
  C. dawka akcentów w funkcji tygodni do startu i praca ciągła w tempie (B5),
  D. kolejność weekendu: co wypada dzień po długim, co po starcie B/C (B6).

Agregaty bez PII (bez nazw startów i dat). Uruchomienie:
    python -I tools/corpus/season_profile.py
Wyjście: liczby na stdout + corpus/parsed/season-profile.json (gitignore).
"""
import io
import json
import statistics
import sys
from collections import Counter, defaultdict
from datetime import date, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
# `python -I` nie dodaje katalogu skryptu do sys.path — dodajemy własny katalog jawnie
sys.path.insert(0, str(Path(__file__).resolve().parent))
from races import race_km  # noqa: E402  (wspólna reguła startów, races.py)
REP_WORK = {'intervals', 'hills', 'pickups', 'hills_drills', 'time_block', 'steady_time'}
EASY = {'easy', 'warmup', 'cooldown'}
NON_RUN = {'cross', 'strength_session'}
LONG_MIN_KM = 12.0


def km(w):
    est = w.get('distance_km_est') if w else None
    return float(est[1]) if isinstance(est, list) and len(est) == 2 else 0.0


def types(w):
    return [s.get('type') for s in w.get('segments', [])]


def is_run(w):
    segments = set(types(w)) if w else set()
    # brak rozpoznanych segmentów to nadal bieg, jeśli ma dystans
    return bool(w) and not w.get('race') and km(w) > 0 and not (segments and segments <= NON_RUN)


def segment_km(s):
    """Górna granica dystansu segmentu; niepełny albo pusty zapis to 0, nie wyjątek."""
    d = s.get('distance_km')
    return float(d[1]) if isinstance(d, list) and len(d) == 2 and isinstance(d[1], (int, float)) else 0.0


def hard_km(w):
    """Kilometry poza Z1: wszystko poza rozgrzewką, schłodzeniem i spokojnym biegiem; podbiegi w połowie."""
    total = 0.0
    for s in w.get('segments', []):
        t = s.get('type')
        dist = segment_km(s)
        if t in EASY or t in NON_RUN:
            continue
        total += dist / 2 if t in ('hills', 'hills_drills') else dist
    return total


def p90(xs):
    xs = sorted(xs)
    return round(xs[int(0.9 * (len(xs) - 1))], 2) if xs else None


def med(xs):
    return round(statistics.median(xs), 2) if xs else None


def main():
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
    plans = json.loads((ROOT / 'corpus' / 'parsed' / 'corpus.json').read_text(encoding='utf-8'))
    days = {}
    for p in plans:
        for wk in p['weeks']:
            for d in wk['days']:
                if not d.get('date'):
                    continue
                if d['date'] not in days or days[d['date']] is None:
                    days[d['date']] = d.get('workout')

    weeks = defaultdict(dict)
    for iso, w in days.items():
        d = date.fromisoformat(iso)
        weeks[(d - timedelta(days=d.weekday())).isoformat()][d.weekday()] = w
    complete = {m: ws for m, ws in weeks.items() if len(ws) == 7}

    def long_of(ws):
        runs = [w for w in ws.values() if is_run(w) and not set(types(w)) & REP_WORK]
        best = max(runs, key=km, default=None)
        return best if best is not None and km(best) >= LONG_MIN_KM else None

    # ---------------------------------------------------------------- A
    bins = [(0, 30), (30, 40), (40, 50), (50, 60), (60, 70), (70, 999)]
    a = {}
    for lo, hi in bins:
        rows = []
        for ws in complete.values():
            total = sum(km(w) for w in ws.values() if is_run(w))
            if not (lo <= total < hi) or any(w and w.get('race') for w in ws.values()):
                continue
            runs = [w for w in ws.values() if is_run(w)]
            long = long_of(ws)
            other_easy = [km(w) for w in runs if w is not long and set(types(w)) <= EASY]
            quality = [w for w in runs if w.get('quality')]
            rows.append({
                'runs': len(runs), 'quality': len(quality),
                'ratio': (max(other_easy) / km(long)) if long and other_easy else None,
                'longShare': km(long) / total if long and total else None,
                'maxShareNonLong': max((km(w) / total for w in runs if w is not long), default=0) if total else None,
            })
        a[f'{lo}-{hi if hi < 999 else "+"}'] = {
            'weeks': len(rows),
            'medianRuns': med([r['runs'] for r in rows]),
            'runsDistribution': dict(sorted(Counter(r['runs'] for r in rows).items())),
            'medianQuality': med([r['quality'] for r in rows]),
            # „długie" to tu najdłuższy bieg bez pracy odcinkowej, więc stosunek ≤ 1 z definicji;
            # mierzymy, jak daleko pod długim zostaje najdłuższy inny bieg spokojny
            'medianLongestEasyToLong': med([r['ratio'] for r in rows if r['ratio'] is not None]),
            'p90LongestEasyToLong': p90([r['ratio'] for r in rows if r['ratio'] is not None]),
            'medianLongShare': med([r['longShare'] for r in rows if r['longShare']]),
            'p90MaxShareNonLong': p90([r['maxShareNonLong'] for r in rows if r['maxShareNonLong'] is not None]),
        }
    print('A. liczba biegów i długie według objętości tygodnia (tygodnie pełne, bez startów)')
    for k, v in a.items():
        print(f'  {k:>6} km: {v}')

    # ---------------------------------------------------------------- B i C
    goal_races = []
    for iso, w in sorted(days.items()):
        if w and w.get('race'):
            dist = race_km(w)
            if dist is not None and dist >= 21:
                goal_races.append((iso, dist))
    traj = defaultdict(list)
    peak_offsets = []
    long_traj = defaultdict(list)
    dose = defaultdict(list)
    steady_blocks = defaultdict(list)
    for iso, dist in goal_races:
        race_monday = date.fromisoformat(iso) - timedelta(days=date.fromisoformat(iso).weekday())
        series = {}
        for off in range(1, 17):
            m = (race_monday - timedelta(weeks=off)).isoformat()
            if m in complete:
                series[off] = complete[m]
        if len(series) < 10:
            continue
        totals = {off: sum(km(w) for w in ws.values() if is_run(w)) for off, ws in series.items()}
        peak = max(totals.values())
        if peak <= 0:
            continue
        peak_offsets.append(max(totals, key=lambda o: (totals[o], o)))
        for off, t in totals.items():
            traj[off].append(t / peak)
            long = long_of(series[off])
            if long:
                long_traj[off].append(km(long))
            for w in series[off].values():
                if is_run(w) and w.get('quality'):
                    band = '13-16' if off >= 13 else '9-12' if off >= 9 else '5-8' if off >= 5 else '1-4'
                    dose[band].append(hard_km(w))
                    for s in w.get('segments', []):
                        dist = segment_km(s)
                        if s.get('type') in ('steady', 'progression') and dist >= 5:
                            steady_blocks[band].append(dist)
    b = {
        'races': len(peak_offsets),
        'peakWeekBeforeRace': dict(sorted(Counter(peak_offsets).items())),
        'medianShareOfPeak': {off: med(traj[off]) for off in sorted(traj, reverse=True)},
        'medianLongKm': {off: med(long_traj[off]) for off in sorted(long_traj, reverse=True)},
    }
    c = {band: {'sessions': len(dose[band]), 'medianHardKm': med(dose[band]),
                'continuousBlocks5kmPlus': len(steady_blocks[band]), 'medianBlockKm': med(steady_blocks[band])}
         for band in ['13-16', '9-12', '5-8', '1-4']}
    print('\nB. trajektoria objętości przed startem ≥ 21 km (tydzień startu = 0)')
    print(f'  startów z ≥10 pełnymi tygodniami przed: {b["races"]}; tydzień szczytu: {b["peakWeekBeforeRace"]}')
    print('  mediana udziału szczytu:', b['medianShareOfPeak'])
    print('  mediana długiego [km]:', b['medianLongKm'])
    print('\nC. dawka akcentów według tygodni do startu')
    for k, v in c.items():
        print(f'  {k:>5} tyg.: {v}')

    # ---------------------------------------------------------------- D
    def kind(ws, wd, lw):
        w = ws.get(wd)
        if not w or km(w) <= 0 and not w.get('race'):
            return 'wolne'
        if w.get('race'):
            return 'start'
        if w is lw:
            return 'długie'
        if w.get('quality'):
            return 'akcent'
        return 'spokojne' if is_run(w) else 'inne'

    pairs = Counter()
    after_long = Counter()
    sunday_after_sat_race = []
    longs = []
    for m, ws in complete.items():
        lw = long_of(ws)  # raz na tydzień, nie przy każdym dniu
        pairs[(kind(ws, 5, lw), kind(ws, 6, lw))] += 1
        if lw:
            longs.append(km(lw))
        for wd in range(7):
            if kind(ws, wd, lw) != 'długie':
                continue
            if wd < 6:
                after_long[kind(ws, wd + 1, lw)] += 1
            else:
                # niedzielne długie: dzień po nim to poniedziałek następnego tygodnia
                nxt = (date.fromisoformat(m) + timedelta(days=7)).isoformat()
                if nxt in complete:
                    after_long[kind(complete[nxt], 0, long_of(complete[nxt]))] += 1
        if kind(ws, 5, lw) == 'start' and ws.get(6) and is_run(ws[6]):
            sunday_after_sat_race.append(km(ws[6]))
    d = {
        'saturdaySundayPairs': {f'{s}→{n}': v for (s, n), v in pairs.most_common(12)},
        'dayAfterLong': dict(after_long.most_common()),
        'sundayRunAfterSaturdayRace': {'n': len(sunday_after_sat_race), 'medianKm': med(sunday_after_sat_race)},
        'medianLongKm': med(longs),
    }
    print('\nD. weekend (sobota→niedziela) i dzień po długim')
    for k, v in d.items():
        print(f'  {k}: {v}')

    out = {'A_sessionsByVolume': a, 'B_volumeTrajectory': b, 'C_qualityDose': c, 'D_weekend': d}
    dest = ROOT / 'corpus' / 'parsed' / 'season-profile.json'
    dest.write_text(json.dumps(out, ensure_ascii=False, indent=2), encoding='utf-8')
    print(f'\nzapisano: {dest}')


if __name__ == '__main__':
    main()
