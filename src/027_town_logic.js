// ============================================================
// 第2段階の動き：車・バス・信号・犬・夕飯の家・スーパー・駅・公衆電話
// ============================================================
const TL = { cars: [], buses: [], t: 0, sig: 'g' };
// ---- 声の再生（電話・駅・店など）。字幕は呼び出し側で出す
async function sayLine(who, text, o = {}) {
  if (!AU.ready) return 0; const k = voKey(who, text); if (!VO.pending[k] && !VO.buf[k]) return 0;
  const b = await voBuf(k); if (!b) return 0;
  const dest = lineDest(who); if (!dest) return 0;
  const s = AU.ctx.createBufferSource(); s.buffer = b; const g = gainN(o.gain ?? 1); s.connect(g); g.connect(dest); s.start(now() + (o.when ?? 0)); TL.lastLine = s; return b.duration;
}
function lineDest(who) {
  if (who.startsWith('phone') || ['jiho', 'weather', 'op', 'pmom', 'neighbor', 'oldwoman', 'umemom'].includes(who) || who === 'father_tel' || who === 'friend_tel') return phoneOut();
  const ap = arcVoicePos(who); if (ap) { const s = mkSrc(ap[0], ap[1], 1, { ref: who === 'fgann' ? 1.5 : 2 }); setTimeout(() => { const i = AU.sources.indexOf(s); if (i >= 0) AU.sources.splice(i, 1); }, 15000); audioUpdate(camera.position, G.zone); return s.input; }
  const pos = { station: new V3(-66, -2, -72), clerk: new V3(-19, 1.4, -60), driver: TL.busNear ? TL.busNear.g.position.clone().add(new V3(0, 2, 0)) : camera.position.clone(), neighbor2: new V3(-11.5, 2.2, -29) }[who];
  if (!pos) return null; const zone = who === 'station' ? 'station' : who === 'clerk' ? 'store' : 'out';
  const s = mkSrc(pos, zone, 1, { ref: who === 'station' ? 6 : 2 }); setTimeout(() => { const i = AU.sources.indexOf(s); if (i >= 0) AU.sources.splice(i, 1); }, 15000); audioUpdate(camera.position, G.zone); return s.input;
}
let PHONE_OUT = null;
function phoneOut() { if (PHONE_OUT) return PHONE_OUT; const hp = filt('highpass', 380), lp = filt('lowpass', 3000), d = filt('peaking', 1500, 1); d.gain.value = 5; const g = gainN(1.3); chain(hp, lp, d, g, AU.master); PHONE_OUT = hp; return hp; }

// ---- 車（環七）とバス（泉南通り）
function makeVehicle(kind) {
  const g = new THREE.Group(), col = pick([0xe8e8e4, 0x2a2a2e, 0xa8aeb4, 0x8a1a1a, 0x1a3a6a, 0xd8d0b8, 0x3a5a3a]);
  const body = M({ color: kind === 'taxi' ? 0x2a6a3a : kind === 'truck' ? 0xe8e8e0 : col, rough: .3, metal: .5 });
  const add = (x0, x1, y0, y1, z0, z1, m) => { const b = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0), m); b.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2); b.castShadow = true; b.receiveShadow = true; g.add(b); return b; };
  if (kind === 'truck') { add(-1.2, 1.2, .5, 3.4, -4, 2.2, M({ color: 0xd8d8d0, rough: .6 })); add(-1.15, 1.15, .5, 2.6, 2.3, 4, body); add(-1.1, 1.1, 1.7, 2.5, 3.95, 4.02, MT.darkGlass); }
  else { add(-.85, .85, .3, .95, -2.2, 2.2, body); add(-.8, .8, .95, 1.42, -1.1, .9, body); add(-.78, .78, 1.0, 1.38, .88, .94, MT.darkGlass); add(-.78, .78, 1.0, 1.38, -1.14, -1.08, MT.darkGlass); if (kind === 'taxi') add(-.2, .2, 1.42, 1.58, -.1, .1, M({ color: 0xf0e8a0, emissive: 0xf0e8a0, ei: .6 })); }
  const len = kind === 'truck' ? 4 : 2.2;
  for (const [a, b] of [[-.85, len * .62], [.85, len * .62], [-.85, -len * .62], [.85, -len * .62]]) { const w = new THREE.Mesh(new THREE.CylinderGeometry(.33, .33, .22, 12), MT.black); w.rotation.z = Math.PI / 2; w.position.set(a, .33, b); g.add(w); }
  const hl = new THREE.MeshBasicMaterial({ color: 0x777766 }); for (const x of [-.6, .6]) { const h = new THREE.Mesh(new THREE.PlaneGeometry(.3, .16), hl); h.position.set(x, .7, len + .01); g.add(h); }
  const tl = new THREE.MeshBasicMaterial({ color: 0x551111 }); for (const x of [-.65, .65]) { const h = new THREE.Mesh(new THREE.PlaneGeometry(.25, .14), tl); h.position.set(x, .75, -len - .01); h.rotation.y = Math.PI; g.add(h); }
  scene.add(g); return { g, hl, tl, len };
}
function makeBus(company) {
  const g = new THREE.Group(), keio = company === '京王バス';
  const lower = M({ color: keio ? 0xb82a3a : 0x6ab04a, rough: .4, metal: .3 }), upper = M({ color: 0xf0eee6, rough: .4, metal: .2 }), stripe = M({ color: keio ? 0x1a2a6a : 0xe8e040, rough: .4 });
  const add = (x0, x1, y0, y1, z0, z1, m) => { const b = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0), m); b.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2); b.castShadow = true; b.receiveShadow = true; g.add(b); return b; };
  add(-1.25, 1.25, .4, 1.3, -5.3, 5.3, lower); add(-1.25, 1.25, 1.3, 3.0, -5.3, 5.3, upper); add(-1.26, 1.26, 1.25, 1.38, -5.3, 5.3, stripe);
  add(-1.27, 1.27, 1.6, 2.5, -4.6, 4.2, MT.darkGlass); add(-1.1, 1.1, 1.3, 2.7, 5.29, 5.34, MT.darkGlass);
  for (const [a, b] of [[-1.1, 3.6], [1.1, 3.6], [-1.1, -3.4], [1.1, -3.4]]) { const w = new THREE.Mesh(new THREE.CylinderGeometry(.48, .48, .3, 14), MT.black); w.rotation.z = Math.PI / 2; w.position.set(a, .48, b); g.add(w); }
  const dest = company === '京王バス' ? pick(['新宿駅西口', '中野駅', '佼成会聖堂普門館前', '中野車庫']) : pick(['渋谷駅', '阿佐ケ谷駅', '杉並車庫']);
  const led = labelTex(512, 64, (c, w, h) => { c.fillStyle = '#100800'; c.fillRect(0, 0, w, h); c.fillStyle = '#ffa028'; c.font = `bold 40px ${GOTH}`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(dest + ' 行', w / 2, h / 2 + 2); });
  const lm = new THREE.Mesh(new THREE.PlaneGeometry(2.0, .3), new THREE.MeshBasicMaterial({ map: led })); lm.position.set(0, 2.8, 5.345); g.add(lm);
  const name = labelTex(256, 48, (c, w, h) => { c.fillStyle = 'rgba(0,0,0,0)'; c.clearRect(0, 0, w, h); c.fillStyle = keio ? '#b82a3a' : '#2a7a2a'; c.font = `bold 34px ${GOTH}`; c.fillText(company, 10, 36); });
  for (const s of [-1, 1]) { const n = new THREE.Mesh(new THREE.PlaneGeometry(1.8, .34), new THREE.MeshBasicMaterial({ map: name, transparent: true })); n.position.set(s * 1.28, .95, 1); n.rotation.y = s * Math.PI / 2; g.add(n); }
  scene.add(g); return { g, len: 5.3, company, dest };
}
function trafficInit() {
  const lanes = [{ x: -89.8, dir: -1 }, { x: -86.2, dir: -1 }, { x: -75.8, dir: 1 }, { x: -72.2, dir: 1 }];
  for (let i = 0; i < 12; i++) { const L = lanes[i % 4], kind = rng() < .2 ? 'truck' : rng() < .25 ? 'taxi' : 'car', v = makeVehicle(kind); v.lane = L; v.z = -140 + (i / 12) * 180 + R(-5, 5); v.sp = R(10, 14); v.cur = v.sp; v.g.position.set(L.x, 0, v.z); v.g.rotation.y = L.dir > 0 ? 0 : Math.PI; TL.cars.push(v); }
  for (const [company, zL, dir, stopX] of [['京王バス', -50, -1, -31], ['都営バス', -54, 1, -42]]) { const b = makeBus(company); b.zL = zL; b.dir = dir; b.stopX = stopX; b.x = dir < 0 ? 70 : -150; b.state = 'wait'; b.t = R(5, 30); b.g.position.set(b.x, 0, zL); b.g.rotation.y = dir > 0 ? Math.PI / 2 : -Math.PI / 2; b.g.visible = false; TL.buses.push(b); }
}
function trafficUpdate(dt) {
  TL.t += dt; const cyc = TL.t % 40; TL.sig = cyc < 24 ? 'g' : cyc < 27 ? 'y' : 'r';
  for (const s of TOWN.signals) { if (s.kind === 'car') { s.lamps[0].color.set(TL.sig === 'g' ? 0x30ffa0 : 0x1a2a22); s.lamps[1].color.set(TL.sig === 'y' ? 0xffc030 : 0x2a2418); s.lamps[2].color.set(TL.sig === 'r' ? 0xff3020 : 0x2a1a18); } else { const pg = cyc < 20 || (cyc < 24 && Math.floor(TL.t * 3) % 2); s.lamps[0].color.set(TL.sig !== 'g' || cyc >= 24 ? 0xff3020 : 0x2a1a18); s.lamps[1].color.set(pg && TL.sig === 'g' ? 0x30ffa0 : 0x1a2a22); } }
  const eve = G.evening;
  for (const v of TL.cars) {
    const d = v.lane.dir, stopLine = d > 0 ? -62 : -42; let target = v.sp;
    // 赤信号で止まる
    if (TL.sig !== 'g' && ((d > 0 && v.z < stopLine && v.z > stopLine - 14) || (d < 0 && v.z > stopLine && v.z < stopLine + 14))) { const dist = Math.abs(stopLine - v.z) - v.len; target = dist < 1 ? 0 : Math.min(v.sp, dist * 1.2); }
    // 前の車・人に近づいたら減速
    for (const o of TL.cars) if (o !== v && o.lane === v.lane) { const gap = (o.z - v.z) * d; if (gap > 0 && gap < 14) target = Math.min(target, Math.max(0, (gap - 7) * 1.5)); }
    const pg = (P.pos.z - v.z) * d; if (Math.abs(P.pos.x - v.lane.x) < 1.8 && pg > 0 && pg < 12) target = Math.min(target, Math.max(0, (pg - 4) * 1.5));
    v.cur = lerp(v.cur, target, 1 - Math.exp(-dt * 1.8)); v.z += d * v.cur * dt;
    if (d > 0 && v.z > 45) v.z = -145; if (d < 0 && v.z < -145) v.z = 45;
    v.g.position.set(v.lane.x, 0, v.z);
    v.hl.color.set(eve ? 0xfff4d0 : 0x777766); v.tl.color.set(eve || v.cur < 2 ? 0xff2020 : 0x551111);
    if (v.src) v.src.mul = .4 + .6 * v.cur / v.sp;
  }
  TL.busNear = null;
  for (const b of TL.buses) {
    if (b.state === 'wait') { b.t -= dt; if (b.t <= 0) { b.state = 'drive'; b.x = b.dir < 0 ? 70 : -150; b.g.visible = true; b.stopped = false; } if (b.src) b.src.mul = 0; continue; }
    let sp = 9; const toStop = (b.stopX - b.x) * b.dir;
    if (!b.stopped && toStop > 0 && toStop < 25) sp = Math.max(0, toStop * .6);
    if (b.state === 'stop') { sp = 0; b.t -= dt; if (b.t <= 0) { b.state = 'drive'; b.stopped = true; SFX.busDoor && SFX.busDoor(b.g.position); } }
    else if (!b.stopped && toStop <= .3) { b.state = 'stop'; b.t = 9; SFX.busDoor && SFX.busDoor(b.g.position); if (P.pos.distanceTo(b.g.position) < 25) { TL.busNear = b; setTimeout(() => sayLine('driver', '泉南駅です。ご乗車、ありがとうございます。'), 800); setTimeout(() => { TL.busNear = b; sayLine('driver', '発車します。おつかまりください。'); }, 7000); } }
    const pg = (P.pos.x - b.x) * b.dir; if (Math.abs(P.pos.z - b.zL) < 2 && pg > 0 && pg < 14) sp = Math.min(sp, Math.max(0, (pg - 7) * 1.2));
    b.x += b.dir * sp * dt; b.g.position.set(b.x, 0, b.zL); if (b.src) b.src.mul = .5 + sp / 18;
    if ((b.dir < 0 && b.x < -150) || (b.dir > 0 && b.x > 72)) { b.state = 'wait'; b.t = R(40, 90); b.g.visible = false; }
  }
}

// ---- 犬の家（東の道ぞい）
const DOG = { x: -10.55, z: -18.8, state: 'idle', t: 0, lunge: 0, seen: false };
function buildDog() {
  const k = new THREE.Group(), m = M({ color: 0x141414, rough: .7 }), eye = new THREE.MeshBasicMaterial({ color: 0x302010 });
  const add = (geo, x, y, z, mat = m) => { const o = new THREE.Mesh(geo, mat); o.position.set(x, y, z); o.castShadow = true; k.add(o); return o; };
  add(new THREE.CapsuleGeometry(.2, .5, 4, 10), 0, .5, 0).rotation.x = Math.PI / 2;
  const head = new THREE.Group(); head.position.set(0, .72, .42); k.add(head);
  const hd = new THREE.Mesh(new THREE.BoxGeometry(.26, .24, .3), m); hd.castShadow = true; head.add(hd);
  const muz = new THREE.Mesh(new THREE.BoxGeometry(.16, .13, .16), m); muz.position.set(0, -.04, .2); head.add(muz);
  for (const s of [-1, 1]) { const ear = new THREE.Mesh(new THREE.ConeGeometry(.06, .14, 4), m); ear.position.set(s * .09, .16, -.03); head.add(ear); const e = new THREE.Mesh(new THREE.SphereGeometry(.02, 6, 6), eye); e.position.set(s * .07, .04, .15); head.add(e); }
  for (const [x, z] of [[-.12, .25], [.12, .25], [-.12, -.25], [.12, -.25]]) add(new THREE.CylinderGeometry(.045, .04, .42, 6), x, .21, z);
  const tail = add(new THREE.CylinderGeometry(.025, .015, .3, 6), 0, .65, -.42); tail.rotation.x = -.8;
  k.position.set(DOG.x, 0, DOG.z); k.rotation.y = Math.PI / 2; scene.add(k); DOG.k = k; DOG.head = head; DOG.tail = tail;
  // 鉄の門（塀のすき間をふさぐ）
  const gm = M({ color: 0x3a3a3a, rough: .5, metal: .6 }); DOG.gate = new THREE.Group(); scene.add(DOG.gate);
  for (let i = 0; i <= 10; i++) { const b = new THREE.Mesh(new THREE.BoxGeometry(.045, 1.15, .045), gm); b.position.set(-9.55, .6, -19.3 + i * .1); DOG.gate.add(b); }
  for (const y of [.1, 1.15]) { const b = new THREE.Mesh(new THREE.BoxGeometry(.04, .05, 1.0), gm); b.position.set(-9.55, y, -18.8); DOG.gate.add(b); }
  addCol(-9.62, -9.48, 0, 1.3, -19.3, -18.3);
  // 「犬」のシール（玄関と門柱）
  const st = labelTex(96, 96, (g, w, h) => { g.fillStyle = '#f4f2e8'; g.fillRect(0, 0, w, h); g.strokeStyle = '#222'; g.lineWidth = 5; g.strokeRect(4, 4, w - 8, h - 8); g.fillStyle = '#111'; g.font = `bold 66px ${MIN}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('犬', w / 2, h / 2 + 4); });
  for (let i = 0; i < 5; i++) decal(st, .1, .1, new V3(-10.975, 1.35 + (i % 2) * .14, -19.95 + i * .11), Math.PI / 2);
  for (let i = 0; i < 3; i++) decal(st, .09, .09, new V3(-9.46, .9 + i * .12, -19.35), Math.PI / 2);
  W.looks.push({ id: 'dogsticker', pos: new V3(-10.97, 1.4, -19.7), dist: 5, dot: .95, text: '玄関に「犬」のシールが、いくつも貼ってある。', noBlock: true });
}
function dogUpdate(dt) {
  if (!DOG.k) return; const d = Math.hypot(P.pos.x - DOG.x, P.pos.z - DOG.z), onRoad = G.zone === 'out' && P.pos.y < 1;
  DOG.t -= dt;
  if (G.evening) { DOG.k.position.y = -.14; DOG.head.rotation.x = .5; DOG.tail.rotation.x = -1.5; if (d < 5 && !G.flags.dogSleep) { G.flags.dogSleep = true; G.thought('さっきの犬は、寝そべって動かない。'); } return; }
  DOG.k.position.y = 0;
  if (onRoad && d < 10 && d >= 6.5 && DOG.t <= 0) { DOG.t = 1.8; SFX.growl(new V3(DOG.x, .6, DOG.z)); SFX.chain(new V3(DOG.x, .3, DOG.z)); }
  if (onRoad && d < 6.5) {
    if (!DOG.seen) { DOG.seen = true; G.thought('……黒い犬だ。'); }
    DOG.lunge = Math.min(1, DOG.lunge + dt * 4);
    if (DOG.t <= 0) { DOG.t = .38 + Math.random() * .3; SFX.bark(new V3(DOG.x + .5, .8, DOG.z)); DOG.head.rotation.x = -.35; setTimeout(() => DOG.head.rotation.x = 0, 120); if (Math.random() < .4) { SFX.clang(new V3(-9.55, .7, -18.8)); DOG.gate.position.x = .03; setTimeout(() => DOG.gate.position.x = 0, 80); } }
  } else DOG.lunge = Math.max(0, DOG.lunge - dt * 1.5);
  const tx = DOG.x + DOG.lunge * .25 + Math.sin(TL.t * 14) * .04 * DOG.lunge; DOG.k.position.x = tx; DOG.k.rotation.y = Math.PI / 2 + Math.sin(TL.t * 3) * .15 * (1 - DOG.lunge);
  DOG.tail.rotation.z = Math.sin(TL.t * (DOG.lunge > .5 ? 18 : 4)) * .5;
}

// ---- 夕飯の支度の家（夕方）
const DINNER = [
  { pos: new V3(-11.1, 2.2, -30.2), smell: 'ごま油のにおいがする。', snd: 'fry' },
  { pos: new V3(-11.1, 2.2, -9.2), smell: 'カレーのにおいがする。', snd: 'pot', call: true },
  { pos: new V3(-3.9, 2.0, -38.5), smell: '魚を焼くにおいがする。', snd: 'fry' },
];
function buildDinner() {
  const sm = labelTex(64, 64, (g, w, h) => { const gr = g.createRadialGradient(32, 32, 2, 32, 32, 30); gr.addColorStop(0, 'rgba(240,240,240,.55)'); gr.addColorStop(1, 'rgba(240,240,240,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, h); });
  const smat = new THREE.SpriteMaterial({ map: sm, transparent: true, depthWrite: false, opacity: 0 });
  for (const d of DINNER) {
    box(d.pos.x - .06, d.pos.x + .06, d.pos.y - .2, d.pos.y + .2, d.pos.z - .2, d.pos.z + .2, MT.alu, { col: false });
    d.puffs = []; for (let i = 0; i < 6; i++) { const s = new THREE.Sprite(smat.clone()); s.scale.setScalar(.6); scene.add(s); d.puffs.push({ s, t: i / 6 }); }
    const wl = new THREE.PointLight(0xffc880, 0, 4, 2); wl.position.copy(d.pos).add(new V3(.8, -.6, 0)); scene.add(wl); d.light = wl;
  }
}
function dinnerUpdate(dt) {
  for (const d of DINNER) {
    const on = G.evening; d.light.intensity = on ? 1.6 : 0;
    for (const p of d.puffs) { p.t = (p.t + dt * .25) % 1; p.s.position.set(d.pos.x + .15 + p.t * .5, d.pos.y + p.t * 1.4, d.pos.z + Math.sin(p.t * 6 + d.pos.z) * .15); p.s.material.opacity = on ? (1 - p.t) * .5 : 0; p.s.scale.setScalar(.35 + p.t * .8); }
    if (!on || !AU.ready) continue;
    const dist = camera.position.distanceTo(d.pos);
    if (dist < 5 && !d.smelled && G.zone === 'out') { d.smelled = true; G.thought(d.smell); if (d.call) setTimeout(() => { showSub('ごはん、できたわよー！', { who: '近所の家', far: true }); sayLine('neighbor2', 'ごはん、できたわよー！'); }, 1500); }
    if (dist < 14) { d.sndT = (d.sndT || 0) - dt; if (d.sndT <= 0) { d.sndT = d.snd === 'fry' ? .6 : 2.2; SFX.cook(d.pos, d.snd); } }
  }
}

// ---- スーパーの自動ドア・店内
function superUpdate(dt) {
  const D = TOWN.superDoor; if (!D) return;
  const near = Math.hypot(P.pos.x - D.cx, P.pos.z - D.zf) < 2.6 && P.pos.y < 1;
  const was = D.o; D.o = clamp(D.o + (near ? dt * 2.2 : -dt * 1.6), 0, 1);
  if (was === 0 && D.o > 0) SFX.autoDoor && SFX.autoDoor(new V3(D.cx, 1.2, D.zf));
  D.dl.position.x = D.cx - .6 - D.o * 1.15; D.dr.position.x = D.cx + .6 + D.o * 1.15; D.col.on = D.o < .7;
  const inside = G.zone === 'store';
  if (inside && !TL.inStore) { TL.inStore = true; if (!TL.greetT || TL.t - TL.greetT > 30) { TL.greetT = TL.t; setTimeout(() => { showSub('いらっしゃいませー。', { who: '店員さん' }); sayLine('clerk', 'いらっしゃいませー。'); }, 500); } }
  if (!inside) TL.inStore = false;
  if (SRC.storeBGM) SRC.storeBGM.mul = 1;
}
// ---- 駅（構内放送・電車の音）と、はじまり・おわり
function stationUpdate(dt) {
  TL.stT = (TL.stT ?? 12) - dt;
  if (TL.stT <= 0 && AU.ready) {
    TL.stT = 70 + Math.random() * 40;
    const inSt = G.zone === 'station' || camera.position.distanceTo(new V3(-66, 0, -60)) < 20;
    if (inSt) { const seq = async () => { await sayLine('station', 'まもなく、一番線に、中野坂上行きが、まいります。'); SFX.train && SFX.train(true); setTimeout(() => { SFX.bell && SFX.bell(); }, 16000); setTimeout(() => sayLine('station', '一番線、ドアが閉まります。ご注意ください。'), 24000); setTimeout(() => SFX.train && SFX.train(false), 30000); }; seq(); }
  }
  // 改札：行きは通り抜け、帰りは通るとおわり
  if (TOWN.gateCol) TOWN.gateCol.on = !(G.phase === 'approach' && P.pos.z < TOWN.gateZ + .6);
}
function stationInit() {
  // 改札の通路をふさぐ（行きは通れる）
  TOWN.gateCol = addCol(-71.2, -60, -4.5, -3.4, TOWN.gateZ - .12, TOWN.gateZ + .12);
  hitProxy(-71.2, -60, -4.5, -3.2, TOWN.gateZ - .3, TOWN.gateZ + .3, { label: () => G.phase === 'outside' ? '改札を通る' : '', act: () => { if (G.phase === 'outside') { SFX.gate && SFX.gate(); G.ending(); } } });
}

// ---- 公衆電話
const PH = { open: false, num: '', busy: false };
const PHONE_HOME = '3311-2468', PHONE_UME = '3318-7070';
function openPhone() {
  if (PH.open) return; PH.open = true; PH.num = ''; phoneDraw();
  $('phone').style.display = 'block'; if (document.pointerLockElement) document.exitPointerLock(); CHAT.open = true; // 入力中はポーズしない
  SFX.click(new V3(-62.6, 1.3, -57.7));
}
function closePhone() { if (!PH.open) return; PH.open = false; PH.busy = false; CHAT.open = false; $('phone').style.display = 'none'; if (TL.ring) { TL.ring.stop(); TL.ring = null; } if (TL.lastLine) { try { TL.lastLine.stop(); } catch (e) { } } SFX.click(new V3(-62.6, 1.3, -57.7)); canvas.requestPointerLock()?.catch?.(() => { }); }
function phoneDraw() { $('phNum').textContent = PH.num || '　'; }
function phoneKey(k) { if (PH.busy) return; if (k === 'C') PH.num = ''; else if (PH.num.length < 12) { PH.num += k; if (PH.num.replace(/-/g, '').length === 4 && !PH.num.includes('-') && !['117', '177'].includes(PH.num)) PH.num += '-'; } SFX.dtmf && SFX.dtmf(k); phoneDraw(); }
async function phoneRing(n) { for (let i = 0; i < n; i++) { if (!PH.open) return false; if (!(TL.ring = playSE('プルプル', { gain: .7 }))) SFX.chime(camera.position); await wait(2.2); } TL.ring = null; return PH.open; }
async function phoneDial(num) {
  if (PH.busy || !num) return; PH.busy = true; const n = num.replace(/-/g, '');
  const L = async (who, t, label) => { if (!PH.open) return; showSub(t, { who: label, dur: Math.max(2.5, t.length * .14 + 1), noVoice: true }); const d = await sayLine(who, t); await wait(Math.max(1.4, d + .4)); };
  if (n === '117') { await wait(.6); const h = Math.floor(G.clock / 60) % 24, m = Math.floor(G.clock % 60), s = Math.floor((G.clock % 1) * 60 / 10) * 10, parts = [h < 12 ? '午前' : '午後', (h % 12 === 0 ? 12 : h % 12) + '時', m + '分', s + '秒', 'を、お知らせします。']; showSub(`${parts[0]}、${parts[1]}、${parts[2]}、${parts[3]}${parts[4]}`, { who: '時報', dur: 5 }); for (const p of parts) { if (!PH.open) break; const d = await sayLine('jiho', p); await wait(d ? d + .05 : .5); } for (let i = 0; i < 3; i++) { SFX.pip && SFX.pip(false); await wait(1); } SFX.pip && SFX.pip(true); await wait(1.5); }
  else if (n === '177') { await wait(.6); await L('weather', '東京地方の天気をお知らせします。きょうは晴れ。夕方から、ところにより、にわか雨があるでしょう。最高気温は、三十四度の予想です。', '天気予報'); }
  else if (n === PHONE_HOME.replace('-', '')) { if (await phoneRing(2)) { if (G.evening) { await L('pmom', 'はい、もしもし。……あら、あんた？ もう暗くなるわよ。早く帰ってらっしゃい。', '自分の母'); } else { await L('pmom', 'はい、もしもし。……あら、あんた？ どうしたの。夕飯カレーだから、暗くなる前に帰ってきなさいね。', '自分の母'); } } }
  else if (n === PHONE_UME.replace('-', '')) { if (await phoneRing(3)) { if (G.flags.mother && G.left) { await L('umemom', 'はい、梅崎でございます。……あら、さっきの。忘れ物？ ……そう。気をつけて帰ってね。', '梅崎の母'); } else { await L('father_tel', '……はい。梅崎です。', '？？？'); await wait(1.5); await L('father_tel', '……ああ。……ちょっと待ってろ。', '？？？'); await wait(3); await L('friend_tel', '……もしもし。……なんだよ。来るなら早く来いよ。', '梅崎'); } } }
  else if (n.length >= 7) {
    const r = hash2(parseInt(n.slice(-4)) || 0, n.length);
    if (r < .2) { await wait(1); await L('op', 'おかけになった電話番号は、現在、使われておりません。番号をお確かめになって、おかけなおしください。', '案内'); }
    else if (r < .4) { await phoneRing(12); }
    else if (await phoneRing(2)) {
      if (r < .6) { await L('neighbor', 'はい、渡辺です。……もしもし？ ……もしもし？', '知らない人'); await wait(.5); G.thought('（切られた）'); }
      else if (r < .8) { await L('oldwoman', '……はい。……どちらさま？', '知らない人'); await wait(2.5); await L('oldwoman', '……もしもし？ いたずらなら、切りますよ。', '知らない人'); }
      else { showSub('……（誰も話さない。向こうで、テレビの音と食器の音がする）', { cls: 'thought' }); await wait(5); }
    }
  } else { await wait(.8); await L('op', 'おかけになった電話番号は、現在、使われておりません。', '案内'); }
  PH.busy = false;
}
function phoneUIInit() {
  const box_ = document.createElement('div'); box_.id = 'phone'; box_.className = 'xp';
  box_.style.cssText = 'bottom:auto;top:18%;width:300px;display:none;pointer-events:auto';
  box_.innerHTML = `<div class="xp-title"><span class="xp-icon"></span><span class="xp-t">公衆電話</span><span class="xp-btns"><i class="x" id="phX">×</i></span></div>
  <div class="xp-body" style="font-size:14px">
    <div id="phNum" style="font:26px Consolas,monospace;background:#1a2a1a;color:#9f9;padding:6px 10px;margin-bottom:8px;letter-spacing:.1em;min-height:30px">　</div>
    <div id="phKeys" style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px"></div>
    <div style="display:flex;gap:6px;margin-top:8px"><button id="phCall" style="flex:1">かける</button><button id="phHang" style="flex:1">切る</button></div>
    <div style="margin-top:8px;font-size:12px;color:#555;line-height:1.7">メモ：自宅 ${PHONE_HOME}　／　梅崎 ${PHONE_UME}<br>117 時報　／　177 天気予報　（数字キー・Enter・Escも使えます）</div>
  </div>`;
  $('ui').appendChild(box_);
  for (const k of ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'C', '0', '#']) { const b = document.createElement('button'); b.textContent = k; b.style.cssText = 'font:18px Tahoma;padding:6px'; b.onclick = () => phoneKey(k); $('phKeys').appendChild(b); }
  $('phCall').onclick = () => phoneDial(PH.num); $('phHang').onclick = () => closePhone(); $('phX').onclick = () => closePhone();
  addEventListener('keydown', e => { if (!PH.open) return; e.stopPropagation(); if (/^[0-9]$/.test(e.key)) phoneKey(e.key); else if (e.key === 'Backspace') { PH.num = PH.num.slice(0, -1); phoneDraw(); } else if (e.key === 'Enter') phoneDial(PH.num); else if (e.key === 'Escape') closePhone(); }, true);
}
function townInit() { trafficInit(); buildDog(); buildDinner(); stationInit(); phoneUIInit(); arcadeInit(); }
function townUpdate(dt) { trafficUpdate(dt); dogUpdate(dt); dinnerUpdate(dt); superUpdate(dt); stationUpdate(dt); arcadeUpdate(dt); for (const m of TOWN.shops) { if (m.isLight) m.intensity = G.evening ? 3 : 0; else m.emissiveIntensity = G.evening ? .9 : .25; } for (const m of TOWN.windows) { m.emissive.set(G.evening ? 0xffe0a0 : 0x000000); m.emissiveIntensity = .5; } if (TOWN.stationSign) TOWN.stationSign.emissiveIntensity = G.evening ? 1.2 : .35; }
