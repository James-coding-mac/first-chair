import json
import sys
import unittest
from datetime import date, timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import fetch_avalanche as fa


class TestParseIndex(unittest.TestCase):
    """Tests for parse_index parsing and validation."""
    def test_picks_latest_heure(self):
        """Selects the maximum heure string per massif."""
        raw = json.dumps([
            {"massif": "HAUTE-TARENTAISE", "heures": ["20251215100000", "20251215150000"]},
            {"massif": "VANOISE", "heures": ["20251215140000"]}
        ])
        res = fa.parse_index(raw)
        self.assertEqual(res["HAUTE-TARENTAISE"], "20251215150000")
        self.assertEqual(res["VANOISE"], "20251215140000")

    def test_ignores_other_massifs_and_malformed(self):
        """Skips unknown massifs, non-dicts, and invalid heure formats."""
        raw = json.dumps([
            {"massif": "OTHER", "heures": ["20251215100000"]},
            "not a dict",
            {"massif": "HAUTE-TARENTAISE", "heures": ["bad"]},
            {"massif": "HAUTE-TARENTAISE", "heures": ["20251215120000"]}
        ])
        res = fa.parse_index(raw)
        self.assertEqual(res, {"HAUTE-TARENTAISE": "20251215120000"})

    def test_raises_on_non_list(self):
        """Raises ValueError when top-level JSON is not a list."""
        with self.assertRaises(ValueError):
            fa.parse_index(json.dumps({"massif": "X"}))


class TestCollect(unittest.TestCase):
    """Tests for collect fallback and result structure."""
    def test_uses_today_when_available(self):
        """Prefers today's index when fetch succeeds."""
        def fetch(url):
            self.assertIn("20251215", url)
            return json.dumps([{"massif": "HAUTE-TARENTAISE", "heures": ["20251215150000"]}])
        res = fa.collect(fetch, date(2025, 12, 15))
        self.assertTrue(res["ok"])
        self.assertIsNotNone(res["massifs"]["HAUTE-TARENTAISE"])

    def test_falls_back_to_yesterday(self):
        """Retries yesterday's index when today's fetch raises."""
        calls = []
        def fetch(url):
            calls.append(url)
            if "20251215" in url:
                raise ConnectionError("today down")
            return json.dumps([{"massif": "VANOISE", "heures": ["20251214140000"]}])
        res = fa.collect(fetch, date(2025, 12, 15))
        self.assertTrue(res["ok"])
        self.assertIn("20251214", calls[1])
        self.assertIsNotNone(res["massifs"]["VANOISE"])

    def test_both_fail_returns_ok_false(self):
        """Returns ok=False and null massifs when both days fail."""
        def fetch(url):
            raise ConnectionError("down")
        res = fa.collect(fetch, date(2025, 12, 15))
        self.assertFalse(res["ok"])
        self.assertIsNone(res["massifs"]["HAUTE-TARENTAISE"])
        self.assertIsNone(res["massifs"]["VANOISE"])
        self.assertIsNotNone(res["error"])


class TestUrlsAndFormatting(unittest.TestCase):
    """Tests for URL generation and timestamp formatting."""
    def test_pdf_url_format(self):
        """Constructs PDF URL correctly."""
        url = fa.pdf_url("HAUTE-TARENTAISE", "20251215152046")
        self.assertEqual(url, "https://donneespubliques.meteofrance.fr/donnees_libres/Pdf/BRA/BRA.HAUTE-TARENTAISE.20251215152046.pdf")

    def test_issued_iso_formatting(self):
        """Formats heure as ISO local time without timezone."""
        def fetch(url):
            return json.dumps([{"massif": "HAUTE-TARENTAISE", "heures": ["20251215152046"]}])
        res = fa.collect(fetch, date(2025, 12, 15))
        self.assertEqual(res["massifs"]["HAUTE-TARENTAISE"]["issued"], "2025-12-15T15:20:46")


if __name__ == "__main__":
    unittest.main()
