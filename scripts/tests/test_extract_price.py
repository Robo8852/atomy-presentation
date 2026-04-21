"""Tests for extract_price() — see price-Spec.md for contract."""
from __future__ import annotations

import sys
import unittest
from pathlib import Path

# Make the sibling scripts/ dir importable.
SCRIPTS_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(SCRIPTS_DIR))

from build_presentation import extract_price  # noqa: E402

ONEPAGERS = Path("/home/owner/Atomy/downloads/onepagers")


class ExtractPriceTests(unittest.TestCase):
    def test_extract_price_single(self):
        self.assertEqual(
            extract_price(ONEPAGERS / "Hemohim.pptx"),
            {"usd": "105.00", "pv": "66,000"},
        )

    def test_extract_price_dual(self):
        self.assertEqual(
            extract_price(ONEPAGERS / "Herbal Cabello NE.pptx"),
            {
                "items": [
                    {"label": "Shampoo", "usd": "14.00", "pv": "7,000"},
                    {"label": "Acondicionador", "usd": "16.00", "pv": "8,000"},
                ]
            },
        )

    def test_extract_price_missing(self):
        self.assertIsNone(extract_price(ONEPAGERS / "Atomy Parche de Hidrogel.pptx"))


if __name__ == "__main__":
    unittest.main()
