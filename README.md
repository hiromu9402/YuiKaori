# ゆいかおり データベース

小倉唯・石原夏織・ゆいかおりの楽曲、CD、ライブのセットリスト、イベントをまとめたサイトです。

- 公開サイト: https://hiromu9402.github.io/YuiKaori/
- 元にしたリポジトリ: [tokiyui/YuiKaori](https://github.com/tokiyui/YuiKaori)（このリポジトリはその fork です）

## ページ

| ページ | 内容 |
|---|---|
| `index.html` | トップ |
| `songs.html` | 楽曲一覧（披露回数など） |
| `tour.html` | ツアー比較 |
| `event.html` | イベント検索 |
| `calendar.html` | カレンダー |
| `my.html`・`my_c.html`・`my_f.html` | 未回収楽曲チェック |
| `sub/setlist.html` | 公演ごとのセットリスト |
| `sub/search.html` | 曲ごとの披露一覧 |

データは直下の JSON（`song.json`・`CD.json`・`setlist.json`・`event.json`・`tours.json`・`checklist.json`）にあり、各ページがそれを読み込んで表示します。

## 構成

- 直下と `sub/` … 公開サイト（静的な HTML・CSS・JS と JSON）
- `tools/` … 公開の仕組み（許可リスト `site_files.py`、公開ファイルを集める `build_site.py`、手元で確かめる `serve_site.py`、そのテスト）
- `tests/` … ページの動きのテスト（headless Chromium）。トップの数字、楽曲一覧の検索と並べ替え、ツアー比較の選択、イベント検索の絞り込み、セットリストの「○回目」、ナビゲーションとフッター、JavaScript のエラーがないことを確かめます。
- `.github/workflows/pages.yml` … `main` に push されると、公開サイトのファイルだけを GitHub Pages に公開します。公開するファイルは `tools/site_files.py` の許可リストで決めていて、`tools/` やこの README は公開されません。

## データの更新の流れ

1. 管理画面（[hiromu9402/YuiKaori-admin](https://github.com/hiromu9402/YuiKaori-admin)、Django + SQLite）でデータを直す。
2. 管理画面の「公開ファイルの書き出し」で、直下の JSON を書き出す。
3. 差分を確かめて commit し、`main` に push する（Actions が Pages に公開する）。

## テスト

```bash
python3 -m unittest discover -s tools -p 'test_*.py'   # 公開の仕組み（許可リスト・meta.json）
python3 -m unittest discover -s tests                  # ページの動き（Chromium か Google Chrome が必要。ないときは飛ばす）
```

PR を出すと、Actions（`.github/workflows/test.yml`）が同じテストを実行します。`main` に push したときは、`pages.yml` がテストを通してから公開します。
