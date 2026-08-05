# -*- coding: utf-8 -*-
"""Parser korpusu: corpus/raw-text/*.txt -> corpus/parsed/ (JSON + REPORT.md).

Taksonomia: docs/corpus-taxonomy.md
Uzycie:     python tools/corpus/parse_plans.py
"""
from __future__ import annotations

import json
import re
import sys
import io
import statistics
from datetime import date, timedelta
from pathlib import Path

if __name__ == '__main__':  # bezpieczne polskie znaki w konsoli Windows
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / 'corpus' / 'raw-text'
DST = ROOT / 'corpus' / 'parsed'

# ---------------------------------------------------------------- normalizacja

_DIA = str.maketrans('ąćęłńóśźżĄĆĘŁŃÓŚŹŻ', 'acelnoszzACELNOSZZ')


def norm(s: str) -> str:
    return s.translate(_DIA).upper()


MONTHS = {}
for i, names in enumerate([
    ('STYCZEN', 'STYCZNIA'), ('LUTY', 'LUTEGO'), ('MARZEC', 'MARCA'),
    ('KWIECIEN', 'KWIETNIA'), ('MAJ', 'MAJA'), ('CZERWIEC', 'CZERWCA'),
    ('LIPIEC', 'LIPCA'), ('SIERPIEN', 'SIERPNIA'), ('WRZESIEN', 'WRZESNIA'),
    ('PAZDZIERNIK', 'PAZDZIERNIKA'), ('LISTOPAD', 'LISTOPADA'),
    ('GRUDZIEN', 'GRUDNIA'),
], start=1):
    for n in names:
        MONTHS[n] = i

# ---------------------------------------------------------------- nazwa pliku


def parse_filename(stem: str) -> dict:
    """Kotwice (miesiac, rok) + flagi z nazwy pliku."""
    n = norm(stem)
    flags = []
    if 'ODZYSKANY' in n:
        flags.append('recovered')
    if re.search(r'\(\d+\)', stem):
        flags.append('duplicate_suffix')
    year_m = re.search(r'\b(20\d{2})\b', n)
    base_year = int(year_m.group(1)) if year_m else None
    months = []
    for tok in re.findall(r'[A-Z]+', n):
        if tok in MONTHS:
            months.append(MONTHS[tok])
    anchors = []
    year = base_year
    prev = None
    for m in months:
        if prev is not None and m < prev:  # przelom roku (12 -> 1)
            year += 1
        anchors.append({'month': m, 'year': year})
        prev = m
    return {'anchors': anchors, 'flags': flags}


def resolve_date(day: int, month: int, anchors: list[dict]) -> str | None:
    """Rok dla daty d.mm: minimalna odleglosc od srodka miesiaca-kotwicy."""
    if not anchors or not anchors[0]['year']:
        return None
    best, best_dist = None, None
    years = set()
    for a in anchors:
        years.update((a['year'] - 1, a['year'], a['year'] + 1))
    for y in years:
        try:
            d = date(y, month, day)
        except ValueError:
            continue
        for a in anchors:
            dist = abs((d - date(a['year'], a['month'], 15)).days)
            if best_dist is None or dist < best_dist:
                best, best_dist = d, dist
    return best.isoformat() if best else None

# ---------------------------------------------------------------- liczby/tempa

PACE_RE = re.compile(r'(\d):(\d{2})(?:\s*-\s*(\d:\d{2}|\d{2}))?')
DIST_RE = re.compile(
    r'(\d+(?:,\d+)?)(?:\s*-\s*(\d+(?:,\d+)?))?\s*(kilometr\w*|km\b|metr\w*)',
    re.IGNORECASE)
INTERVAL_RE = re.compile(
    r'(\d+)\s*\*\s*(\d+(?:,\d+)?)\s*(kilometr\w*|km\b|metr\w*|minut\w*|sekund\w*)',
    re.IGNORECASE)
RECOV_RE = re.compile(
    r'przerw\w*\s+(\d+(?:,\d+)?)\s*(minutow\w*|metrow\w*|kilometrow\w*)'
    r'(?:\s+w\s+((?:bardzo\s+wolnym\s+)?truchcie|marszu))?', re.IGNORECASE)
MIDSET_RE = re.compile(
    r'po\s+(\d+)(?:\s+i\s+(\d+))?\s+odcinku\s+przerw\w*\s+(\d+(?:,\d+)?)\s*'
    r'minutow\w*(?:\s+w\s+(truchcie|marszu))?', re.IGNORECASE)
STEP_RE = re.compile(r'(\d+)\s*-\s*(\d+)\s*km\s+(\d):(\d{2})')
COOLDOWN_RE = re.compile(
    r'Na koniec treningu,?\s+(\d+(?:,\d+)?)\s*(kilometr\w*|km\b|metr\w*)'
    r'\s+(?:bardzo\s+wolnego\s+)?truchtu\.?', re.IGNORECASE)
SQUATS_RE = re.compile(r'(\d+)\s+przysiad\w*', re.IGNORECASE)
DRILL_KW = re.compile(r'skip\w*|wieloskok\w*|no[zż]yc\w*|[zż]abek|wykrok\w*|si[lł]a biegowa',
                      re.IGNORECASE)
TIME_RE = re.compile(r'^(\d+(?:,\d+)?)\s*minut\w*', re.IGNORECASE)
NESTED_RE = re.compile(r'(\d+)\s*\*\s*\(')
RACE_KW = re.compile(r'STAR\w*|MARATON|P[OÓ][LŁ]MARATON|[LŁ]EMKOWYNA|TRIAL|TRAIL|BIEG\w*')
STRENGTH_KW = re.compile(r'AWF|SPRAWNO|WZMACN|SI[LŁ]OWN')


def caps_only(s: str) -> bool:
    letters = re.sub(r'[^A-Za-zĄĆĘŁŃÓŚŹŻąćęłńóśźż]', '', s)
    return bool(letters) and letters == letters.upper()


def num(s: str) -> float:
    return float(s.replace(',', '.'))


def parse_pace(text: str) -> dict | None:
    """'4:15 na km' -> 255 s/km; '4:25-30' -> (265, 270); '3:50-4:00' -> (230, 240)."""
    m = PACE_RE.search(text)
    if not m:
        return None
    lo = int(m.group(1)) * 60 + int(m.group(2))
    hi = lo
    if m.group(3):
        g = m.group(3)
        hi = (int(g.split(':')[0]) * 60 + int(g.split(':')[1])) if ':' in g \
            else int(m.group(1)) * 60 + int(g)
    approx = bool(re.search(r'okolicach|mniej wi[eę]cej|oko[lł]o', text, re.IGNORECASE))
    return {'sec_per_km': [lo, hi], 'approx': approx}


def to_km(value: float, unit: str) -> float:
    return value / 1000.0 if unit.lower().startswith('m') and not unit.lower().startswith('km') \
        else value


def parse_dist(text: str) -> list[float] | None:
    """Pierwszy dystans w tekscie -> [lo_km, hi_km]."""
    m = DIST_RE.search(text)
    if not m:
        return None
    lo = to_km(num(m.group(1)), m.group(3))
    hi = to_km(num(m.group(2)), m.group(3)) if m.group(2) else lo
    return [lo, hi]


def parse_recovery(text: str) -> dict | None:
    rec = None
    m = RECOV_RE.search(text)
    if m:
        unit = m.group(2).lower()
        rec = {'value': num(m.group(1)),
               'unit': 'min' if unit.startswith('minut') else 'm' if unit.startswith('metr') else 'km',
               'mode': ('walk' if m.group(3) and 'marsz' in m.group(3).lower()
                        else 'jog' if m.group(3) else None)}
    ms = MIDSET_RE.search(text)
    if ms:
        rec = rec or {}
        rec['midset'] = {'after_reps': [int(g) for g in (ms.group(1), ms.group(2)) if g],
                         'minutes': num(ms.group(3)),
                         'mode': ('walk' if ms.group(4) and 'marsz' in ms.group(4).lower()
                                  else 'jog' if ms.group(4) else None)}
    return rec

# ---------------------------------------------------------------- segmentacja


def split_top(text: str) -> list[str]:
    """Podzial na '+' poza nawiasami."""
    parts, buf, depth = [], [], 0
    for ch in text:
        if ch == '(':
            depth += 1
        elif ch == ')':
            depth = max(0, depth - 1)
        if ch == '+' and depth == 0:
            parts.append(''.join(buf).strip())
            buf = []
        else:
            buf.append(ch)
    parts.append(''.join(buf).strip())
    return [p for p in parts if p]


def merge_complexes(chunks: list[str]) -> list[str]:
    """Laczy lancuchy 'podbiegi: 30 m skip A + 100 m podbiegu, ...' w jeden segment."""
    def member(c: str) -> bool:
        return bool(DRILL_KW.search(c) or re.search(r'podbieg', c, re.IGNORECASE))
    out: list[str] = []
    for c in chunks:
        if out and member(c) and member(out[-1]):
            out[-1] = out[-1] + ' + ' + c
        else:
            out.append(c)
    return out


def classify_segment(chunk: str) -> dict:
    c = chunk
    low = c.lower()
    seg: dict = {'raw': c}

    if re.search(r'podbieg', low):
        seg['type'] = 'hills_drills' if DRILL_KW.search(c) else 'hills'
        iv = INTERVAL_RE.search(c)
        if iv and seg['type'] == 'hills':
            seg['reps'] = int(iv.group(1))
            unit = iv.group(3).lower()
            if unit.startswith(('minut', 'sekund')):  # podbiegi na czas
                seg['rep_sec'] = num(iv.group(2)) * (60 if unit.startswith('minut') else 1)
            else:
                seg['rep_m'] = to_km(num(iv.group(2)), iv.group(3)) * 1000
                seg['distance_km'] = [seg['reps'] * seg['rep_m'] / 1000] * 2
                seg['approx_distance'] = True  # bez zbiegow
        q = re.search(r'\((spokojnie|szybko|bardzo szybko|mocno)\)', low)
        if q:
            seg['qualifier'] = q.group(1)
        return seg

    if DRILL_KW.search(c):
        seg['type'] = 'drills'
        meters = sum(int(m.group(1)) * to_km(num(m.group(2)), m.group(3)) * 1000
                     for m in INTERVAL_RE.finditer(c)
                     if not m.group(3).lower().startswith(('minut', 'sekund')))
        if meters:
            seg['distance_km'] = [meters / 1000] * 2
            seg['approx_distance'] = True
        return seg

    if re.search(r'zmienn|schemacie', low):
        seg['type'] = 'alternating'
        seg['distance_km'] = parse_dist(c)
        paces = [int(m.group(1)) * 60 + int(m.group(2)) for m in PACE_RE.finditer(c)]
        if paces:
            seg['pace_fast'], seg['pace_slow'] = min(paces), max(paces)
        return seg

    if re.search(r'narastaj', low):
        seg['type'] = 'progression'
        seg['distance_km'] = parse_dist(c)
        seg['steps'] = [{'from_km': int(m.group(1)), 'to_km': int(m.group(2)),
                         'sec_per_km': int(m.group(3)) * 60 + int(m.group(4))}
                        for m in STEP_RE.finditer(c)]
        return seg

    if re.search(r'rozgrzewkow', low):
        seg['type'] = 'warmup'
        seg['distance_km'] = parse_dist(c)
        return seg

    if re.search(r'\bcross', low):
        seg['type'] = 'cross'
        seg['distance_km'] = parse_dist(c)
        return seg

    nested = NESTED_RE.search(c)
    if nested:
        seg['type'] = 'intervals'
        seg['nested'] = True
        seg['reps'] = int(nested.group(1))
        seg['pace'] = parse_pace(c)
        rec = parse_recovery(c)
        if rec:
            seg['recovery'] = rec
        return seg

    iv = INTERVAL_RE.search(c)
    if iv:
        seg['type'] = 'intervals'
        seg['reps'] = int(iv.group(1))
        unit = iv.group(3).lower()
        if unit.startswith(('minut', 'sekund')):
            minutes = num(iv.group(2)) * (1 / 60 if unit.startswith('sekund') else 1)
            seg['rep_min'] = minutes
            pace = parse_pace(c)
            if pace:
                mid = sum(pace['sec_per_km']) / 2
                seg['distance_km'] = [seg['reps'] * minutes * 60 / mid] * 2
                seg['approx_distance'] = True
        else:
            seg['rep_m'] = to_km(num(iv.group(2)), iv.group(3)) * 1000
            seg['distance_km'] = [seg['reps'] * seg['rep_m'] / 1000] * 2
        seg['pace'] = parse_pace(c)
        rec = parse_recovery(c)
        if rec:
            seg['recovery'] = rec
        return seg

    if re.search(r'spokojn', low):
        seg['type'] = 'easy'
        seg['distance_km'] = parse_dist(c)
        seg['intensity'] = 'very_easy' if re.search(r'bardzo\s+spokojn', low) else 'easy'
        pace = parse_pace(c)
        if pace:
            seg['pace'] = pace
        if re.search(r'km numer', low):
            seg['type'] = 'pickups'
        return seg

    if re.search(r'przebie[zż]k', low):
        seg['type'] = 'strides'
        return seg

    if re.search(r'truchtu', low) and DIST_RE.match(c):
        seg['type'] = 'cooldown'
        seg['distance_km'] = parse_dist(c)
        return seg

    pace = parse_pace(c)
    dist = parse_dist(c)
    if pace and dist:
        seg['type'] = 'steady'
        seg['distance_km'] = dist
        seg['pace'] = pace
        return seg

    tm = TIME_RE.match(c)
    if tm:
        minutes = num(tm.group(1))
        seg['duration_min'] = minutes
        if pace:
            mid = sum(pace['sec_per_km']) / 2
            seg['type'] = 'steady_time'
            seg['pace'] = pace
            seg['distance_km'] = [round(minutes * 60 / mid, 2)] * 2
            seg['approx_distance'] = True
        else:
            seg['type'] = 'time_block'
        rec = parse_recovery(c)
        if rec:
            seg['recovery'] = rec
        return seg

    if caps_only(c):
        if STRENGTH_KW.search(norm(c)):
            seg['type'] = 'strength_session'
            return seg
        if RACE_KW.search(norm(c)):
            seg['type'] = 'race_marker'
            return seg

    seg['type'] = 'unparsed'
    return seg


QUALITY = {'intervals', 'steady', 'steady_time', 'time_block', 'progression',
           'alternating', 'hills', 'hills_drills', 'drills', 'strides',
           'pickups', 'cross'}


def parse_workout(raw: str) -> dict:
    text = re.sub(r'\s+', ' ', raw).strip()
    w: dict = {'raw': text}

    race = re.search(r'START\w*\s+(?:W|NA)\b[^.]*', text)
    if race and race.group(0).isupper():
        w['race'] = {'raw': race.group(0).strip()}
        dist = re.search(r'(\d+)\s*KM', race.group(0))
        if dist:
            w['race']['distance_km'] = int(dist.group(1))
        text = (text[:race.start()] + text[race.end():]).strip(' .+')

    segments: list[dict] = []
    m = COOLDOWN_RE.search(text)
    cooldown = None
    if m:
        cooldown = {'type': 'cooldown', 'raw': m.group(0),
                    'distance_km': [to_km(num(m.group(1)), m.group(2))] * 2}
        text = (text[:m.start()] + text[m.end():]).strip()
    sq = SQUATS_RE.search(text)
    if sq:
        w['strength_note'] = sq.group(0)

    if text:
        for chunk in merge_complexes(split_top(text)):
            segments.append(classify_segment(chunk))
    if cooldown:
        segments.append(cooldown)

    # nietypowo zapisane starty ("ŁEMKOWYNA TRIAL.", "STAR W LESIE KABACKIM- 10 KM.")
    for s in list(segments):
        if s['type'] == 'race_marker':
            if 'race' not in w:
                w['race'] = {'raw': s['raw'].strip(' .')}
                dist = re.search(r'(\d+)\s*KM', s['raw'])
                if dist:
                    w['race']['distance_km'] = int(dist.group(1))
            segments.remove(s)
    w['segments'] = segments

    lo = hi = 0.0
    complete = True
    for s in segments:
        d = s.get('distance_km')
        if d:
            lo, hi = lo + d[0], hi + d[1]
        elif s['type'] not in ('strides',):
            complete = False
    w['distance_km_est'] = [round(lo, 1), round(hi, 1)]
    w['distance_complete'] = complete and bool(segments)
    w['quality'] = any(s['type'] in QUALITY for s in segments)
    return w

# ------------------------------------------------------------- maszyna stanow

WEEK_RE = re.compile(r'^Tydzie[nń]\s+(\S+)\s*(.*)$')
DAY_RE = re.compile(r'^(PN|WT|ŚR|SR|CZ|PT|SB|ND)\b[\s.]*(\d{1,2}\.\d{1,2})?\s*$')
DATE_RE = re.compile(r'^(\d{1,2})\.(\d{1,2})\.?$')


def parse_plan(text: str, stem: str) -> dict:
    meta = parse_filename(stem)
    plan = {'source_file': stem, 'flags': meta['flags'],
            'anchors': meta['anchors'], 'notes': [], 'weeks': []}
    week = None
    day = None
    workout_lines: list[str] = []

    def close_day():
        nonlocal day, workout_lines
        if day is not None:
            if workout_lines:
                day['workout'] = parse_workout(' '.join(workout_lines))
            workout_lines = []
            day = None

    for line in text.split('\n'):
        line = line.strip().lstrip('|').strip()
        if not line:
            continue
        wm = WEEK_RE.match(line)
        if wm:
            close_day()
            week = {'label': wm.group(1), 'range_raw': wm.group(2).strip(), 'days': []}
            plan['weeks'].append(week)
            continue
        dm = DAY_RE.match(line)
        if dm and week is not None:
            close_day()
            day = {'weekday': dm.group(1).replace('SR', 'ŚR'), 'date': None}
            week['days'].append(day)
            if dm.group(2):
                d, mth = dm.group(2).split('.')
                day['date'] = resolve_date(int(d), int(mth), meta['anchors'])
            continue
        tm = DATE_RE.match(line)
        if tm and day is not None and day['date'] is None and not workout_lines:
            day['date'] = resolve_date(int(tm.group(1)), int(tm.group(2)), meta['anchors'])
            continue
        if day is not None:
            workout_lines.append(line)
        else:
            plan['notes'].append(line)
    close_day()
    return plan

# --------------------------------------------------------------------- raport


def iso_week(day_iso: str) -> str:
    y, w, _ = date.fromisoformat(day_iso).isocalendar()
    return f'{y}-W{w:02d}'


def build_report(plans: list[dict]) -> str:
    seg_counts: dict[str, int] = {}
    unparsed_samples: list[str] = []
    races: list[tuple[str, str]] = []
    date_files: dict[str, set] = {}
    candidates: dict[str, list] = {}
    n_days = n_workouts = n_undated = 0

    for p in plans:
        for wk in p['weeks']:
            for d in wk['days']:
                n_days += 1
                if d['date'] is None:
                    n_undated += 1
                w = d.get('workout')
                if not w:
                    continue
                n_workouts += 1
                if d['date']:
                    date_files.setdefault(d['date'], set()).add(p['source_file'])
                if w.get('race'):
                    races.append((d['date'] or '????-??-??', w['race']['raw']))
                for s in w['segments']:
                    seg_counts[s['type']] = seg_counts.get(s['type'], 0) + 1
                    if s['type'] == 'unparsed' and len(unparsed_samples) < 25:
                        unparsed_samples.append(s['raw'][:160])
                if d['date']:
                    month = int(d['date'][5:7])
                    anchor_hit = any(a['month'] == month for a in p['anchors'])
                    penalty = ('duplicate_suffix' in p['flags']) + ('recovered' in p['flags'])
                    candidates.setdefault(d['date'], []).append(
                        (penalty, not anchor_hit, p['source_file'], w))

    # dedupe nakladajacych sie plikow: jedna data liczona raz
    weekly: dict[str, dict] = {}
    n_overlap_dates = 0
    for dt, cands in candidates.items():
        if len(cands) > 1:
            n_overlap_dates += 1
        w = sorted(cands, key=lambda c: c[:3])[0][3]
        wkkey = iso_week(dt)
        agg = weekly.setdefault(wkkey, {'lo': 0.0, 'hi': 0.0, 'complete': True})
        agg['lo'] += w['distance_km_est'][0]
        agg['hi'] += w['distance_km_est'][1]
        agg['complete'] &= w['distance_complete']

    total_segs = sum(seg_counts.values())
    unparsed = seg_counts.get('unparsed', 0)
    coverage = 100.0 * (1 - unparsed / total_segs) if total_segs else 0.0

    dup_pairs: dict[tuple, int] = {}
    for files in date_files.values():
        fl = sorted(files)
        for i in range(len(fl)):
            for j in range(i + 1, len(fl)):
                dup_pairs[(fl[i], fl[j])] = dup_pairs.get((fl[i], fl[j]), 0) + 1
    dups = sorted(((n, a, b) for (a, b), n in dup_pairs.items() if n >= 7), reverse=True)

    complete_weeks = sorted((v['lo'] + v['hi']) / 2 for v in weekly.values() if v['complete'])
    lines = ['# Raport parsowania korpusu', '']
    lines += [f'- Pliki: **{len(plans)}**, tygodnie: **{sum(len(p["weeks"]) for p in plans)}**, '
              f'dni: **{n_days}** (bez daty: {n_undated}), treningi: **{n_workouts}**, '
              f'dni wolne: **{n_days - n_workouts}**',
              f'- Segmenty: **{total_segs}**, pokrycie taksonomii: **{coverage:.1f}%** '
              f'(unparsed: {unparsed})',
              f'- Starty: **{len(races)}**', '']
    lines += ['## Rozkład typów segmentów', '', '| typ | liczba | % |', '|---|---|---|']
    for t, n in sorted(seg_counts.items(), key=lambda kv: -kv[1]):
        lines.append(f'| {t} | {n} | {100 * n / total_segs:.1f}% |')
    if complete_weeks:
        lines += ['', '## Objętość tygodniowa (po dedupe, tygodnie w pełni policzalne)', '',
                  f'- Dat pokrytych przez >1 plik (zdeduplikowane): {n_overlap_dates}',
                  f'- Tygodni policzalnych: {len(complete_weeks)} / {len(weekly)}',
                  f'- Mediana: **{statistics.median(complete_weeks):.0f} km**, '
                  f'P25: {complete_weeks[len(complete_weeks) // 4]:.0f} km, '
                  f'P75: {complete_weeks[3 * len(complete_weeks) // 4]:.0f} km, '
                  f'max: {max(complete_weeks):.0f} km']
    lines += ['', '## Starty w korpusie', '']
    for dt, raw in sorted(set(races)):
        lines.append(f'- {dt} — {raw}')
    if dups:
        lines += ['', '## Kandydaci na duplikaty (wspólne daty z treningami ≥7)', '']
        for n, a, b in dups:
            lines.append(f'- {n} wspólnych dat: `{a}` ↔ `{b}`')
    if unparsed_samples:
        lines += ['', '## Próbki unparsed (do iteracji taksonomii)', '']
        for s in unparsed_samples:
            lines.append(f'- `{s}`')
    lines.append('')
    return '\n'.join(lines)

# ----------------------------------------------------------------------- main


def main():
    (DST / 'plans').mkdir(parents=True, exist_ok=True)
    plans = []
    for f in sorted(SRC.glob('*.txt')):
        plan = parse_plan(f.read_text(encoding='utf-8'), f.stem)
        plans.append(plan)
        out = DST / 'plans' / (f.stem + '.json')
        out.write_text(json.dumps(plan, ensure_ascii=False, indent=1), encoding='utf-8')
    (DST / 'corpus.json').write_text(
        json.dumps(plans, ensure_ascii=False), encoding='utf-8')
    report = build_report(plans)
    (DST / 'REPORT.md').write_text(report, encoding='utf-8')
    print(report)


if __name__ == '__main__':
    main()
