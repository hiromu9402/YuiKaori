// 公開ページを iframe で開いて動かし、確かめたい値を JSON にまとめて <pre id="result"> に出す。
// test_pages.py が __probe.html?check=... として開き、Chromium の --dump-dom で結果を受け取る。
// データの件数には頼らず、JSON から求めた値と画面の表示を比べる（データを更新してもテストを直さなくてよいように）。
const params = new URLSearchParams(location.search);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const arr = v => Array.isArray(v) ? v : (v ? [v] : []);
const songsOf = live => ['setlist', 'encore', 'Wencore']
  .flatMap(k => arr(live[k]).filter(Boolean).flatMap(t => typeof t === 'object' ? t.medley : [t]));
const json = name => fetch(name).then(r => r.json());

async function waitFor(fn, timeout = 20000) {
  const start = Date.now();
  for (;;) {
    let v;
    try { v = fn(); } catch (e) { v = null; }
    if (v) return v;
    if (Date.now() - start > timeout) throw new Error('timeout: ' + fn.toString().slice(0, 120));
    await sleep(50);
  }
}

function openPage(src) {
  return new Promise(resolve => {
    const f = document.createElement('iframe');
    f.style.width = '1200px';
    f.style.height = '800px';
    f.src = src;
    f.onload = () => resolve(f.contentWindow);
    document.body.appendChild(f);
  });
}

// 表の行数が変わらなくなるまで待つ
async function stableRows(doc, selector) {
  let last = -1, same = 0;
  for (;;) {
    const n = doc.querySelectorAll(selector).length;
    if (n > 0 && n === last) { if (++same >= 4) return n; } else { same = 0; last = n; }
    await sleep(100);
  }
}

const checks = {
  // トップ：数字のまとめ・今日の出来事・これからの予定・最近の公演
  async index() {
    const [songs, lives, events] = await Promise.all(['song.json', 'setlist.json', 'event.json'].map(json));
    const w = await openPage('index.html');
    const doc = w.document;
    await waitFor(() => doc.querySelectorAll('#stats b').length === 3 && doc.querySelector('#recent li'));
    const ids = new Set(lives.map(l => l.id));
    const recentLinks = [...doc.querySelectorAll('#recent a')].map(a => new URL(a.href).searchParams.get('id'));
    const now = new Date();
    return {
      stats: [...doc.querySelectorAll('#stats b')].map(b => Number(b.textContent)),
      expectedStats: [songs.length, lives.length, events.length],
      todayLabel: doc.getElementById('todayLabel').textContent,
      expectedTodayLabel: `（${now.getMonth() + 1}月${now.getDate()}日）`,
      todayFilled: !!doc.querySelector('#today li, #today .none'),
      upcomingFilled: !!doc.querySelector('#upcoming li, #upcoming .none'),
      recentCount: recentLinks.length,
      recentLinksValid: recentLinks.every(id => ids.has(id)),
    };
  },

  // 楽曲一覧：検索欄での絞り込みと、並べ替え（見出しの印と並び順）
  async songs() {
    const w = await openPage('songs.html');
    const doc = w.document;
    const total = await stableRows(doc, '#songTable tr');
    const rows = () => [...doc.querySelectorAll('#songTable tr')];
    const visible = () => rows().filter(tr => !tr.hidden);
    const search = doc.getElementById('songSearch');
    const setSearch = value => { search.value = value; search.dispatchEvent(new Event('input')); };

    // 3行目の曲名で絞り込む
    const term = rows()[2].querySelector('td').textContent.trim();
    setSearch(term);
    const filtered = {
      term,
      shown: visible().length,
      allMatch: visible().every(tr => tr.textContent.toLowerCase().includes(term.toLowerCase())),
      countText: doc.getElementById('songCount').textContent,
    };
    setSearch('このことばを含む曲はない' + Date.now());
    const none = visible().length;
    setSearch('');
    const cleared = { shown: visible().length, countText: doc.getElementById('songCount').textContent };

    // 披露回数の見出しを2回押す（押すたびに向きが変わる）
    const th = doc.querySelector('th[data-col="performanceCount"]');
    const counts = () => rows().map(tr => Number(tr.querySelectorAll('td')[4].textContent));
    th.click();
    const first = { sort: th.getAttribute('aria-sort'), counts: counts() };
    th.click();
    const second = { sort: th.getAttribute('aria-sort'), counts: counts() };
    const others = [...doc.querySelectorAll('th[aria-sort]')].length;
    return { total, filtered, none, cleared, first, second, sortedHeaders: others };
  },

  // ツアー比較：セットリストのページの「ツアー比較で見る」から開くと、そのツアーが選ばれている
  async tour() {
    const lives = await json('setlist.json');
    const byTour = {};
    lives.forEach(l => { if (l.tourtitle) (byTour[l.tourtitle] = byTour[l.tourtitle] || []).push(l); });
    const [tour, members] = Object.entries(byTour).find(([, ls]) => ls.length > 1);
    const s = await openPage(`sub/setlist.html?id=${encodeURIComponent(members[0].id)}`);
    const link = await waitFor(() => [...s.document.querySelectorAll('.actions a')].find(a => a.textContent.includes('ツアー比較')));
    const w = await openPage(link.href);
    const select = await waitFor(() => {
      const el = w.document.getElementById('tourSelect');
      return el && el.value ? el : null;
    });
    const rows = await stableRows(w.document, '#concertTable tr, #setlistContainer tr');
    return { tour, selected: select.value, concerts: members.length, rows };
  },

  // イベント検索：年と大分類で絞り込むと、表の行がすべて条件に合い、件数の表示とも合う
  async event() {
    const w = await openPage('event.html');
    const doc = w.document;
    await stableRows(doc, '#eventTable tr');
    await sleep(300);
    const count = () => Number(doc.querySelector('#resultCount b').textContent);
    const dataRows = () => [...doc.querySelectorAll('#eventTable tr')].slice(1)
      .map(tr => [...tr.querySelectorAll('td')].map(td => td.textContent.trim()));
    const before = { count: count(), rows: dataRows().length };

    // 表の1行目の年・大分類で絞り込む（必ず1件以上残る）
    const [year, , , , , class1] = dataRows().find(r => r[0] && r[5]);
    const check = id => {
      const cb = doc.getElementById(id);
      cb.checked = true;
      cb.dispatchEvent(new Event('change'));
    };
    check(`year-${year}`);
    check(`class1-${class1}`);
    await sleep(300);
    const rows = dataRows();
    const after = {
      year, class1, count: count(), rows: rows.length,
      allMatch: rows.every(r => r[0] === year && r[5] === class1),
      labels: [...doc.querySelectorAll('.dd.active .sel')].map(s => s.textContent),
    };
    doc.getElementById('clearFilters').click();
    await sleep(300);
    const cleared = { count: count(), rows: dataRows().length, active: doc.querySelectorAll('.dd.active').length };
    return { before, after, cleared };
  },

  // セットリスト：「初披露」「○回目」のラベルが、それまでの公演で歌った回数と合う。見つからない公演の表示
  async setlist() {
    const lives = (await json('setlist.json')).sort((a, b) => a.id.localeCompare(b.id));
    const labelsOf = async id => {
      const w = await openPage(`sub/setlist.html?id=${encodeURIComponent(id)}`);
      await waitFor(() => w.document.querySelectorAll('#liveInfo .song').length);
      return [...w.document.querySelectorAll('#liveInfo .song')].map(li => [
        li.querySelector('.title').textContent, li.querySelector('.tag.first, .tag.cnt').textContent]);
    };
    const expectedOf = id => {
      const upTo = lives.slice(0, lives.findIndex(l => l.id === id) + 1);
      return songsOf(lives.find(l => l.id === id)).map(title => {
        const n = upTo.filter(l => songsOf(l).includes(title)).length;
        return [title, n === 1 ? '初披露' : `${n}回目`];
      });
    };
    // 最初の公演・中ほどの公演・最後の公演
    const picks = [lives[0], lives[Math.floor(lives.length / 2)], lives[lives.length - 1]].map(l => l.id);
    const out = {};
    for (const id of picks) out[id] = { actual: await labelsOf(id), expected: expectedOf(id) };

    const message = async query => {
      const w = await openPage(`sub/setlist.html${query}`);
      return (await waitFor(() => w.document.querySelector('#liveInfo p'))).textContent;
    };
    return { lives: out, notFound: await message('?id=0000000000'), noId: await message('') };
  },

  // 全ページ共通：ナビゲーション（リンク先があり、今のページに印が付く）とフッター（データ更新の日付）
  async common() {
    const meta = await json('meta.json').catch(() => null);
    const pages = ['index.html', 'songs.html', 'tour.html', 'event.html', 'calendar.html', 'my.html', 'my_c.html',
                   'my_f.html', 'sub/setlist.html?id=' + (await json('setlist.json'))[0].id, 'sub/search.html?name=Raise'];
    const out = {};
    for (const page of pages) {
      const w = await openPage(page);
      const doc = w.document;
      const updated = await waitFor(() => {
        const s = doc.querySelector('.site-footer .updated');
        return s && s.textContent !== '確認中' ? s.textContent : null;
      });
      const links = [...doc.querySelectorAll('.gnav a')];
      const status = await Promise.all(links.map(a => fetch(a.href, { method: 'HEAD' }).then(r => r.status)));
      out[page] = {
        links: links.map(a => new URL(a.href).pathname.split('/').pop()),
        status,
        current: links.filter(a => a.classList.contains('on')).map(a => new URL(a.href).pathname.split('/').pop()),
        updated,
      };
    }
    const d = meta ? new Date(meta.data_updated) : null;
    return { pages: out, expectedUpdated: d ? `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日` : null };
  },
};

(async () => {
  const pre = document.createElement('pre');
  pre.id = 'result';
  try {
    pre.textContent = JSON.stringify(await checks[params.get('check')]());
  } catch (e) {
    pre.textContent = JSON.stringify({ error: String(e && e.stack || e) });
  }
  document.body.appendChild(pre);
})();
