// 全ページ共通: ページの下に、データの更新日と参考にした情報源を出す。
// 更新日は、公開するときに作る meta.json の data_updated（データのファイルが最後に変わったコミットの日時）を表示する。
// meta.json がないとき（手元の確認用サーバーなど）は、データのファイルの最終更新日時（Last-Modified）で代わりにする。
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

  const span = footer.querySelector('.updated');
  const show = d => { span.textContent = `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`; };

  const fromLastModified = () => {
    const files = ['song.json', 'CD.json', 'setlist.json', 'event.json', 'tours.json', 'checklist.json'];
    return Promise.all(files.map(f => fetch(base + f, { method: 'HEAD', cache: 'no-cache' })
      .then(r => r.ok ? r.headers.get('Last-Modified') : null).catch(() => null)))
      .then(values => {
        const times = values.filter(Boolean).map(v => new Date(v)).filter(d => !isNaN(d));
        if (times.length) show(new Date(Math.max(...times))); else span.textContent = '不明';
      });
  };

  fetch(base + 'meta.json', { cache: 'no-cache' })
    .then(r => r.ok ? r.json() : Promise.reject())
    .then(meta => {
      const d = new Date(meta.data_updated);
      if (isNaN(d)) return Promise.reject();
      show(d);
    })
    .catch(fromLastModified);
})();
