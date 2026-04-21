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

from pptx import Presentation

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

# Category per detail-deck slug. The combined DECK_SLUG is intentionally absent
# (category=None in catalog — always surfaces regardless of filter).
# Labels are both UI strings and enum values — do not paraphrase.
CATEGORIES: dict[str, str] = {
    "absolute-cuidado-del-cabello": "Cuidado del Cabello",
    "adelica-delineador-de-cejas": "Maquillaje",
    "adelica-mascara-de-pestanas-volumen": "Maquillaje",
    "atomy-absolute": "Cuidado de la Piel",
    "atomy-aceite-esencial-para-cabello-ne": "Cuidado del Cabello",
    "atomy-aidam-limpiador": "Higiene Personal",
    "atomy-bb-cream": "Maquillaje",
    "atomy-brillo-labial": "Maquillaje",
    "atomy-cafe-arabica-black": "Consumibles",
    "atomy-cepillo-dental-ninos": "Higiene Personal",
    "atomy-cream-mist": "Cuidado de la Piel",
    "atomy-cuidado-nocturno-4-pasos": "Cuidado de la Piel",
    "atomy-daily-expert-mask": "Cuidado de la Piel",
    "atomy-desmaquillante-bifasico": "Cuidado de la Piel",
    "atomy-e-omega-3": "Consumibles",
    "atomy-esencia-para-rizos": "Cuidado del Cabello",
    "atomy-fermento-de-noni-organico": "Consumibles",
    "atomy-fermento-de-noni-organico-sachet": "Consumibles",
    "atomy-gel-de-manzana-verde": "Consumibles",
    "atomy-hierro": "Consumibles",
    "atomy-homme-all-in-one-wash": "Higiene Personal",
    "atomy-jabon-de-manos": "Higiene Personal",
    "atomy-kit-de-viaje": "Higiene Personal",
    "atomy-limpiador-herbal": "Higiene Personal",
    "atomy-parche-de-hidrogel": "Cuidado de la Piel",
    "atomy-pasta-dental": "Higiene Personal",
    "atomy-pasta-dental-sensitive": "Higiene Personal",
    "atomy-probioticos-10": "Consumibles",
    "atomy-protector-solar-barra": "Cuidado de la Piel",
    "atomy-protector-solar-ne": "Cuidado de la Piel",
    "atomy-sistema-de-cuidado-para-la-piel-the-fame": "Cuidado de la Piel",
    "atomy-spray-de-propoleo-verde": "Consumibles",
    "atomy-suavizante-de-telas-ne": "Hogar",
    "atomy-terapia-de-manos-ne": "Cuidado de la Piel",
    "atomy-tratamiento-labial-ne": "Cuidado de la Piel",
    "balsamo-para-manos": "Cuidado de la Piel",
    "crema-no-lactea-ne": "Consumibles",
    "detergente-para-ropa-ne": "Hogar",
    "editable-sistemacuidadobucal2": "Higiene Personal",
    "editable-tratamientoliquido": "Cuidado del Cabello",
    "espanol-ppt-protein-intensive-haircare-editable": "Cuidado del Cabello",
    "fibra-imagenes": "Consumibles",
    "fresh-sun-lotion": "Cuidado de la Piel",
    "gel-de-granada-ne": "Cuidado de la Piel",
    "gomitas-de-propoleo-ne": "Consumibles",
    "guantes-de-latex-final": "Hogar",
    "hemohim": "Consumibles",
    "herbal-cabello-ne": "Cuidado del Cabello",
    "hydra-balm-ne": "Cuidado de la Piel",
    "lavatrastes-ne": "Hogar",
    "limpiador-profundo-aceite-editable": "Cuidado de la Piel",
    "ppt-absolute-essence-sun-uv-ne": "Cuidado de la Piel",
    "ppt-esponjillas-de-acero-ineoxidable-ne": "Hogar",
    "ppt-esponjillas-multiproposito-ne": "Hogar",
    "ppt-exfoliante-corporal-a-base-de-sales": "Higiene Personal",
    "puer-te": "Consumibles",
    "scalpcare-ne": "Cuidado del Cabello",
    "spirulina": "Consumibles",
}


# ── Price extraction ──────────────────────────────────────────────
# Onepagers carry their price block on slide 1 in one of two shapes:
#   Single: two adjacent paragraphs  "<usd> USD" / "<pv> PV".
#   Dual:   one paragraph per item   "<label>  <usd> USD  ·  <pv> PV".
# Unpriced onepagers simply don't contain a USD/PV paragraph.

_SINGLE_USD = re.compile(r"^(\d[\d,.]*)\s*USD$")
_SINGLE_PV = re.compile(r"^(\d[\d,.]*)\s*PV$")
_DUAL_LINE = re.compile(
    r"^(?P<label>.+?)\s{2,}(?P<usd>\d[\d,.]*)\s*USD"
    r"[\s·•\-–—]+(?P<pv>\d[\d,.]*)\s*PV$"
)


def extract_price(pptx_path: Path) -> dict | None:
    prs = Presentation(pptx_path)
    paragraphs: list[str] = []
    for shape in prs.slides[0].shapes:
        if not shape.has_text_frame:
            continue
        for para in shape.text_frame.paragraphs:
            text = para.text.strip()
            if text:
                paragraphs.append(text)

    # Dual-price sweep: any paragraph matching the dual shape contributes an item.
    items: list[dict] = []
    for text in paragraphs:
        m = _DUAL_LINE.match(text)
        if m:
            items.append({
                "label": m.group("label").strip(),
                "usd": m.group("usd"),
                "pv": m.group("pv"),
            })
    if items:
        return {"items": items}

    # Single-price sweep: USD line immediately followed by PV line.
    for i in range(len(paragraphs) - 1):
        u = _SINGLE_USD.match(paragraphs[i])
        v = _SINGLE_PV.match(paragraphs[i + 1])
        if u and v:
            return {"usd": u.group(1), "pv": v.group(1)}

    return None


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
    # Price merges in from the matching onepager PPTX (name-for-name); missing
    # or unpriced onepagers silently omit the field.
    catalog_path = OUT_ROOT / "catalog.json"
    product_entries: list[dict] = []
    priced_count = 0
    for deck_dir in sorted(OUT_ROOT.iterdir()):
        if not deck_dir.is_dir() or deck_dir.name == DECK_SLUG:
            continue
        manifest = deck_dir / "manifest.json"
        if not manifest.exists():
            continue
        data = json.loads(manifest.read_text())
        slug = data["slug"]
        if slug not in CATEGORIES:
            raise SystemExit(f"Slug '{slug}' missing from CATEGORIES dict")
        entry: dict = {
            "slug": slug,
            "name": data["name"],
            "category": CATEGORIES[slug],
        }
        onepager = ONEPAGER_DIR / f"{data['name']}.pptx"
        if onepager.exists():
            price = extract_price(onepager)
            if price is not None:
                entry["price"] = price
                priced_count += 1
        product_entries.append(entry)
    product_entries.sort(key=lambda e: e["name"].lower())
    new_catalog = [{"slug": DECK_SLUG, "name": DECK_NAME, "category": None}] + product_entries
    catalog_path.write_text(json.dumps(new_catalog, ensure_ascii=False, indent=2) + "\n")
    print(f"catalog.json: {len(new_catalog)} entries (combined deck first)")
    print(f"  priced: {priced_count}/{len(product_entries)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
