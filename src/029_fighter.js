// ============================================================
// 格闘ゲーム『FIGHTING EDGE 2』（架空のメーカーのポリゴン格闘ゲーム）
// 別のシーンを描いて、ゲーセンの筐体の画面に映す
// ============================================================
const FG = { W: 512, H: 384, t: 0, mode: 'attract', state: 'idle', msg: '', msgT: 0, side: null, vsMan: false, shake: 0 };
const FG_NAMES = ['ゴウ', 'レイ'];
// 実況の声（tools/gen_voice.js が拾う）と、画面に出す英語
const FG_VO = [['fgann', 'ラウンド、ワン。'], ['fgann', 'ファイト！'], ['fgann', 'ケー、オー！'], ['fgann', 'リングアウト！'], ['fgann', 'タイム、アップ！'], ['fgann', 'ユー、ウィン。'], ['fgann', 'ユー、ルーズ。'], ['fgann', 'ニュー、チャレンジャー！']];
const FG_EN = { 'ラウンド ワン': 'ROUND 1', 'ファイト！': 'FIGHT!', 'ケー オー！': 'K.O.', 'リングアウト！': 'RING OUT!', 'タイム アップ！': 'TIME UP', 'ユー ウィン': 'YOU WIN', 'ユー ルーズ': 'YOU LOSE', 'ニュー チャレンジャー！': 'NEW CHALLENGER!' };
function fgInit() {
  const S = FG.scene = new THREE.Scene(); FG.scene.background = new THREE.Color(0x7a9ad8);
  FG.cam = new THREE.PerspectiveCamera(38, FG.W / FG.H, .1, 400);
  S.add(new THREE.HemisphereLight(0xc8d8ff, 0x4a4030, 1.4)); const d = new THREE.DirectionalLight(0xfff0d8, 2.6); d.position.set(4, 10, 6); S.add(d);
  // 空（上から下へのグラデーション）と遠くの山
  const sky = new THREE.Mesh(new THREE.SphereGeometry(180, 16, 10), new THREE.MeshBasicMaterial({ side: THREE.BackSide, vertexColors: true }));
  const cols = []; const pa = sky.geometry.attributes.position; for (let i = 0; i < pa.count; i++) { const y = pa.getY(i) / 180, c = new THREE.Color().lerpColors(new THREE.Color(0xe8c8a0), new THREE.Color(0x3a5ab8), Math.max(0, y) ** .6); cols.push(c.r, c.g, c.b); } sky.geometry.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3)); S.add(sky);
  const mtM = new THREE.MeshLambertMaterial({ color: 0x4a5a7a, flatShading: true });
  for (let i = 0; i < 14; i++) { const a = i / 14 * Math.PI * 2, m = new THREE.Mesh(new THREE.ConeGeometry(18 + Math.random() * 14, 20 + Math.random() * 25, 5), mtM); m.position.set(Math.cos(a) * 120, 4, Math.sin(a) * 120 - 20); S.add(m); }
  // リング（石の舞台）と水面
  const ringM = new THREE.MeshLambertMaterial({ color: 0x9a9088, flatShading: true });
  const ring = new THREE.Mesh(new THREE.BoxGeometry(12, .8, 12), ringM); ring.position.y = -.4; S.add(ring);
  for (let i = -5; i <= 5; i += 2) for (let j = -5; j <= 5; j += 2) { const t = new THREE.Mesh(new THREE.BoxGeometry(1.96, .02, 1.96), new THREE.MeshLambertMaterial({ color: (i + j) % 4 === 0 ? 0xa8a098 : 0x8e867e })); t.position.set(i, .005, j); S.add(t); }
  const water = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.MeshLambertMaterial({ color: 0x2a5a9a })); water.rotation.x = -Math.PI / 2; water.position.y = -1.4; S.add(water);
  FG.f = [mkFighter(0), mkFighter(1)];
  for (const f of FG.f) S.add(f.root);
  FG.rt = new THREE.WebGLRenderTarget(FG.W, FG.H, { type: THREE.HalfFloatType });
  // 画面の上に重ねる文字（体力ゲージ・時間・メッセージ）
  const hc = document.createElement('canvas'); hc.width = FG.W; hc.height = FG.H; FG.hud = hc; FG.hg = hc.getContext('2d');
  FG.hudTex = new THREE.CanvasTexture(hc); FG.hudTex.colorSpace = THREE.SRGBColorSpace;
  fgReset('attract');
}
function mkFighter(k) {
  const root = new THREE.Group(), C = k === 0 ? { top: 0xf0f0ea, pants: 0xf0f0ea, belt: 0x111111, skin: 0xd8a070, hair: 0x1a1a1a, band: 0xc82020 } : { top: 0xc82a2a, pants: 0x2a3a7a, belt: 0x2a2a2a, skin: 0xe0b088, hair: 0x6a3a1a, band: null };
  const mat = c => new THREE.MeshLambertMaterial({ color: c, flatShading: true });
  const B = (w, h, d, m, x, y, z, parent) => { const g = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); g.position.set(x, y, z); parent.add(g); return g; };
  const J = (x, y, z, parent) => { const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g); return g; };
  const hips = J(0, 1.0, 0, root); B(.36, .2, .22, mat(C.pants), 0, 0, 0, hips); B(.38, .07, .24, mat(C.belt), 0, .1, 0, hips);
  const chest = J(0, .12, 0, hips); B(.42, .42, .25, mat(C.top), 0, .24, 0, chest); B(.18, .1, .2, mat(C.skin), 0, .48, 0, chest);
  const head = J(0, .58, 0, chest); const hd = new THREE.Mesh(new THREE.IcosahedronGeometry(.13, 0), mat(C.skin)); hd.scale.set(1, 1.15, 1.05); head.add(hd);
  const hair = new THREE.Mesh(new THREE.IcosahedronGeometry(.135, 0), mat(C.hair)); hair.scale.set(1.02, .7, 1.08); hair.position.y = .07; head.add(hair);
  if (C.band) B(.28, .04, .28, mat(C.band), 0, .05, 0, head);
  const arm = s => { const sh = J(s * .27, .42, 0, chest); B(.12, .3, .13, mat(k === 0 ? C.top : C.top), 0, -.15, 0, sh); const el = J(0, -.3, 0, sh); B(.1, .28, .1, mat(C.skin), 0, -.14, 0, el); B(.12, .11, .12, mat(C.skin), 0, -.3, 0, el); return { sh, el }; };
  const leg = s => { const hp = J(s * .11, -.08, 0, hips); B(.15, .44, .16, mat(C.pants), 0, -.22, 0, hp); const kn = J(0, -.44, 0, hp); B(.13, .44, .14, mat(C.pants), 0, -.22, 0, kn); B(.13, .07, .26, mat(k === 0 ? C.skin : 0x222222), 0, -.46, .05, kn); return { hp, kn }; };
  const f = { root, hips, chest, head, aL: arm(-1), aR: arm(1), lL: leg(-1), lR: leg(1), k };
  root.traverse(o => { if (o.isMesh) o.castShadow = false; });
  return f;
}
// 姿勢（関節の目標角度）
const POSES = {
  idle: { hipsY: 1.0, chest: [.1, .5], lL: [-.35, .45], lR: [.25, .35], aL: [-.9, .3, -1.6], aR: [-.6, -.2, -1.9] },
  walk: { hipsY: 1.0, chest: [.1, .5], lL: [-.2, .3], lR: [.1, .3], aL: [-.9, .3, -1.6], aR: [-.6, -.2, -1.9] },
  punch: { hipsY: .98, chest: [.15, .05], lL: [-.5, .3], lR: [.4, .3], aL: [-1.5, 0, -.05], aR: [-.5, -.2, -2.0] },
  kick: { hipsY: 1.02, chest: [-.25, .3], lL: [-1.55, .05], lR: [.15, .15], aL: [-.5, .5, -1.4], aR: [-.3, -.5, -1.4] },
  guard: { hipsY: .92, chest: [.2, .3], lL: [-.45, .6], lR: [.35, .5], aL: [-1.6, .5, -2.4], aR: [-1.5, -.4, -2.5] },
  hit: { hipsY: .96, chest: [-.45, .9], lL: [-.1, .3], lR: [.3, .4], aL: [-.3, .6, -.6], aR: [-.2, -.6, -.6] },
  down: { hipsY: .2, chest: [-1.4, 0], lL: [-.3, .2], lR: [-.2, .1], aL: [-2.6, .5, -.2], aR: [-2.6, -.5, -.2] },
  win: { hipsY: 1.0, chest: [-.05, 0], lL: [-.1, .05], lR: [.1, .05], aL: [-.2, .3, -.3], aR: [-2.8, -.2, -.3] },
};
function fgPose(f, name, dt, k = 14) {
  const p = POSES[name], a = 1 - Math.exp(-dt * k), L = (o, prop, v) => { o[prop] = lerp(o[prop], v, a); };
  L(f.hips.position, 'y', p.hipsY); L(f.chest.rotation, 'x', p.chest[0]); L(f.chest.rotation, 'y', p.chest[1] * (f.face > 0 ? 1 : 1));
  L(f.lL.hp.rotation, 'x', p.lL[0]); L(f.lL.kn.rotation, 'x', p.lL[1]); L(f.lR.hp.rotation, 'x', p.lR[0]); L(f.lR.kn.rotation, 'x', p.lR[1]);
  L(f.aL.sh.rotation, 'x', p.aL[0]); L(f.aL.sh.rotation, 'z', p.aL[1]); L(f.aL.el.rotation, 'x', p.aL[2]); L(f.aR.sh.rotation, 'x', p.aR[0]); L(f.aR.sh.rotation, 'z', p.aR[1]); L(f.aR.el.rotation, 'x', p.aR[2]);
  L(f.hips.rotation, 'x', name === 'down' ? -1.45 : 0);
}
function fgReset(mode) {
  FG.mode = mode; FG.state = 'intro'; FG.t = 0; FG.timer = 30; FG.result = null;
  FG.f.forEach((f, i) => { Object.assign(f, { x: i ? 1.4 : -1.4, y: 0, vx: 0, face: i ? -1 : 1, hp: 100, st: 'idle', st_t: 0, hitDone: false, guardT: 0, aiT: 0, out: false }); f.root.position.set(f.x, 0, 0); f.root.rotation.y = f.face > 0 ? Math.PI / 2 : -Math.PI / 2; });
  if (mode !== 'attract') { fgSay('ラウンド、ワン。'); setTimeout(() => fgSay('ファイト！'), 1300); }
}
function fgSay(t) { FG.msg = t.replace(/、/g, ' ').replace('。', ''); FG.msgT = 1.2; if (FG.loud) sayLine('fgann', t); }
const FG_MOVES = { punch: { dur: .34, a0: .08, a1: .17, range: 1.05, dmg: 7, stun: .3, kb: 1.6 }, kick: { dur: .56, a0: .18, a1: .31, range: 1.4, dmg: 13, stun: .45, kb: 3.0 } };
function fgAct(f, act) {
  if (FG.state !== 'fight' || f.st === 'hit' || f.st === 'down' || FG_MOVES[f.st]) return;
  if (FG_MOVES[act]) { f.st = act; f.st_t = 0; f.hitDone = false; fgSfx('swing'); }
}
function fgAI(f, o, dt, skill) {
  f.aiT -= dt; const dist = Math.abs(o.x - f.x);
  if (FG_MOVES[o.st] && dist < 1.6 && f.aiT < .1 && Math.random() < skill * .7) { f.wantGuard = .45; f.aiT = .3; }
  if (f.wantGuard > 0) { f.wantGuard -= dt; return { guard: true }; }
  if (f.aiT > 0) return { dir: f.aiDir || 0 };
  f.aiT = .18 + Math.random() * .35; f.aiDir = 0;
  if (dist > 1.25) f.aiDir = Math.sign(o.x - f.x);
  else { const r = Math.random(); if (r < .35 + skill * .1) return { act: 'punch' }; if (r < .6) return { act: 'kick' }; if (r < .7) f.aiDir = -Math.sign(o.x - f.x); }
  return { dir: f.aiDir };
}
function fgUpdate(dt) {
  if (!FG.scene) return; FG.t += dt; FG.msgT = Math.max(0, FG.msgT - dt); FG.shake = Math.max(0, FG.shake - dt);
  const [a, b] = FG.f;
  if (FG.state === 'intro' && FG.t > (FG.mode === 'attract' ? .5 : 1.8)) FG.state = 'fight';
  if (FG.state === 'fight') { FG.timer -= dt; if (FG.timer <= 0) { FG.timer = 0; fgFinish(a.hp === b.hp ? -1 : a.hp > b.hp ? 0 : 1, 'time'); } }
  for (let i = 0; i < 2; i++) {
    const f = FG.f[i], o = FG.f[1 - i];
    let inp = {};
    if (FG.state === 'fight') {
      if (FG.side === i && FG.playing) { inp.dir = (KEYS.KeyD || KEYS.ArrowRight ? 1 : 0) - (KEYS.KeyA || KEYS.ArrowLeft ? 1 : 0); inp.guard = KEYS.KeyL || KEYS.KeyS; if (FG.pressP) { inp.act = 'punch'; } if (FG.pressK) inp.act = 'kick'; }
      else inp = fgAI(f, o, dt, FG.mode === 'vs' && i !== FG.side ? .62 : .5);
    }
    f.st_t += dt;
    if (inp.act) fgAct(f, inp.act);
    const mv = FG_MOVES[f.st];
    if (mv) { if (f.st_t > mv.dur) f.st = 'idle'; else if (!f.hitDone && f.st_t > mv.a0 && f.st_t < mv.a1 && Math.abs(o.x - f.x) < mv.range && o.st !== 'down') { f.hitDone = true; fgHit(f, o, mv); } }
    else if (f.st === 'hit') { if (f.st_t > f.stun) f.st = 'idle'; }
    else if (f.st === 'down' || f.st === 'win') { }
    else if (FG.state === 'fight') { if (inp.guard) f.st = 'guard'; else if (inp.dir) { f.st = 'walk'; f.x += inp.dir * 2.0 * dt; } else f.st = 'idle'; }
    // ノックバック・リングアウト
    f.x += f.vx * dt; f.vx *= Math.exp(-dt * 6);
    if (Math.abs(f.x) > 5.8 && !f.out && FG.state === 'fight') { f.out = true; f.st = 'down'; fgFinish(1 - i, 'out'); }
    if (f.out) { f.y = Math.max(-1.5, f.y - dt * 4); f.x += Math.sign(f.x) * dt; }
    f.face = Math.sign(o.x - f.x) || f.face;
    fgPose(f, f.st === 'walk' ? 'walk' : (POSES[f.st] ? f.st : 'idle'), dt);
    if (f.st === 'walk') { const s = Math.sin(FG.t * 12); f.lL.hp.rotation.x += s * .25 * dt * 10; f.lR.hp.rotation.x -= s * .25 * dt * 10; }
  }
  // 重ならないように
  const gap = b.x - a.x, minG = .62; if (Math.abs(gap) < minG && !a.out && !b.out) { const push = (minG - Math.abs(gap)) / 2 * Math.sign(gap || 1); a.x -= push; b.x += push; }
  for (const f of FG.f) { f.root.position.set(f.x, f.y, 0); f.root.rotation.y = f.face > 0 ? Math.PI / 2 : -Math.PI / 2; }
  FG.pressP = FG.pressK = false;
  // 試合が終わったら
  if (FG.state === 'end') { FG.endT -= dt; if (FG.endT <= 0) { if (FG.onEnd) { const cb = FG.onEnd; FG.onEnd = null; cb(FG.result); } fgReset('attract'); FG.loud = false; } }
  if (FG.mode === 'attract' && FG.state === 'end' && FG.endT <= 0) fgReset('attract');
  // カメラ
  const mid = (a.x + b.x) / 2, sep = Math.abs(a.x - b.x);
  FG.cam.position.set(mid + Math.sin(FG.t * .2) * .6, 1.7 + (FG.shake ? (Math.random() - .5) * .1 : 0), 4.6 + sep * .55); FG.cam.lookAt(mid, 1.05, 0);
  fgDrawHUD();
}
function fgHit(f, o, mv) {
  const guarded = o.st === 'guard' && Math.sign(f.x - o.x) === o.face;
  if (guarded) { o.vx = f.face * 1.0; fgSfx('block'); return; }
  o.hp = Math.max(0, o.hp - mv.dmg); o.st = 'hit'; o.st_t = 0; o.stun = mv.stun; o.vx = f.face * mv.kb; fgSfx(mv === FG_MOVES.kick ? 'kick' : 'hit');
  if (o.hp <= 0) { o.st = 'down'; fgFinish(FG.f.indexOf(f), 'ko'); }
}
function fgFinish(winner, how) {
  if (FG.state === 'end') return; FG.state = 'end'; FG.endT = 4; FG.result = { winner, how };
  if (winner >= 0) { FG.f[winner].st = 'win'; FG.f[winner].st_t = 0; }
  fgSay(how === 'ko' ? 'ケー、オー！' : how === 'out' ? 'リングアウト！' : 'タイム、アップ！');
  if (FG.side !== null && FG.playing && winner >= 0) setTimeout(() => fgSay(winner === FG.side ? 'ユー、ウィン。' : 'ユー、ルーズ。'), 1600);
}
function fgDrawHUD() {
  const g = FG.hg, W = FG.W; g.clearRect(0, 0, W, FG.H);
  if (FG.mode === 'attract' && !FG.loud) { g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(0, 300, W, 50); g.fillStyle = Math.floor(FG.t * 2) % 2 ? '#fff' : '#ffd040'; g.font = 'bold 26px Arial,sans-serif'; g.textAlign = 'center'; g.fillText('INSERT COIN', W / 2, 334); g.font = 'bold 34px Impact,Arial,sans-serif'; g.fillStyle = '#ffe040'; g.strokeStyle = '#a02010'; g.lineWidth = 4; g.strokeText('FIGHTING EDGE 2', W / 2, 52); g.fillText('FIGHTING EDGE 2', W / 2, 52); g.textAlign = 'left'; FG.hudTex.needsUpdate = true; return; }
  const [a, b] = FG.f;
  for (const [f, x, al] of [[a, 20, 'left'], [b, W - 20, 'right']]) {
    const w = 200, x0 = al === 'left' ? x : x - w; g.fillStyle = '#300'; g.fillRect(x0, 40, w, 16); g.fillStyle = f.hp > 30 ? '#ffd030' : '#ff4020'; const hw = w * f.hp / 100; g.fillRect(al === 'left' ? x0 + w - hw : x0, 40, hw, 16); g.strokeStyle = '#fff'; g.lineWidth = 2; g.strokeRect(x0, 40, w, 16);
    g.fillStyle = '#fff'; g.font = `bold 16px ${GOTH}`; g.textAlign = al; g.fillText(FG_NAMES[f.k], x, 74);
  }
  g.textAlign = 'center'; g.fillStyle = '#fff'; g.font = 'bold 30px Arial,sans-serif'; g.fillText(String(Math.ceil(FG.timer)).padStart(2, '0'), W / 2, 62);
  if (FG.msgT > 0 || FG.state === 'end') { g.font = 'bold 50px Impact,Arial,sans-serif'; g.fillStyle = '#ffe040'; g.strokeStyle = '#a01010'; g.lineWidth = 5; const t = FG_EN[FG.msg] || FG.msg; g.strokeText(t, W / 2, 200); g.fillText(t, W / 2, 200); }
  if (FG.challenger) { g.fillStyle = 'rgba(200,0,0,.6)'; g.fillRect(0, 230, W, 40); g.fillStyle = '#fff'; g.font = `bold 24px ${GOTH}`; g.fillText('挑戦者が乱入しました！', W / 2, 258); }
  g.textAlign = 'left'; FG.hudTex.needsUpdate = true;
}
function fgSfx(k) {
  if (!AU.ready || !FG.sfxOut) return; const t = now(), d = FG.sfxOut;
  if (k === 'swing') { const n = oneNoise('white', t, .12), bp = filt('bandpass', 1800, .9), g = gainN(0); chain(n, bp, g, d); env(g, t, .01, .12, .1); }
  if (k === 'hit' || k === 'kick') { const n = oneNoise('pink', t, .2), lp = filt('lowpass', k === 'kick' ? 900 : 1500), g = gainN(0); chain(n, lp, g, d); env(g, t, .002, k === 'kick' ? 1.2 : .8, .15); const o = osc('square', k === 'kick' ? 90 : 140), go = gainN(0); o.connect(go); go.connect(d); env(go, t, .002, .25, .12); o.start(t); o.stop(t + .2); FG.shake = .12; }
  if (k === 'block') { const o = osc('square', 900), g = gainN(0); o.connect(g); g.connect(d); env(g, t, .001, .08, .06); o.start(t); o.stop(t + .1); }
}
function fgRender() { if (!FG.scene) return; renderer.setRenderTarget(FG.rt); renderer.render(FG.scene, FG.cam); renderer.setRenderTarget(null); }
