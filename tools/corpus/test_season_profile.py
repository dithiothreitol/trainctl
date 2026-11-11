"""Testy pomocników season_profile. Uruchomienie: python -m unittest discover tools/corpus -v"""
import unittest

from season_profile import med, p90


class TestStats(unittest.TestCase):
    def test_p90_on_filtered_values(self):
        # lista po odfiltrowaniu bywa krótsza niż liczba tygodni — indeks liczony z niej
        self.assertEqual(p90([0.2]), 0.2)
        self.assertIsNone(p90([]))
        self.assertEqual(p90([0.1 * i for i in range(1, 11)]), 0.9)

    def test_median(self):
        self.assertIsNone(med([]))
        self.assertEqual(med([1, 3]), 2)


if __name__ == '__main__':
    unittest.main()
