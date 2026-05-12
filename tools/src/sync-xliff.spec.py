#!/usr/bin/env python3
"""Unit tests for sync-xliff.py.

Run with: python3 tools/src/sync-xliff.spec.py
"""
import importlib.util
import shutil
import tempfile
import textwrap
import unittest
import xml.etree.ElementTree as ET
from pathlib import Path

# Load sync-xliff module (hyphen in name prevents normal import)
_SPEC = importlib.util.spec_from_file_location(
    "sync_xliff", Path(__file__).parent / "sync-xliff.py"
)
_MOD = importlib.util.module_from_spec(_SPEC)
_SPEC.loader.exec_module(_MOD)

parse_units = _MOD.parse_units
compute_diff = _MOD.compute_diff
sync_locale = _MOD.sync_locale
get_trg_lang = _MOD.get_trg_lang
NS = _MOD.NS
Q = f"{{{NS}}}"


def _xliff(units_xml: str, trg_lang: str | None = None) -> str:
    trg_attr = f' trgLang="{trg_lang}"' if trg_lang else ""
    return (
        f'<?xml version="1.0" encoding="UTF-8" ?>\n'
        f'<xliff version="2.0" xmlns="{NS}" srcLang="de"{trg_attr}>\n'
        f'  <file id="ngi18n" original="ng.template">\n'
        f'    {units_xml}\n'
        f'  </file>\n'
        f'</xliff>\n'
    )


def _unit(uid: str, source: str, target: str | None = None, state: str = "translated") -> str:
    tgt = f'<target>{target}</target>' if target is not None else ""
    return textwrap.dedent(f"""\
        <unit id="{uid}">
              <segment state="{state}">
                <source>{source}</source>
                {tgt}
              </segment>
            </unit>""")


class TestParseUnits(unittest.TestCase):
    def test_parses_named_ids(self):
        content = _xliff(_unit("foo.bar", "Hallo"))
        with tempfile.NamedTemporaryFile(suffix=".xlf", mode="w", encoding="utf-8", delete=False) as f:
            f.write(content)
            path = Path(f.name)
        try:
            units = parse_units(path)
            self.assertIn("foo.bar", units)
            self.assertEqual(units["foo.bar"].uid, "foo.bar")
        finally:
            path.unlink()

    def test_parses_source_text(self):
        content = _xliff(_unit("a", "Guten Morgen"))
        with tempfile.NamedTemporaryFile(suffix=".xlf", mode="w", encoding="utf-8", delete=False) as f:
            f.write(content)
            path = Path(f.name)
        try:
            units = parse_units(path)
            src_el = units["a"].segment.source_el
            self.assertIsNotNone(src_el)
            self.assertEqual(src_el.text, "Guten Morgen")
        finally:
            path.unlink()

    def test_parses_target_text(self):
        content = _xliff(_unit("a", "Nacht", target="Night"))
        with tempfile.NamedTemporaryFile(suffix=".xlf", mode="w", encoding="utf-8", delete=False) as f:
            f.write(content)
            path = Path(f.name)
        try:
            units = parse_units(path)
            tgt_el = units["a"].segment.target_el
            self.assertIsNotNone(tgt_el)
            self.assertEqual(tgt_el.text, "Night")
        finally:
            path.unlink()


class TestComputeDiff(unittest.TestCase):
    def _make_units(self, specs: list[tuple[str, str, str | None]]) -> dict:
        xml = "\n".join(_unit(uid, src, tgt) for uid, src, tgt in specs)
        content = _xliff(xml, trg_lang="en")
        with tempfile.NamedTemporaryFile(suffix=".xlf", mode="w", encoding="utf-8", delete=False) as f:
            f.write(content)
            path = Path(f.name)
        try:
            return parse_units(path)
        finally:
            path.unlink()

    def test_adds_missing_units(self):
        # Given: source has unit not in locale
        src = self._make_units([("new.key", "Neu", None)])
        loc = self._make_units([])
        result, added, removed, updated = compute_diff(src, loc)
        self.assertEqual(added, 1)
        self.assertEqual(len(result), 1)
        self.assertEqual(result[0].uid, "new.key")

    def test_new_unit_has_initial_state_and_empty_target(self):
        src = self._make_units([("k", "Text", None)])
        loc = self._make_units([])
        result, _, _, _ = compute_diff(src, loc)
        self.assertEqual(result[0].segment.state, "initial")
        self.assertIsNone(result[0].segment.target_el)

    def test_removes_stale_units(self):
        # Given: locale has unit not in source
        src = self._make_units([("existing", "Bleibt", "Stays")])
        loc = self._make_units([("existing", "Bleibt", "Stays"), ("stale", "Veraltet", "Old")])
        result, added, removed, updated = compute_diff(src, loc)
        self.assertEqual(removed, 1)
        ids = [u.uid for u in result]
        self.assertNotIn("stale", ids)
        self.assertIn("existing", ids)

    def test_preserves_target_for_existing_units(self):
        src = self._make_units([("greet", "Hallo Welt", None)])
        loc = self._make_units([("greet", "Hallo Welt", "Hello World")])
        result, _, _, _ = compute_diff(src, loc)
        tgt = result[0].segment.target_el
        self.assertIsNotNone(tgt)
        self.assertEqual(tgt.text, "Hello World")

    def test_updates_changed_source_text(self):
        src = self._make_units([("k", "Neuer Text", None)])
        loc = self._make_units([("k", "Alter Text", "Old translation")])
        result, _, _, updated = compute_diff(src, loc)
        self.assertEqual(updated, 1)
        self.assertEqual(result[0].segment.source_el.text, "Neuer Text")
        self.assertEqual(result[0].segment.target_el.text, "Old translation")

    def test_no_change_when_source_unchanged(self):
        src = self._make_units([("k", "Gleich", None)])
        loc = self._make_units([("k", "Gleich", "Same")])
        _, _, _, updated = compute_diff(src, loc)
        self.assertEqual(updated, 0)

    def test_preserves_source_order(self):
        src = self._make_units([("c", "C", None), ("a", "A", None), ("b", "B", None)])
        loc = self._make_units([("b", "B", "B-tr"), ("a", "A", "A-tr")])
        result, _, _, _ = compute_diff(src, loc)
        ids = [u.uid for u in result]
        self.assertEqual(ids, ["c", "a", "b"])


class TestSyncLocale(unittest.TestCase):
    def setUp(self):
        self.tmpdir = Path(tempfile.mkdtemp())

    def tearDown(self):
        shutil.rmtree(self.tmpdir)

    def _write(self, name: str, content: str) -> Path:
        path = self.tmpdir / name
        path.write_text(content, encoding="utf-8")
        return path

    def test_sync_writes_valid_xliff(self):
        src = self._write("messages.xlf", _xliff(_unit("a", "Ja")))
        loc = self._write("messages.en.xlf", _xliff(_unit("a", "Ja", "Yes"), trg_lang="en"))
        sync_locale(src, loc)
        tree = ET.parse(loc)
        units = list(tree.getroot().iter(f"{Q}unit"))
        self.assertEqual(len(units), 1)

    def test_sync_preserves_trg_lang(self):
        src = self._write("messages.xlf", _xliff(_unit("a", "Ja")))
        loc = self._write("messages.en.xlf", _xliff(_unit("a", "Ja", "Yes"), trg_lang="en"))
        sync_locale(src, loc)
        root = ET.parse(loc).getroot()
        self.assertEqual(root.get("trgLang"), "en")

    def test_sync_adds_new_unit_with_empty_target(self):
        src = self._write("messages.xlf", _xliff(_unit("new", "Neu") + "\n" + _unit("old", "Alt")))
        loc = self._write("messages.en.xlf", _xliff(_unit("old", "Alt", "Old"), trg_lang="en"))
        added, _, _ = sync_locale(src, loc)
        self.assertEqual(added, 1)
        units = {u.get("id"): u for u in ET.parse(loc).getroot().iter(f"{Q}unit")}
        new_tgt = units["new"].find(f"{Q}segment/{Q}target")
        self.assertIsNotNone(new_tgt)

    def test_sync_removes_stale_units(self):
        src = self._write("messages.xlf", _xliff(_unit("kept", "Behalten")))
        loc = self._write("messages.en.xlf", _xliff(
            _unit("kept", "Behalten", "Kept") + "\n" + _unit("gone", "Weg", "Gone"),
            trg_lang="en"
        ))
        _, removed, _ = sync_locale(src, loc)
        self.assertEqual(removed, 1)
        ids = [u.get("id") for u in ET.parse(loc).getroot().iter(f"{Q}unit")]
        self.assertNotIn("gone", ids)

    def test_sync_returns_zeros_when_unchanged(self):
        src = self._write("messages.xlf", _xliff(_unit("a", "Text")))
        loc = self._write("messages.en.xlf", _xliff(_unit("a", "Text", "Translation"), trg_lang="en"))
        # First sync to align
        sync_locale(src, loc)
        # Second sync should be no-op (after first run aligns everything)
        added, removed, updated = sync_locale(src, loc)
        self.assertEqual(added, 0)
        self.assertEqual(removed, 0)
        self.assertEqual(updated, 0)

    def test_sync_preserves_ph_elements(self):
        ph_source = '<source>Hallo <ph id="0" equiv="INTERPOLATION" disp="{{ name }}"/> Welt</source>'
        src_content = f"""\
<?xml version="1.0" encoding="UTF-8" ?>
<xliff version="2.0" xmlns="{NS}" srcLang="de">
  <file id="ngi18n" original="ng.template">
    <unit id="greet">
      <segment>
        {ph_source}
      </segment>
    </unit>
  </file>
</xliff>
"""
        loc_content = f"""\
<?xml version="1.0" encoding="UTF-8" ?>
<xliff version="2.0" xmlns="{NS}" srcLang="de" trgLang="en">
  <file id="ngi18n" original="ng.template">
    <unit id="greet">
      <segment state="translated">
        {ph_source}
        <target>Hello <ph id="0" equiv="INTERPOLATION" disp="{{ name }}"/> World</target>
      </segment>
    </unit>
  </file>
</xliff>
"""
        src = self._write("messages.xlf", src_content)
        loc = self._write("messages.en.xlf", loc_content)
        added, removed, updated = sync_locale(src, loc)
        # no change expected since source matches
        self.assertEqual(updated, 0)
        units = {u.get("id"): u for u in ET.parse(loc).getroot().iter(f"{Q}unit")}
        tgt = units["greet"].find(f"{Q}segment/{Q}target")
        # target translation preserved
        ph_in_target = tgt.find(f"{Q}ph")
        self.assertIsNotNone(ph_in_target)


if __name__ == "__main__":
    unittest.main(verbosity=2)
