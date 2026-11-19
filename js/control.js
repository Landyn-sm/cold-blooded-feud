/* The control panel: the laptop side. Every click here drives the game screen. */
(function () {
  const DATA = Engine.prep(window.GAME_DATA);
  const KEY = 'cbf_state_v1', SIG = JSON.stringify(DATA).length;
  const $ = id => document.getElementById(id);
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const bc = 'BroadcastChannel' in window ? new BroadcastChannel('cbf') : null;
  const app = $('app');
  let state, history = [], displayWin = null, timerInt = null, adjVal = [5, 5], volume = 0.9;

  try {
    const saved = JSON.parse(localStorage.getItem(KEY));
    if (saved && saved.sig === SIG) state = saved.state;
  } catch (e) {}
  if (!state) state = Engine.newState(DATA);

  function save() { try { localStorage.setItem(KEY, JSON.stringify({ sig: SIG, state })); } catch (e) {} }

  function send(fx) {
    const msg = { type: 'state', id: Date.now() + Math.random(), state, fx: fx || null };
    if (displayWin && !displayWin.closed) { try { displayWin.postMessage(msg, '*'); } catch (e) {} }
    if (bc) bc.postMessage(msg);
  }

  function snapshot() { history.push(JSON.stringify(state)); if (history.length > 300) history.shift(); }

  function act(a) {
    snapshot();
    const out = Engine.act(state, DATA, a);
    out.sounds.forEach(n => SFX.play(n));
    if (a.t === 'screen') {
      if (a.v === 'winner') { SFX.music(false); setTimeout(() => { if (state.screen === 'winner') { SFX.music(true); render(); } }, 3200); }
      else SFX.music(a.v === 'title' || a.v === 'teams');
    }
    if (a.t === 'gotoRound') SFX.music(false);
    save(); send(out.fx); render();
  }

  function undo() {
    if (!history.length) return;
    state = JSON.parse(history.pop());
    save(); send(); render();
  }

  function stopTimer() { clearInterval(timerInt); timerInt = null; }
  function startTimer(sec) {
    stopTimer();
    state.fm.timeLeft = sec; save(); send(); tickUI();
    timerInt = setInterval(() => {
      state.fm.timeLeft--;
      if (state.fm.timeLeft <= 0) { state.fm.timeLeft = 0; stopTimer(); SFX.play('timeUp'); }
      else SFX.play('tick');
      save(); send(); tickUI();
    }, 1000);
  }
  function tickUI() { const el = $('fmTime'); if (el) el.textContent = state.fm.timeLeft == null ? '--' : state.fm.timeLeft; }

  /* ---------- drawing ---------- */
  const btn = (label, c, attrs, cls) => '<button tabindex="-1" data-c="' + c + '" ' + (attrs || '') + ' class="' + (cls || '') + '">' + label + '</button>';

  function topBar() {
    return '<div class="bar">' +
      btn('GO LIVE', 'open', '', 'gold big') +
      btn('Undo (Ctrl+Z)', 'undo', history.length ? '' : 'disabled') +
      '<span class="grow"></span>' +
      btn(SFX.isMusic() ? 'Theme music: ON' : 'Theme music: off', 'music', '', SFX.isMusic() ? 'on' : '') +
      btn('Applause', 'snd', 'data-v="applause"') + btn('Big applause', 'snd', 'data-v="applauseLong"') +
      btn('Drumroll', 'snd', 'data-v="drumroll"') + btn('Sad horn', 'snd', 'data-v="womp"') +
      btn('Sting', 'snd', 'data-v="sting"') + btn('Fanfare', 'snd', 'data-v="fanfare"') +
      '<label class="muted">Vol <input type="range" id="vol" data-b="vol" min="0" max="1" step="0.05" value="' + volume + '"></label>' +
      '</div>';
  }

  function screens() {
    const list = [['title', 'Title'], ['teams', 'Teams'], ['roundcard', 'Round card'], ['board', 'Board'], ['fm', DATA.fastMoney.label], ['winner', 'Winner']];
    return '<div class="card"><h2>What the game screen shows</h2><div class="bar">' +
      list.map(s => btn(s[1], 'screen', 'data-v="' + s[0] + '"', state.screen === s[0] ? 'on' : '')).join('') +
      '<span class="grow"></span>' + btn('New game', 'newGame', '', 'red') + '</div></div>';
  }

  function scores() {
    return '<div class="cols">' + state.teams.map((t, i) =>
      '<div class="card"><div class="bar"><input id="tn' + i + '" data-b="tname" data-team="' + i + '" value="' + esc(t.name) + '" style="width:190px;font-weight:700">' +
      '<span class="score">' + t.score + '</span><span class="grow"></span>' +
      btn('-', 'adj', 'data-team="' + i + '" data-sign="-1"') +
      '<input id="adj' + i + '" data-b="adj" data-team="' + i + '" type="number" value="' + adjVal[i] + '" style="width:70px">' +
      btn('+', 'adj', 'data-team="' + i + '" data-sign="1"') + '</div></div>').join('') + '</div>';
  }

  function statusLine(r) {
    const T = state.teams, c = state.control;
    const lead = T[0].score >= DATA.winScore || T[1].score >= DATA.winScore;
    let h = '';
    if (state.phase === 'faceoff') h = 'FACE-OFF. Click who buzzed first. Reveal what they say or hit WRONG. Then choose who plays.' +
      (r.answers.length === 1 ? ' Sudden death: whoever names the answer gets the pot (use Award).' : '');
    else if (state.phase === 'play') h = esc(T[c].name) + ' is playing. Strikes: ' + state.strikes + ' of 3.';
    else if (state.phase === 'steal') h = esc(T[1 - c].name) + ' can STEAL. Reveal their answer if it is on the board, otherwise hit WRONG.';
    else h = 'Round over. ' + esc(T[state.awardedTo].name) + ' won ' + state.pot + '. Click the leftover answers to show them, then go to the next round.';
    let out = '<div class="status">' + h + '</div>';
    if (lead && state.phase === 'done') {
      const w = T[0].score >= T[1].score ? 0 : 1;
      out += '<div class="status win">' + esc(T[w].name) + ' has reached ' + DATA.winScore + '. Show the Winner screen, then the ' + esc(DATA.fastMoney.label) + '.</div>';
    }
    return out;
  }

  function roundPanel() {
    const r = DATA.rounds[state.roundIdx], T = state.teams, ph = state.phase;
    let h = '<div class="card"><h2>Main game</h2><div class="bar">' +
      DATA.rounds.map((x, i) => btn(esc(x.label) + (x.multiplier > 1 ? ' x' + x.multiplier : ''), 'round', 'data-i="' + i + '"', i === state.roundIdx ? 'on' : '')).join('') +
      '<span class="grow"></span><span class="pot">POT ' + state.pot + '</span></div>' +
      statusLine(r) +
      '<div class="q">' + esc(r.question) + '</div>' +
      '<div class="bar" style="margin-bottom:8px">' +
      btn(state.screen === 'board' ? 'Board is showing' : 'Show board', 'screen', 'data-v="board"', state.screen === 'board' ? 'on' : 'gold') +
      btn(state.showQuestion ? 'Hide question on screen' : 'Show question on screen', 'toggleQ', '', state.showQuestion ? 'on' : '') +
      '</div><div class="answers">';
    const half = Math.ceil(r.answers.length / 2);
    for (let row = 0; row < half; row++) [row, row + half].forEach(i => {
      const a = r.answers[i];
      h += a ? '<button tabindex="-1" class="ans ' + (state.revealed[i] ? 'rev' : '') + '" data-c="reveal" data-i="' + i + '"' + (state.revealed[i] ? ' disabled' : '') +
        '><b>' + (i + 1) + '</b><span>' + esc(a.text) + '</span><em>' + a.points + '</em></button>' : '<span></span>';
    });
    h += '</div><div class="bar" style="margin-top:10px">' +
      btn('WRONG (X)', 'strike', ph === 'done' ? 'disabled' : '', 'red big');
    if (ph === 'faceoff') {
      h += T.map((t, i) => btn('Buzz: ' + esc(t.name), 'buzz', 'data-team="' + i + '"', state.buzzed === i ? 'on' : '')).join('') +
        '<span class="grow"></span>' +
        T.map((t, i) => btn(esc(t.name) + ' plays', 'control', 'data-team="' + i + '"', 'gold')).join('');
    }
    if (ph !== 'done') h += '<span class="grow"></span>' + T.map((t, i) => btn('Award pot: ' + esc(t.name), 'award', 'data-team="' + i + '"')).join('');
    else h += '<span class="grow"></span>' + btn('Next round', 'round', 'data-i="' + (state.roundIdx + 1) + '"' + (state.roundIdx + 1 >= DATA.rounds.length ? ' disabled' : ''), 'gold big');
    h += '</div><p class="muted">Keys while the board is showing: <kbd>1</kbd> to <kbd>8</kbd> reveal an answer, <kbd>X</kbd> wrong answer, <kbd>Ctrl</kbd>+<kbd>Z</kbd> undo.</p></div>';
    return h;
  }

  function fmPanel() {
    const F = DATA.fastMoney, fm = state.fm;
    let h = '<div class="card"><h2>' + esc(F.label) + '</h2><div class="bar">' +
      btn('Show on screen', 'screen', 'data-v="fm"', state.screen === 'fm' ? 'on' : 'gold') +
      btn('Start ' + F.times[0] + 's (player 1)', 'timer', 'data-v="' + F.times[0] + '"') +
      btn('Start ' + F.times[1] + 's (player 2)', 'timer', 'data-v="' + F.times[1] + '"') +
      btn('Stop clock', 'timerStop') +
      '<span class="pot">Clock <span id="fmTime">' + (fm.timeLeft == null ? '--' : fm.timeLeft) + '</span></span>' +
      '<span class="grow"></span>' +
      btn(fm.hideP1 ? 'Player 1 answers HIDDEN' : 'Hide player 1 answers', 'fmHide', '', fm.hideP1 ? 'on' : '') +
      btn('Already said (buzz)', 'fmDup', '', 'red') +
      '<span class="pot">TOTAL ' + Engine.fmTotal(state, DATA) + ' / ' + F.target + '</span></div>' +
      '<p class="muted">Type what each player says (Tab jumps to the next box). After the clock, pick the matching survey answer, then reveal the answer and its points one at a time.</p>' +
      '<div class="cols">';
    [0, 1].forEach(p => {
      h += '<div><h2>Player ' + (p + 1) + '</h2>';
      F.questions.forEach((q, i) => {
        const a = fm.answers[p][i];
        h += '<div class="fmrow"><div class="fmq">' + (i + 1) + '. ' + esc(q.question) + '</div>' +
          '<input id="fm' + p + '_' + i + '" data-b="said" data-p="' + p + '" data-q="' + i + '" value="' + esc(a.said) + '" placeholder="What they said">' +
          '<select tabindex="-1" id="fmm' + p + '_' + i + '" data-b="match" data-p="' + p + '" data-q="' + i + '">' +
          '<option value="-1">Not on the list (0)</option>' +
          q.answers.map((x, k) => '<option value="' + k + '"' + (a.match === k ? ' selected' : '') + '>' + esc(x.text) + ' (' + x.points + ')</option>').join('') +
          '</select>' +
          btn('Answer', 'fmText', 'data-p="' + p + '" data-q="' + i + '"' + (a.text ? ' disabled' : '')) +
          btn('Points', 'fmPts', 'data-p="' + p + '" data-q="' + i + '"' + (a.pts ? ' disabled' : ''), 'gold') +
          '<b>' + (a.pts ? Engine.fmPoints(state, DATA, p, i) : '') + '</b></div>';
      });
      h += '</div>';
    });
    return h + '</div><div class="bar">' + btn('Clear ' + esc(F.label), 'fmReset', '', 'red') + '</div></div>';
  }

  function setup() {
    return '<div class="card"><h2>Player names (shown on the Teams screen)</h2><div class="cols">' + state.teams.map((t, i) =>
      '<div class="bar">' + t.players.map((p, k) => '<input id="pl' + i + '_' + k + '" data-b="player" data-team="' + i + '" data-i="' + k + '" value="' + esc(p) + '" style="width:110px">').join('') + '</div>').join('') +
      '</div><p class="muted">Setup: click GO LIVE, drag that window onto the projector, then press <kbd>F</kbd> in it for full screen. Sound plays from this laptop.</p></div>';
  }

  function render() {
    const el = document.activeElement, id = el && el.id;
    let pos = null; try { pos = el.selectionStart; } catch (e) {}
    app.innerHTML = topBar() + screens() + scores() + roundPanel() + fmPanel() + setup();
    if (id) {
      const n = $(id);
      if (n) { n.focus(); if (pos != null) { try { n.setSelectionRange(pos, pos); } catch (e) {} } }
    }
  }

  /* ---------- input ---------- */
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-c]');
    if (!b || b.disabled) return;
    SFX.init();
    const d = b.dataset, n = x => parseInt(x, 10);
    switch (d.c) {
      case 'open': displayWin = window.open('display.html', 'cbf_display', 'width=1280,height=720'); setTimeout(send, 600); break;
      case 'undo': undo(); break;
      case 'screen': act({ t: 'screen', v: d.v }); break;
      case 'round': act({ t: 'gotoRound', i: n(d.i) }); break;
      case 'reveal': act({ t: 'reveal', i: n(d.i) }); break;
      case 'strike': act({ t: 'strike' }); break;
      case 'buzz': act({ t: 'buzz', team: n(d.team) }); break;
      case 'control': act({ t: 'control', team: n(d.team) }); break;
      case 'award': act({ t: 'award', team: n(d.team) }); break;
      case 'toggleQ': act({ t: 'toggleQuestion' }); break;
      case 'adj': act({ t: 'adjust', team: n(d.team), delta: n(d.sign) * (adjVal[n(d.team)] || 0) }); break;
      case 'snd': SFX.play(d.v); break;
      case 'music': SFX.music(!SFX.isMusic()); render(); break;
      case 'timer': startTimer(n(d.v)); break;
      case 'timerStop': stopTimer(); break;
      case 'fmText': act({ t: 'fmText', p: n(d.p), q: n(d.q) }); break;
      case 'fmPts': act({ t: 'fmPts', p: n(d.p), q: n(d.q) }); break;
      case 'fmHide': act({ t: 'fmHide', v: !state.fm.hideP1 }); break;
      case 'fmDup': act({ t: 'fmDup' }); break;
      case 'fmReset': if (confirm('Clear all ' + DATA.fastMoney.label + ' answers?')) { stopTimer(); act({ t: 'fmReset' }); } break;
      case 'newGame':
        if (confirm('Start a brand new game? All scores reset.')) {
          snapshot(); stopTimer(); SFX.music(false);
          state = Engine.newState(DATA); save(); send(); render();
        }
        break;
    }
  });

  // Typing never redraws the panel, so the judge can type while the clock runs.
  document.addEventListener('input', e => {
    const d = e.target.dataset;
    if (!d || !d.b) return;
    const v = e.target.value;
    if (d.b === 'tname') { state.teams[+d.team].name = v; save(); send(); }
    else if (d.b === 'player') { state.teams[+d.team].players[+d.i] = v; save(); send(); }
    else if (d.b === 'said') { state.fm.answers[+d.p][+d.q].said = v; save(); send(); }
    else if (d.b === 'adj') adjVal[+d.team] = Math.abs(parseInt(v, 10) || 0);
    else if (d.b === 'vol') { volume = +v; SFX.init(); SFX.setVolume(volume); }
  });

  document.addEventListener('change', e => {
    const d = e.target.dataset;
    if (d && d.b === 'match') { const v = parseInt(e.target.value, 10); setTimeout(() => act({ t: 'fmMatch', p: +d.p, q: +d.q, match: v }), 0); }
    else if (d && d.b === 'tname') setTimeout(render, 0);
  });

  document.addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'Z')) {
      if (/INPUT|TEXTAREA/.test(e.target.tagName) && e.target.type !== 'range') return;
      e.preventDefault(); undo(); return;
    }
    if (/INPUT|SELECT|TEXTAREA/.test(e.target.tagName) || e.ctrlKey || e.altKey || e.metaKey) return;
    if (state.screen !== 'board') return;
    SFX.init();
    if (e.key >= '1' && e.key <= '8') {
      const i = +e.key - 1;
      if (i < DATA.rounds[state.roundIdx].answers.length) act({ t: 'reveal', i });
    } else if (e.key === 'x' || e.key === 'X') act({ t: 'strike' });
  });

  // The game screen says hello when it opens or reloads; answer with the live state.
  function onHello(e) {
    if (!e.data || e.data.type !== 'hello') return;
    if (e.source && e.source !== window) displayWin = e.source;
    send();
  }
  addEventListener('message', onHello);
  if (bc) bc.onmessage = onHello;

  render();
})();
