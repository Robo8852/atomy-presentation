#!/usr/bin/env python3
"""Convert Atomy product source decks (detailed pptx) to per-slide JPGs.

Each file in downloads/pptx/ becomes one deck directory under public/decks/<slug>/.
Does NOT merge with onepagers — the onepagers are a separate artifact used by
scripts/build_presentation.py to build the combined "Presentación de Productos" deck.

This script does NOT write catalog.json. The canonical catalog writer is
scripts/build_presentation.py, which prepends the Presentación entry and writes
the detail decks alphabetically after.

Pipeline per deck:
    .pptx -> soffice --headless --convert-to pdf  (sequential; soffice is single-instance)
    .pdf  -> pdftoppm -jpeg -r 120                -> slide-N.jpg (zero-padding stripped)

Usage:
    python3 scripts/convert_decks.py                 # render all source decks (idempotent)
    python3 scripts/convert_decks.py --only hemohim  # substring-filtered targeted run
"""
from __future__ import annotations

import argparse
import json
import re
import shutil
import subprocess
import sys
import tempfile
import time
import unicodedata
from pathlib import Path

ROOT = Path("/home/owner/Atomy")
SOURCE_DIR = ROOT / "downloads" / "pptx"
OUT_ROOT = ROOT / "atomy-deck-viewer" / "public" / "decks"
DPI = 120
SOFFICE_TIMEOUT_S = 180
PDFTOPPM_TIMEOUT_S = 180


def slugify(text: str) -> str:
    text = unicodedata.normalize("NFKD", text)
    text = "".join(c for c in text if not unicodedata.combining(c))
    text = text.lower()
    text = re.sub(r"[^a-z0-9]+", "-", text)
    return text.strip("-")


def pptx_to_pdf(pptx: Path, work_dir: Path) -> Path:
    profile = work_dir / "soffice_profile"
    profile.mkdir(exist_ok=True)
    cmd = [
        "soffice",
        f"-env:UserInstallation=file://{profile}",
        "--headless",
        "--norestore",
        "--nologo",
        "--nofirststartwizard",
        "--convert-to", "pdf",
        "--outdir", str(work_dir),
        str(pptx),
    ]
    subprocess.run(
        cmd, check=True, timeout=SOFFICE_TIMEOUT_S,
        stdout=subprocess.DEVNULL, stderr=subprocess.PIPE,
    )
    pdf = work_dir / (pptx.stem + ".pdf")
    if not pdf.exists():
        raise RuntimeError(f"soffice did not produce {pdf.name}")
    return pdf


def pdf_to_jpgs(pdf: Path, out_dir: Path) -> int:
    out_dir.mkdir(parents=True, exist_ok=True)
    for f in out_dir.glob("slide-*.jpg"):
        f.unlink()
    cmd = [
        "pdftoppm", "-jpeg", "-r", str(DPI),
        str(pdf), str(out_dir / "slide"),
    ]
    subprocess.run(
        cmd, check=True, timeout=PDFTOPPM_TIMEOUT_S,
        stdout=subprocess.DEVNULL, stderr=subprocess.PIPE,
    )
    for p in sorted(out_dir.glob("slide-*.jpg")):
        m = re.fullmatch(r"slide-0*(\d+)\.jpg", p.name)
        if not m:
            continue
        target = out_dir / f"slide-{int(m.group(1))}.jpg"
        if p != target:
            p.rename(target)
    return len(list(out_dir.glob("slide-*.jpg")))


def already_converted(out_dir: Path) -> bool:
    return (
        out_dir.exists()
        and (out_dir / "slide-1.jpg").exists()
        and (out_dir / "manifest.json").exists()
    )


def process_deck(pptx: Path) -> dict | None:
    name = pptx.stem
    slug = slugify(name)
    out_dir = OUT_ROOT / slug
    manifest_path = out_dir / "manifest.json"

    if already_converted(out_dir):
        existing = json.loads(manifest_path.read_text())
        print(f"  skip (exists): {slug} -> {existing.get('slideCount', '?')} slides")
        return {"slug": slug, "name": name}

    print(f"  convert: {pptx.name} -> {slug}")
    t0 = time.time()
    with tempfile.TemporaryDirectory(prefix="atomy-convert-") as work:
        work_dir = Path(work)
        try:
            pdf = pptx_to_pdf(pptx, work_dir)
        except (subprocess.CalledProcessError, subprocess.TimeoutExpired, RuntimeError) as e:
            stderr = getattr(e, "stderr", b"")
            stderr = stderr.decode(errors="replace") if isinstance(stderr, (bytes, bytearray)) else str(e)
            print(f"    FAILED (soffice): {stderr.strip() or e}", file=sys.stderr)
            return None
        try:
            slide_count = pdf_to_jpgs(pdf, out_dir)
        except (subprocess.CalledProcessError, subprocess.TimeoutExpired) as e:
            stderr = getattr(e, "stderr", b"")
            stderr = stderr.decode(errors="replace") if isinstance(stderr, (bytes, bytearray)) else str(e)
            print(f"    FAILED (pdftoppm): {stderr.strip() or e}", file=sys.stderr)
            shutil.rmtree(out_dir, ignore_errors=True)
            return None

    if slide_count == 0:
        print(f"    FAILED: 0 slides produced for {slug}", file=sys.stderr)
        shutil.rmtree(out_dir, ignore_errors=True)
        return None

    manifest = {"name": name, "slug": slug, "slideCount": slide_count}
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n")
    print(f"    -> {slide_count} slides in {time.time() - t0:.1f}s")
    return {"slug": slug, "name": name}


def main() -> int:
    parser = argparse.ArgumentParser(description="Batch-render Atomy source decks to slide JPGs.")
    parser.add_argument(
        "--only", default=None,
        help="Case-insensitive substring filter on pptx filename.",
    )
    args = parser.parse_args()

    if not SOURCE_DIR.exists():
        print(f"ERROR: missing {SOURCE_DIR}", file=sys.stderr)
        return 2

    OUT_ROOT.mkdir(parents=True, exist_ok=True)
    pptx_files = sorted(SOURCE_DIR.glob("*.pptx"))
    filtered = [p for p in pptx_files if not args.only or args.only.lower() in p.stem.lower()]
    print(f"Processing {len(filtered)}/{len(pptx_files)} source decks in {SOURCE_DIR}")

    failures: list[str] = []
    processed = 0
    for pptx in filtered:
        if process_deck(pptx) is None:
            failures.append(pptx.name)
        else:
            processed += 1

    print(f"\nProcessed {processed} deck(s). Failures: {len(failures)}")
    for f in failures:
        print(f"  - {f}", file=sys.stderr)

    print("NOTE: catalog.json is written by scripts/build_presentation.py, not this script.")
    return 0 if not failures else 1


if __name__ == "__main__":
    sys.exit(main())
