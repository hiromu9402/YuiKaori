"""公開サイトのファイルだけを出力先に集める（GitHub Pages で公開する内容）。

許可リスト（site_files.py）に合うファイルだけをコピーする。GitHub Actions（.github/workflows/pages.yml）で使うほか、
公開される内容を手元で確かめるときにも使う。

あわせて meta.json を作り、データのファイル（site_files.DATA_FILES）が最後に変わったコミットの日時を
data_updated に入れる（フッターの「データ更新」に出す）。git の履歴が要るので、Actions では全履歴を取得する。

    python3 tools/build_site.py _site
"""
import argparse
import json
import shutil
import subprocess
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from site_files import DATA_FILES, SITE_DIR, public_files  # noqa: E402


def data_updated(site_dir=SITE_DIR):
    """データのファイルが最後に変わったコミットの日時（ISO 8601、例: 2026-09-28T11:19:07+09:00）を返す。"""
    proc = subprocess.run(["git", "-C", str(site_dir), "log", "-1", "--format=%cI", "--", *DATA_FILES],
                          capture_output=True, text=True)
    value = proc.stdout.strip()
    if proc.returncode != 0 or not value:
        # 履歴が取れないまま公開すると、間違った日付が出るので止める
        raise SystemExit(f"データの更新日を git の履歴から取れませんでした: {proc.stderr.strip() or '該当するコミットがありません'}")
    return value


def build(out_dir, site_dir=SITE_DIR):
    """out_dir に公開ファイルをコピーし、コピーしたファイルの相対パスを返す。out_dir は空か、まだないこと。"""
    out_dir = Path(out_dir)
    if out_dir.exists() and any(out_dir.iterdir()):
        raise SystemExit(f"出力先が空ではありません: {out_dir}")
    files = public_files(site_dir)
    for rel in files:
        dest = out_dir / rel
        dest.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(Path(site_dir) / rel, dest)
    meta = {"data_updated": data_updated(site_dir)}
    (out_dir / "meta.json").write_text(json.dumps(meta, ensure_ascii=False) + "\n", encoding="utf-8")
    return files + ["meta.json"]


def main():
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("out_dir", help="出力先のディレクトリ（空か、まだないこと）")
    args = parser.parse_args()
    files = build(args.out_dir)
    print(f"{len(files)} 個のファイルを {args.out_dir} に書き出しました")


if __name__ == "__main__":
    main()
