"""公開の仕組みのテスト（Pages に載せるファイルに、許可リスト以外が入らないこと）。

    python3 -m unittest discover -s tools -p 'test_*.py'
"""
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import build_site  # noqa: E402
import site_files  # noqa: E402


class BuildSiteTests(unittest.TestCase):
    def test_only_public_files_are_copied(self):
        with tempfile.TemporaryDirectory() as tmp:
            out_dir = Path(tmp) / "_site"
            files = build_site.build(out_dir)
            out = sorted(p.relative_to(out_dir).as_posix() for p in out_dir.rglob("*") if p.is_file())
        self.assertEqual(out, files)
        for page in ["index.html", "songs.html", "tour.html", "event.html", "calendar.html", "my.html",
                     "sub/setlist.html", "sub/search.html", "common.css", "site.js", "setlist.json"]:
            with self.subTest(page=page):
                self.assertIn(page, files)
        for path in files:
            with self.subTest(path=path):
                self.assertFalse(path.startswith(("admin/", "tools/", ".git", ".github/", "_site/")))
                self.assertNotIn(path, ["README.md", "HANDOFF.md", ".gitignore"])

    def test_allowlist(self):
        for path in ["index.html", "song.json", "sub/setlist.html", "404.html"]:
            with self.subTest(path=path):
                self.assertTrue(site_files.allowed(path))
        for path in ["HANDOFF.md", "README.md", ".gitignore", ".git/config", "tools/site_files.py",
                     "tools/test_site.py", "admin/serve.py", ".github/workflows/pages.yml", "sub/../tools/x.html",
                     "sub/notes.md", "../index.html", ".hidden.html"]:
            with self.subTest(path=path):
                self.assertFalse(site_files.allowed(path))

    def test_refuses_non_empty_output(self):
        with tempfile.TemporaryDirectory() as tmp:
            (Path(tmp) / "old.txt").write_text("x")
            with self.assertRaises(SystemExit):
                build_site.build(tmp)


if __name__ == "__main__":
    unittest.main()
