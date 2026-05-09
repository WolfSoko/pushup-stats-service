#!/usr/bin/env python3
"""Sync translation XLF files with the source messages.xlf.

For each messages.<lang>.xlf:
  - Adds units missing from translation (German source text as placeholder target).
  - Removes obsolete units that are no longer in the source.

Run from repo root: python3 tools/src/sync-translations.py
Exit code 1 when changes were made, 0 when everything was already up to date.
"""

import os
import re
import sys

LOCALE_DIR = "web/src/locale"
SOURCE_FILENAME = "messages.xlf"

# Four-space indent used for <unit> blocks in source XLF.
_UNIT_INDENT = "    "


def extract_unit_blocks(content):
    """Return {id: raw_unit_xml_string} extracted from XLF content."""
    units = {}
    pattern = re.compile(
        r"(?m)^(" + _UNIT_INDENT + r'<unit\s+id="([^"]+)"[\s\S]*?</unit>)',
    )
    for m in pattern.finditer(content):
        units[m.group(2)] = m.group(1)
    return units


def get_unit_ids(content):
    return set(re.findall(r'<unit\s+id="([^"]+)"', content))


def _source_inner(unit_xml):
    """Return inner content of <source>…</source>, or None for <source/>."""
    m = re.search(r"<source>([\s\S]*?)</source>", unit_xml)
    return m.group(1) if m else None


def make_translation_unit(source_unit_xml):
    """Transform a source unit block into a translation-ready unit with target."""
    result = source_unit_xml.replace("<segment>", '<segment state="new">', 1)

    inner = _source_inner(result)
    if inner is not None:
        old = f"<source>{inner}</source>"
        new = f"<source>{inner}</source>\n        <target>{inner}</target>"
        result = result.replace(old, new, 1)
    else:
        result = result.replace("<source/>", "<source/>\n        <target/>", 1)

    return result


def sync_file(source_units, path):
    with open(path, encoding="utf-8") as fh:
        content = fh.read()

    existing_ids = get_unit_ids(content)
    source_ids = set(source_units)

    to_add = source_ids - existing_ids
    to_remove = existing_ids - source_ids

    for uid in to_remove:
        # Literal 4-space indent — do NOT use f-string quantifier {4} here.
        content = re.sub(
            r"\n" + _UNIT_INDENT + r'<unit\s+id="' + re.escape(uid) + r'"[\s\S]*?</unit>',
            "",
            content,
        )

    if to_add:
        new_blocks = "\n".join(
            make_translation_unit(source_units[uid]) for uid in sorted(to_add)
        )
        content = content.replace("\n  </file>", f"\n{new_blocks}\n  </file>", 1)

    changed = bool(to_add or to_remove)

    if changed:
        with open(path, "w", encoding="utf-8") as fh:
            fh.write(content)
        print(
            f"  {os.path.basename(path)}: +{len(to_add)} new, -{len(to_remove)} removed"
        )
    else:
        print(f"  {os.path.basename(path)}: up to date")

    return len(to_add), len(to_remove)


def main():
    repo_root = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..")
    locale_dir = os.path.join(repo_root, LOCALE_DIR)
    source_path = os.path.join(locale_dir, SOURCE_FILENAME)

    with open(source_path, encoding="utf-8") as fh:
        source_content = fh.read()

    source_units = extract_unit_blocks(source_content)
    print(f"Source: {len(source_units)} units")

    translation_files = sorted(
        os.path.join(locale_dir, name)
        for name in os.listdir(locale_dir)
        if name.startswith("messages.")
        and name != SOURCE_FILENAME
        and name.endswith(".xlf")
    )

    total_added = total_removed = 0
    for path in translation_files:
        added, removed = sync_file(source_units, path)
        total_added += added
        total_removed += removed

    print(
        f"\nDone: +{total_added} added, -{total_removed} removed"
        f" across {len(translation_files)} files"
    )
    return 1 if total_added + total_removed > 0 else 0


if __name__ == "__main__":
    sys.exit(main())
