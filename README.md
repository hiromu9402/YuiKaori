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
- `admin/` … データを編集する管理画面（Django + SQLite）。公開用の JSON はここから書き出します。使い方は [admin/README.md](admin/README.md)。
- `.github/workflows/pages.yml` … `main` に push されると、公開サイトのファイルだけを GitHub Pages に公開します。公開するファイルは `admin/deploy/site_files.py` の許可リストで決めていて、`admin/` やこの README は公開されません。

## データの更新の流れ

1. 管理画面でデータを直す。
2. 管理画面の「公開ファイルの書き出し」で、直下の JSON を書き出す。
3. 差分を確かめて commit し、`main` に push する（Actions が Pages に公開する）。
