/* The game screen. It only draws what the control panel tells it to. */
(function () {
  const DATA = Engine.prep(window.GAME_DATA);
  const $ = id => document.getElementById(id);
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const bc = 'BroadcastChannel' in window ? new BroadcastChannel('cbf') : null;
  let lastId = null, boardKey = null, xTimer = null, bTimer = null, lastScreen = null;

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
    }
    const r = DATA.rounds[s.roundIdx];

    $('t-title').textContent = DATA.title;
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
      el.querySelector('.tstatus').textContent = stealing ? 'STEAL' : playing ? 'PLAYING' : '';
    });

    $('rc-label').textContent = r.label;
    $('rc-mult').textContent = r.multiplier === 2 ? 'DOUBLE POINTS' : r.multiplier === 3 ? 'TRIPLE POINTS' : '';

    const fresh = boardKey !== s.roundIdx;
    if (fresh) { buildGrid(r); boardKey = s.roundIdx; }
    document.querySelectorAll('#grid .tile[data-i]').forEach(t => {
      const on = !!s.revealed[+t.dataset.i];
      if (on && !t.classList.contains('rev') && !fresh) { t.classList.remove('pop'); void t.offsetWidth; t.classList.add('pop'); }
      t.classList.toggle('rev', on);
    });
    $('roundlabel').textContent = r.label + (r.multiplier > 1 ? '  x' + r.multiplier : '');
    setNum($('pot'), s.pot);
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
    $('fm-timer').textContent = tl == null ? '' : tl;
    $('fm-timer').style.visibility = tl == null ? 'hidden' : 'visible';
    $('fm-timer').classList.toggle('low', tl != null && tl <= 5);
    const total = Engine.fmTotal(s, DATA);
    $('fm-total').innerHTML = 'TOTAL <b>' + total + '</b>';
    $('fm-total').classList.toggle('won', !!s.fm.won);

    const w = s.winner == null ? (s.teams[0].score >= s.teams[1].score ? 0 : 1) : s.winner;
    $('w-name').textContent = s.teams[w].name;
    $('w-name').style.color = w === 1 ? 'var(--orange)' : 'var(--gold)';
    $('w-score').textContent = s.teams[w].score + ' POINTS';
  }

  function fx(f) {
    if (f.delay) { const g = Object.assign({}, f, { delay: 0 }); setTimeout(() => fx(g), f.delay); return; }
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
  const cols = ['#FFC216', '#2AAAE2', '#733C80', '#F09C53', '#E06535', '#fff'];
  let ch = '';
  for (let i = 0; i < 70; i++) ch += '<div class="conf" style="left:' + (Math.random() * 100) + '%;background:' + cols[i % 6] +
    ';animation-duration:' + (3 + Math.random() * 4) + 's;animation-delay:-' + (Math.random() * 6) + 's"></div>';
  $('confetti').innerHTML = ch;

  // Chasing marquee bulbs along the top and bottom edges.
  let bulbs = '';
  for (let i = 0; i < 48; i++) bulbs += '<i style="animation-delay:' + (i % 4) * 0.2 + 's"></i>';
  document.querySelectorAll('.bulbs').forEach(el => { el.innerHTML = bulbs; });

  // First paint: last saved game if there is one, then ask the control panel for the live state.
  let first = Engine.newState(DATA);
  try {
    const saved = JSON.parse(localStorage.getItem('cbf_state_v2'));
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
    first.fm.timeLeft = 4;
  }
  render(first);

  const hello = { type: 'hello' };
  if (window.opener) { try { window.opener.postMessage(hello, '*'); } catch (e) {} }
  if (bc) bc.postMessage(hello);
})();
