// 公開ページの共通処理。
// 選択肢やチェックボックスは、管理画面から書き出した tours.json / checklist.json から作る。

async function fetchJSON(path) {
  const response = await fetch(path);
  return response.json();
}

// ツアーセットリスト比較ページ（tour.html）の選択肢を作る
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
  groups.forEach((group, index) => {
    if (index > 0) container.appendChild(document.createElement('br'));
    const heading = document.createElement('h3');
    const strong = document.createElement('strong');
    strong.textContent = group.heading;
    heading.appendChild(strong);
    container.appendChild(heading);
    group.lives.forEach(live => {
      const label = document.createElement('label');
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.id = live.id;
      checkbox.className = 'checkbox';
      checkbox.addEventListener('change', checkMissingSongs);
      label.append(checkbox, live.label);
      container.append(label, ' ');
    });
  });
}

function checkMissingSongs() {
  const searchResults = document.getElementById('searchResults');
  const checkedIds = Array.from(document.querySelectorAll('.checkbox:checked')).map(cb => cb.id);
  if (checkedIds.length === 0) {
    searchResults.innerHTML = '';
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
  missingSongs.forEach(title => list.append(title, document.createElement('br')));
  searchResults.append(count, list);
}

// artist: 対象のアーティスト名（checklist.json のキーと song.json の artist）
async function initChecklistPage(artist) {
  const [songs, setlists, checklist] = await Promise.all(
    [fetchJSON('song.json'), fetchJSON('setlist.json'), fetchJSON('checklist.json')]);
  renderChecklist(document.getElementById('checklist'), checklist[artist] || []);
  songData = songs.filter(song => song.artist === artist);
  setlistData = setlists;
}
