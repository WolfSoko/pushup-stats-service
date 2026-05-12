#!/usr/bin/env python3
"""Sync web/src/locale/messages.xlf into all messages.<lang>.xlf files.

Invoked by lint-staged when messages.xlf is staged.  Reads the source file,
then for every sibling messages.<lang>.xlf:
  - Adds units present in source but missing in locale  (state=initial, <target/>)
  - Removes units in locale that no longer exist in source
  - Updates <source> content for existing units (keeps <target> and state)
  - Writes the modified file and stages it via `git add`

Exit codes:  0 = ok,  1 = error
"""

from __future__ import annotations

import copy
import subprocess
import sys
import xml.etree.ElementTree as ET
from pathlib import Path
from typing import NamedTuple

NS = "urn:oasis:names:tc:xliff:document:2.0"
ET.register_namespace("", NS)
Q = f"{{{NS}}}"


# ---------------------------------------------------------------------------
# Data model
# ---------------------------------------------------------------------------


class SegmentData(NamedTuple):
    state: str | None
    source_el: ET.Element | None
    target_el: ET.Element | None


class UnitData(NamedTuple):
    uid: str
    notes_el: ET.Element | None
    segment: SegmentData


# ---------------------------------------------------------------------------
# Parsing helpers
# ---------------------------------------------------------------------------


def _q(tag: str) -> str:
    return f"{Q}{tag}"


def _parse_segment(unit_el: ET.Element) -> SegmentData:
    seg = unit_el.find(_q("segment"))
    if seg is None:
        return SegmentData(None, None, None)
    return SegmentData(
        state=seg.get("state"),
        source_el=seg.find(_q("source")),
        target_el=seg.find(_q("target")),
    )


def parse_units(path: Path) -> dict[str, UnitData]:
    tree = ET.parse(path)
    result: dict[str, UnitData] = {}
    for unit_el in tree.getroot().iter(_q("unit")):
        uid = unit_el.get("id")
        if uid:
            result[uid] = UnitData(
                uid=uid,
                notes_el=unit_el.find(_q("notes")),
                segment=_parse_segment(unit_el),
            )
    return result


def get_trg_lang(path: Path) -> str | None:
    return ET.parse(path).getroot().get("trgLang")


# ---------------------------------------------------------------------------
# Unit building
# ---------------------------------------------------------------------------


def _build_unit_el(data: UnitData, indent: str = "    ") -> ET.Element:
    unit_el = ET.Element(_q("unit"), {"id": data.uid})
    unit_el.text = f"\n{indent}  "

    if data.notes_el is not None:
        notes_copy = copy.deepcopy(data.notes_el)
        notes_copy.tail = f"\n{indent}  "
        unit_el.append(notes_copy)

    seg_attrs: dict[str, str] = {}
    if data.segment.state:
        seg_attrs["state"] = data.segment.state
    seg_el = ET.SubElement(unit_el, _q("segment"), seg_attrs)
    seg_el.text = f"\n{indent}    "

    if data.segment.source_el is not None:
        src_copy = copy.deepcopy(data.segment.source_el)
        src_copy.tail = f"\n{indent}    "
        seg_el.append(src_copy)

    if data.segment.target_el is not None:
        tgt_copy = copy.deepcopy(data.segment.target_el)
        tgt_copy.tail = f"\n{indent}  "
        seg_el.append(tgt_copy)
    else:
        tgt_el = ET.SubElement(seg_el, _q("target"))
        tgt_el.tail = f"\n{indent}  "

    seg_el.tail = f"\n{indent}"
    unit_el.tail = "\n    "
    return unit_el


def _new_locale_unit(src_data: UnitData) -> UnitData:
    return UnitData(
        uid=src_data.uid,
        notes_el=copy.deepcopy(src_data.notes_el),
        segment=SegmentData(
            state="initial",
            source_el=copy.deepcopy(src_data.segment.source_el),
            target_el=None,
        ),
    )


def _el_to_str(el: ET.Element | None) -> str:
    if el is None:
        return ""
    tmp = copy.deepcopy(el)
    tmp.tail = None
    return ET.tostring(tmp, encoding="unicode")


def _update_source(loc_data: UnitData, src_data: UnitData) -> UnitData:
    src_text = _el_to_str(src_data.segment.source_el)
    loc_text = _el_to_str(loc_data.segment.source_el)
    if src_text == loc_text:
        return loc_data
    return UnitData(
        uid=loc_data.uid,
        notes_el=loc_data.notes_el,
        segment=SegmentData(
            state=loc_data.segment.state,
            source_el=copy.deepcopy(src_data.segment.source_el),
            target_el=loc_data.segment.target_el,
        ),
    )


# ---------------------------------------------------------------------------
# Sync logic
# ---------------------------------------------------------------------------


def compute_diff(
    src_units: dict[str, UnitData],
    loc_units: dict[str, UnitData],
) -> tuple[list[UnitData], int, int, int]:
    """Return (result_units, n_added, n_removed, n_updated)."""
    added = removed = updated = 0
    result: list[UnitData] = []

    for uid, src_data in src_units.items():
        if uid not in loc_units:
            result.append(_new_locale_unit(src_data))
            added += 1
        else:
            merged = _update_source(loc_units[uid], src_data)
            if merged is not loc_units[uid]:
                updated += 1
            result.append(merged)

    removed = len(set(loc_units) - set(src_units))
    return result, added, removed, updated


def build_tree(
    result_units: list[UnitData],
    trg_lang: str | None,
) -> ET.ElementTree:
    xliff_attrs: dict[str, str] = {"version": "2.0", "srcLang": "de"}
    if trg_lang:
        xliff_attrs["trgLang"] = trg_lang

    root = ET.Element(_q("xliff"), xliff_attrs)
    root.text = "\n  "

    file_el = ET.SubElement(root, _q("file"), {"id": "ngi18n", "original": "ng.template"})
    file_el.text = "\n    "
    file_el.tail = "\n"

    for unit_data in result_units:
        file_el.append(_build_unit_el(unit_data))

    return ET.ElementTree(root)


def write_xliff(tree: ET.ElementTree, path: Path) -> None:
    import io

    buf = io.BytesIO()
    tree.write(buf, encoding="UTF-8", xml_declaration=True, short_empty_elements=True)
    raw = buf.getvalue().decode("utf-8")
    raw = raw.replace("<?xml version='1.0' encoding='UTF-8'?>", "<?xml version=\"1.0\" encoding=\"UTF-8\" ?>")
    path.write_text(raw + "\n", encoding="utf-8")


def sync_locale(source_path: Path, locale_path: Path) -> tuple[int, int, int]:
    """Sync one locale file. Returns (added, removed, updated)."""
    src_units = parse_units(source_path)
    loc_units = parse_units(locale_path)
    trg_lang = get_trg_lang(locale_path)

    result_units, added, removed, updated = compute_diff(src_units, loc_units)

    if added == 0 and removed == 0 and updated == 0:
        return 0, 0, 0

    tree = build_tree(result_units, trg_lang)
    write_xliff(tree, locale_path)
    return added, removed, updated


# ---------------------------------------------------------------------------
# CLI entry point
# ---------------------------------------------------------------------------


def main(argv: list[str] | None = None) -> int:
    args = argv if argv is not None else sys.argv[1:]
    if not args:
        print("Usage: sync-xliff.py <path/to/messages.xlf>", file=sys.stderr)
        return 1

    source_path = Path(args[0]).resolve()
    if not source_path.exists():
        print(f"Source not found: {source_path}", file=sys.stderr)
        return 1

    locale_dir = source_path.parent
    locale_files = sorted(
        p for p in locale_dir.glob("messages.*.xlf") if p != source_path
    )

    if not locale_files:
        print("No locale files found to sync.", file=sys.stderr)
        return 0

    files_to_stage: list[Path] = []
    for locale_path in locale_files:
        added, removed, updated = sync_locale(source_path, locale_path)
        if added or removed or updated:
            print(
                f"  {locale_path.name}: +{added} added, -{removed} removed, ~{updated} updated"
            )
            files_to_stage.append(locale_path)
        else:
            print(f"  {locale_path.name}: no changes")

    if files_to_stage:
        subprocess.run(
            ["git", "add", "--", *[str(p) for p in files_to_stage]],
            check=True,
            cwd=str(locale_dir),
        )

    return 0


if __name__ == "__main__":
    sys.exit(main())
