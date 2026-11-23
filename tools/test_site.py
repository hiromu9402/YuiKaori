"""公開の仕組みのテスト（Pages に載せるファイルに、許可リスト以外が入らないこと）。

    python3 -m unittest discover -s tools -p 'test_*.py'
"""
import json
import subprocess
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
            meta = json.loads((out_dir / "meta.json").read_text(encoding="utf-8"))
        self.assertEqual(out, sorted(files))
        for page in ["index.html", "songs.html", "tour.html", "event.html", "calendar.html", "my.html",
                     "sub/setlist.html", "sub/search.html", "common.css", "site.js", "setlist.json"]:
            with self.subTest(page=page):
                self.assertIn(page, files)
        for path in files:
            with self.subTest(path=path):
                self.assertFalse(path.startswith(("admin/", "tools/", ".git", ".github/", "_site/")))
                self.assertNotIn(path, ["README.md", "HANDOFF.md", ".gitignore"])
                self.assertTrue(site_files.allowed(path))
        # データの更新日は、データのファイルが最後に変わったコミットの日時
        expected = subprocess.run(["git", "-C", str(site_files.SITE_DIR), "log", "-1", "--format=%cI", "--",
                                   *site_files.DATA_FILES], capture_output=True, text=True, check=True).stdout.strip()
        self.assertEqual(meta, {"data_updated": expected})

    def test_data_updated_ignores_other_files(self):
        # データ以外（ページや README）を変えたコミットでは、更新日は変わらない
        with tempfile.TemporaryDirectory() as tmp:
            def git(*args, date):
                env = {"GIT_AUTHOR_DATE": date, "GIT_COMMITTER_DATE": date, "PATH": "/usr/bin:/bin",
                       "GIT_AUTHOR_NAME": "t", "GIT_AUTHOR_EMAIL": "t@example.com",
                       "GIT_COMMITTER_NAME": "t", "GIT_COMMITTER_EMAIL": "t@example.com"}
                subprocess.run(["git", "-C", tmp, *args], check=True, capture_output=True, env=env)
            git("init", "-q", date="2026-01-01T00:00:00+09:00")
            Path(tmp, "song.json").write_text("[]")
            git("add", "-A", date="2026-01-01T00:00:00+09:00")
            git("commit", "-q", "-m", "データ", date="2026-01-02T10:00:00+09:00")
            Path(tmp, "index.html").write_text("<p>")
            git("add", "-A", date="2026-01-01T00:00:00+09:00")
            git("commit", "-q", "-m", "ページ", date="2026-01-05T10:00:00+09:00")
            self.assertEqual(build_site.data_updated(tmp), "2026-01-02T10:00:00+09:00")

    def test_data_updated_fails_without_history(self):
        with tempfile.TemporaryDirectory() as tmp:
            with self.assertRaises(SystemExit):
                build_site.data_updated(tmp)

    def test_allowlist(self):
        for path in ["index.html", "song.json", "sub/setlist.html", "404.html"]:
            with self.subTest(path=path):
                self.assertTrue(site_files.allowed(path))
        for path in ["HANDOFF.md", "README.md", ".gitignore", ".git/config", "tools/site_files.py",
                     "tools/test_site.py", "tests/probe.js", "tests/test_pages.py", "admin/serve.py", ".github/workflows/pages.yml", "sub/../tools/x.html",
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
