"""Testy pomocników season_profile. Uruchomienie: python -m unittest discover tools/corpus -v"""
import unittest

from races import race_km
from season_profile import is_run, med, p90


class TestStats(unittest.TestCase):
    def test_p90_on_filtered_values(self):
        # lista po odfiltrowaniu bywa krótsza niż liczba tygodni — indeks liczony z niej
        self.assertEqual(p90([0.2]), 0.2)
        self.assertIsNone(p90([]))
        self.assertEqual(p90([0.1 * i for i in range(1, 11)]), 0.9)

    def test_median(self):
        self.assertIsNone(med([]))
        self.assertEqual(med([1, 3]), 2)


class TestParsing(unittest.TestCase):
    def test_decimal_race_distance(self):
        self.assertEqual(race_km({'race': {'raw': 'START NA 21,1 KM'}}), 21.1)
        self.assertEqual(race_km({'race': {'raw': 'START NA 21,0975 KM'}}), 21.0975)
        self.assertEqual(race_km({'race': {'raw': 'START NA 10 KM'}}), 10.0)

    def test_warmup_distance_does_not_win(self):
        self.assertEqual(race_km({'race': {'raw': 'ROZGRZEWKA 3 KM + PÓŁMARATON'}}), 21.0975)
        self.assertEqual(race_km({'race': {}, 'raw': '2 KM TRUCHTU, START MARATON'}), 42.195)
        self.assertEqual(race_km({'race': {'raw': 'START NA 5 KM'}}), 5.0)

    def test_marathon_names(self):
        self.assertEqual(race_km({'race': {'raw': 'ULTRAMARATON 60 KM'}}), 60.0)
        self.assertEqual(race_km({'race': {'raw': 'BERLIN MARATHON'}}), 42.195)
        self.assertIsNone(race_km({'race': {'raw': 'ULTRAMARATON GÓRSKI'}}))

    def test_run_without_segments(self):
        self.assertTrue(is_run({'distance_km_est': [8, 10], 'segments': []}))
        self.assertFalse(is_run({'distance_km_est': [0, 45], 'segments': [{'type': 'cross'}]}))


class TestSteadyDistance(unittest.TestCase):
    def test_hard_km_ignores_malformed_distance(self):
        # segment z niepełnym dystansem nie wywraca pomiaru (hard_km i bloki ciągłe)
        from season_profile import hard_km
        w = {'segments': [{'type': 'steady', 'distance_km': [5]}, {'type': 'steady', 'distance_km': [None, None]}]}
        self.assertEqual(hard_km(w), 0.0)


if __name__ == '__main__':
    unittest.main()
