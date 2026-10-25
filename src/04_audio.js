// ============================================================
// 音響（Web Audio で生成。場所ごとの遮音・距離減衰つき）
// ============================================================
const AU = { ctx: null, sources: [], ready: false };
function audioInit(vol) {
  const ctx = new (window.AudioContext || window.webkitAudioContext)(); AU.ctx = ctx;
  AU.master = ctx.createGain(); AU.master.gain.value = vol;
  const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.knee.value = 12; comp.ratio.value = 4; comp.attack.value = .005; comp.release.value = .25;
  AU.master.connect(comp); comp.connect(ctx.destination);
  AU.buf = { white: noiseBuf('white', 4), pink: noiseBuf('pink', 4), brown: noiseBuf('brown', 4) };
  AU.pulse25 = pulseWave(.25); AU.pulse125 = pulseWave(.125);
  AU.se = {};
  for (const [k, v] of Object.entries(window.ASSETS || {})) if (k.startsWith('se_')) {
    const bin = Uint8Array.from(atob(v.split(',')[1]), c => c.charCodeAt(0)).buffer;
    ctx.decodeAudioData(bin).then(b => AU.se[k.slice(3)] = b).catch(e => console.warn('se', k, e));
  }
  AU.ready = true;
}
function noiseBuf(type, sec) {
  const ctx = AU.ctx, n = ctx.sampleRate * sec, b = ctx.createBuffer(1, n, ctx.sampleRate), d = b.getChannelData(0);
  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0, last = 0;
  for (let i = 0; i < n; i++) {
    const w = Math.random() * 2 - 1;
    if (type === 'white') d[i] = w;
    else if (type === 'pink') { b0 = .99886 * b0 + w * .0555179; b1 = .99332 * b1 + w * .0750759; b2 = .969 * b2 + w * .153852; b3 = .8665 * b3 + w * .3104856; b4 = .55 * b4 + w * .5329522; b5 = -.7616 * b5 - w * .016898; d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * .5362) * .11; b6 = w * .115926; }
    else { last = (last + .02 * w) / 1.02; d[i] = last * 3.5; }
  }
  return b;
}
function pulseWave(duty) { const n = 64, re = new Float32Array(n), im = new Float32Array(n); for (let k = 1; k < n; k++) im[k] = 2 / (k * Math.PI) * Math.sin(k * Math.PI * duty) * 1; for (let k = 1; k < n; k++) { re[k] = im[k]; im[k] = 0; } return AU.ctx.createPeriodicWave(re, im, { disableNormalization: false }); }
const now = () => AU.ctx.currentTime;
function gainN(v) { const g = AU.ctx.createGain(); g.gain.value = v; return g; }
function filt(type, f, q = .7) { const x = AU.ctx.createBiquadFilter(); x.type = type; x.frequency.value = f; x.Q.value = q; return x; }
function osc(type, f) { const o = AU.ctx.createOscillator(); if (type instanceof PeriodicWave) o.setPeriodicWave(type); else o.type = type; o.frequency.value = f; return o; }
function chain(...n) { for (let i = 0; i < n.length - 1; i++) n[i].connect(n[i + 1]); return n[0]; }
function loopNoise(type, rate = 1) { const s = AU.ctx.createBufferSource(); s.buffer = AU.buf[type]; s.loop = true; s.playbackRate.value = rate; s.start(0, Math.random() * 3); return s; }
function oneNoise(type, t, dur) { const s = AU.ctx.createBufferSource(); s.buffer = AU.buf[type]; s.start(t, Math.random() * 3, dur + .05); return s; }
function env(g, t, a, peak, d, hold = 0) { g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(peak, t + a); g.gain.setValueAtTime(peak, t + a + hold); g.gain.exponentialRampToValueAtTime(.0001, t + a + hold + d); }
function setP(p, v) { if (p.positionX) { p.positionX.value = v.x; p.positionY.value = v.y; p.positionZ.value = v.z; } else p.setPosition(v.x, v.y, v.z); }

function mkSrc(pos, zone, base = 1, o = {}) {
  const ctx = AU.ctx, input = gainN(1), lp = filt('lowpass', 18000, .5), g = gainN(0);
  input.connect(lp); lp.connect(g);
  let pan = null;
  if (o.flat) g.connect(AU.master);
  else { pan = ctx.createPanner(); pan.panningModel = 'HRTF'; pan.distanceModel = 'inverse'; pan.refDistance = o.ref ?? 1.2; pan.rolloffFactor = o.roll ?? 1; pan.maxDistance = 10000; g.connect(pan); pan.connect(AU.master); setP(pan, pos); }
  const s = { input, lp, g, pan, pos: pos.clone(), zone, base, mul: 1, dyn: o.dyn };
  AU.sources.push(s); return s;
}
// 遮音：各部屋から廊下（hall）への通りやすさ
function thru(z) {
  switch (z) {
    case 'hall': return 1;
    case 'friend': return DOORS.friend.isOpen ? .8 : .28;
    case 'brother': return .4;
    case 'living': return G.earOnFusuma ? .55 : .33;
    case 'toilet': return DOORS.toilet.isOpen ? .8 : .22;
    case 'out': return DOORS.front.isOpen ? .6 : .07;
    case 'station': return .1;
    case 'arcade': return .5;
    case 'store': return TOWN.superDoor && TOWN.superDoor.o > .5 ? .55 : .15;
  }
  return .05;
}
const DIRECT = { 'friend|out': .42, 'living|out': .09, 'brother|friend': .06, 'living|toilet': .1, 'brother|living': .08, 'friend|living': .05 };
function trans(a, b) { if (a === b) return 1; if ((a === 'station' || a === 'store' || a === 'arcade' || b === 'station' || b === 'store' || b === 'arcade') && (a === 'out' || b === 'out')) return a === 'out' ? thru(b) : thru(a); const t = thru(a) * thru(b); const d = DIRECT[a + '|' + b] ?? DIRECT[b + '|' + a] ?? .02; return Math.min(1, Math.max(t, d)); }
const _fw = new V3(), _up = new V3();
function audioUpdate(camPos, zoneL) {
  if (!AU.ready) return; const L = AU.ctx.listener, t = now();
  camera.getWorldDirection(_fw); _up.set(0, 1, 0).applyQuaternion(camera.quaternion);
  if (L.positionX) { L.positionX.value = camPos.x; L.positionY.value = camPos.y; L.positionZ.value = camPos.z; L.forwardX.value = _fw.x; L.forwardY.value = _fw.y; L.forwardZ.value = _fw.z; L.upX.value = _up.x; L.upY.value = _up.y; L.upZ.value = _up.z; }
  else { L.setPosition(camPos.x, camPos.y, camPos.z); L.setOrientation(_fw.x, _fw.y, _fw.z, _up.x, _up.y, _up.z); }
  for (const s of AU.sources) {
    const T = trans(zoneL, s.zone);
    s.lp.frequency.setTargetAtTime(220 + 17800 * Math.pow(T, 2.3), t, .1);
    s.g.gain.setTargetAtTime(s.base * s.mul * (.05 + .95 * T), t, .1);
    if (s.dyn && s.pan) { s.dyn(s.pos); setP(s.pan, s.pos); }
  }
}
function later(ms, fn) { return setTimeout(() => { if (AU.ready) fn(); }, ms); }
function every(minS, maxS, fn, first) { const go = () => { if (!AU.ready) return; fn(); setTimeout(go, (minS + Math.random() * (maxS - minS)) * 1000); }; setTimeout(go, (first ?? (minS + Math.random() * (maxS - minS))) * 1000); }

// ------------------------------------------------------------
// 声（フォルマント合成。ふすま越しに聞こえる程度の質）
// ------------------------------------------------------------
const VOW = { a: [730, 1090, 2440], i: [270, 2290, 3010], u: [300, 870, 2240], e: [530, 1840, 2480], o: [570, 840, 2410] };
function voice(dest, o) {
  const ctx = AU.ctx, t0 = now() + (o.when ?? 0), vs = o.vowels ?? 'aiueo', n = o.n ?? vs.length, rate = o.rate ?? 7.5, f0 = o.f0 ?? 110, gain = o.gain ?? .5, fs = o.fs ?? 1;
  const src = osc('sawtooth', f0), vib = osc('sine', 5 + Math.random()), vg = gainN(f0 * .018); vib.connect(vg); vg.connect(src.frequency);
  const f1 = filt('bandpass', 700, 5), f2 = filt('bandpass', 1200, 7), f3 = filt('bandpass', 2500, 9), g1 = gainN(3.2), g2 = gainN(2.2), g3 = gainN(1.0), e = gainN(0);
  src.connect(f1); src.connect(f2); src.connect(f3); f1.connect(g1); f2.connect(g2); f3.connect(g3); g1.connect(e); g2.connect(e); g3.connect(e); e.connect(dest);
  const ns = loopNoise('white'), nf = filt('bandpass', 3500, .8), ng = gainN(0); ns.connect(nf); nf.connect(ng); ng.connect(dest);
  const br = o.breath ?? .08; let t = t0;
  for (let i = 0; i < n; i++) {
    const V = VOW[vs[i % vs.length]] || VOW.a, sl = (1 / rate) * (.75 + Math.random() * .5), k = n > 1 ? i / (n - 1) : 0;
    let p = f0 * (1 + (o.startUp ?? .06) - (o.decl ?? .22) * k) * (1 + (Math.random() - .5) * .06); if (o.question && i >= n - 2) p *= 1 + .18 * (i - n + 3);
    src.frequency.setTargetAtTime(p, t, .025);
    f1.frequency.setTargetAtTime(V[0] * fs, t, .02); f2.frequency.setTargetAtTime(V[1] * fs, t, .02); f3.frequency.setTargetAtTime(V[2] * fs, t, .02);
    if (Math.random() < .55) { ng.gain.setValueAtTime(0, t); ng.gain.linearRampToValueAtTime(gain * (.25 + br), t + .01); ng.gain.linearRampToValueAtTime(gain * br * .3, t + .045); }
    e.gain.setTargetAtTime(gain * (.75 + .25 * Math.random()), t + .015, .018); e.gain.setTargetAtTime(gain * .18, t + sl * .78, .02);
    t += sl;
  }
  e.gain.setTargetAtTime(0, t, .04); ng.gain.setTargetAtTime(0, t, .03);
  src.start(t0); vib.start(t0); src.stop(t + .5); vib.stop(t + .5); ns.stop(t + .5);
  return t - t0;
}

// ------------------------------------------------------------
// 環境音
// ------------------------------------------------------------
const SRC = {};
function cicadaMin(s) {
  // 高い帯域の細いノイズを速い脈動で刻む（エンジン音にならないよう低い倍音は出さない）
  const n = loopNoise('white'), bp = filt('bandpass', 3900, 9), bp2 = filt('bandpass', 5800, 7), hp = filt('highpass', 2500);
  const amN = gainN(.5), am = osc('sine', 170 + Math.random() * 30), amg = gainN(.5), e = gainN(0);
  n.connect(bp); n.connect(bp2); bp.connect(hp); bp2.connect(hp); hp.connect(amN); am.connect(amg); amg.connect(amN.gain); amN.connect(e); e.connect(s.input); am.start();
  const phrase = () => {
    let t = now() + .05; const g = e.gain, f = bp.frequency, base = 3700 + Math.random() * 400;
    g.setTargetAtTime(.9, t, .15); f.setTargetAtTime(base, t, .3); t += .9 + Math.random() * .4;
    const k = 6 + Math.floor(Math.random() * 6);
    for (let i = 0; i < k; i++) { g.setTargetAtTime(.35, t, .03); f.setTargetAtTime(base * .97, t, .04); t += .1; g.setTargetAtTime(1, t, .03); f.setTargetAtTime(base * 1.03, t, .05); t += .22; }
    g.setTargetAtTime(.7, t, .08); t += .9; g.setTargetAtTime(0, t, .35); t += .8;
    setTimeout(() => AU.ready && phrase(), (t - now()) * 1000 + 2500 + Math.random() * 9000);
  };
  setTimeout(phrase, Math.random() * 5000);
}
function aburazemi(s) {
  const n = loopNoise('white'), bp = filt('bandpass', 4300, 1.4), bp2 = filt('peaking', 6500, 2); bp2.gain.value = 6;
  const amN = gainN(.6), am = osc('sine', 48 + Math.random() * 14), amg = gainN(.35), e = gainN(.4);
  chain(n, bp, bp2, amN, e, s.input); am.connect(amg); amg.connect(amN.gain); am.start();
  every(2, 7, () => e.gain.setTargetAtTime(.2 + Math.random() * .6, now(), .8), 0);
}
function higurashi(s) {
  const o = osc('sine', 4300), o2 = osc('sine', 8600), g2 = gainN(.15), amN = gainN(.5), am = osc('sine', 15), amg = gainN(.5), e = gainN(0);
  o.connect(amN); o2.connect(g2); g2.connect(amN); am.connect(amg); amg.connect(amN.gain); amN.connect(e); e.connect(s.input); o.start(); o2.start(); am.start();
  const phrase = () => {
    const t = now() + .05, d = 3 + Math.random() * 1.5; o.frequency.setValueAtTime(4700, t); o.frequency.linearRampToValueAtTime(3900, t + d); o2.frequency.setValueAtTime(9400, t); o2.frequency.linearRampToValueAtTime(7800, t + d);
    am.frequency.setValueAtTime(18, t); am.frequency.linearRampToValueAtTime(11, t + d);
    e.gain.setValueAtTime(0, t); e.gain.linearRampToValueAtTime(.5, t + .3); e.gain.setValueAtTime(.5, t + d - .8); e.gain.linearRampToValueAtTime(0, t + d);
    setTimeout(() => AU.ready && phrase(), (d + 4 + Math.random() * 9) * 1000);
  };
  setTimeout(phrase, 1000 + Math.random() * 5000);
}
function traffic(s) {
  const n = loopNoise('brown'), lp = filt('lowpass', 220), e = gainN(.7); chain(n, lp, e, s.input);
  const h = loopNoise('pink'), hb = filt('bandpass', 700, .5), he = gainN(.05); chain(h, hb, he, s.input);
  every(3, 8, () => { e.gain.setTargetAtTime(.55 + Math.random() * .25, now(), 2.5); }, 0);
}
function hum(s, parts) { for (const [type, f, g] of parts) { if (type === 'noise') { const n = loopNoise('brown'), lp = filt('lowpass', f), gg = gainN(g); chain(n, lp, gg, s.input); } else if (type === 'pnoise') { const n = loopNoise('pink'), bp = filt('bandpass', f, .8), gg = gainN(g); chain(n, bp, gg, s.input); } else { const o = osc(type, f), gg = gainN(g); o.connect(gg); gg.connect(s.input); o.start(); } } }
function clockTick(s) {
  let next = now() + .2, tock = false;
  setInterval(() => { if (!AU.ready) return; while (next < now() + .3) { const t = next, n = oneNoise('white', t, .02), bp = filt('bandpass', tock ? 2300 : 3000, 9), g = gainN(0); chain(n, bp, g, s.input); env(g, t, .001, 1.2, .03); tock = !tock; next += 1; } }, 100);
}
function upstairs(s) { every(40, 110, () => { let t = now(); for (let i = 0; i < 2 + Math.floor(Math.random() * 4); i++) { const n = oneNoise('brown', t, .12), lp = filt('lowpass', 140), g = gainN(0); chain(n, lp, g, s.input); env(g, t, .005, 2.5, .15); t += .45 + Math.random() * .3; } }); }
function airplane(s) { every(70, 160, () => { const t = now(), d = 18, n = oneNoise('pink', t, d), lp = filt('lowpass', 500), g = gainN(0); chain(n, lp, g, s.input); lp.frequency.setValueAtTime(300, t); lp.frequency.linearRampToValueAtTime(700, t + d * .5); lp.frequency.linearRampToValueAtTime(250, t + d); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(.12, t + d * .5); g.gain.linearRampToValueAtTime(0, t + d); }, 40); }
function crows(s) { every(12, 35, () => { if (!G.evening) return; let t = now(); for (let i = 0; i < 1 + Math.floor(Math.random() * 3); i++) { const o = osc('sawtooth', 620), f1 = filt('bandpass', 1300, 3), f2 = filt('bandpass', 2400, 4), g = gainN(0); o.connect(f1); o.connect(f2); f1.connect(g); f2.connect(g); g.connect(s.input); o.frequency.setValueAtTime(640, t); o.frequency.linearRampToValueAtTime(520, t + .45); env(g, t, .04, 1.4, .45, .1); o.start(t); o.stop(t + .8); t += .7; } }); }

// ------------------------------------------------------------
// 居間のテレビ（高校野球中継）と父親
// ------------------------------------------------------------
const TVB = { vol: 1 };
function baseballTV(s) {
  const out = gainN(1); TVB.out = out; out.connect(s.input);
  const spk = filt('highpass', 220), spk2 = filt('lowpass', 4200); chain(spk, spk2, out); TVB.in = spk;
  const cn = loopNoise('pink'), cb = filt('bandpass', 1100, .45), cg = gainN(.12); chain(cn, cb, cg, spk); TVB.crowd = cg;
  every(2, 6, () => cg.gain.setTargetAtTime(.08 + Math.random() * .08, now(), 1.5), 0);
  // 実況（VOICEVOX の声があればそれを、無ければ合成音）
  const announce = async () => {
    if (!AU.ready) return; let d = 0;
    const t = pickNR('tv', TV_LINES), k = voKey('announcer', t);
    if (VO.pending[k]) { const b = await voBuf(k); if (b) { const s = AU.ctx.createBufferSource(); s.buffer = b; const g = gainN(.9); s.connect(g); g.connect(spk); s.start(); d = b.duration; } }
    if (!d) d = voice(spk, { n: 8 + Math.floor(Math.random() * 14), f0: 135, rate: 7.8, gain: .5, vowels: 'aoiueaoeia', decl: .25 });
    setTimeout(announce, (d + 1.2 + Math.random() * 3.5) * 1000);
  };
  TVB.hitLine = async () => { const t = pickNR('tvh', TV_HIT), k = voKey('announcer2', t); if (VO.pending[k]) { const b = await voBuf(k); if (b) { const s = AU.ctx.createBufferSource(); s.buffer = b; const g = gainN(1.0); s.connect(g); g.connect(spk); s.start(now() + .3); return; } } voice(spk, { n: 14, f0: 190, rate: 10, gain: .6, vowels: 'aaoaiaoa', when: .3, decl: .1 }); };
  setTimeout(announce, 500);
  every(25, 70, () => { // 打球
    const t = now(); for (const [f, g, d] of [[1850, .5, .35], [2950, .35, .25], [4200, .2, .15]]) { const o = osc('sine', f), gg = gainN(0); o.connect(gg); gg.connect(spk); env(gg, t, .001, g, d); o.start(t); o.stop(t + d + .1); }
    cg.gain.setTargetAtTime(.45, t + .15, .3); cg.gain.setTargetAtTime(.12, t + 3.5, 1.2);
    TVB.hitLine();
  });
  every(40, 90, () => { // 応援団
    const t0 = now(), notes = [392, 440, 523, 587, 659], d = .22; for (let i = 0; i < 32; i++) { const t = t0 + i * d; if (i % 4 === 3) continue; const o = osc('square', notes[Math.floor(Math.random() * 5)]), g = gainN(0); o.connect(g); g.connect(spk); env(g, t, .01, .05, d * .8); o.start(t); o.stop(t + d); if (i % 2 === 0) { const n = oneNoise('brown', t, .1), lp = filt('lowpass', 160), gg = gainN(0); chain(n, lp, gg, spk); env(gg, t, .003, .9, .12); } }
  });
}
const FATHER = { silent: false };
function fatherSounds(s) {
  FATHER.dest = s.input;
  every(9, 22, () => { if (FATHER.silent) return; const r = Math.random(); if (r < .5) SFX.newspaper(s.input); else if (r < .55) SFX.cup(s.input); else if (r < .72) SFX.cough(s.input); else voice(s.input, { n: 2 + Math.floor(Math.random() * 4), f0: 92, rate: 5.5, gain: .5, vowels: 'aou', decl: .3, breath: .2 }); }, 6);
}
function fatherLaugh() { let t = 0; for (let i = 0; i < 4; i++) { voice(FATHER.dest, { n: 1, f0: 108 - i * 5, rate: 9, gain: .45 - i * .06, vowels: 'a', breath: .8, when: t }); t += .16; } }
function fatherLine(which) {
  if (which === 2) voice(FATHER.dest, { n: 7, f0: 100, rate: 6.2, gain: .75, vowels: 'aeaiuoa', question: true, decl: .12, breath: .15 });
  else voice(FATHER.dest, { n: 11, f0: 104, rate: 6.8, gain: .95, vowels: 'ooeaiaeuua', decl: .3, breath: .15 });
}

// ------------------------------------------------------------
// 効果音
// ------------------------------------------------------------
// 効果音フォルダの音を鳴らす。無ければ false を返す（呼び出し側で合成音に切り替える）
function playSE(name, o = {}) {
  if (!AU.ready || !AU.se || !AU.se[name]) return false;
  const s = AU.ctx.createBufferSource(); s.buffer = AU.se[name]; const g = gainN(o.gain ?? .6);
  if (o.pos) { const src = SFX.at(o.pos, o.zone ?? G.zoneAt(o.pos), d => { s.connect(g); g.connect(d); }); } else { s.connect(g); g.connect(AU.master); }
  s.start(now() + (o.when ?? 0)); return s;
}
const SFX = {
  at(pos, zone, build, life = 9000) { if (!AU.ready) return; const s = mkSrc(pos, zone, 1, { ref: 1 }); build(s.input); setTimeout(() => { const i = AU.sources.indexOf(s); if (i >= 0) AU.sources.splice(i, 1); s.g.disconnect(); }, life); audioUpdate(camera.position, G.zone); return s; },
  newspaper(dest) {
    const c = AU.ctx, sr = c.sampleRate, dur = 1.6, n = Math.floor(sr * dur), b = c.createBuffer(1, n, sr), d = b.getChannelData(0);
    // 紙の細かいクシャクシャ（まばらなパチパチ）＋めくる瞬間の「バサッ」
    let amp = 0, lp = 0; const flip = .55 + Math.random() * .3;
    for (let i = 0; i < n; i++) { const tt = i / sr; if (Math.random() < .0022) amp = .35 + Math.random() * .65; amp *= .9978; const w = Math.random() * 2 - 1; lp += (w - lp) * .35; const env = tt < .08 ? tt / .08 : 1; d[i] = (w * .55 + lp * .45) * amp * env * .8; const fd = tt - flip; if (fd > 0 && fd < .22) d[i] += (Math.random() * 2 - 1) * Math.exp(-fd * 18) * .9 * Math.sin(Math.min(1, fd * 40) * 1.57); }
    const s = c.createBufferSource(); s.buffer = b; const hp = filt('highpass', 450), pk = filt('peaking', 3200, 1.2), g = gainN(.85); pk.gain.value = 5; chain(s, hp, pk, g, dest); s.start(now());
    const th = oneNoise('brown', now() + flip, .2), tl = filt('lowpass', 300), tg = gainN(0); chain(th, tl, tg, dest); env(tg, now() + flip, .01, 1.2, .18);
  },
  cup(dest) { const t = now(), o = osc('sine', 950), g = gainN(0); o.connect(g); g.connect(dest); env(g, t, .001, .5, .08); o.start(t); o.stop(t + .15); const n = oneNoise('white', t, .03), bp = filt('bandpass', 2200, 3), gg = gainN(0); chain(n, bp, gg, dest); env(gg, t, .001, .6, .025); },
  cough(dest) { let t = now(); for (const a of [1, .6]) { const n = oneNoise('pink', t, .2), bp = filt('bandpass', 650, 1.2), g = gainN(0); chain(n, bp, g, dest); env(g, t, .01, 1.6 * a, .14); voice(dest, { n: 1, f0: 125, rate: 8, gain: .3 * a, vowels: 'a', breath: .9, when: t - now() }); t += .28; } },
  chime(pos) { SFX.at(pos, 'hall', d => { const t = now(); for (const [f, dt, dur] of [[880, 0, 1.2], [698, .55, 1.8]]) { for (const [m, g] of [[1, .35], [2, .08], [3, .04]]) { const o = osc('sine', f * m), gg = gainN(0); o.connect(gg); gg.connect(d); env(gg, t + dt, .005, g, dur); o.start(t + dt); o.stop(t + dt + dur + .1); } } }); },
  door(open, pos, heavy) { SFX.at(pos, G.zoneAt(pos), d => { const t = now(); const c = oneNoise('white', t, .02), bp = filt('bandpass', heavy ? 2500 : 3200, 4), g = gainN(0); chain(c, bp, g, d); env(g, t, .001, .8, .03); if (open) { const o = osc('sawtooth', 160), b2 = filt('bandpass', 1100, 6), g2 = gainN(0); chain(o, b2, g2, d); o.frequency.setValueAtTime(150, t + .05); o.frequency.linearRampToValueAtTime(230, t + .5); env(g2, t + .05, .05, heavy ? .15 : .06, .4, .1); o.start(t); o.stop(t + .8); } else { const n = oneNoise('brown', t + .02, .25), lp = filt('lowpass', heavy ? 220 : 400), g3 = gainN(0); chain(n, lp, g3, d); env(g3, t + .02, .003, heavy ? 3 : 1.5, .22); const o = osc('sine', heavy ? 70 : 110), g4 = gainN(0); o.connect(g4); g4.connect(d); env(g4, t + .02, .002, .5, .2); o.start(t); o.stop(t + .4); } }); },
  latch(pos) { SFX.at(pos, G.zoneAt(pos), d => { const t = now(); for (const dt of [0, .09]) { const c = oneNoise('white', t + dt, .015), bp = filt('bandpass', 2800, 5), g = gainN(0); chain(c, bp, g, d); env(g, t + dt, .001, .7, .02); } }); },
  click(pos) { SFX.at(pos, G.zoneAt(pos), d => { const t = now(), c = oneNoise('white', t, .01), hp = filt('highpass', 2000), g = gainN(0); chain(c, hp, g, d); env(g, t, .0005, .8, .012); }); },
  flush(pos) { SFX.at(pos, 'toilet', d => { const t = now(), n = oneNoise('pink', t, 7), lp = filt('lowpass', 600), g = gainN(0); chain(n, lp, g, d); lp.frequency.setValueAtTime(500, t); lp.frequency.linearRampToValueAtTime(2600, t + .8); lp.frequency.linearRampToValueAtTime(700, t + 4); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(1.2, t + .5); g.gain.linearRampToValueAtTime(.5, t + 3); g.gain.linearRampToValueAtTime(0, t + 5.5); const o = osc('sine', 280), am = osc('sine', 7), amg = gainN(80), g2 = gainN(0); am.connect(amg); amg.connect(o.frequency); o.connect(g2); g2.connect(d); g2.gain.setValueAtTime(0, t + 2); g2.gain.linearRampToValueAtTime(.05, t + 3); g2.gain.linearRampToValueAtTime(0, t + 5); o.start(t); am.start(t); o.stop(t + 6); am.stop(t + 6); const r = oneNoise('white', t + 3, 5), rb = filt('bandpass', 3200, 2), rg = gainN(0); chain(r, rb, rg, d); rg.gain.setValueAtTime(0, t + 3); rg.gain.linearRampToValueAtTime(.12, t + 4); rg.gain.linearRampToValueAtTime(0, t + 8); }); },
  step(surf, creak) {
    const t = now(), d = AU.master, p = { out: [1400, .1, 1], stair: [1000, .14, 1], wood: [320, .16, 0], carpet: [260, .07, 0], tile: [1800, .05, 0], genkan: [900, .06, 0] }[surf] || [1000, .08, 1];
    const n = oneNoise(p[2] ? 'white' : 'pink', t, .08), f = filt(p[2] ? 'bandpass' : 'lowpass', p[0], p[2] ? 1.2 : .7), g = gainN(0); chain(n, f, g, d); env(g, t, .004, p[1] * (.8 + Math.random() * .4), .06);
    if (creak) { const o = osc('sawtooth', 210), bp = filt('bandpass', 850, 7), g2 = gainN(0); chain(o, bp, g2, d); o.frequency.setValueAtTime(200, t); o.frequency.linearRampToValueAtTime(290 + Math.random() * 60, t + .3); env(g2, t, .05, .05, .3, .05); o.start(t); o.stop(t + .5); }
  },
  juice(pos) { SFX.at(pos, 'out', d => { let t = now(); for (let i = 0; i < 3; i++) { for (const f of [2400, 3550]) { const o = osc('sine', f + Math.random() * 100), g = gainN(0); o.connect(g); g.connect(d); env(g, t, .001, .12, .15); o.start(t); o.stop(t + .2); } t += .14; } t += .3; const m = oneNoise('pink', t, .7), mb = filt('bandpass', 400, 2), mg = gainN(0); chain(m, mb, mg, d); env(mg, t, .05, .3, .5, .2); t += .8; const n = oneNoise('brown', t, .3), lp = filt('lowpass', 260), g = gainN(0); chain(n, lp, g, d); env(g, t, .002, 4, .25); const o = osc('sine', 85), g2 = gainN(0); o.connect(g2); g2.connect(d); env(g2, t, .002, .6, .3); o.start(t); o.stop(t + .5); }); },
  crunch(g0 = 1) { const d = AU.master; let t = now(); for (let i = 0; i < 3; i++) { const n = oneNoise('white', t, .06), bp = filt('bandpass', 2600 + Math.random() * 1500, 1.5), g = gainN(0); chain(n, bp, g, d); env(g, t, .002, .35 * g0, .06); t += .09 + Math.random() * .05; } },
  wash() { SFX.at(new V3(14.7, 3.9, -9.7), 'toilet', d => { const t = now(), n = oneNoise('pink', t, 2.5), bp = filt('bandpass', 2200, .8), g = gainN(0); chain(n, bp, g, d); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(.6, t + .2); g.gain.setValueAtTime(.6, t + 2); g.gain.linearRampToValueAtTime(0, t + 2.4); }); },
  bark(pos) { SFX.at(pos, 'out', d => { let t = now(); for (let k = 0; k < (Math.random() < .5 ? 2 : 1); k++) { const o = osc('sawtooth', 240), f1 = filt('bandpass', 750, 3), f2 = filt('bandpass', 1500, 4), g = gainN(0); o.connect(f1); o.connect(f2); f1.connect(g); f2.connect(g); g.connect(d); o.frequency.setValueAtTime(260, t); o.frequency.exponentialRampToValueAtTime(150, t + .16); env(g, t, .008, 2.4, .14); o.start(t); o.stop(t + .25); const n = oneNoise('pink', t, .12), nb = filt('bandpass', 1100, 1), ng = gainN(0); chain(n, nb, ng, d); env(ng, t, .004, 1.3, .1); const th = oneNoise('brown', t, .1), tl = filt('lowpass', 200), tg = gainN(0); chain(th, tl, tg, d); env(tg, t, .004, 1.5, .1); t += .19; } }); },
  growl(pos) { SFX.at(pos, 'out', d => { const t = now(), o = osc('sawtooth', 70), am = osc('sine', 23), ag = gainN(.5), f = filt('lowpass', 420), g = gainN(0); am.connect(ag); ag.connect(g.gain); o.connect(f); f.connect(g); g.connect(d); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(.7, t + .3); g.gain.linearRampToValueAtTime(0, t + 1.5); o.start(t); am.start(t); o.stop(t + 1.6); am.stop(t + 1.6); }); },
  chain(pos) { SFX.at(pos, 'out', d => { let t = now(); for (let i = 0; i < 6; i++) { for (const f of [3800 + Math.random() * 1500, 5200 + Math.random() * 1500]) { const o = osc('sine', f), g = gainN(0); o.connect(g); g.connect(d); env(g, t, .001, .05, .08); o.start(t); o.stop(t + .1); } t += .05 + Math.random() * .08; } }); },
  clang(pos) { SFX.at(pos, 'out', d => { const t = now(); for (const [f, g0] of [[620, .25], [1240, .12], [1870, .08], [410, .15]]) { const o = osc('sine', f + Math.random() * 20), g = gainN(0); o.connect(g); g.connect(d); env(g, t, .002, g0, .5); o.start(t); o.stop(t + .6); } }); },
  cook(pos, kind) { SFX.at(pos, 'out', d => { const t = now(); if (kind === 'fry') { const n = oneNoise('white', t, .7), hp = filt('highpass', 2500), g = gainN(0); chain(n, hp, g, d); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(.12, t + .1); g.gain.linearRampToValueAtTime(0, t + .7); for (let i = 0; i < 4; i++) { const c = oneNoise('white', t + Math.random() * .6, .01), cb = filt('bandpass', 4000, 3), cg = gainN(0); chain(c, cb, cg, d); env(cg, t + Math.random() * .6, .001, .4, .02); } } else { for (let i = 0; i < 3; i++) { const tt = t + i * .35, c = oneNoise('brown', tt, .05), lp = filt('lowpass', 900), g = gainN(0); chain(c, lp, g, d); env(g, tt, .002, .6, .05); } } }); },
  busDoor(pos) { SFX.at(pos.clone().add(new V3(0, 1.5, 0)), 'out', d => { const t = now(), n = oneNoise('pink', t, 1), hp = filt('highpass', 1800), g = gainN(0); chain(n, hp, g, d); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(.6, t + .05); g.gain.exponentialRampToValueAtTime(.001, t + .9); const th = oneNoise('brown', t + .8, .15), tl = filt('lowpass', 250), tg = gainN(0); chain(th, tl, tg, d); env(tg, t + .8, .005, 1.2, .15); }); },
  autoDoor(pos) { SFX.at(pos, 'out', d => { const t = now(), n = oneNoise('pink', t, 1), bp = filt('bandpass', 500, 1), g = gainN(0); chain(n, bp, g, d); env(g, t, .1, .25, .6, .2); }); },
  gate() { const d = AU.master, t = now(); for (const [f, dt] of [[1400, 0], [1100, .09]]) { const o = osc('square', f), g = gainN(0); o.connect(g); g.connect(d); env(g, t + dt, .002, .05, .08); o.start(t + dt); o.stop(t + dt + .12); } const n = oneNoise('brown', t + .15, .1), lp = filt('lowpass', 500), g2 = gainN(0); chain(n, lp, g2, d); env(g2, t + .15, .003, .8, .1); },
  bell() { SFX.at(new V3(-66, -3, -80), 'station', d => { const t = now(), o = osc('square', 1180), am = osc('square', 28), ag = gainN(.5), g = gainN(0), f = filt('bandpass', 2400, 1); am.connect(ag); ag.connect(g.gain); o.connect(f); f.connect(g); g.connect(d); g.gain.setValueAtTime(.25, t); g.gain.setValueAtTime(.25, t + 6); g.gain.linearRampToValueAtTime(0, t + 6.2); o.start(t); am.start(t); o.stop(t + 6.3); am.stop(t + 6.3); }, 12000); },
  train(arrive) { SFX.at(new V3(-66, -8, -82), 'station', d => { const t = now(), dur = 14, n = oneNoise('brown', t, dur), lp = filt('lowpass', 300), g = gainN(0); chain(n, lp, g, d); const p = oneNoise('pink', t, dur), pb = filt('bandpass', 900, .7), pg = gainN(0); chain(p, pb, pg, d); for (const gg of [g, pg]) { gg.gain.setValueAtTime(0, t); if (arrive) { gg.gain.linearRampToValueAtTime(gg === g ? 2.2 : .5, t + 7); gg.gain.linearRampToValueAtTime(0, t + 13); } else { gg.gain.linearRampToValueAtTime(gg === g ? 2.2 : .5, t + 4); gg.gain.linearRampToValueAtTime(0, t + 13); } } if (arrive) { const sq = osc('sine', 2800), sg = gainN(0); sq.connect(sg); sg.connect(d); sg.gain.setValueAtTime(0, t + 8); sg.gain.linearRampToValueAtTime(.03, t + 9); sg.gain.linearRampToValueAtTime(0, t + 12); sq.start(t); sq.stop(t + dur); } }, 16000); },
  dtmf(k) { const fr = { 1: [697, 1209], 2: [697, 1336], 3: [697, 1477], 4: [770, 1209], 5: [770, 1336], 6: [770, 1477], 7: [852, 1209], 8: [852, 1336], 9: [852, 1477], 0: [941, 1336], '#': [941, 1477], C: [941, 1209] }[k] || [941, 1336]; const t = now(); for (const f of fr) { const o = osc('sine', f), g = gainN(0); o.connect(g); g.connect(phoneOut()); env(g, t, .005, .12, .12, .05); o.start(t); o.stop(t + .2); } },
  pip(long) { const t = now(), o = osc('sine', long ? 880 : 440), g = gainN(0); o.connect(g); g.connect(phoneOut()); env(g, t, .005, .25, long ? .9 : .12, long ? .3 : .02); o.start(t); o.stop(t + 1.4); },
  tea() { const d = AU.master; let t = now(); for (const f of [3200, 4700, 2600]) { const o = osc('sine', f), g = gainN(0); o.connect(g); g.connect(d); env(g, t, .001, .05, .2); o.start(t); o.stop(t + .3); t += .06; } t += .4; for (let i = 0; i < 2; i++) { const o = osc('sine', 200), g = gainN(0); o.connect(g); g.connect(d); o.frequency.setValueAtTime(220, t); o.frequency.exponentialRampToValueAtTime(110, t + .12); env(g, t, .01, .12, .1); o.start(t); o.stop(t + .2); t += .5; } },
  // メッセージウインドウの効果音（XP風の澄んだ電子音。オリジナル）
  ui(kind) {
    if (playSE({ msg: 'スポン', thought: 'スポン', open: 'カチッ', error: 'スポン' }[kind], { gain: .45 })) return;
    const d = AU.master, t = now();
    const bell = (f, dt, dur, g) => { for (const [m, k] of [[1, 1], [2.01, .25], [3.02, .08]]) { const o = osc('sine', f * m), gg = gainN(0); o.connect(gg); gg.connect(d); env(gg, t + dt, .004, g * k, dur); o.start(t + dt); o.stop(t + dt + dur + .05); } };
    if (kind === 'msg') { bell(1319, 0, .35, .07); bell(1760, .075, .5, .06); }
    else if (kind === 'thought') { bell(880, 0, .45, .045); }
    else if (kind === 'open') { bell(1047, 0, .18, .05); bell(1568, .05, .3, .045); }
  },
  elvDoor() { SFX.at(new V3(27.9, ELV.y + 1, .65), 'out', d => { const t = now(), n = oneNoise('pink', t, 1.1), bp = filt('bandpass', 700, 1.5), g = gainN(0); chain(n, bp, g, d); env(g, t, .15, .25, .5, .4); const c = oneNoise('white', t + 1.05, .02), cb = filt('bandpass', 2000, 3), cg = gainN(0); chain(c, cb, cg, d); env(cg, t + 1.05, .002, .4, .04); }); },
  elvStart() { SFX.at(new V3(28.8, ELV.y + 1, .6), 'out', d => { const t = now(), n = oneNoise('brown', t, .3), lp = filt('lowpass', 200), g = gainN(0); chain(n, lp, g, d); env(g, t, .01, 1.5, .25); }); },
  elvArrive() { SFX.at(new V3(28.8, ELV.y + 2, .6), 'out', d => { const t = now(); for (const [f, g] of [[1318, .12], [2636, .03]]) { const o = osc('sine', f), gg = gainN(0); o.connect(gg); gg.connect(d); env(gg, t, .005, g, 1.2); o.start(t); o.stop(t + 1.3); } }); },
  tofu(pos) { SFX.at(pos, 'out', d => { let t = now(); for (const [f, dur] of [[587, .7], [523, 1.3], [587, .7], [523, 1.3]]) { const o = osc('sawtooth', f), o2 = osc('sawtooth', f * 1.005), bp = filt('lowpass', 1800), g = gainN(0); o.connect(bp); o2.connect(bp); bp.connect(g); g.connect(d); env(g, t, .05, .08, .2, dur - .2); o.start(t); o2.start(t); o.stop(t + dur + .2); o2.stop(t + dur + .2); t += dur + .15; } }); },
};

function storeMusic(s) {
  const out = s.input, notes = [[523, 659, 784], [440, 523, 659], [349, 440, 523], [392, 494, 587]], mel = [784, 880, 784, 659, 698, 659, 587, 523, 587, 659, 523, 440, 494, 523, 587, 392];
  let next = now() + .5, step = 0;
  setInterval(() => { if (!AU.ready) return; while (next < now() + .3) { const t = next, ch = notes[Math.floor(step / 8) % 4];
    if (step % 8 === 0) for (const f of ch) { const o = osc('triangle', f / 2), g = gainN(0); o.connect(g); g.connect(out); env(g, t, .05, .05, 1.6, .4); o.start(t); o.stop(t + 2.2); }
    if (step % 2 === 0) { const o = osc('sine', mel[(step / 2) % 16]), g = gainN(0); o.connect(g); g.connect(out); env(g, t, .02, .07, .35, .1); o.start(t); o.stop(t + .6); }
    step++; next += .28; } }, 80);
}
function trafficAudio() { for (const v of TL.cars.slice(0, 8)) { v.src = mkSrc(v.g.position, 'out', .55, { ref: 4, dyn: p => p.copy(v.g.position) }); hum(v.src, [['noise', v.len > 3 ? 160 : 260, .9], ['pnoise', 900, .12]]); } for (const b of TL.buses) { b.src = mkSrc(b.g.position, 'out', .7, { ref: 5, dyn: p => p.copy(b.g.position) }); hum(b.src, [['noise', 140, 1], ['sine', 55, .03]]); b.src.mul = 0; } }
function startAmbience() {
  // 屋外
  const treeSrc = (W.trees || []).slice(0, 4);
  treeSrc.forEach((p, i) => { const s = mkSrc(p, 'out', .09, { ref: 2.5 }); if (i % 2 === 0) cicadaMin(s); else aburazemi(s); SRC['cicada' + i] = s; });
  SRC.cicadaFar = mkSrc(new V3(40, 8, -60), 'out', .13, { ref: 25 }); aburazemi(SRC.cicadaFar);
  SRC.higu = mkSrc(new V3(-30, 8, -30), 'out', 0, { ref: 20 }); higurashi(SRC.higu);
  SRC.higu2 = mkSrc(new V3(20, 8, 30), 'out', 0, { ref: 20 }); higurashi(SRC.higu2);
  SRC.traffic = mkSrc(new V3(-81, 2, -52), 'out', .35, { ref: 25 }); traffic(SRC.traffic);
  SRC.storeBGM = mkSrc(new V3(-19, 3, -66), 'store', .5, { ref: 6 }); storeMusic(SRC.storeBGM);
  SRC.stationAir = mkSrc(new V3(-66, -2.5, -75), 'station', .5, { ref: 8 }); hum(SRC.stationAir, [['noise', 120, .5], ['pnoise', 2400, .02]]);
  SRC.fridgeStore = mkSrc(new V3(-19, 1, -73), 'store', .5, { ref: 3 }); hum(SRC.fridgeStore, [['sine', 60, .05], ['noise', 200, .1]]);
  trafficAudio();
  SRC.ac = mkSrc(new V3(14.9, 3.1, -10.75), 'out', .4, { ref: 1 }); hum(SRC.ac, [['pnoise', 520, .25], ['sine', 100, .01]]);
  SRC.ac2 = mkSrc(new V3(-10.8, .3, -8.5), 'out', .3, { ref: 1 }); hum(SRC.ac2, [['pnoise', 600, .25], ['sine', 100, .008]]);
  SRC.vend = mkSrc(W.vending.pos, 'out', .5, { ref: .8 }); hum(SRC.vend, [['sine', 60, .06], ['sine', 120, .04], ['sine', 7400, .003], ['noise', 200, .05]]);
  SRC.sky = mkSrc(new V3(10, 60, 10), 'out', .5, { ref: 60 }); airplane(SRC.sky);
  SRC.crow = mkSrc(new V3(40, 20, -40), 'out', .6, { ref: 20 }); crows(SRC.crow);
  // 室内
  SRC.elv = mkSrc(new V3(28.8, 2.5, .6), 'out', .5, { ref: 1.5, dyn: p => { } }); hum(SRC.elv, [['noise', 180, .6], ['sine', 120, .02], ['pnoise', 900, .05]]); SRC.elv.mul = 0;
  SRC.fan = mkSrc(W.fan.pos, 'friend', .5, { ref: .8, dyn: p => { } }); hum(SRC.fan, [['pnoise', 330, .5], ['sine', 118, .02]]);
  SRC.game = mkSrc(W.tvPos, 'friend', .55, { ref: .8 });
  SRC.upstairs = mkSrc(new V3(18, 5.7, -1.8), 'friend', .5, { ref: 1 }); upstairs(SRC.upstairs);
  SRC.clock = mkSrc(new V3(14.3, 4.4, -6.75), 'hall', .5, { ref: .6 }); clockTick(SRC.clock);
  SRC.tv = mkSrc(new V3(17.2, 3.5, -8.8), 'living', .8, { ref: 1.2 }); baseballTV(SRC.tv);
  SRC.father = mkSrc(new V3(16.6, 3.3, -7.4), 'living', 1, { ref: 1.2 }); fatherSounds(SRC.father);
  SRC.fridge = mkSrc(new V3(20.2, 3.6, -6.2), 'living', .5, { ref: 1 }); hum(SRC.fridge, [['sine', 50, .05], ['sine', 100, .03], ['noise', 160, .12]]);
  SRC.toiletTank = mkSrc(new V3(14.7, 3.6, -9.7), 'toilet', .2, { ref: .5 }); every(4, 12, () => { const t = now(), o = osc('sine', 1400 + Math.random() * 600), g = gainN(0); o.connect(g); g.connect(SRC.toiletTank.input); o.frequency.setValueAtTime(1500 + Math.random() * 500, t); o.frequency.exponentialRampToValueAtTime(700, t + .06); env(g, t, .002, .15, .06); o.start(t); o.stop(t + .12); });
}
