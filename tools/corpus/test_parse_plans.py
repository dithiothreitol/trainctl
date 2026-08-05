# -*- coding: utf-8 -*-
"""Testy parsera korpusu. Uruchomienie: python -m unittest discover tools/corpus -v"""
import unittest

from parse_plans import (parse_filename, resolve_date, parse_pace, parse_dist,
                         parse_recovery, classify_segment, parse_workout,
                         parse_plan, split_top, merge_complexes)


class TestFilename(unittest.TestCase):
    def test_single_month(self):
        r = parse_filename('DAREK- PLAN TRENINGOWY PAŹDZIERNIK 2025')
        self.assertEqual(r['anchors'], [{'month': 10, 'year': 2025}])

    def test_two_months_same_year(self):
        r = parse_filename('DAREK- PLAN TRENINGOWY NA CZERWIEC, LIPIEC 2025')
        self.assertEqual(r['anchors'],
                         [{'month': 6, 'year': 2025}, {'month': 7, 'year': 2025}])

    def test_year_wrap(self):
        r = parse_filename('DAREK-PLAN-TRENINGOWY-NA-GRUDZIEN-STYCZEŃ-2020')
        self.assertEqual(r['anchors'],
                         [{'month': 12, 'year': 2020}, {'month': 1, 'year': 2021}])

    def test_genitive_month(self):
        r = parse_filename('DAREK-PLAN-TRENINGOWY-DO-15-PAŹDZIERNIKA-2023')
        self.assertEqual(r['anchors'], [{'month': 10, 'year': 2023}])

    def test_flags(self):
        r = parse_filename('DAREK-  PLAN-TRENINGOWY-  STYCZEŃ 2025 (Automatycznie odzyskany) (3)')
        self.assertIn('recovered', r['flags'])
        self.assertIn('duplicate_suffix', r['flags'])
        self.assertEqual(r['anchors'], [{'month': 1, 'year': 2025}])


class TestResolveDate(unittest.TestCase):
    def test_spillover_previous_month(self):
        # 31.08 w planie wrzesniowym 2020
        self.assertEqual(resolve_date(31, 8, [{'month': 9, 'year': 2020}]), '2020-08-31')

    def test_year_wrap_january(self):
        anchors = [{'month': 12, 'year': 2020}, {'month': 1, 'year': 2021}]
        self.assertEqual(resolve_date(3, 1, anchors), '2021-01-03')
        self.assertEqual(resolve_date(28, 12, anchors), '2020-12-28')


class TestPace(unittest.TestCase):
    def test_simple(self):
        self.assertEqual(parse_pace('w tempie 4:15 na km')['sec_per_km'], [255, 255])

    def test_short_range(self):
        self.assertEqual(parse_pace('w tempie 4:25-30 na km')['sec_per_km'], [265, 270])

    def test_full_range(self):
        self.assertEqual(parse_pace('w tempie 3:50-4:00 na km')['sec_per_km'], [230, 240])

    def test_approx(self):
        p = parse_pace('tempo w okolicach 4:00 na km')
        self.assertEqual(p['sec_per_km'], [240, 240])
        self.assertTrue(p['approx'])


class TestDist(unittest.TestCase):
    def test_km_word(self):
        self.assertEqual(parse_dist('15 kilometrów (w tempie spokojnym)'), [15, 15])

    def test_decimal(self):
        self.assertEqual(parse_dist('2,5 km (w tempie 3:25 na km)'), [2.5, 2.5])

    def test_range(self):
        self.assertEqual(parse_dist('10-12 km (w tempie spokojnym)'), [10, 12])

    def test_meters(self):
        self.assertEqual(parse_dist('400 metrów'), [0.4, 0.4])


class TestSegments(unittest.TestCase):
    def test_intervals_full(self):
        s = classify_segment('10*1 km (w tempie 4:15 na km), przerwy 2 minutowe w marszu, '
                             'po 5 odcinku przerwa 4 minutowa w marszu')
        self.assertEqual(s['type'], 'intervals')
        self.assertEqual(s['reps'], 10)
        self.assertEqual(s['rep_m'], 1000)
        self.assertEqual(s['distance_km'], [10, 10])
        self.assertEqual(s['pace']['sec_per_km'], [255, 255])
        self.assertEqual(s['recovery']['value'], 2)
        self.assertEqual(s['recovery']['mode'], 'walk')
        self.assertEqual(s['recovery']['midset']['after_reps'], [5])
        self.assertEqual(s['recovery']['midset']['minutes'], 4)

    def test_intervals_time_based(self):
        s = classify_segment('15*2 minuty (tempo w okolicach 4:00 na km), przerwy 1 minutowe '
                             'w truchcie, po 5 i 10 odcinku przerwy 2 minutowe w marszu')
        self.assertEqual(s['type'], 'intervals')
        self.assertEqual(s['rep_min'], 2)
        self.assertAlmostEqual(s['distance_km'][0], 7.5)  # 15*2min @ 4:00
        self.assertEqual(s['recovery']['midset']['after_reps'], [5, 10])

    def test_hills(self):
        s = classify_segment('podbiegi: 15*200 metrów (spokojnie)')
        self.assertEqual(s['type'], 'hills')
        self.assertEqual(s['reps'], 15)
        self.assertEqual(s['rep_m'], 200)
        self.assertEqual(s['qualifier'], 'spokojnie')

    def test_hills_time_based(self):
        # regresja: "45 sekund" bylo liczone jak 45 km -> 681 km w jeden dzien
        s = classify_segment('podbiegi: 15*45 sekund (szybko)')
        self.assertEqual(s['type'], 'hills')
        self.assertEqual(s['rep_sec'], 45)
        self.assertNotIn('distance_km', s)

    def test_alternating(self):
        s = classify_segment('15 km biegu zmiennego (na zmianę 1 km w tempie 4:10 na km, '
                             'na 1 km w tempie 4:50 na km)')
        self.assertEqual(s['type'], 'alternating')
        self.assertEqual(s['distance_km'], [15, 15])
        self.assertEqual(s['pace_fast'], 250)
        self.assertEqual(s['pace_slow'], 290)

    def test_progression(self):
        s = classify_segment('15 km w tempie narastającym (1-3 km 4:40 na km, 4-6 km 4:35, '
                             '7-9 km 4:30, 10-12 km 4:25, 13-15 km 4:20 na km)')
        self.assertEqual(s['type'], 'progression')
        self.assertEqual(s['distance_km'], [15, 15])
        self.assertEqual(len(s['steps']), 5)
        self.assertEqual(s['steps'][0], {'from_km': 1, 'to_km': 3, 'sec_per_km': 280})

    def test_easy_with_explicit_pace(self):
        s = classify_segment('28-30 km (w tempie spokojnym, czyli tempo 5:20-30 na km)')
        self.assertEqual(s['type'], 'easy')
        self.assertEqual(s['distance_km'], [28, 30])
        self.assertEqual(s['pace']['sec_per_km'], [320, 330])

    def test_very_easy(self):
        s = classify_segment('25 kilometrów (w tempie bardzo spokojnym)')
        self.assertEqual(s['intensity'], 'very_easy')

    def test_pickups(self):
        s = classify_segment('20 km (w tempie bardzo spokojnym, km numer 3,6,9,12,15 oraz 18 '
                             'w tempie 4:15 na km)')
        self.assertEqual(s['type'], 'pickups')

    def test_warmup(self):
        s = classify_segment('3 kilometry (tempo rozgrzewkowe)')
        self.assertEqual(s['type'], 'warmup')
        self.assertEqual(s['distance_km'], [3, 3])

    def test_steady(self):
        s = classify_segment('10 km (w tempie 4:30 na km)')
        self.assertEqual(s['type'], 'steady')
        self.assertEqual(s['pace']['sec_per_km'], [270, 270])

    def test_drills(self):
        s = classify_segment('siła biegowa: 10*200 metrów (w tym 50 metrów skip A '
                             '+ 50 metrów Wieloskok)')
        self.assertEqual(s['type'], 'drills')

    def test_steady_time(self):
        s = classify_segment('15 minut (w tempie 4:15 na km), przerwa 3 minutowa w truchcie')
        self.assertEqual(s['type'], 'steady_time')
        self.assertEqual(s['duration_min'], 15)
        self.assertAlmostEqual(s['distance_km'][0], 3.53, places=2)

    def test_time_block_bare(self):
        s = classify_segment('3 minuty')
        self.assertEqual(s['type'], 'time_block')
        self.assertEqual(s['duration_min'], 3)

    def test_nested_intervals(self):
        s = classify_segment('10*(3 minuty + 1 minuta), przerwa po odcinku 3 minutowym- '
                             '1 minutowa w truchcie')
        self.assertEqual(s['type'], 'intervals')
        self.assertTrue(s['nested'])
        self.assertEqual(s['reps'], 10)

    def test_cross(self):
        s = classify_segment('10-12 km crossu (tempo takie abyś odczuł ten trening)')
        self.assertEqual(s['type'], 'cross')
        self.assertEqual(s['distance_km'], [10, 12])

    def test_strength_session_caps(self):
        s = classify_segment('TRENINNG NA AWF GŁÓWNIE ĆWICZENIA SPRAWNOŚCIOWO- WZMACNIJAĆE')
        self.assertEqual(s['type'], 'strength_session')

    def test_merge_hills_drills_chain(self):
        raw = ('5 kilometrów (w tempie spokojnym) + podbiegi: 30 metrów skip A '
               '+ 100 metrów podbiegu, 30 metrów skip C + 100 metrów podbiegu, '
               '30 metrów wieloskok + 100 metrów podbiegu')
        chunks = merge_complexes(split_top(raw))
        self.assertEqual(len(chunks), 2)
        s = classify_segment(chunks[1])
        self.assertEqual(s['type'], 'hills_drills')


class TestWorkout(unittest.TestCase):
    def test_cooldown_extraction(self):
        w = parse_workout('3 kilometry (tempo rozgrzewkowe) + 10 km (w tempie 4:30 na km). '
                          'Na koniec treningu 1 kilometr truchtu.')
        types = [s['type'] for s in w['segments']]
        self.assertEqual(types, ['warmup', 'steady', 'cooldown'])
        self.assertEqual(w['distance_km_est'], [14.0, 14.0])
        self.assertTrue(w['distance_complete'])
        self.assertTrue(w['quality'])

    def test_race(self):
        w = parse_workout('START NA 100 KM.')
        self.assertEqual(w['race']['distance_km'], 100)
        self.assertFalse(w['quality'])

    def test_easy_day_not_quality(self):
        w = parse_workout('15 kilometrów (w tempie spokojnym).')
        self.assertFalse(w['quality'])
        self.assertEqual(w['distance_km_est'], [15.0, 15.0])

    def test_race_nonstandard(self):
        w = parse_workout('ŁEMKOWYNA TRIAL.')
        self.assertEqual(w['race']['raw'], 'ŁEMKOWYNA TRIAL')
        w2 = parse_workout('STAR W LESIE KABACKIM- 10 KM.')
        self.assertEqual(w2['race']['distance_km'], 10)
        w3 = parse_workout('MARATON PARYŻ.')
        self.assertIn('race', w3)

    def test_strength_note(self):
        w = parse_workout('6 km (w tempie spokojnym) + podbiegi: 15*100 metrów. '
                          'Na zakończeniu każdego podbiegu, wykonaj 20 przysiadów. '
                          'Na koniec treningu 1 km truchtu.')
        self.assertIn('strength_note', w)
        self.assertIn('20 przysiad', w['strength_note'])


class TestStateMachine(unittest.TestCase):
    PLAN = '\n'.join([
        'Tydzień PIERWSZY 6-12 PAŹDZIERNIK',
        'PN', '6.10',
        'WT', '7.10',
        'ŚR', '8.10',
        '| \t15 kilometrów (w tempie spokojnym).',
        'CZ', '9.10',
        'PT 10.10',
        'SB', '11.10',
        '| \t25 kilometrów (w tempie bardzo spokojnym).',
        'ND', '12.10',
        '| \t5 kilometrów (w tempie spokojnym) + podbiegi: 15*200 metrów (spokojnie).',
        'Na koniec treningu 1 km truchtu.',
    ])

    def test_structure(self):
        p = parse_plan(self.PLAN, 'PLAN PAŹDZIERNIK 2025')
        self.assertEqual(len(p['weeks']), 1)
        days = p['weeks'][0]['days']
        self.assertEqual(len(days), 7)
        self.assertEqual(days[0]['date'], '2025-10-06')
        self.assertNotIn('workout', days[0])          # dzien wolny
        self.assertEqual(days[2]['workout']['distance_km_est'], [15.0, 15.0])
        self.assertEqual(days[4]['date'], '2025-10-10')  # "PT 10.10" w jednej linii
        # kontynuacja (cooldown) doklejona do niedzieli
        nd = days[6]['workout']
        self.assertEqual([s['type'] for s in nd['segments']],
                         ['easy', 'hills', 'cooldown'])


if __name__ == '__main__':
    unittest.main(verbosity=2)
