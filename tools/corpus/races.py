# -*- coding: utf-8 -*-
"""Wspólne rozpoznanie dystansu startu dla skryptów pomiarowych korpusu.

Jedna reguła dla post_race_profile.py (R-8) i season_profile.py (P-12, J-10):
oba pomiary liczą na tym samym zbiorze startów.
"""
import re


def race_km(workout):
    """Dystans startu w km albo None, gdy z zapisu nie da się go ustalić.

    Kolejność: jawny dystans z parsera, jawne „NN KM" w opisie (także z ułamkiem,
    „ULTRAMARATON 60 KM" to 60 km), półmaraton, ultra bez dystansu (None),
    maraton. Opis startu, a gdy go brak — opis całej jednostki.
    """
    race = workout.get('race') or {}
    if isinstance(race.get('distance_km'), (int, float)):
        return float(race['distance_km'])
    raw = (race.get('raw') or workout.get('raw') or '').upper()
    m = re.search(r'(?<![\d,.])(\d{1,3}(?:[.,]\d+)?)\s*KM', raw)
    if m:
        return float(m.group(1).replace(',', '.'))
    if re.search(r'P[OÓ][ŁL]MARATON|HALF', raw):
        return 21.0975
    if re.search(r'ULTRA', raw):
        return None
    if re.search(r'MARAT[HO]', raw):
        return 42.195
    return None
