// 公開ページの共通処理。
// 選択肢やチェックボックスは、管理画面から書き出した tours.json / checklist.json から作る。

async function fetchJSON(path) {
  const response = await fetch(path);
  return response.json();
}

// ツアーセットリスト比較ページ（tour.html）の選択肢を作り、初期選択（なければ先頭）の比較表を表示する
async function renderTourOptions(select) {
  const data = await fetchJSON('tours.json');
  // tour.html?tour=ツアー名 で開いたときは、そのツアーを選ぶ（セットリストのページからのリンク用）
  const wanted = new URLSearchParams(window.location.search).get('tour');
  const all = data.groups.flatMap(group => group.tours);
  const initial = all.includes(wanted) ? wanted : data.default;
  for (const group of data.groups) {
    const optgroup = document.createElement('optgroup');
    optgroup.label = group.group;
    for (const title of group.tours) {
      const option = document.createElement('option');
      option.value = title;
      option.textContent = title;
      option.selected = title === initial;
      optgroup.appendChild(option);
    }
    select.appendChild(optgroup);
  }
  if (select.value) select.dispatchEvent(new Event('change'));
}

// ---- 未回収楽曲チェックツール（my.html / my_c.html / my_f.html） ----

let songData;
let setlistData;

// setlist / encore / Wencore（配列または文字列）から、メドレーを展開した曲名の一覧を作る
function extractSongs(arr) {
  if (!Array.isArray(arr)) arr = arr ? [arr] : [];
  const songs = [];
  arr.forEach(item => {
    if (typeof item === 'string') {
      songs.push(item);
    } else if (item && Array.isArray(item.medley)) {
      songs.push(...item.medley);
    }
  });
  return songs;
}

function renderChecklist(container, groups) {
  // ツアー・シリーズごとに折りたためる行を作る。行を押すと公演のボタン（チェックボックス）が開く。
  // 最初は、いちばん新しいツアー（先頭）だけを開いておく。
  groups.forEach((group, index) => {
    const box = document.createElement('details');
    box.className = 'cl-group';
    box.open = index === 0;
    const summary = document.createElement('summary');
    const heading = document.createElement('h3');
    const strong = document.createElement('strong');
    strong.textContent = group.heading;
    heading.appendChild(strong);
    const badge = document.createElement('span');
    badge.className = 'cl-badge';
    summary.append(heading, badge);
    const lives = document.createElement('div');
    lives.className = 'cl-lives';
    group.lives.forEach(live => {
      const label = document.createElement('label');
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.id = live.id;
      checkbox.className = 'checkbox';
      checkbox.addEventListener('change', checkMissingSongs);
      label.append(checkbox, live.label);
      lives.append(label, ' ');
    });
    if (group.lives.length > 1) {
      // そのツアーの公演をまとめて選ぶ・外す
      const all = document.createElement('button');
      all.type = 'button';
      all.className = 'cl-all';
      all.addEventListener('click', () => {
        const boxes = [...lives.querySelectorAll('.checkbox')];
        const on = !boxes.every(cb => cb.checked);
        boxes.forEach(cb => { cb.checked = on; });
        checkMissingSongs();
      });
      lives.appendChild(all);
    }
    box.append(summary, lives);
    container.appendChild(box);
  });
  updateChecklistBadges();
}

// 各ツアーの行に、公演数（「9公演」）または選んだ数（「2/9」）を出す
function updateChecklistBadges() {
  document.querySelectorAll('.cl-group').forEach(group => {
    const boxes = [...group.querySelectorAll('.checkbox')];
    const n = boxes.filter(cb => cb.checked).length;
    const badge = group.querySelector('.cl-badge');
    badge.textContent = n ? `${n}/${boxes.length}` : `${boxes.length}公演`;
    badge.classList.toggle('on', n > 0);
    const all = group.querySelector('.cl-all');
    if (all) all.textContent = n === boxes.length ? '全部外す' : '全部選ぶ';
  });
}

function toggleChecklistGroups(open) {
  document.querySelectorAll('.cl-group').forEach(group => { group.open = open; });
}

function clearChecklist() {
  document.querySelectorAll('.checkbox:checked').forEach(cb => { cb.checked = false; });
  checkMissingSongs();
}

// 選んだ公演の数と未回収の曲数を、結果欄の見出しとスマホ用の下のバーに出す
function showChecklistSummary(checked, missing) {
  const text = checked === 0 ? '公演を選ぶと、まだ聴いていない曲が出ます'
    : `${checked}公演を選択中 ・ 未回収 ${missing}曲`;
  document.querySelectorAll('.cl-summary').forEach(el => { el.textContent = text; });
  document.querySelectorAll('.cl-clear').forEach(el => { el.hidden = checked === 0; });
  updateChecklistBadges();
}

function checkMissingSongs() {
  const searchResults = document.getElementById('searchResults');
  const checkedIds = Array.from(document.querySelectorAll('.checkbox:checked')).map(cb => cb.id);
  if (checkedIds.length === 0) {
    searchResults.innerHTML = '';
    showChecklistSummary(0, 0);
    return;
  }
  if (!songData || !setlistData) {
    return;
  }
  const missingSongs = songData.map(song => song.title).filter(title => {
    return !setlistData.some(event => {
      if (!checkedIds.includes(event.id)) return false;
      return ['setlist', 'encore', 'Wencore'].some(section => extractSongs(event[section]).includes(title));
    });
  });
  searchResults.innerHTML = '';
  const count = document.createElement('p');
  count.textContent = `未回収楽曲数: ${missingSongs.length}`;
  const list = document.createElement('ul');
  missingSongs.forEach(title => {
    const item = document.createElement('li');
    const link = document.createElement('a');
    link.href = `sub/search.html?name=${encodeURIComponent(title)}`;
    link.textContent = title;
    item.appendChild(link);
    list.appendChild(item);
  });
  searchResults.append(count, list);
  showChecklistSummary(checkedIds.length, missingSongs.length);
}

// artist: 対象のアーティスト名（checklist.json のキーと song.json の artist）
async function initChecklistPage(artist) {
  const [songs, setlists, checklist] = await Promise.all(
    [fetchJSON('song.json'), fetchJSON('setlist.json'), fetchJSON('checklist.json')]);
  renderChecklist(document.getElementById('checklist'), checklist[artist] || []);
  songData = songs.filter(song => song.artist === artist);
  setlistData = setlists;
}
