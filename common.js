// 公開ページの共通処理。
// 選択肢やチェックボックスは、管理画面から書き出した tours.json / checklist.json から作る。

async function fetchJSON(path) {
  const response = await fetch(path);
  return response.json();
}

// ツアーセットリスト比較ページ（tour.html）の選択肢を作り、初期選択（なければ先頭）の比較表を表示する
async function renderTourOptions(select) {
  const data = await fetchJSON('tours.json');
  for (const group of data.groups) {
    const optgroup = document.createElement('optgroup');
    optgroup.label = group.group;
    for (const title of group.tours) {
      const option = document.createElement('option');
      option.value = title;
      option.textContent = title;
      option.selected = title === data.default;
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
  // ツアー・シリーズごとに、見出し（h3）と公演のチェックボックス（丸いボタンの見た目）をまとめる
  groups.forEach(group => {
    const box = document.createElement('div');
    box.className = 'cl-group';
    const heading = document.createElement('h3');
    const strong = document.createElement('strong');
    strong.textContent = group.heading;
    heading.appendChild(strong);
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
    box.append(heading, lives);
    container.appendChild(box);
  });
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
