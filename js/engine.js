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
    s.counted = r.answers.map(() => 0);   // points each answer put in the pot
    s.pot = 0; s.strikes = 0; s.control = null; s.buzzed = null;
    s.awardedTo = null; s.phase = 'faceoff'; s.showQuestion = false;
  }

  function freshFM(data) {
    return {
      answers: [0, 1].map(() => data.fastMoney.questions.map(() => ({ said: '', match: -1, text: false, pts: false }))),
      stage: 0, hideP1: false, timeLeft: null, won: false, lost: false
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

  // The next thing to reveal for a lightning round player: answer text first, then its points.
  E.fmNextStep = function (s, p) {
    const col = s.fm.answers[p];
    for (let q = 0; q < col.length; q++) if (!col[q].pts) return { q, what: col[q].text ? 'pts' : 'text' };
    return null;
  };

  /* What the big NEXT button should do right now. null = nothing to advance yet. */
  E.next = function (s, data) {
    const afterRound = () => {
      const top = Math.max(s.teams[0].score, s.teams[1].score);
      if (top >= data.winScore || s.roundIdx + 1 >= data.rounds.length)
        return { label: 'Declare the winner', a: { t: 'screen', v: 'winner' } };
      return { label: 'Start ' + data.rounds[s.roundIdx + 1].label, a: { t: 'gotoRound', i: s.roundIdx + 1 } };
    };
    switch (s.screen) {
      case 'title': return { label: 'Introduce the teams', a: { t: 'screen', v: 'teams' } };
      case 'teams':
        return s.phase === 'done' ? afterRound() : { label: 'Start ' + data.rounds[s.roundIdx].label, a: { t: 'gotoRound', i: s.roundIdx } };
      case 'roundcard': return { label: 'Show the board', a: { t: 'screen', v: 'board' } };
      case 'board':
        if (s.phase !== 'done') return null;
        if (!s.revealed.every(Boolean)) return { label: 'Reveal the answers nobody got', a: { t: 'revealRest' } };
        return afterRound();
      case 'winner': return { label: 'Start the ' + data.fastMoney.label, a: { t: 'screen', v: 'fm' } };
      case 'fm':
        if (s.fm.stage === 0 && !E.fmNextStep(s, 0)) return { label: 'Player 2 comes out', a: { t: 'fmStage', v: 1 } };
        return null;
    }
    return null;
  };

  /* Applies one action. Returns sounds ("name" or "name@delayMs") and on-screen effects. */
  E.act = function (s, data, a) {
    const out = { sounds: [], fx: [] };
    const r = data.rounds[s.roundIdx];
    const banner = (text, team, delay) => out.fx.push({ type: 'banner', text, team, delay: delay || 0 });
    const award = team => {
      if (s.awardedTo != null) return false;
      s.teams[team].score += s.pot;
      s.awardedTo = team; s.phase = 'done'; s.buzzed = null;
      return true;
    };

    switch (a.t) {
      case 'screen':
        s.screen = a.v;
        if (a.v === 'winner') {
          s.winner = s.teams[0].score >= s.teams[1].score ? 0 : 1;
          out.sounds.push('fanfare', 'cheer@300', 'applauseLong@700');
        } else out.sounds.push('whoosh');
        break;

      case 'gotoRound':
        if (a.i < 0 || a.i >= data.rounds.length) break;
        s.roundIdx = a.i; freshRound(s, data);
        s.screen = 'roundcard'; out.sounds.push('whoosh', 'sting@150');
        break;

      case 'toggleQuestion': s.showQuestion = !s.showQuestion; break;

      case 'buzz':
        if (s.phase !== 'faceoff') break;
        s.buzzed = a.team; out.sounds.push('buzzIn');
        break;

      case 'control':
        if (s.phase !== 'faceoff') break;
        s.control = a.team; s.phase = 'play'; s.buzzed = null; s.strikes = 0;
        banner(s.teams[a.team].name + ' PLAYS', a.team);
        out.sounds.push('whoosh');
        break;

      case 'reveal': {
        const i = a.i;
        if (i < 0 || i >= r.answers.length) break;
        if (s.revealed[i]) {                      // clicking a shown answer hides it again
          s.revealed[i] = false;
          if (s.awardedTo == null) s.pot -= s.counted[i];
          s.counted[i] = 0;
          out.sounds.push('whoosh');
          break;
        }
        s.revealed[i] = true;
        if (s.phase === 'done') { out.sounds.push('ding'); break; }
        const pts = r.answers[i].points * r.multiplier;
        if (s.phase === 'steal') {
          if (data.stealAddsAnswer) { s.pot += pts; s.counted[i] = pts; }
          const t = 1 - s.control;
          award(t);
          out.sounds.push('ding', 'cheer@250', 'applause@500');
          banner('STOLEN! ' + s.teams[t].name + ' +' + s.pot, t, 500);
        } else {
          s.pot += pts; s.counted[i] = pts;
          if (i === 0) { out.sounds.push('dingTop', 'applause@200'); banner('NUMBER ONE ANSWER!', s.control); }
          else out.sounds.push('ding');
          if (s.phase === 'play' && s.revealed.every(Boolean)) {
            award(s.control);
            out.sounds.push('cheer@500', 'applauseLong@800');
            banner('CLEAN SWEEP! ' + s.teams[s.control].name + ' +' + s.pot, s.control, 900);
          }
        }
        break;
      }

      case 'strike':
        if (s.phase === 'done') break;
        out.sounds.push('buzzer');
        if (s.phase === 'faceoff') out.fx.push({ type: 'strike', n: 1 });
        else if (s.phase === 'play') {
          s.strikes++;
          out.fx.push({ type: 'strike', n: s.strikes });
          if (s.strikes >= 3) {
            s.phase = 'steal';
            out.sounds.push('aww@700');
            banner(s.teams[1 - s.control].name + ' CAN STEAL!', 1 - s.control, 1500);
          }
        } else {
          out.fx.push({ type: 'strike', n: 1 });
          award(s.control);
          out.sounds.push('applause@1200');
          banner(s.teams[s.control].name + ' KEEPS ' + s.pot, s.control, 1500);
        }
        break;

      case 'award':
        if (award(a.team)) {
          out.sounds.push('applause');
          banner(s.teams[a.team].name + ' +' + s.pot, a.team);
        }
        break;

      case 'adjust':
        s.teams[a.team].score = Math.max(0, s.teams[a.team].score + a.delta);
        break;

      case 'fmMatch': s.fm.answers[a.p][a.q].match = a.match; break;

      case 'fmStage':
        s.fm.stage = a.v; s.fm.hideP1 = a.v === 1; s.fm.timeLeft = null;
        out.sounds.push('whoosh');
        break;

      case 'fmNext': {
        const p = s.fm.stage, step = E.fmNextStep(s, p);
        if (!step) break;
        const cell = s.fm.answers[p][step.q];
        if (p === 1) s.fm.hideP1 = false;
        if (step.what === 'text') { cell.text = true; out.sounds.push('fmReveal'); break; }
        cell.pts = true;
        const pts = E.fmPoints(s, data, p, step.q), total = E.fmTotal(s, data);
        out.sounds.push(pts > 0 ? 'ding' : 'fmZero');
        if (!s.fm.won && total >= data.fastMoney.target) {
          s.fm.won = true;
          out.sounds.push('fanfare@400', 'cheer@600', 'applauseLong@900');
          banner('WINNER! ' + total + ' POINTS', null, 400);
        } else if (p === 1 && !s.fm.won && !E.fmNextStep(s, 1)) {
          s.fm.lost = true;
          out.sounds.push('womp@700', 'aww@900');
          banner('SO CLOSE! ' + total + ' POINTS', null, 700);
        }
        break;
      }

      case 'fmHide': s.fm.hideP1 = a.v; break;
      case 'fmDup': out.sounds.push('duplicate'); out.fx.push({ type: 'dup' }); break;
      case 'fmReset': s.fm = freshFM(data); break;
    }
    return out;
  };

  root.Engine = E;
})(typeof window !== 'undefined' ? window : globalThis);
