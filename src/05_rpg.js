// ============================================================
// ブラウン管の中のRPG（架空のスーファミ風アクションRPG『大地の記憶』）
// ============================================================
const RPG = { W: 64, H: 48, T: 16, t: 0, acc: 0, mode: 'ai', gems: 0, flash: 0, msg: null, msgT: 0, restored: 0 };
const PAL = { g1: '#3f7f3a', g2: '#468a3f', g3: '#356d33', fl: '#e8d86a', dirt: '#9a7a4e', dirt2: '#8a6c44', st: '#8d8a80', st2: '#7a776e', wall: '#5a574f', wallT: '#77746a', water: '#2f5f9a', water2: '#3a70b0', tree: '#1f4a24', tree2: '#2e6a2e', trunk: '#5a3a22' };
function rpgInit() {
  const cv = document.createElement('canvas'); cv.width = 256; cv.height = 224; RPG.cv = cv; RPG.g = cv.getContext('2d'); RPG.g.imageSmoothingEnabled = false;
  const W = RPG.W, H = RPG.H, map = new Uint8Array(W * H), r = mulberry32(1995); RPG.map = map;
  const set = (x, y, v) => { if (x >= 0 && y >= 0 && x < W && y < H) map[y * W + x] = v; };
  for (let i = 0; i < W * H; i++) map[i] = r() < .06 ? 2 : (r() < .5 ? 0 : 1);
  // 道
  const path = (x0, y0, x1, y1) => { let x = x0, y = y0; while (x !== x1 || y !== y1) { set(x, y, 3); set(x + 1, y, 3); if (x !== x1 && (r() < .6 || y === y1)) x += Math.sign(x1 - x); else y += Math.sign(y1 - y); } };
  path(6, 40, 30, 32); path(30, 32, 32, 20); path(12, 8, 30, 20); path(32, 20, 56, 12);
  // 遺跡
  for (let y = 12; y < 30; y++) for (let x = 22; x < 44; x++) set(x, y, 4);
  for (let x = 22; x < 44; x++) { if (x < 30 || x > 34) { set(x, 12, 5); set(x, 29, 5); } }
  for (let y = 12; y < 30; y++) { if (y < 19 || y > 22) { set(22, y, 5); set(43, y, 5); } }
  for (let y = 15; y < 28; y += 4) for (let x = 25; x < 42; x += 5) set(x, y, 8);
  for (let y = 19; y < 22; y++) for (let x = 31; x < 34; x++) set(x, y, 9);
  // 湖
  for (let y = 32; y < 46; y++) for (let x = 40; x < 60; x++) { const dx = (x - 50) / 9, dy = (y - 39) / 6; if (dx * dx + dy * dy < 1) set(x, y, 6); }
  // 森
  for (let k = 0; k < 170; k++) { const x = Math.floor(r() * W), y = Math.floor(r() * H); if (map[y * W + x] < 3) set(x, y, 7); }
  for (let x = 0; x < W; x++) { set(x, 0, 7); set(x, H - 1, 7); } for (let y = 0; y < H; y++) { set(0, y, 7); set(W - 1, y, 7); }
  // 地図を事前描画
  const bg = document.createElement('canvas'); bg.width = W * 16; bg.height = H * 16; const g = bg.getContext('2d'); RPG.bg = bg; RPG.bgg = g;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) drawTile(g, x, y, map[y * W + x], r);
  RPG.hero = { x: 8 * 16, y: 38 * 16, dir: 0, walk: 0, atk: 0, hp: 8, inv: 0, target: null, stuck: 0, wp: 0, idle: 0 };
  RPG.enemies = []; for (let i = 0; i < 12; i++) spawnEnemy(r);
  RPG.parts = [];
  RPG.tex = new THREE.CanvasTexture(cv); RPG.tex.colorSpace = THREE.SRGBColorSpace; RPG.tex.magFilter = THREE.NearestFilter; RPG.tex.minFilter = THREE.LinearFilter; RPG.tex.generateMipmaps = false;
  // ブラウン管のシェーダー
  const mat = new THREE.ShaderMaterial({
    uniforms: { map: { value: RPG.tex }, time: { value: 0 }, bright: { value: 1.6 } },
    vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
    fragmentShader: `uniform sampler2D map; uniform float time, bright; varying vec2 vUv;
      vec2 curve(vec2 uv){ uv=uv*2.-1.; vec2 o=abs(uv.yx)/vec2(5.5,4.5); uv=uv+uv*o*o; return uv*.5+.5; }
      void main(){ vec2 uv=curve(vUv); if(uv.x<0.||uv.y<0.||uv.x>1.||uv.y>1.){ gl_FragColor=vec4(0.004,0.005,0.006,1.); return; }
        vec2 px = vec2(1./256., 0.);
        vec3 c = vec3(texture2D(map, uv+px*.6).r, texture2D(map, uv).g, texture2D(map, uv-px*.6).b);
        c += texture2D(map, uv-px*1.5).rgb*.12;
        float sl = .72 + .28*sin(uv.y*224.*6.2832);
        float mask = .86 + .14*sin(gl_FragCoord.x*2.0944);
        vec2 v = uv*(1.-uv); float vig = pow(v.x*v.y*16., .22);
        float roll = .97 + .03*sin(uv.y*6. - time*2.);
        c = c*sl*mask*vig*roll*bright + vec3(.006,.008,.01);
        gl_FragColor = vec4(c, 1.); }`,
  });
  const scr = new THREE.Mesh(new THREE.PlaneGeometry(.44, .33), mat); scr.position.copy(W_tvPos()); scr.rotation.y = -Math.PI / 2; scene.add(scr);
  RPG.screen = scr; RPG.smat = mat;
  interactable(scr, { label: () => 'テレビの画面を見る', act: () => G.thought(pick(['ドット絵の遺跡。音楽が、少しだけ悲しい。', '主人公の名前は「ヨシ」になっている。', '画面の端が、少し丸く歪んでいる。'])) });
}
function W_tvPos() { return W.tvPos; }
function drawTile(g, x, y, v, r) {
  const X = x * 16, Y = y * 16, F = (c, a, b, w, h) => { g.fillStyle = c; g.fillRect(X + a, Y + b, w, h); };
  switch (v) {
    case 0: case 1: case 2: F(v === 1 ? PAL.g2 : PAL.g1, 0, 0, 16, 16); for (let i = 0; i < 5; i++) F(PAL.g3, Math.floor(r() * 15), Math.floor(r() * 14), 1, 2); if (v === 2) { F(PAL.fl, 5, 6, 2, 2); F('#fff', 10, 10, 2, 2); F('#e87a8a', 3, 11, 2, 2); } break;
    case 3: F(PAL.dirt, 0, 0, 16, 16); for (let i = 0; i < 6; i++) F(PAL.dirt2, Math.floor(r() * 15), Math.floor(r() * 15), 2, 1); break;
    case 4: F(PAL.st, 0, 0, 16, 16); F(PAL.st2, 0, 15, 16, 1); F(PAL.st2, 15, 0, 1, 16); F(PAL.st2, 7, 0, 1, 8); F(PAL.st2, 0, 7, 16, 1); if (r() < .2) F(PAL.g3, 3, 3, 3, 2); break;
    case 5: F(PAL.wall, 0, 0, 16, 16); F(PAL.wallT, 0, 0, 16, 5); F('#3a3832', 0, 15, 16, 1); F('#3a3832', 8, 5, 1, 10); break;
    case 6: F(PAL.water, 0, 0, 16, 16); F(PAL.water2, 2, 4, 6, 1); F(PAL.water2, 9, 11, 5, 1); break;
    case 7: F(PAL.g1, 0, 0, 16, 16); F(PAL.tree, 1, 1, 14, 11); F(PAL.tree2, 3, 2, 8, 5); F(PAL.trunk, 7, 12, 3, 4); break;
    case 8: F(PAL.st, 0, 0, 16, 16); F('#aaa69a', 4, 0, 8, 14); F('#6a675f', 4, 14, 8, 2); F('#c8c4b6', 5, 1, 2, 12); break;
    case 9: F('#c8b870', 0, 0, 16, 16); F('#e8d890', 2, 2, 12, 12); F('#a89850', 6, 6, 4, 4); break;
  }
}
function solidAt(px, py) { const x = Math.floor(px / 16), y = Math.floor(py / 16); if (x < 0 || y < 0 || x >= RPG.W || y >= RPG.H) return true; const v = RPG.map[y * RPG.W + x]; return v === 5 || v === 6 || v === 7 || v === 8; }
function freeBox(x, y) { return !solidAt(x + 3, y + 8) && !solidAt(x + 12, y + 8) && !solidAt(x + 3, y + 15) && !solidAt(x + 12, y + 15); }
function spawnEnemy(r = Math.random) { for (let k = 0; k < 50; k++) { const x = Math.floor(r() * (RPG.W - 2) + 1) * 16, y = Math.floor(r() * (RPG.H - 2) + 1) * 16; if (freeBox(x, y) && Math.hypot(x - (RPG.hero?.x ?? 0), y - (RPG.hero?.y ?? 0)) > 90) { RPG.enemies.push({ x, y, hp: 2, t: r() * 10, vx: 0, vy: 0, hit: 0, kind: r() < .3 ? 1 : 0 }); return; } } }
const DIRS = [[0, 1], [-1, 0], [1, 0], [0, -1]];
const WAYPOINTS = [[32 * 16, 20 * 16], [12 * 16, 8 * 16], [56 * 16, 12 * 16], [30 * 16, 32 * 16]];
function rpgUpdate(dt, input) {
  const h = RPG.hero; RPG.t += dt; h.inv = Math.max(0, h.inv - dt); h.atk = Math.max(0, h.atk - dt);
  let mx = 0, my = 0, attack = false;
  if (RPG.mode === 'player' && input) { mx = input.x; my = input.y; attack = input.atk; }
  else {
    // 友だちの操作（それっぽく）
    let tgt = null, best = 150; for (const e of RPG.enemies) { const d = Math.hypot(e.x - h.x, e.y - h.y); if (d < best) { best = d; tgt = e; } }
    if (h.idle > 0) h.idle -= dt;
    else if (tgt) { const dx = tgt.x - h.x, dy = tgt.y - h.y; if (Math.abs(dx) > Math.abs(dy)) mx = Math.sign(dx); else my = Math.sign(dy); if (Math.hypot(dx, dy) < 20) { mx = my = 0; h.dir = Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 1 : 2) : (dy < 0 ? 3 : 0); if (h.atk <= 0 && Math.random() < .08) attack = true; } }
    else { const [wx, wy] = WAYPOINTS[h.wp]; const dx = wx - h.x, dy = wy - h.y; if (Math.hypot(dx, dy) < 12) { h.wp = (h.wp + 1) % WAYPOINTS.length; h.idle = 1 + Math.random() * 2; } else if (Math.abs(dx) > Math.abs(dy)) mx = Math.sign(dx); else my = Math.sign(dy); }
    if (h.stuck > .4) { const d = DIRS[Math.floor(Math.random() * 4)]; h.forceD = d; h.forceT = .5; h.stuck = 0; }
    if (h.forceT > 0) { h.forceT -= dt; mx = h.forceD[0]; my = h.forceD[1]; }
    if (Math.random() < .002) h.idle = 1.5;
  }
  if (mx || my) {
    if (mx) h.dir = mx < 0 ? 1 : 2; else h.dir = my < 0 ? 3 : 0;
    const sp = 58 * dt; const nx = h.x + mx * sp, ny = h.y + my * sp; let moved = false;
    if (freeBox(nx, h.y)) { h.x = nx; moved = moved || mx !== 0; } if (freeBox(h.x, ny)) { h.y = ny; moved = moved || my !== 0; }
    if (!moved) h.stuck += dt; else h.stuck = 0; h.walk += dt * 8;
  }
  if (attack && h.atk <= 0) { h.atk = .28; chipSfx('swing'); const [dx, dy] = DIRS[h.dir]; for (const e of RPG.enemies) { const ex = e.x - (h.x + dx * 14), ey = e.y - (h.y + dy * 14); if (Math.abs(ex) < 16 && Math.abs(ey) < 16) { e.hp--; e.hit = .25; e.vx = dx * 120; e.vy = dy * 120; chipSfx('hit'); if (e.hp <= 0) { e.dead = true; chipSfx('die'); for (let i = 0; i < 8; i++) RPG.parts.push({ x: e.x + 8, y: e.y + 8, vx: (Math.random() - .5) * 80, vy: (Math.random() - .5) * 80, t: .6 }); RPG.gems++; } } } }
  for (const e of RPG.enemies) {
    e.t += dt; e.hit = Math.max(0, e.hit - dt);
    if (e.hit > 0) { const nx = e.x + e.vx * dt, ny = e.y + e.vy * dt; if (freeBox(nx, ny)) { e.x = nx; e.y = ny; } e.vx *= .85; e.vy *= .85; continue; }
    const dx = h.x - e.x, dy = h.y - e.y, d = Math.hypot(dx, dy); let vx = 0, vy = 0;
    if (d < 70) { vx = dx / d * 22; vy = dy / d * 22; } else if (Math.floor(e.t) % 3 === 0) { vx = Math.cos(e.t * 1.3 + e.x) * 14; vy = Math.sin(e.t * 1.1 + e.y) * 14; }
    const nx = e.x + vx * dt, ny = e.y + vy * dt; if (freeBox(nx, e.y)) e.x = nx; if (freeBox(e.x, ny)) e.y = ny;
    if (d < 11 && h.inv <= 0) { h.hp--; h.inv = 1.2; chipSfx('hurt'); if (h.hp <= 0) { h.hp = 8; RPG.flash = .6; RPG.message('ヨシは たおれた……', 2); G.friendSays('……あ。', 2); h.x = 8 * 16; h.y = 38 * 16; } }
  }
  RPG.enemies = RPG.enemies.filter(e => !e.dead); while (RPG.enemies.length < 10) spawnEnemy();
  if (RPG.t % 4 < dt && h.hp < 8) h.hp++;
  for (const p of RPG.parts) { p.x += p.vx * dt; p.y += p.vy * dt; p.t -= dt; } RPG.parts = RPG.parts.filter(p => p.t > 0);
  // 祭壇
  const ax = 32 * 16, ay = 20 * 16; if (Math.hypot(h.x - ax, h.y - ay) < 20 && RPG.t - RPG.restored > 40) { RPG.restored = RPG.t; RPG.flash = 1.2; RPG.message('だいちに ひかりが もどった……', 3.5); chipSfx('restore'); }
  RPG.flash = Math.max(0, RPG.flash - dt); if (RPG.msgT > 0) RPG.msgT -= dt;
}
RPG.message = (s, t) => { RPG.msg = s; RPG.msgT = t; };
function rpgDraw() {
  const g = RPG.g, h = RPG.hero;
  if (RPG.black) { g.fillStyle = '#000'; g.fillRect(0, 0, 256, 224); RPG.tex.needsUpdate = true; return; }
  if (RPG.glitch > 0) { // バグった画面：タイルが崩れて色が化ける
    for (let i = 0; i < 40; i++) { const sx = Math.floor(Math.random() * 60) * 16, sy = Math.floor(Math.random() * 44) * 16, dx = Math.floor(Math.random() * 16) * 16, dy = Math.floor(Math.random() * 14) * 16; g.drawImage(RPG.bg, sx, sy, 16, 16, dx, dy, 16, 16); }
    for (let i = 0; i < 12; i++) { g.fillStyle = ['#f0f', '#0ff', '#ff0', '#000', '#fff'][i % 5]; g.fillRect(Math.floor(Math.random() * 32) * 8, Math.floor(Math.random() * 28) * 8, 8 + Math.floor(Math.random() * 6) * 8, 8); }
    RPG.glitch -= 1 / 30; RPG.tex.needsUpdate = true; return;
  } const cx = clamp(h.x + 8 - 128, 0, RPG.W * 16 - 256), cy = clamp(h.y + 8 - 112, 0, RPG.H * 16 - 224);
  g.drawImage(RPG.bg, Math.floor(cx), Math.floor(cy), 256, 224, 0, 0, 256, 224);
  const wt = Math.floor(RPG.t * 2) % 2; // 水のゆらぎ
  const ox = -Math.floor(cx), oy = -Math.floor(cy);
  for (const e of RPG.enemies) { const x = Math.floor(e.x) + ox, y = Math.floor(e.y) + oy; if (x < -16 || y < -16 || x > 256 || y > 224) continue; const b = Math.floor(e.t * 4) % 2; g.fillStyle = e.hit > 0 ? '#fff' : (e.kind ? '#9a4ac8' : '#c84a3a'); g.fillRect(x + 2, y + 6 + b, 12, 10 - b); g.fillRect(x + 4, y + 4 + b, 8, 2); g.fillStyle = '#000'; g.fillRect(x + 5, y + 8 + b, 2, 2); g.fillRect(x + 9, y + 8 + b, 2, 2); }
  if (!(h.inv > 0 && Math.floor(RPG.t * 20) % 2)) drawHero(g, Math.floor(h.x) + ox, Math.floor(h.y) + oy, h);
  for (const p of RPG.parts) { g.fillStyle = p.t > .3 ? '#fff8c0' : '#e8c040'; g.fillRect(Math.floor(p.x) + ox, Math.floor(p.y) + oy, 2, 2); }
  // HUD
  g.fillStyle = 'rgba(0,0,0,.5)'; g.fillRect(0, 0, 256, 18); g.fillStyle = '#fff'; g.font = '10px "MS Gothic",monospace'; g.fillText('HP', 6, 12);
  for (let i = 0; i < 8; i++) { g.fillStyle = i < h.hp ? '#e84a4a' : '#402020'; g.fillRect(24 + i * 9, 5, 7, 7); }
  g.fillStyle = '#9ad8ff'; g.fillRect(180, 5, 6, 7); g.fillStyle = '#fff'; g.fillText('× ' + String(RPG.gems).padStart(3, '0'), 190, 12);
  if (RPG.msgT > 0 && RPG.msg) { const gr = g.createLinearGradient(0, 170, 0, 214); gr.addColorStop(0, '#2a3a9a'); gr.addColorStop(1, '#101a5a'); g.fillStyle = gr; g.fillRect(12, 168, 232, 44); g.strokeStyle = '#fff'; g.lineWidth = 2; g.strokeRect(13, 169, 230, 42); g.fillStyle = '#fff'; g.font = '12px "MS Gothic",monospace'; g.fillText(RPG.msg.slice(0, Math.floor((1 - RPG.msgT / 4) * 40 + 8)), 22, 194); }
  if (RPG.flash > 0) { g.fillStyle = `rgba(255,250,220,${Math.min(.7, RPG.flash)})`; g.fillRect(0, 0, 256, 224); }
  RPG.tex.needsUpdate = true;
}
function drawHero(g, x, y, h) {
  const F = (c, a, b, w, hh) => { g.fillStyle = c; g.fillRect(x + a, y + b, w, hh); };
  const step = Math.floor(h.walk) % 2, d = h.dir;
  F('rgba(0,0,0,.25)', 3, 14, 10, 2);
  F('#3a5ab8', 4, 7, 8, 6); // 服
  F('#2a2a4a', 4 + (step ? 0 : 1), 13, 3, 3); F('#2a2a4a', 9 - (step ? 0 : 1), 13, 3, 3);
  F('#f0c898', 4, 1, 8, 6); // 顔
  F('#6a3a1a', 3, 0, 10, 3); if (d === 3) F('#6a3a1a', 4, 1, 8, 5);
  if (d === 0) { F('#000', 6, 4, 1, 1); F('#000', 9, 4, 1, 1); } else if (d === 1) F('#000', 5, 4, 1, 1); else if (d === 2) F('#000', 10, 4, 1, 1);
  F('#e8e0c0', 2, 8, 2, 4); F('#e8e0c0', 12, 8, 2, 4);
  if (h.atk > 0) { const [dx, dy] = DIRS[d]; g.fillStyle = '#fffbe0'; const k = 1 - h.atk / .28; for (let i = 0; i < 6; i++) { const a = (k * 2 - 1) * 1.2 + i * .15; const ang = Math.atan2(dy, dx) + a - .4; g.fillRect(x + 7 + Math.cos(ang) * 11, y + 9 + Math.sin(ang) * 11, 2, 2); } }
}

// ------------------------------------------------------------
// チップチューン（オリジナル曲）
// ------------------------------------------------------------
const MUS = { next: 0, step: 0, on: true };
const NOTE = n => { if (n === 'R') return 0; const m = n.match(/^([A-G])(#|b)?(\d)$/); const b = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0); return 440 * Math.pow(2, (b + (+m[3] + 1) * 12 - 69) / 12); };
const MEL = 'D5:2 A4:1 D5:1 F5:2 E5:1 D5:1 C5:2 A4:1 C5:1 E5:3 R:1 Bb4:2 D5:1 F5:1 A5:2 G5:1 F5:1 E5:2 C#5:1 E5:1 A5:3 R:1 D5:2 A4:1 D5:1 F5:2 G5:1 A5:1 Bb5:2 A5:1 G5:1 F5:2 E5:1 F5:1 G5:2 F5:1 E5:1 D5:2 C#5:1 E5:1 D5:6 R:2'.split(' ').map(s => { const [n, d] = s.split(':'); return [NOTE(n), +d]; });
const BASS = ['D3', 'A2', 'Bb2', 'A2', 'D3', 'Bb2', 'G2', 'A2'].map(NOTE);
const ARP = [[0, 3, 7], [0, 3, 7], [0, 4, 7], [0, 4, 7], [0, 3, 7], [0, 4, 7], [0, 3, 7], [0, 4, 7]];
function musicInit() {
  const out = SRC.game.input; const spk = filt('highpass', 150), lp = filt('lowpass', 5000), g = gainN(.55); chain(spk, lp, g, out); MUS.out = spk;
  const mel = []; let t = 0; for (const [f, d] of MEL) { mel.push([t, f, d]); t += d; } MUS.mel = mel; MUS.len = t;
  MUS.next = now() + .3; MUS.pos = 0;
  setInterval(() => { if (!AU.ready || !MUS.on) return; const e = .2; while (MUS.next < now() + .25) { musicStep(MUS.next, MUS.pos); MUS.next += e; MUS.pos = (MUS.pos + 1) % MUS.len; } }, 60);
}
function musicStep(t, p) {
  const d = .2, out = MUS.out;
  for (const [st, f, dur] of MUS.mel) if (st === p && f) { const o = osc(AU.pulse25, f), g = gainN(0); o.connect(g); g.connect(out); g.gain.setValueAtTime(.09, t); g.gain.setTargetAtTime(.05, t + .04, .08); g.gain.setTargetAtTime(0, t + dur * d - .02, .02); o.start(t); o.stop(t + dur * d + .1); const o2 = osc(AU.pulse125, f * 1.004), g2 = gainN(0); o2.connect(g2); g2.connect(out); g2.gain.setValueAtTime(0, t + .18); g2.gain.linearRampToValueAtTime(.02, t + .2); g2.gain.setTargetAtTime(0, t + dur * d + .15, .05); o2.start(t + .18); o2.stop(t + dur * d + .4); }
  const bar = Math.floor(p / 8) % 8, root = BASS[bar];
  { const o = osc('triangle', p % 2 ? root * 2 : root), g = gainN(0); o.connect(g); g.connect(out); g.gain.setValueAtTime(.22, t); g.gain.setTargetAtTime(0, t + d * .8, .02); o.start(t); o.stop(t + d); }
  { const ar = ARP[bar], k = ar[p % 3], o = osc(AU.pulse125, root * 4 * Math.pow(2, k / 12)), g = gainN(0); o.connect(g); g.connect(out); g.gain.setValueAtTime(.025, t); g.gain.setTargetAtTime(0, t + .05, .03); o.start(t); o.stop(t + .12); }
  if (p % 4 === 2) { const n = oneNoise('white', t, .05), hp = filt('highpass', 5000), g = gainN(0); chain(n, hp, g, out); env(g, t, .001, .05, .04); }
}
function chipSfx(k) {
  if (!AU.ready || !MUS.out) return; const t = now(), out = MUS.out;
  const blip = (f0, f1, dur, type, vol) => { const o = osc(type, f0), g = gainN(0); o.connect(g); g.connect(out); o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + dur); env(g, t, .002, vol, dur); o.start(t); o.stop(t + dur + .05); };
  if (k === 'swing') { const n = oneNoise('white', t, .1), bp = filt('bandpass', 3000, 1), g = gainN(0); chain(n, bp, g, out); env(g, t, .005, .15, .08); }
  if (k === 'hit') blip(900, 300, .08, 'square', .1);
  if (k === 'die') { for (let i = 0; i < 4; i++) { const o = osc('square', 1200 - i * 220), g = gainN(0); o.connect(g); g.connect(out); env(g, t + i * .05, .002, .07, .05); o.start(t + i * .05); o.stop(t + i * .05 + .08); } }
  if (k === 'hurt') blip(300, 90, .2, 'square', .12);
  if (k === 'bug') { for (const f of [233, 349, 466]) { const o = osc('square', f), g = gainN(0); o.connect(g); g.connect(out); g.gain.setValueAtTime(.06, t); g.gain.setValueAtTime(.06, t + 2.4); g.gain.linearRampToValueAtTime(0, t + 2.6); o.frequency.setValueAtTime(f, t); o.frequency.setValueAtTime(f * 1.5, t + .4); o.frequency.setValueAtTime(f * .7, t + 1.1); o.start(t); o.stop(t + 2.7); } }
  if (k === 'restore') { [523, 659, 784, 1046, 1318].forEach((f, i) => { const o = osc(AU.pulse25, f), g = gainN(0); o.connect(g); g.connect(out); env(g, t + i * .12, .005, .08, .5); o.start(t + i * .12); o.stop(t + i * .12 + .6); }); }
}
