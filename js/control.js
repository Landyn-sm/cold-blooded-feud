/* The control center: the laptop side. Every click here drives the game screen. */
(function () {
  const DATA = Engine.prep(window.GAME_DATA);
  const KEY = 'cbf_state_v3', SIG = JSON.stringify(DATA).length;
  const $ = id => document.getElementById(id);
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const bc = 'BroadcastChannel' in window ? new BroadcastChannel('cbf') : null;
  const app = $('app');
  let state, history = [], displayWin = null, timerInt = null, adjVal = [5, 5], volume = 0.9;
  let moreOpen = false, autoTimer = null, restTimer = null;

  try {
    const saved = JSON.parse(localStorage.getItem(KEY));
    if (saved && saved.sig === SIG) state = saved.state;
  } catch (e) {}
  if (!state) state = Engine.newState(DATA);

  function save() { try { localStorage.setItem(KEY, JSON.stringify({ sig: SIG, state })); } catch (e) {} }

  function send(fx) {
    const msg = { type: 'state', id: Date.now() + Math.random(), state, fx: fx || [] };
    if (displayWin && !displayWin.closed) { try { displayWin.postMessage(msg, '*'); } catch (e) {} }
    if (bc) bc.postMessage(msg);
  }

  function snapshot() { history.push(JSON.stringify(state)); if (history.length > 300) history.shift(); }

  function playSounds(list) {
    list.forEach(n => { const p = n.split('@'); SFX.play(p[0], +p[1] || 0); });
  }

  function act(a) {
    if (a.t === 'revealRest') return revealRest();
    snapshot();
    clearTimeout(autoTimer);
    const out = Engine.act(state, DATA, a);
    playSounds(out.sounds);
    if (a.t === 'screen') {
      if (a.v === 'winner') { SFX.music(false); setTimeout(() => { if (state.screen === 'winner') { SFX.music(true); render(); } }, 4500); }
      else SFX.music(a.v === 'title' || a.v === 'teams' || a.v === 'outro' || a.v === 'break');
    }
    if (a.t === 'gotoRound') {
      SFX.music(false);
      // The round card shows itself, then the board comes up on its own.
      autoTimer = setTimeout(() => { if (state.screen === 'roundcard') act({ t: 'screen', v: 'board' }); }, 3200);
    }
    save(); send(out.fx); render();
  }

  // After a round, flip the answers nobody got, bottom to top, one per second.
  function revealRest() {
    clearTimeout(restTimer);
    const left = [];
    state.revealed.forEach((v, i) => { if (!v) left.push(i); });
    if (!left.length || state.phase !== 'done') return;
    act({ t: 'reveal', i: left[left.length - 1] });
    if (left.length > 1) restTimer = setTimeout(revealRest, 1100);
  }

  function undo() {
    if (!history.length) return;
    clearTimeout(autoTimer); clearTimeout(restTimer);
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
  const tbtn = (i, label, c, cls) => btn(label, c, 'data-team="' + i + '"', (cls || '') + ' team' + i);

  function rulesPage() { return (DATA.rulesPages || [])[state.rulesPage || 0] || { title: 'Rules', items: [] }; }

  function whatNow() {
    const T = state.teams, c = state.control, r = DATA.rounds[state.roundIdx], F = DATA.fastMoney;
    switch (state.screen) {
      case 'title': return 'Title screen is up. Press GO LIVE to open the game screen and start the theme.';
      case 'teams': return 'Team rosters are on screen.';
      case 'rules': return state.rulesShown < rulesPage().items.length
        ? 'Rules slide. Press NEXT each time you start explaining a rule and it pops up behind you.'
        : 'Every rule on this slide is showing. Press NEXT to move on.';
      case 'break': return 'The "Be right back" screen is up with music. Press NEXT to pick up where you left off.';
      case 'outro': return 'Closing screen is up with the theme. That is the show!';
      case 'roundcard': return r.label + ' card is showing. The board comes up by itself in a moment.';
      case 'winner': return 'Winner screen is up.';
      case 'fm': {
        const p = state.fm.stage, step = Engine.fmNextStep(state, p);
        if (state.fm.won) return 'They hit ' + F.target + '. They win! Press NEXT to close the show.';
        if (state.fm.lost) return 'All answers revealed. They came up short. Press NEXT to close the show.';
        if (!step) return 'Player 1 is done. Press NEXT to bring out player 2.';
        return 'Player ' + (p + 1) + ': start the clock, type their 5 answers, match them, then press REVEAL for each one.';
      }
    }
    if (state.phase === 'faceoff') return r.answers.length === 1
      ? 'SUDDEN DEATH. Click who buzzed. If they say the answer, click it, then give that team the pot.'
      : 'FACE-OFF. Click who buzzed. Click the answer they give, or WRONG. Then pick which team plays.';
    if (state.phase === 'play') return esc(T[c].name) + ' is playing. Click each answer they get, or WRONG. Strikes: ' + state.strikes + ' of 3.';
    if (state.phase === 'steal') return esc(T[1 - c].name) + ' gets ONE guess to steal. Click their answer if it is up there, otherwise WRONG.';
    return 'Round over. ' + esc(T[state.awardedTo].name) + ' won ' + state.pot + ' points. Press NEXT.';
  }

  function header() {
    const nx = Engine.next(state, DATA);
    return '<div class="top">' +
      btn('GO LIVE', 'open', '', 'gold') + btn('Undo', 'undo', history.length ? '' : 'disabled') +
      '<div class="now">' + whatNow() + '</div>' +
      '<button tabindex="-1" data-c="next" class="next"' + (nx ? '' : ' disabled') + '>' + (nx ? 'NEXT: ' + esc(nx.label) + ' &#9654;' : 'NEXT') + '</button></div>';
  }

  function scores() {
    return '<div class="cols">' + state.teams.map((t, i) => {
      const live = (state.phase === 'play' && state.control === i) || (state.phase === 'steal' && state.control === 1 - i);
      return '<div class="card team' + i + (live && state.screen === 'board' ? ' live' : '') + '"><div class="bar">' +
        '<input id="tn' + i + '" data-b="tname" data-team="' + i + '" value="' + esc(t.name) + '" class="tname">' +
        '<span class="grow"></span><span class="score">' + t.score + '</span></div></div>';
    }).join('') + '</div>';
  }

  function boardPanel() {
    const r = DATA.rounds[state.roundIdx], T = state.teams, ph = state.phase;
    let h = '<div class="card"><div class="bar"><h2>' + esc(r.label) + (r.multiplier > 1 ? ' (points x' + r.multiplier + ')' : '') + '</h2><span class="grow"></span>' +
      btn(state.showQuestion ? 'Question is on screen' : 'Put question on screen', 'toggleQ', '', state.showQuestion ? 'on' : '') +
      '<span class="pot">POT ' + state.pot + '</span></div>' +
      '<div class="q">' + esc(r.question) + '</div><div class="answers">';
    const half = Math.ceil(r.answers.length / 2);
    for (let row = 0; row < half; row++) [row, row + half].forEach(i => {
      const a = r.answers[i];
      h += a ? '<button tabindex="-1" class="ans ' + (state.revealed[i] ? 'rev' : '') + '" data-c="reveal" data-i="' + i + '">' +
        '<b>' + (i + 1) + '</b><span>' + esc(a.text) + '</span><em>' + a.points + '</em></button>' : '<span></span>';
    });
    h += '</div><p class="muted">Click an answer to flip it. Click it again to flip it back.</p><div class="actions">';
    if (ph === 'faceoff') {
      h += '<div><h3>1. Who buzzed first?</h3><div class="bar">' + T.map((t, i) => tbtn(i, esc(t.name), 'buzz', state.buzzed === i ? 'on' : '')).join('') + '</div></div>' +
        '<div><h3>2. Wrong answer?</h3>' + btn('WRONG', 'strike', '', 'red big') + '</div>';
      h += r.answers.length === 1
        ? '<div><h3>3. Who got it?</h3><div class="bar">' + T.map((t, i) => tbtn(i, 'Pot to ' + esc(t.name), 'award', 'big')).join('') + '</div></div>'
        : '<div><h3>3. Who plays the round?</h3><div class="bar">' + T.map((t, i) => tbtn(i, esc(t.name) + ' plays', 'control', 'big')).join('') + '</div></div>';
    } else if (ph === 'play' || ph === 'steal') {
      h += '<div>' + btn(ph === 'steal' ? 'WRONG: steal failed' : 'WRONG', 'strike', '', 'red huge') + '</div>' +
        '<div class="strikes">' + [0, 1, 2].map(i => '<span class="' + (i < state.strikes ? 'hit' : '') + '">X</span>').join('') + '</div>';
    }
    return h + '</div></div>';
  }

  function fmPanel() {
    const F = DATA.fastMoney, fm = state.fm, stage = fm.stage, step = Engine.fmNextStep(state, stage);
    const revLabel = !step ? 'All revealed' : 'REVEAL: ' + (step.what === 'text' ? 'answer ' : 'points for answer ') + (step.q + 1);
    let h = '<div class="card"><div class="bar"><h2>' + esc(F.label) + ': player ' + (stage + 1) + '</h2><span class="grow"></span>' +
      '<span class="pot">TOTAL ' + Engine.fmTotal(state, DATA) + ' / ' + F.target + '</span></div>' +
      '<div class="actions">' +
      '<div><h3>1. Run the clock</h3><div class="bar">' + btn('Start ' + F.times[stage] + ' seconds', 'timer', 'data-v="' + F.times[stage] + '"', 'gold big') +
      btn('Stop', 'timerStop') + '<span class="pot"><span id="fmTime">' + (fm.timeLeft == null ? '--' : fm.timeLeft) + '</span></span>' +
      (stage === 1 ? btn('Already said', 'fmDup', '', 'red') : '') + '</div></div>' +
      '<div><h3>2. Type and match below, then reveal</h3>' + btn(revLabel, 'fmNext', step ? '' : 'disabled', 'gold huge') + '</div>' +
      '</div><div class="cols">';
    [0, 1].forEach(p => {
      h += '<div class="' + (p === stage ? '' : 'dim') + '"><h3>Player ' + (p + 1) + (p === 0 && fm.hideP1 ? ' (hidden on screen)' : '') + '</h3>';
      F.questions.forEach((q, i) => {
        const a = fm.answers[p][i];
        h += '<div class="fmrow"><div class="fmq">' + (i + 1) + '. ' + esc(q.question) + '</div>' +
          '<input ' + (p === stage ? '' : 'tabindex="-1" ') + 'id="fm' + p + '_' + i + '" data-b="said" data-p="' + p + '" data-q="' + i + '" value="' + esc(a.said) + '" placeholder="What they said">' +
          '<select tabindex="-1" id="fmm' + p + '_' + i + '" data-b="match" data-p="' + p + '" data-q="' + i + '">' +
          '<option value="-1">Not on the list (0)</option>' +
          q.answers.map((x, k) => '<option value="' + k + '"' + (a.match === k ? ' selected' : '') + '>' + esc(x.text) + ' (' + x.points + ')</option>').join('') +
          '</select><b>' + (a.pts ? Engine.fmPoints(state, DATA, p, i) : a.text ? 'shown' : '') + '</b></div>';
      });
      h += '</div>';
    });
    return h + '</div></div>';
  }

  function simplePanel() {
    if (state.screen === 'rules') return '<div class="card"><h2>' + esc(rulesPage().title) + '</h2>' +
      rulesPage().items.map((r, i) => '<p class="' + (i < state.rulesShown ? '' : 'dim') + '"><b>' + (i + 1) + '.</b> ' + esc(r) + '</p>').join('') + '</div>';
    if (state.screen !== 'teams') return '';
    return '<div class="card"><h2>Player names</h2><div class="cols">' + state.teams.map((t, i) =>
      '<div class="bar">' + t.players.map((p, k) => '<input id="pl' + i + '_' + k + '" data-b="player" data-team="' + i + '" data-i="' + k + '" value="' + esc(p) + '" style="width:112px">').join('') + '</div>').join('') + '</div></div>';
  }

  function more() {
    const T = state.teams;
    const list = [['title', 'Title'], ['teams', 'Teams'], ['rules', 'Rules'], ['board', 'Board'], ['winner', 'Winner'], ['fm', DATA.fastMoney.label], ['outro', 'Closing'], ['break', 'Be right back']];
    const snd = [['applause', 'Applause'], ['applauseLong', 'Big applause'], ['cheer', 'Cheer'], ['laugh', 'Laugh'], ['aww', 'Aww'], ['drumroll', 'Drumroll'],
      ['womp', 'Sad horn'], ['sting', 'Sting'], ['fanfare', 'Fanfare'], ['buzzer', 'Buzzer'], ['ding', 'Ding']];
    return '<details class="card" id="more"' + (moreOpen ? ' open' : '') + '><summary>More controls: sounds, fix a score, jump around</summary>' +
      '<h3>Sound board</h3><div class="bar">' +
      btn(SFX.isMusic() ? 'Theme music: ON' : 'Theme music: off', 'music', '', SFX.isMusic() ? 'on' : '') +
      snd.map(s => btn(s[1], 'snd', 'data-v="' + s[0] + '"')).join('') +
      '<label class="muted">Volume <input type="range" id="vol" data-b="vol" min="0" max="1" step="0.05" value="' + volume + '"></label></div>' +
      '<h3>Fix a score</h3><div class="bar">' + T.map((t, i) => '<span>' + esc(t.name) + '</span>' +
        btn('-', 'adj', 'data-team="' + i + '" data-sign="-1"') +
        '<input id="adj' + i + '" data-b="adj" data-team="' + i + '" type="number" value="' + adjVal[i] + '" style="width:70px">' +
        btn('+', 'adj', 'data-team="' + i + '" data-sign="1"') + '<span style="width:24px"></span>').join('') +
      (state.phase !== 'done' ? T.map((t, i) => tbtn(i, 'Give pot to ' + esc(t.name), 'award')).join('') : '') + '</div>' +
      '<h3>Jump to a screen</h3><div class="bar">' + list.map(s => btn(s[1], 'screen', 'data-v="' + s[0] + '"', state.screen === s[0] ? 'on' : '')).join('') + '</div>' +
      '<h3>Jump to a round (restarts that round)</h3><div class="bar">' +
      DATA.rounds.map((x, i) => btn(esc(x.label), 'round', 'data-i="' + i + '"', i === state.roundIdx ? 'on' : '')).join('') + '</div>' +
      '<h3>' + esc(DATA.fastMoney.label) + '</h3><div class="bar">' +
      btn(state.fm.hideP1 ? 'Player 1 answers are hidden' : 'Hide player 1 answers', 'fmHide', '', state.fm.hideP1 ? 'on' : '') +
      btn('Back to player 1', 'fmStage0') + btn('Clear all answers', 'fmReset', '', 'red') + '</div>' +
      '<h3>Start over</h3><div class="bar">' + btn('New game', 'newGame', '', 'red') + '</div>' +
      '<p class="muted">Keys: <kbd>Enter</kbd> = NEXT. On the board: <kbd>1</kbd> to <kbd>8</kbd> flip an answer, <kbd>X</kbd> wrong. <kbd>Ctrl</kbd>+<kbd>Z</kbd> undo.<br>' +
      'Setup: press GO LIVE, drag the new window onto the projector, press <kbd>F</kbd> in it for full screen. Sound plays from this computer.</p></details>';
  }

  function render() {
    const el = document.activeElement, id = el && el.id;
    let pos = null; try { pos = el.selectionStart; } catch (e) {}
    const y = window.scrollY;
    app.innerHTML = header() + scores() +
      (state.screen === 'board' ? boardPanel() : state.screen === 'fm' ? fmPanel() : simplePanel()) + more();
    if (id) {
      const n = $(id);
      if (n) { n.focus(); if (pos != null) { try { n.setSelectionRange(pos, pos); } catch (e) {} } }
    }
    window.scrollTo(0, y);
  }

  /* ---------- input ---------- */
  function doNext() { const nx = Engine.next(state, DATA); if (nx) act(nx.a); }

  document.addEventListener('click', e => {
    const b = e.target.closest('[data-c]');
    if (!b || b.disabled) return;
    SFX.init();
    const d = b.dataset, n = x => parseInt(x, 10);
    switch (d.c) {
      case 'open': displayWin = window.open('display.html', 'cbf_display', 'width=1280,height=720'); setTimeout(send, 600);
        if (state.screen === 'title' || state.screen === 'teams') { SFX.music(true); render(); }
        break;
      case 'undo': undo(); break;
      case 'next': doNext(); break;
      case 'screen': act({ t: 'screen', v: d.v }); break;
      case 'round': act({ t: 'gotoRound', i: n(d.i) }); break;
      case 'reveal': clearTimeout(restTimer); act({ t: 'reveal', i: n(d.i) }); break;
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
      case 'fmNext': act({ t: 'fmNext' }); break;
      case 'fmHide': act({ t: 'fmHide', v: !state.fm.hideP1 }); break;
      case 'fmStage0': act({ t: 'fmStage', v: 0 }); break;
      case 'fmDup': act({ t: 'fmDup' }); break;
      case 'fmReset': if (confirm('Clear all ' + DATA.fastMoney.label + ' answers?')) { stopTimer(); act({ t: 'fmReset' }); } break;
      case 'newGame':
        if (confirm('Start a brand new game? All scores reset.')) {
          snapshot(); stopTimer(); clearTimeout(autoTimer); clearTimeout(restTimer);
          state = Engine.newState(DATA); SFX.music(true); save(); send(); render();
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

  document.addEventListener('toggle', e => { if (e.target.id === 'more') moreOpen = e.target.open; }, true);

  document.addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'Z')) {
      if (/INPUT|TEXTAREA/.test(e.target.tagName) && e.target.type !== 'range') return;
      e.preventDefault(); undo(); return;
    }
    if (/INPUT|SELECT|TEXTAREA/.test(e.target.tagName) || e.ctrlKey || e.altKey || e.metaKey) return;
    SFX.init();
    if (e.key === 'Enter') { e.preventDefault(); doNext(); return; }
    if (state.screen !== 'board') return;
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
