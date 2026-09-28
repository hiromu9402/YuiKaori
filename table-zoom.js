// 表のピンチ操作: 表の上を2本指でつまむ・広げると、表の文字の大きさだけが変わる。
// パソコンでは Ctrl＋ホイール（タッチパッドのピンチ）で同じ動きになる。
// .table-wrap を持つページで読み込む。選んだ大きさはページをまたいで覚えておく。
(function () {
  const KEY = 'tableZoom';
  const MIN = 0.5, MAX = 1.6;
  let scale = 1;
  try {
    const s = parseFloat(localStorage.getItem(KEY));
    if (s >= MIN && s <= MAX) scale = s;
  } catch (e) { /* 保存できない環境では毎回 100% から */ }
  const save = () => { try { localStorage.setItem(KEY, String(scale)); } catch (e) {} };
  const outputs = [];
  const wraps = [...document.querySelectorAll('.table-wrap')];

  function show() { outputs.forEach(o => { o.textContent = Math.round(scale * 100) + '%'; }); }

  // 指（またはマウス）の位置 cx, cy にある表の場所が動かないように、スクロール位置も合わせる
  function setScale(wrap, s, cx, cy) {
    s = Math.min(MAX, Math.max(MIN, s));
    const r = wrap.getBoundingClientRect();
    if (cx === undefined) { cx = r.left + r.width / 2; cy = r.top + r.height / 2; }
    const x = cx - r.left, y = cy - r.top, k = s / scale;
    const px = wrap.scrollLeft + x, py = wrap.scrollTop + y;
    scale = s;
    wraps.forEach(w => w.style.setProperty('--z', s));
    wrap.scrollLeft = px * k - x;
    wrap.scrollTop = py * k - y;
    show();
  }

  const dist = t => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);

  wraps.forEach(wrap => {
    wrap.style.setProperty('--z', scale);

    const bar = document.createElement('div');
    bar.className = 'zoombar';
    bar.innerHTML = '<span>表の文字の大きさ</span> <output></output><button type="button">元に戻す</button>' +
      '<span class="how">（表の上を2本指でつまむ・広げると変わります。パソコンでは Ctrl＋ホイール）</span>';
    outputs.push(bar.querySelector('output'));
    bar.querySelector('button').addEventListener('click', () => { setScale(wrap, 1); save(); });
    wrap.parentNode.insertBefore(bar, wrap);

    let pinch = null;
    wrap.addEventListener('touchstart', e => {
      if (e.touches.length === 2) pinch = { d: dist(e.touches), s: scale };
    }, { passive: true });
    wrap.addEventListener('touchmove', e => {
      if (e.touches.length === 2 && pinch) {
        e.preventDefault();
        const cx = (e.touches[0].clientX + e.touches[1].clientX) / 2;
        const cy = (e.touches[0].clientY + e.touches[1].clientY) / 2;
        setScale(wrap, pinch.s * dist(e.touches) / pinch.d, cx, cy);
      }
    }, { passive: false });
    wrap.addEventListener('touchend', e => {
      if (e.touches.length < 2 && pinch) { pinch = null; save(); }
    });
    // iPhone（Safari）の標準の拡大を、表の上だけ止める
    ['gesturestart', 'gesturechange'].forEach(ev => wrap.addEventListener(ev, e => e.preventDefault()));
    wrap.addEventListener('wheel', e => {
      if (e.ctrlKey) {
        e.preventDefault();
        setScale(wrap, scale * Math.exp(-e.deltaY / 250), e.clientX, e.clientY);
        save();
      }
    }, { passive: false });
  });
  show();
})();
