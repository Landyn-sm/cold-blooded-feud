/* The game screen. It only draws what the control panel tells it to. */
(function () {
  const DATA = Engine.prep(window.GAME_DATA);
  const $ = id => document.getElementById(id);
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const bc = 'BroadcastChannel' in window ? new BroadcastChannel('cbf') : null;
  let prev = null, dyeKey = null, rulesKey = null, lastId = null, boardKey = null, xTimer = null, bTimer = null, lastScreen = null;

  function fit() {
    const s = Math.min(innerWidth / 1920, innerHeight / 1080);
    $('stage').style.transform = 'translate(-50%,-50%) scale(' + s + ')';
  }
  addEventListener('resize', fit); fit();

  // Press F (or double click) on this window for full screen.
  const goFull = () => { if (!document.fullscreenElement) document.documentElement.requestFullscreen().catch(() => {}); else document.exitFullscreen(); };
  addEventListener('keydown', e => { if (e.key === 'f' || e.key === 'F') goFull(); });
  addEventListener('dblclick', goFull);

  function setNum(el, target) {
    const from = el._v == null ? target : el._v;
    el._v = target;
    if (from === target) { el.textContent = target; return; }
    el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump');
    const t0 = performance.now();
    cancelAnimationFrame(el._raf);
    (function step(now) {
      const k = Math.min(1, (now - t0) / 600);
      el.textContent = Math.round(from + (target - from) * k);
      if (k < 1) el._raf = requestAnimationFrame(step);
    })(t0);
  }

  // Tie-dye spiral: three arms, wobbled so the bands look hand dyed. The colours heat up
  // for double (purple) and triple (orange) rounds.
  const DYES = {
    1: [[11, 79, 122], [20, 121, 168], [42, 170, 226], [127, 211, 245], [176, 228, 249], [127, 211, 245], [42, 170, 226], [20, 121, 168]],
    2: [[52, 20, 74], [115, 60, 128], [160, 90, 178], [205, 150, 222], [236, 208, 244], [205, 150, 222], [160, 90, 178], [115, 60, 128]],
    3: [[150, 36, 20], [224, 101, 53], [240, 156, 83], [255, 200, 110], [255, 232, 170], [255, 200, 110], [240, 156, 83], [224, 101, 53]]
  };
  function paintDye(key) {
    if (!DYES[key]) key = 1;
    if (key === dyeKey) return;
    dyeKey = key;
    const c = $('dye'), N = 800, g = c.getContext('2d'), P = DYES[key];
    c.width = c.height = N;
    const im = g.createImageData(N, N), d = im.data;
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const dx = x - N / 2, dy = y - N / 2, r = Math.sqrt(dx * dx + dy * dy), a = Math.atan2(dy, dx);
      const n = Math.sin(x * 0.021 + Math.sin(y * 0.017) * 2.2) * 0.5 + Math.sin(y * 0.026 + Math.sin(x * 0.014) * 2.6) * 0.5 + Math.sin((x + y) * 0.09) * 0.12;
      let t = a / (2 * Math.PI) * 3 + r * 0.0105 + n * 0.11;
      t = ((t % 1) + 1) % 1 * P.length;
      const i = Math.floor(t) % P.length, A = P[i], B = P[(i + 1) % P.length];
      let f = t - Math.floor(t); f = f * f * (3 - 2 * f);
      const o = (y * N + x) * 4;
      d[o] = A[0] + (B[0] - A[0]) * f; d[o + 1] = A[1] + (B[1] - A[1]) * f; d[o + 2] = A[2] + (B[2] - A[2]) * f; d[o + 3] = 255;
    }
    g.putImageData(im, 0, 0);
  }

  const COLS = ['#FFC216', '#2AAAE2', '#733C80', '#F09C53', '#E06535', '#fff'];

  // A burst of confetti from the middle of the screen.
  function burst(n) {
    const st = $('stage');
    for (let i = 0; i < n; i++) {
      const c = document.createElement('div');
      c.className = 'confb'; c.style.background = COLS[i % 6];
      c.style.left = (960 + (Math.random() - 0.5) * 500) + 'px';
      st.appendChild(c);
      const dx = (Math.random() - 0.5) * 1900, up = -(300 + Math.random() * 600), rot = (Math.random() - 0.5) * 1400;
      c.animate([
        { transform: 'translate(0,0) rotate(0deg)' },
        { transform: 'translate(' + dx * 0.6 + 'px,' + up + 'px) rotate(' + rot * 0.5 + 'deg)', offset: 0.35 },
        { transform: 'translate(' + dx + 'px,700px) rotate(' + rot + 'deg)' }
      ], { duration: 1600 + Math.random() * 1200, easing: 'cubic-bezier(.2,.6,.4,1)' }).onfinish = () => c.remove();
    }
  }

  // "+30" popping off a tile when it flips.
  function floatPts(tile, n) {
    const g = $('grid'), f = document.createElement('div');
    f.className = 'float'; f.textContent = '+' + n;
    f.style.left = (g.offsetLeft + tile.offsetLeft + tile.offsetWidth - 190) + 'px';
    f.style.top = (g.offsetTop + tile.offsetTop - 20) + 'px';
    $('s-board').appendChild(f);
    setTimeout(() => f.remove(), 1300);
  }

  // The pot flying over to the team that won it.
  function flyPot(team, n) {
    const f = document.createElement('div');
    f.className = 'fly'; f.textContent = '+' + n;
    $('s-board').appendChild(f);
    const end = 'translate(calc(-50% + ' + ((team === 0 ? 146 : 1774) - 960) + 'px), calc(-50% + 440px))';
    f.animate([
      { transform: 'translate(-50%,-50%) scale(.6)', opacity: 0 },
      { transform: 'translate(-50%,-50%) scale(1.5)', opacity: 1, offset: 0.25 },
      { transform: end + ' scale(.8)', opacity: 1, offset: 0.9 },
      { transform: end + ' scale(.2)', opacity: 0 }
    ], { duration: 1200, easing: 'ease-in-out' }).onfinish = () => f.remove();
  }

  function buildGrid(r) {
    let h = '';
    for (let i = 0; i < 8; i++) {
      const a = r.answers[i];
      if (!a) { h += '<div class="tile empty"><div class="inner"><div class="front"></div></div></div>'; continue; }
      const cls = a.text.length > 24 ? 's' : a.text.length > 17 ? 'm' : '';
      h += '<div class="tile" data-i="' + i + '"><div class="inner"><div class="front"><span class="num">' + (i + 1) +
        '</span></div><div class="back"><span class="atext ' + cls + '">' + esc(a.text) + '</span><span class="apts">' + a.points + '</span></div></div></div>';
    }
    $('grid').innerHTML = h;
  }

  function render(s) {
    document.querySelectorAll('.screen').forEach(el => el.classList.toggle('on', el.id === 's-' + s.screen));
    if (s.screen !== lastScreen) {           // replay the entrance animation of the new screen
      const sc = $('s-' + s.screen);
      sc.classList.remove('enter'); void sc.offsetWidth; sc.classList.add('enter');
      lastScreen = s.screen;
      if (prev && (s.screen === 'winner' || s.screen === 'outro')) { burst(140); setTimeout(() => burst(100), 900); }
    }
    const r = DATA.rounds[s.roundIdx];

    if ($('t-title')._t !== DATA.title) {      // each word drops in on its own
      $('t-title')._t = DATA.title;
      $('t-title').innerHTML = DATA.title.split(' ').map((w, i) => '<span class="w" style="animation-delay:' + (0.55 + i * 0.22) + 's">' + esc(w) + '</span>').join(' ');
    }
    $('bk-title').textContent = DATA.title;
    $('t-sub').textContent = DATA.subtitle;
    $('t-tag').textContent = DATA.surveyLine;

    s.teams.forEach((t, i) => {
      $('ro-n' + i).textContent = t.name;
      $('ro-p' + i).innerHTML = t.players.map(p => '<li>' + esc(p) + '</li>').join('');
      const el = $('team' + i);
      el.querySelector('.tname').textContent = t.name;
      setNum(el.querySelector('.tscore'), t.score);
      const playing = s.phase === 'play' && s.control === i;
      const stealing = s.phase === 'steal' && s.control === 1 - i;
      el.classList.toggle('active', playing || stealing);
      el.classList.toggle('buzzed', s.buzzed === i);
      el.classList.toggle('lead', t.score > s.teams[1 - i].score);
      el.querySelector('.tstatus').textContent = stealing ? 'STEAL' : playing ? 'PLAYING' : '';
    });

    const pg = (DATA.rulesPages || [])[s.rulesPage || 0] || { title: '', items: [] };
    $('ru-title').textContent = pg.title;
    if (rulesKey !== (s.rulesPage || 0)) {
      rulesKey = s.rulesPage || 0;
      $('ru-list').className = pg.items.length > 6 ? 'tight' : '';
      $('ru-list').innerHTML = pg.items.map((t, i) => '<div class="rule"><b>' + (i + 1) + '</b><span>' + esc(t) + '</span></div>').join('');
      void $('ru-list').offsetWidth;
    }
    Array.prototype.forEach.call($('ru-list').children, (el, i) => el.classList.toggle('show', i < (s.rulesShown || 0)));

    $('rc-label').textContent = r.label;
    $('rc-mult').textContent = r.multiplier === 2 ? 'DOUBLE POINTS' : r.multiplier === 3 ? 'TRIPLE POINTS' : '';

    const fo = s.teams.map(t => t.players[s.roundIdx % t.players.length]);
    $('rc-face').textContent = DATA.showFaceoffNames === false || fo.some(n => /^Player d+$/.test(n)) ? '' : 'FACE-OFF: ' + fo[0] + ' vs ' + fo[1];
    paintDye(s.screen === 'roundcard' || s.screen === 'board' ? r.multiplier : 1);

    const fresh = boardKey !== s.roundIdx;
    if (fresh) { buildGrid(r); boardKey = s.roundIdx; }
    document.querySelectorAll('#grid .tile[data-i]').forEach(t => {
      const on = !!s.revealed[+t.dataset.i];
      if (on && !t.classList.contains('rev') && !fresh) {
        t.classList.remove('pop'); void t.offsetWidth; t.classList.add('pop');
        const got = (s.counted || [])[+t.dataset.i];
        if (got > 0) floatPts(t, got);
      }
      t.classList.toggle('rev', on);
    });
    $('roundlabel').textContent = r.label + (r.multiplier > 1 ? '  x' + r.multiplier : '');
    setNum($('pot'), s.pot);
    if (prev && prev.roundIdx === s.roundIdx && prev.awardedTo == null && s.awardedTo != null && s.pot > 0) flyPot(s.awardedTo, s.pot);
    $('question').textContent = r.question;
    $('question').classList.toggle('on', !!s.showQuestion);
    $('strikes').classList.toggle('on', s.phase === 'play' || s.phase === 'steal' || s.strikes > 0);
    document.querySelectorAll('#strikes .sx').forEach((x, i) => x.classList.toggle('hit', i < s.strikes));

    // Lightning round
    $('fm-title').textContent = DATA.fastMoney.label;
    s.fm.answers.forEach((col, p) => {
      $('fm-c' + p).innerHTML = col.map((a, q) => {
        const hide = p === 0 && s.fm.hideP1;
        return '<div class="fmrow"><div class="fmtext">' + (a.text && !hide ? esc(a.said) : '') + '</div><div class="fmpts">' +
          (a.pts && !hide ? Engine.fmPoints(s, DATA, p, q) : '') + '</div></div>';
      }).join('');
    });
    const tl = s.fm.timeLeft;
    $('fm-tnum').textContent = tl == null ? '' : tl;
    const tfull = DATA.fastMoney.times[s.fm.stage || 0] || 20;
    $('fm-timer').style.background = 'conic-gradient(var(--ink) ' + (tl == null ? 0 : (1 - tl / tfull) * 100) + '%, ' + (tl != null && tl <= 5 ? 'var(--red)' : 'var(--gold)') + ' 0)';
    $('fm-timer').style.visibility = tl == null ? 'hidden' : 'visible';
    $('fm-timer').classList.toggle('low', tl != null && tl <= 5);
    const total = Engine.fmTotal(s, DATA);
    $('fm-total').innerHTML = 'TOTAL <b>' + total + '</b>';
    $('fm-total').classList.toggle('won', !!s.fm.won);

    $('o-title').textContent = DATA.closingTitle || 'THANKS FOR PLAYING!';
    $('o-line').textContent = DATA.closingLine || '';
    $('o-result').textContent = s.fm.won ? 'LIGHTNING ROUND WON WITH ' + total + ' POINTS'
      : s.fm.lost ? 'LIGHTNING ROUND: ' + total + ' POINTS' : '';

    const w = s.winner == null ? (s.teams[0].score >= s.teams[1].score ? 0 : 1) : s.winner;
    $('w-name').textContent = s.teams[w].name;
    $('w-name').style.color = w === 1 ? 'var(--orange)' : 'var(--gold)';
    $('w-score').textContent = s.teams[w].score + ' POINTS';
    $('o-champ').textContent = 'CHAMPIONS: ' + s.teams[w].name;
    prev = s;
  }

  function fx(f) {
    if (f.delay) { const g = Object.assign({}, f, { delay: 0 }); setTimeout(() => fx(g), f.delay); return; }
    if (f.type === 'confetti') { burst(f.n || 80); return; }
    if (f.type === 'banner') {
      const b = $('banner');
      b.textContent = f.text;
      b.className = 'on' + (f.team === 1 ? ' t1' : '');
      void b.offsetWidth; b.classList.add('go');
      clearTimeout(bTimer);
      bTimer = setTimeout(() => { b.className = ''; }, 2600);
      return;
    }
    const o = $('xoverlay'), st = $('stage');
    if (f.type === 'strike') o.innerHTML = Array(f.n + 1).join('<div class="bigx">X</div>');
    else if (f.type === 'dup') o.innerHTML = '<div class="bigmsg">TRY AGAIN</div>';
    else return;
    o.classList.add('on');
    st.classList.remove('shake'); void st.offsetWidth; st.classList.add('shake');
    clearTimeout(xTimer);
    xTimer = setTimeout(() => o.classList.remove('on'), 1400);
  }

  function onMsg(m) {
    if (!m || m.type !== 'state' || m.id === lastId) return;
    lastId = m.id;
    render(m.state);
    (m.fx || []).forEach(fx);
  }
  addEventListener('message', e => onMsg(e.data));
  if (bc) bc.onmessage = e => onMsg(e.data);

  // Confetti for the winner screen.
  const cols = COLS;
  let ch = '';
  for (let i = 0; i < 70; i++) ch += '<div class="conf" style="left:' + (Math.random() * 100) + '%;background:' + cols[i % 6] +
    ';animation-duration:' + (3 + Math.random() * 4) + 's;animation-delay:-' + (Math.random() * 6) + 's"></div>';
  $('confetti').innerHTML = ch;

  // Spiky starburst behind the round card.
  let star = [];
  for (let i = 0; i < 40; i++) {
    const rr = i % 2 ? 50 : 41, an = i / 40 * 2 * Math.PI;
    star.push((50 + rr * Math.cos(an)).toFixed(2) + '% ' + (50 + rr * Math.sin(an)).toFixed(2) + '%');
  }
  document.querySelectorAll('.star').forEach(el => { el.style.clipPath = 'polygon(' + star.join(',') + ')'; });

  // Chasing marquee bulbs along the top and bottom edges.
  let bulbs = '';
  for (let i = 0; i < 48; i++) bulbs += '<i style="animation-delay:' + (i % 4) * 0.2 + 's"></i>';
  document.querySelectorAll('.bulbs').forEach(el => { el.innerHTML = bulbs; });

  // First paint: last saved game if there is one, then ask the control panel for the live state.
  let first = Engine.newState(DATA);
  try {
    const saved = JSON.parse(localStorage.getItem('cbf_state_v3'));
    if (saved && saved.sig === JSON.stringify(DATA).length) first = saved.state;
  } catch (e) {}

  const demo = new URLSearchParams(location.search).get('demo');
  if (demo) {
    first = Engine.newState(DATA);
    first.screen = demo;
    first.teams[0].score = 142; first.teams[1].score = 87;
    Engine.act(first, DATA, { t: 'reveal', i: 0 }); Engine.act(first, DATA, { t: 'control', team: 0 });
    Engine.act(first, DATA, { t: 'reveal', i: 3 }); Engine.act(first, DATA, { t: 'strike' }); Engine.act(first, DATA, { t: 'strike' });
    first.showQuestion = true; first.screen = demo;
    ['Bearded dragon', 'Crickets', 'No heat lamp', 'Goldfish', 'Zeus'].forEach((t, q) => {
      first.fm.answers[0][q] = { said: t, match: q % 3, text: true, pts: q < 4 };
    });
    first.fm.timeLeft = 4; first.rulesShown = 7; first.rulesPage = +(new URLSearchParams(location.search).get('page') || 0); if (demo === 'outro') first.fm.won = true;
  }
  render(first);
  if (demo && new URLSearchParams(location.search).get('x')) { $('xoverlay').innerHTML = Array(4).join('<div class="bigx">X</div>'); $('xoverlay').classList.add('on'); $('banner').textContent = 'TEAM CRABS CAN STEAL!'; $('banner').className = 'on t1'; }

  const hello = { type: 'hello' };
  if (window.opener) { try { window.opener.postMessage(hello, '*'); } catch (e) {} }
  if (bc) bc.postMessage(hello);
})();
