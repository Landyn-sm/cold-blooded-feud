/*
  All sounds are generated live in the browser, so they are original and need no files.
  To swap one for your own recording, drop an mp3 in the "sounds" folder named after it:
  ding, dingTop, buzzer, buzzIn, tick, timeUp, fmReveal, fmZero, duplicate, womp,
  fanfare, sting, drumroll, applause, applauseLong, cheer, aww, whoosh, theme
*/
const SFX = (function () {
  let ctx, out, sfx, mus, noise, clap, vol = 0.9;
  let musicOn = false, musicTimer = null, nextBar = 0, bar = 0, themeEl = null;
  const over = {};
  const NAMES = ['ding', 'dingTop', 'buzzer', 'buzzIn', 'tick', 'timeUp', 'fmReveal', 'fmZero', 'duplicate',
    'womp', 'fanfare', 'sting', 'drumroll', 'applause', 'applauseLong', 'cheer', 'aww', 'whoosh', 'theme'];

  NAMES.forEach(n => {
    try {
      const a = new Audio();
      a.preload = 'auto';
      a.addEventListener('canplaythrough', () => { over[n] = a; }, { once: true });
      a.addEventListener('error', () => {});
      a.src = 'sounds/' + n + '.mp3';
    } catch (e) {}
  });

  function init() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    const comp = ctx.createDynamicsCompressor();
    comp.connect(ctx.destination);
    out = ctx.createGain(); out.gain.value = vol; out.connect(comp);
    sfx = ctx.createGain(); sfx.connect(out);
    mus = ctx.createGain(); mus.gain.value = 0; mus.connect(out);
    noise = mkNoise(2);
    clap = mkApplause(8);
  }

  function mkNoise(sec) {
    const b = ctx.createBuffer(1, ctx.sampleRate * sec, ctx.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return b;
  }

  // A crowd is thousands of tiny claps: layer short noise bursts at random times.
  function mkApplause(sec) {
    const sr = ctx.sampleRate, b = ctx.createBuffer(2, sr * sec, sr);
    for (let c = 0; c < 2; c++) {
      const d = b.getChannelData(c), claps = sec * 420;
      for (let k = 0; k < claps; k++) {
        const start = Math.floor(Math.random() * (d.length - 2000));
        const len = Math.floor(sr * (0.006 + Math.random() * 0.02));
        const amp = 0.15 + Math.random() * 0.6, tau = len / 4;
        for (let j = 0; j < len; j++) d[start + j] += (Math.random() * 2 - 1) * amp * Math.exp(-j / tau);
      }
      for (let i = 0; i < d.length; i++) d[i] *= 0.3;
    }
    return b;
  }

  const mf = m => 440 * Math.pow(2, (m - 69) / 12);

  function env(g, t, o) {
    const peak = o.g || 0.3, a = o.a || 0.005;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + a);
    if (o.hold) {
      g.gain.setValueAtTime(peak, Math.max(t + a, t + o.d - 0.03));
      g.gain.linearRampToValueAtTime(0.0001, t + o.d);
    } else g.gain.exponentialRampToValueAtTime(0.0001, t + o.d);
  }

  function tone(o) {
    const t = o.at != null ? o.at : ctx.currentTime + (o.t || 0);
    const osc = ctx.createOscillator(), g = ctx.createGain();
    osc.type = o.type || 'sine';
    osc.frequency.setValueAtTime(o.f, t);
    if (o.f2) osc.frequency.exponentialRampToValueAtTime(o.f2, t + o.d);
    if (o.detune) osc.detune.value = o.detune;
    env(g, t, o);
    let node = osc;
    if (o.lp) { const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = o.lp; osc.connect(f); node = f; }
    node.connect(g); g.connect(o.dest || sfx);
    osc.start(t); osc.stop(t + o.d + 0.05);
  }

  function nz(o) {
    const t = o.at != null ? o.at : ctx.currentTime + (o.t || 0);
    const src = ctx.createBufferSource(), g = ctx.createGain(), f = ctx.createBiquadFilter();
    src.buffer = noise; src.loop = true;
    f.type = o.ft || 'highpass'; f.frequency.value = o.ff || 4000; if (o.q) f.Q.value = o.q;
    env(g, t, o);
    src.connect(f); f.connect(g); g.connect(o.dest || sfx);
    src.start(t, Math.random()); src.stop(t + o.d + 0.05);
  }

  function crowd(dur, gain) {
    const t = ctx.currentTime, src = ctx.createBufferSource(), g = ctx.createGain();
    const bp = ctx.createBiquadFilter(), hp = ctx.createBiquadFilter();
    src.buffer = clap; src.loop = true;
    bp.type = 'bandpass'; bp.frequency.value = 1900; bp.Q.value = 0.45;
    hp.type = 'highpass'; hp.frequency.value = 450;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(gain, t + 0.35);
    g.gain.setValueAtTime(gain, t + dur * 0.45);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(bp); bp.connect(hp); hp.connect(g); g.connect(sfx);
    src.start(t, Math.random() * 4); src.stop(t + dur + 0.1);
  }

  function bell(t, f) {
    tone({ f, t, d: 1.6, g: 0.32 });
    tone({ f: f * 2.01, t, d: 0.9, g: 0.1 });
    tone({ f: f * 3, t, d: 0.5, g: 0.05 });
    tone({ type: 'triangle', f: f / 2, t, d: 0.5, g: 0.08 });
  }

  function brass(t, m, d, g, dest, at) {
    const base = { type: 'sawtooth', f: mf(m), d, g: g || 0.1, lp: 2400, hold: 1, a: 0.02, dest };
    if (at != null) base.at = at; else base.t = t;
    tone(base); tone(Object.assign({}, base, { detune: 9 }));
  }

  const S = {
    ding() { bell(0, 1568); },
    dingTop() { bell(0, 1568); bell(0.13, 2093); bell(0.26, 2637); crowd(2.6, 0.35); },
    buzzer() {
      [98, 104, 147, 196].forEach(f => tone({ type: 'sawtooth', f, d: 0.85, g: 0.2, hold: 1, lp: 1800 }));
      tone({ type: 'square', f: 49, d: 0.85, g: 0.22, hold: 1 });
    },
    buzzIn() {
      for (let i = 0; i < 4; i++) {
        tone({ type: 'square', f: 1245, t: i * 0.07, d: 0.06, g: 0.14, hold: 1, lp: 4000 });
        tone({ type: 'square', f: 932, t: i * 0.07, d: 0.06, g: 0.1, hold: 1, lp: 4000 });
      }
    },
    tick() { tone({ type: 'square', f: 1000, d: 0.05, g: 0.1, lp: 3000 }); },
    timeUp() {
      [196, 208, 98].forEach(f => tone({ type: 'sawtooth', f, d: 0.75, g: 0.22, hold: 1, lp: 1600 }));
    },
    fmReveal() {
      tone({ type: 'triangle', f: 660, d: 0.15, g: 0.2 });
      tone({ type: 'triangle', f: 990, t: 0.08, d: 0.22, g: 0.2 });
    },
    fmZero() { tone({ type: 'sawtooth', f: 180, f2: 70, d: 0.55, g: 0.3, lp: 900, hold: 1 }); },
    duplicate() {
      [0, 0.24].forEach(t => [110, 117, 220].forEach(f => tone({ type: 'sawtooth', f, t, d: 0.18, g: 0.2, hold: 1, lp: 1800 })));
    },
    womp() {
      [58, 57, 56].forEach((m, i) => brass(i * 0.42, m, 0.38, 0.14));
      tone({ type: 'sawtooth', f: mf(55), f2: mf(52), t: 1.26, d: 1.1, g: 0.14, lp: 1500, hold: 1, a: 0.02 });
    },
    fanfare() {
      [67, 72, 76, 79].forEach((m, i) => brass(i * 0.15, m, 0.14, 0.12));
      [72, 76, 79, 84].forEach(m => brass(0.66, m, 1.5, 0.09));
      nz({ t: 0.66, d: 1.6, g: 0.22, ff: 6000 });
      tone({ f: 130, f2: 45, t: 0.66, d: 0.3, g: 0.5 });
    },
    sting() {
      [65, 69, 72, 77].forEach((m, i) => brass(i * 0.1, m, 0.09, 0.11));
      [77, 81, 84].forEach(m => brass(0.42, m, 0.7, 0.09));
      nz({ t: 0.42, d: 1.0, g: 0.18, ff: 6500 });
    },
    drumroll() {
      for (let i = 0; i < 60; i++) nz({ t: i * 0.04, d: 0.05, g: 0.06 + i * 0.004, ft: 'bandpass', ff: 900, q: 0.6 });
      nz({ t: 2.42, d: 1.6, g: 0.3, ff: 5500 });
      tone({ f: 130, f2: 45, t: 2.42, d: 0.3, g: 0.5 });
    },
    applause() { crowd(4.2, 0.5); },
    applauseLong() { crowd(7.5, 0.6); },
    cheer() { crowd(3, 0.7); },
    aww() { [220, 233, 262, 294].forEach(f => tone({ type: 'sawtooth', f, f2: f * 0.78, d: 1.3, g: 0.05, lp: 900, hold: 1, a: 0.15 })); },
    whoosh() { nz({ d: 0.45, g: 0.18, ft: 'bandpass', ff: 1200, q: 1.2, a: 0.2 }); }
  };

  /* Theme music: an original eight bar loop. */
  const BEAT = 60 / 126;
  const CH = {
    F: { root: 41, notes: [65, 69, 72] }, Bb: { root: 46, notes: [65, 70, 74] },
    Dm: { root: 38, notes: [65, 69, 74] }, C: { root: 36, notes: [64, 67, 72] }
  };
  const PROG = ['F', 'F', 'Bb', 'Bb', 'Dm', 'C', 'Bb', 'F'];
  const MEL = [
    [[0, 72, .5], [.5, 69, .5], [1, 72, .5], [1.5, 74, 1], [3, 72, .5], [3.5, 69, .5]],
    [[0, 65, 1.5], [2, 67, .5], [2.5, 69, .5], [3, 72, 1]],
    [[0, 74, .5], [.5, 70, .5], [1, 74, .5], [1.5, 77, 1], [3, 74, .5], [3.5, 72, .5]],
    [[0, 70, 1.5], [2, 72, .5], [2.5, 74, .5], [3, 77, 1]],
    [[0, 77, .5], [.5, 74, .5], [1, 69, 1], [2, 74, .5], [2.5, 77, .5], [3, 76, 1]],
    [[0, 76, .5], [.5, 72, .5], [1, 67, 1], [2, 72, .5], [2.5, 76, .5], [3, 79, 1]],
    [[0, 77, .5], [.5, 74, .5], [1, 70, 1], [2, 79, .5], [2.5, 76, .5], [3, 72, 1]],
    [[0, 77, 2], [2.5, 72, .5], [3, 77, .75]]
  ];
  const BASS = [0, 0, 12, 0, 7, 0, 12, 10];

  function schedBar(i, t0) {
    const idx = i % 8, b = BEAT;
    const chord = beat => idx === 6 ? (beat < 2 ? CH.Bb : CH.C) : CH[PROG[idx]];
    for (let k = 0; k < 4; k++) {
      tone({ at: t0 + k * b, f: 140, f2: 45, d: 0.18, g: 0.5, dest: mus });
      if (k % 2) nz({ at: t0 + k * b, d: 0.14, g: 0.22, ft: 'bandpass', ff: 1800, q: 0.7, dest: mus });
      chord(k).notes.forEach(m => tone({ at: t0 + (k + 0.5) * b, type: 'sawtooth', f: mf(m), d: 0.16, g: 0.05, lp: 2500, hold: 1, dest: mus }));
    }
    for (let k = 0; k < 8; k++) {
      nz({ at: t0 + k * b / 2, d: 0.04, g: k % 2 ? 0.1 : 0.05, ff: 7000, dest: mus });
      tone({ at: t0 + k * b / 2, type: 'sawtooth', f: mf(chord(k / 2).root + BASS[k]), d: 0.2, g: 0.26, lp: 500, hold: 1, dest: mus });
    }
    MEL[idx].forEach(n => brass(0, n[1], n[2] * b * 0.9, 0.07, mus, t0 + n[0] * b));
  }

  function music(on) {
    init();
    if (on === musicOn) return;
    musicOn = on;
    if (over.theme) {
      if (on) { themeEl = over.theme; themeEl.loop = true; themeEl.currentTime = 0; themeEl.volume = vol * 0.7; themeEl.play(); }
      else if (themeEl) themeEl.pause();
      return;
    }
    const t = ctx.currentTime;
    mus.gain.cancelScheduledValues(t);
    if (on) {
      mus.gain.setTargetAtTime(0.5, t, 0.05);
      bar = 0; nextBar = t + 0.1;
      musicTimer = setInterval(() => {
        while (nextBar < ctx.currentTime + 0.4) { schedBar(bar++, nextBar); nextBar += 4 * BEAT; }
      }, 100);
    } else {
      clearInterval(musicTimer);
      mus.gain.setTargetAtTime(0, t, 0.2);
    }
  }

  function play(name, delayMs) {
    init();
    if (delayMs) { setTimeout(() => play(name), delayMs); return; }
    if (over[name]) { const c = over[name].cloneNode(); c.volume = vol; c.play().catch(() => {}); return; }
    if (S[name]) S[name]();
  }

  return {
    init, play, music,
    isMusic: () => musicOn,
    setVolume(v) { vol = v; if (out) out.gain.value = v; if (themeEl) themeEl.volume = v * 0.7; },
    names: NAMES
  };
})();
