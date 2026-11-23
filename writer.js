// 作家（作詞・作曲・編曲）の名前をまとめる共通の処理。
// writers.html・sub/writer.html・songs.html・sub/search.html で使う。
// 作家の欄はただの文字なので、表記のゆれ（「本田正樹」と「本田正樹(Dream Monster)」、全角と半角のかっこ）は、
// 最後のかっこ書き（所属や役割）を外した名前で、同じ作家としてまとめる。
(function (global) {
  const arr = v => Array.isArray(v) ? v : (v ? [v] : []);
  const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const ROLES = [['lyrics', '作詞'], ['music', '作曲'], ['arranger', '編曲']];

  // 同じ作家かどうかを決める名前（かっこ書きを外す。全角のかっこも半角にそろえてから外す）
  const writerKey = name => String(name ?? '').normalize('NFKC').replace(/\s*\([^()]*\)\s*$/, '').trim();

  // 欄の値（文字か、複数のときは配列）を、名前の配列にする
  const writerNames = value => arr(value).flatMap(v => String(v).split(' / ')).map(s => s.trim()).filter(Boolean);

  // 欄の値を、作家ごとのページへのリンクにする（base は、ページから見た公開サイトの直下。例: './'、'../'）
  const writerLinks = (value, base) => writerNames(value).map(n =>
    `<a class="writer" href="${base}sub/writer.html?name=${encodeURIComponent(writerKey(n))}">${esc(n)}</a>`).join(' / ');

  // 作家ごとに、関わった曲と役割をまとめる。{ key: { name, forms: Set, songs: [{ song, roles: [...] }] } }
  function collectWriters(songs) {
    const writers = new Map();
    songs.forEach(song => {
      const bySong = new Map();
      ROLES.forEach(([field, label]) => writerNames(song[field]).forEach(n => {
        const key = writerKey(n);
        if (!writers.has(key)) writers.set(key, { name: key, forms: new Set(), songs: [] });
        writers.get(key).forms.add(n);
        if (!bySong.has(key)) bySong.set(key, []);
        if (!bySong.get(key).includes(label)) bySong.get(key).push(label);
      }));
      bySong.forEach((roles, key) => writers.get(key).songs.push({ song, roles }));
    });
    return writers;
  }

  global.YKWriters = { ROLES, writerKey, writerNames, writerLinks, collectWriters };
})(window);
