// 全ページ共通: ページの下に、データの更新日と参考にした情報源を出す。
// 更新日は、データのファイル（setlist.json など）の最終更新日時をサーバーから受け取って表示する。
(function () {
  const base = document.currentScript.src.replace(/site\.js(\?.*)?$/, '');
  const footer = document.createElement('footer');
  footer.className = 'site-footer';
  footer.innerHTML =
    '<p><b>データ更新</b> <span class="updated">確認中</span></p>' +
    '<p><b>参考にした情報源</b> 各公式サイト・公式 X、' +
    '<a href="https://www.eventernote.com/" target="_blank" rel="noopener">イベンターノート</a>、' +
    '<a href="https://anifesdb.net/" target="_blank" rel="noopener">AniFesDB</a>、Wikipedia、' +
    'ライブ映像作品の曲目、ファンのみなさんのライブレポート</p>' +
    '<p>ファンが作成している非公式のデータベースです。誤りや抜けがあることがあります。</p>';
  document.body.appendChild(footer);

  const files = ['setlist.json', 'event.json', 'song.json'];
  Promise.all(files.map(f => fetch(base + f, { method: 'HEAD', cache: 'no-cache' })
    .then(r => r.headers.get('Last-Modified')).catch(() => null)))
    .then(values => {
      const times = values.filter(Boolean).map(v => new Date(v)).filter(d => !isNaN(d));
      const span = footer.querySelector('.updated');
      if (!times.length) { span.textContent = '不明'; return; }
      const d = new Date(Math.max(...times));
      span.textContent = `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
    });
})();
