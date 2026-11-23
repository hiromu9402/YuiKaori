"""公開ページの動きのテスト（headless Chromium）。

公開される内容（tools/build_site.py の出力。meta.json を含む）を 127.0.0.1 で配信し、ページを開いて確かめる。
データの件数には頼らず、JSON から求めた値と画面の表示を比べる。

    python3 -m unittest discover -s tests -v

Chromium（または Google Chrome）がないときは飛ばす。環境変数 REQUIRE_BROWSER=1 のときは、飛ばさずに失敗にする（Actions 用）。
使うブラウザは環境変数 CHROMIUM で指定できる。
"""
import contextlib
import functools
import html
import http.server
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import threading
import unittest
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent / "tools"))
import build_site  # noqa: E402

# JavaScript のエラーを調べるページ（公開サイトの全ページと、URL の指定で表示が変わるもの）
PAGES = ["index.html", "songs.html", "tour.html", "event.html", "calendar.html", "my.html", "my_c.html", "my_f.html",
         "sub/setlist.html", "sub/search.html"]
NAV = ["index.html", "songs.html", "tour.html", "event.html", "calendar.html", "my.html", "my_c.html", "my_f.html"]


def browser():
    for name in [os.environ.get("CHROMIUM"), "chromium", "chromium-browser", "google-chrome", "google-chrome-stable"]:
        if name and shutil.which(name):
            return shutil.which(name)
    return None


class _QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass


@contextlib.contextmanager
def serve(directory):
    handler = functools.partial(_QuietHandler, directory=str(directory))
    server = http.server.ThreadingHTTPServer(("127.0.0.1", 0), handler)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    try:
        yield f"http://127.0.0.1:{server.server_address[1]}"
    finally:
        server.shutdown()
        server.server_close()


def run_chromium(url, timeout=240):
    """url を開いて、表示後の HTML とブラウザのログ（console の出力やエラー）を返す。"""
    # snap の Chromium は /tmp を読み書きできないので、プロフィールはホームの下に作る
    snap_dir = Path.home() / "snap" / "chromium" / "common"
    with tempfile.TemporaryDirectory(dir=snap_dir if snap_dir.exists() else None) as profile:
        proc = subprocess.run(
            [browser(), "--headless", "--no-sandbox", "--disable-gpu", f"--user-data-dir={profile}",
             "--enable-logging=stderr", "--v=0", "--virtual-time-budget=600000", "--dump-dom", url],
            capture_output=True, text=True, timeout=timeout)
    # 例: [123:123:1124/002007.794397:INFO:CONSOLE:1] "Uncaught ReferenceError: x is not defined", source: ... (1)
    console = [re.sub(r"^\[[^\]]*:CONSOLE[^\]]*\] ", "", line) for line in proc.stderr.splitlines() if ":CONSOLE" in line]
    return proc.stdout, console


@unittest.skipUnless(browser() or os.environ.get("REQUIRE_BROWSER") == "1",
                     "Chromium がないので画面のテストを飛ばします")
class PageTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        if not browser():
            raise RuntimeError("Chromium（または Google Chrome）が見つかりません")
        cls._tmp = tempfile.TemporaryDirectory()
        site = Path(cls._tmp.name) / "site"
        build_site.build(site)
        shutil.copy(HERE / "probe.js", site / "__probe.js")
        (site / "__probe.html").write_text(
            '<!DOCTYPE html><meta charset="utf-8"><body><script src="__probe.js"></script></body>', encoding="utf-8")
        cls._server = serve(site)
        cls.base = cls._server.__enter__()
        # 公演 ID は日付順なので、ID で並べると古い順になる
        cls.lives = sorted(json.loads((site / "setlist.json").read_text(encoding="utf-8")), key=lambda l: l["id"])

    @classmethod
    def tearDownClass(cls):
        cls._server.__exit__(None, None, None)
        cls._tmp.cleanup()

    def probe(self, check):
        out, console = run_chromium(f"{self.base}/__probe.html?check={check}")
        found = re.search(r'<pre id="result">(.*?)</pre>', out, re.S)
        self.assertIsNotNone(found, f"{check}: 結果を取得できませんでした\n" + "\n".join(console[-20:]))
        result = json.loads(html.unescape(found.group(1)))
        self.assertNotIn("error", result, result.get("error"))
        return result

    def test_no_javascript_errors(self):
        # どのページも、開いたときに JavaScript のエラーやログが出ない（読み込みの失敗も含む）
        first, last = self.lives[0]["id"], self.lives[-1]["id"]
        urls = PAGES + [f"tour.html?tour={self.lives[-1].get('tourtitle') or ''}",
                        f"sub/setlist.html?id={first}", f"sub/setlist.html?id={last}", "sub/setlist.html?id=0000000000",
                        "sub/search.html?name=Raise"]
        for url in urls:
            with self.subTest(url=url):
                _, console = run_chromium(f"{self.base}/{url}")
                self.assertEqual(console, [])

    def test_index(self):
        r = self.probe("index")
        self.assertEqual(r["stats"], r["expectedStats"])
        self.assertEqual(r["todayLabel"], r["expectedTodayLabel"])
        self.assertTrue(r["todayFilled"])
        self.assertTrue(r["upcomingFilled"])
        self.assertEqual(r["recentCount"], 6)
        self.assertTrue(r["recentLinksValid"])

    def test_songs_search_and_sort(self):
        r = self.probe("songs")
        f = r["filtered"]
        self.assertGreaterEqual(f["shown"], 1)
        self.assertLess(f["shown"], r["total"])
        self.assertTrue(f["allMatch"], f["term"])
        self.assertEqual(f["countText"], f"{f['shown']} / {r['total']}曲")
        self.assertEqual(r["none"], 0)
        self.assertEqual(r["cleared"], {"shown": r["total"], "countText": f"{r['total']}曲"})
        # 見出しの印（▲ 昇順・▼ 降順）と実際の並びが合い、押すたびに向きが変わる
        for click in (r["first"], r["second"]):
            with self.subTest(sort=click["sort"]):
                self.assertIn(click["sort"], ("ascending", "descending"))
                self.assertEqual(click["counts"], sorted(click["counts"], reverse=click["sort"] == "descending"))
        self.assertNotEqual(r["first"]["sort"], r["second"]["sort"])
        self.assertEqual(r["sortedHeaders"], 1)

    def test_tour_link_selects_tour(self):
        r = self.probe("tour")
        self.assertEqual(r["selected"], r["tour"])
        self.assertGreater(r["rows"], 0)

    def test_event_filters(self):
        r = self.probe("event")
        before, after, cleared = r["before"], r["after"], r["cleared"]
        self.assertEqual(before["count"], before["rows"])
        self.assertGreaterEqual(after["rows"], 1)
        self.assertLessEqual(after["rows"], before["rows"])
        self.assertEqual(after["count"], after["rows"])
        self.assertTrue(after["allMatch"])
        self.assertCountEqual(after["labels"], [after["year"], after["class1"]])
        self.assertEqual(cleared, {"count": before["count"], "rows": before["rows"], "active": 0})

    def test_setlist_labels(self):
        r = self.probe("setlist")
        for live_id, v in r["lives"].items():
            with self.subTest(live=live_id):
                self.assertEqual(v["actual"], v["expected"])
        first = r["lives"][self.lives[0]["id"]]["actual"]
        self.assertTrue(all(label == "初披露" for _, label in first))
        self.assertEqual(r["notFound"], "指定された公演が見つかりません。")
        self.assertEqual(r["noId"], "公演が指定されていません。")

    def test_navigation_and_footer(self):
        r = self.probe("common")
        self.assertIsNotNone(r["expectedUpdated"])
        for page, v in r["pages"].items():
            with self.subTest(page=page):
                self.assertEqual(v["links"], NAV)
                self.assertEqual(v["status"], [200] * len(NAV))
                name = page.split("?")[0]
                # 今のページに印が付く（トップと sub/ のページは、どれにも付かない）
                self.assertEqual(v["current"], [] if name in ("index.html",) or name.startswith("sub/") else [name])
                self.assertEqual(v["updated"], r["expectedUpdated"])


if __name__ == "__main__":
    unittest.main()
