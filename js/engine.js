/* Game rules. No DOM in here, so the control panel and the game screen share it. */
(function (root) {
  const E = {};

  E.prep = function (data) {
    data.rounds.forEach(r => r.answers.sort((a, b) => b.points - a.points));
    data.fastMoney.questions.forEach(q => q.answers.sort((a, b) => b.points - a.points));
    return data;
  };

  function freshRound(s, data) {
    const r = data.rounds[s.roundIdx];
    s.revealed = r.answers.map(() => false);
    s.pot = 0; s.strikes = 0; s.control = null; s.buzzed = null;
    s.awardedTo = null; s.phase = 'faceoff'; s.showQuestion = false;
  }

  function freshFM(data) {
    return {
      answers: [0, 1].map(() => data.fastMoney.questions.map(() => ({ said: '', match: -1, text: false, pts: false }))),
      hideP1: false, timeLeft: null, won: false
    };
  }

  E.newState = function (data) {
    const s = {
      screen: 'title',
      teams: data.teams.map(t => ({ name: t.name, players: t.players.slice(), score: 0 })),
      roundIdx: 0, winner: null, fm: freshFM(data)
    };
    freshRound(s, data);
    return s;
  };

  E.fmPoints = function (s, data, p, q) {
    const a = s.fm.answers[p][q];
    return a.match >= 0 ? data.fastMoney.questions[q].answers[a.match].points : 0;
  };

  E.fmTotal = function (s, data) {
    let t = 0;
    s.fm.answers.forEach((col, p) => col.forEach((a, q) => { if (a.pts) t += E.fmPoints(s, data, p, q); }));
    return t;
  };

  /* Applies one action to the state. Returns the sounds to play and any on-screen effect. */
  E.act = function (s, data, a) {
    const out = { sounds: [], fx: null };
    const r = data.rounds[s.roundIdx];
    const award = team => {
      if (s.awardedTo != null) return;
      s.teams[team].score += s.pot;
      s.awardedTo = team; s.phase = 'done'; s.buzzed = null;
      out.sounds.push('applause');
    };

    switch (a.t) {
      case 'screen':
        s.screen = a.v;
        if (a.v === 'winner') {
          s.winner = s.teams[0].score >= s.teams[1].score ? 0 : 1;
          out.sounds.push('fanfare', 'applauseLong');
        }
        break;

      case 'gotoRound':
        if (a.i < 0 || a.i >= data.rounds.length) break;
        s.roundIdx = a.i; freshRound(s, data);
        s.screen = 'roundcard'; out.sounds.push('sting');
        break;

      case 'toggleQuestion': s.showQuestion = !s.showQuestion; break;

      case 'buzz':
        if (s.phase !== 'faceoff') break;
        s.buzzed = a.team; out.sounds.push('buzzIn');
        break;

      case 'control':
        if (s.phase !== 'faceoff') break;
        s.control = a.team; s.phase = 'play'; s.buzzed = null; s.strikes = 0;
        break;

      case 'reveal': {
        const i = a.i;
        if (i < 0 || i >= r.answers.length || s.revealed[i]) break;
        s.revealed[i] = true;
        if (s.phase === 'done') { out.sounds.push('ding'); break; }
        const pts = r.answers[i].points * r.multiplier;
        if (s.phase === 'steal') {
          if (data.stealAddsAnswer) s.pot += pts;
          out.sounds.push('ding');
          award(1 - s.control);
        } else {
          s.pot += pts;
          out.sounds.push(i === 0 ? 'dingTop' : 'ding');
          if (s.phase === 'play' && s.revealed.every(Boolean)) award(s.control);
        }
        break;
      }

      case 'strike':
        if (s.phase === 'done') break;
        out.sounds.push('buzzer');
        if (s.phase === 'faceoff') { out.fx = { type: 'strike', n: 1 }; }
        else if (s.phase === 'play') {
          s.strikes++;
          out.fx = { type: 'strike', n: s.strikes };
          if (s.strikes >= 3) s.phase = 'steal';
        } else { out.fx = { type: 'strike', n: 1 }; award(s.control); }
        break;

      case 'award': award(a.team); break;

      case 'adjust':
        s.teams[a.team].score = Math.max(0, s.teams[a.team].score + a.delta);
        break;

      case 'fmMatch': s.fm.answers[a.p][a.q].match = a.match; break;

      case 'fmText':
        s.fm.answers[a.p][a.q].text = true; out.sounds.push('fmReveal');
        break;

      case 'fmPts': {
        const cell = s.fm.answers[a.p][a.q];
        if (cell.pts) break;
        cell.text = true; cell.pts = true;
        out.sounds.push(E.fmPoints(s, data, a.p, a.q) > 0 ? 'ding' : 'fmZero');
        if (!s.fm.won && E.fmTotal(s, data) >= data.fastMoney.target) {
          s.fm.won = true; out.sounds.push('fanfare', 'applauseLong');
        }
        break;
      }

      case 'fmHide': s.fm.hideP1 = a.v; break;
      case 'fmDup': out.sounds.push('duplicate'); out.fx = { type: 'dup' }; break;
      case 'fmReset': s.fm = freshFM(data); break;
    }
    return out;
  };

  root.Engine = E;
})(typeof window !== 'undefined' ? window : globalThis);
