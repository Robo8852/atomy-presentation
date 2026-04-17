#!/usr/bin/env python3
"""Build the combined "Presentación de Productos" deck — all 58 product onepagers
concatenated in priority order (heavy-hitter consumables first), rasterized to JPGs.

Pipeline:
  each ordered onepager.pptx -> soffice --convert-to pdf  (sequential)
  all PDFs                    -> pdfunite combined.pdf
  combined.pdf                -> pdftoppm -jpeg -r 120   -> slide-N.jpg (unpadded)

Output:
  public/decks/presentacion-de-productos/slide-N.jpg
  public/decks/presentacion-de-productos/manifest.json
  catalog.json                -> prepends the new deck entry (source-only decks stay below)

Run once; re-runs overwrite the combined deck and re-write catalog.json.
"""
from __future__ import annotations

import json
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path("/home/owner/Atomy")
ONEPAGER_DIR = ROOT / "downloads" / "onepagers"
OUT_ROOT = ROOT / "atomy-deck-viewer" / "public" / "decks"
DPI = 120
SOFFICE_TIMEOUT_S = 180
PDFUNITE_TIMEOUT_S = 60
PDFTOPPM_TIMEOUT_S = 300

DECK_SLUG = "presentacion-de-productos"
DECK_NAME = "Presentación de Productos"

# 15 consumables in priority order (heavy hitters first).
CONSUMABLES_ORDER = [
    "Hemohim",
    "Atomy Probióticos 10_",
    "Puer Te",
    "Atomy Gel de Manzana Verde",
    "fibra imagenes",
    "Atomy Fermento de Noni Orgánico",
    "Atomy E-Omega 3",
    "Spirulina",
    "Atomy Hierro",
    "Atomy Fermento de Noni Orgánico Sachet",
    "Gel de Granada NE",
    "Gomitas de Propoleo NE",
    "Atomy Spray de Propóleo Verde",
    "Atomy Café Arábica Black",
    "Crema No Lactea NE",
]


def pptx_to_pdf(pptx: Path, work_dir: Path, tag: str) -> Path:
    profile = work_dir / f"soffice_profile_{tag}"
    profile.mkdir(exist_ok=True)
    stage = work_dir / f"pdf_{tag}"
    stage.mkdir(exist_ok=True)
    cmd = [
        "soffice",
        f"-env:UserInstallation=file://{profile}",
        "--headless",
        "--norestore",
        "--nologo",
        "--nofirststartwizard",
        "--convert-to", "pdf",
        "--outdir", str(stage),
        str(pptx),
    ]
    subprocess.run(
        cmd, check=True, timeout=SOFFICE_TIMEOUT_S,
        stdout=subprocess.DEVNULL, stderr=subprocess.PIPE,
    )
    pdf = stage / (pptx.stem + ".pdf")
    if not pdf.exists():
        raise RuntimeError(f"soffice did not produce {pdf.name}")
    return pdf


def build_order() -> list[Path]:
    available = {p.stem: p for p in ONEPAGER_DIR.glob("*.pptx")}
    missing = [n for n in CONSUMABLES_ORDER if n not in available]
    if missing:
        raise SystemExit(f"Consumables not found in {ONEPAGER_DIR}: {missing}")
    consumables = [available[n] for n in CONSUMABLES_ORDER]
    rest_stems = sorted(set(available) - set(CONSUMABLES_ORDER), key=str.lower)
    rest = [available[n] for n in rest_stems]
    return consumables + rest


def main() -> int:
    ordered_pptx = build_order()
    print(f"Building '{DECK_NAME}' from {len(ordered_pptx)} onepagers")
    print(f"  first: {ordered_pptx[0].stem}")
    print(f"  last:  {ordered_pptx[-1].stem}")

    out_dir = OUT_ROOT / DECK_SLUG
    shutil.rmtree(out_dir, ignore_errors=True)
    out_dir.mkdir(parents=True)

    with tempfile.TemporaryDirectory(prefix="atomy-presentation-") as work:
        work_dir = Path(work)
        pdfs: list[Path] = []
        for i, pptx in enumerate(ordered_pptx, 1):
            print(f"  [{i:02d}/{len(ordered_pptx)}] {pptx.stem}", flush=True)
            pdfs.append(pptx_to_pdf(pptx, work_dir, f"{i:02d}"))

        combined = work_dir / "combined.pdf"
        cmd = ["pdfunite", *[str(p) for p in pdfs], str(combined)]
        subprocess.run(
            cmd, check=True, timeout=PDFUNITE_TIMEOUT_S,
            stdout=subprocess.DEVNULL, stderr=subprocess.PIPE,
        )
        if not combined.exists():
            raise RuntimeError("pdfunite did not produce combined.pdf")
        print(f"  merged -> {combined.name}")

        cmd = ["pdftoppm", "-jpeg", "-r", str(DPI), str(combined), str(out_dir / "slide")]
        subprocess.run(
            cmd, check=True, timeout=PDFTOPPM_TIMEOUT_S,
            stdout=subprocess.DEVNULL, stderr=subprocess.PIPE,
        )

    # Strip pdftoppm's zero-padding.
    for p in sorted(out_dir.glob("slide-*.jpg")):
        m = re.fullmatch(r"slide-0*(\d+)\.jpg", p.name)
        if not m:
            continue
        target = out_dir / f"slide-{int(m.group(1))}.jpg"
        if p != target:
            p.rename(target)

    slide_count = len(list(out_dir.glob("slide-*.jpg")))
    manifest = {"name": DECK_NAME, "slug": DECK_SLUG, "slideCount": slide_count}
    (out_dir / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n")
    print(f"\n{DECK_SLUG}: {slide_count} slides")

    # Rebuild catalog: Presentación first, then every detail deck found on disk,
    # alphabetical by name. Source of truth is public/decks/<slug>/manifest.json.
    catalog_path = OUT_ROOT / "catalog.json"
    product_entries: list[dict] = []
    for deck_dir in sorted(OUT_ROOT.iterdir()):
        if not deck_dir.is_dir() or deck_dir.name == DECK_SLUG:
            continue
        manifest = deck_dir / "manifest.json"
        if not manifest.exists():
            continue
        data = json.loads(manifest.read_text())
        product_entries.append({"slug": data["slug"], "name": data["name"]})
    product_entries.sort(key=lambda e: e["name"].lower())
    new_catalog = [{"slug": DECK_SLUG, "name": DECK_NAME}] + product_entries
    catalog_path.write_text(json.dumps(new_catalog, ensure_ascii=False, indent=2) + "\n")
    print(f"catalog.json: {len(new_catalog)} entries (combined deck first)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
