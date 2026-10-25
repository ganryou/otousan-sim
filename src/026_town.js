// ============================================================
// 第2段階：泉南通りの商店街・環七の交差点・泉南駅・バス停・スーパー・公衆電話
// 座標：泉南通りの車道 z[-56,-48]、北の歩道 z[-48,-45.8]、南の歩道 z[-58.2,-56]
//       環七の車道 x[-92,-70]、駅の出入口は交差点の南東の角
// ============================================================
const TOWN = { holes: [], shops: [], windows: [], signals: [], shutters: [] };
const SW_Y = .12; // 歩道の高さ
function buildTown() {
  const white = M({ color: 0xe2dfd4, rough: .7 }), curbM = M({ map: TX.concrete, color: 0xb8b6ae, uv: 1 });
  const swM = M({ map: TX.pave, color: 0xc8c2b4, uv: 1.2, ph: { key: 'pave', uv: 2 } });
  // ---- 泉南通り（車道・歩道・縁石）
  box(-140, 62, -.02, 0, -56, -48, MT.asphalt, { col: false, cast: false });
  for (const [z0, z1] of [[-48, -45.8], [-58.2, -56]]) { box(-69.5, 62, 0, SW_Y, z0, z1, swM, { col: false, cast: false }); surf(-69.5, 62, z0, z1, SW_Y); }
  box(-69.5, 62, 0, SW_Y + .02, -48.15, -48, curbM, { col: false }); box(-69.5, 62, 0, SW_Y + .02, -56, -55.85, curbM, { col: false });
  // 東側の道からの入口（歩道を切る）
  for (let x = -60; x < 60; x += 6) if (x < -12 || x > -2) box(x, x + 3, .004, .008, -52.1, -51.9, white, { col: false, cast: false });
  box(-69.5, 62, .004, .008, -48.5, -48.4, white, { col: false, cast: false }); box(-69.5, 62, .004, .008, -55.6, -55.5, white, { col: false, cast: false });
  // ---- 環七（6車線・中央分離帯）
  box(-92, -70, -.02, .001, -140, 40, MT.asphalt, { col: false, cast: false });
  box(-81.6, -80.4, 0, .25, -140, -60, curbM, { col: false }); box(-81.6, -80.4, 0, .25, -44, 40, curbM, { col: false });
  for (const x of [-88.3, -84.6, -77.4, -73.7]) for (let z = -140; z < 40; z += 8) if (z < -61 || z > -44) box(x - .06, x + .06, .004, .008, z, z + 4, white, { col: false, cast: false });
  for (const [x0, x1] of [[-96, -92], [-70, -69.5]]) { box(x0, x1, 0, SW_Y, -140, 40, swM, { col: false, cast: false }); }
  surf(-70, -69.5, -140, 40, SW_Y);
  // 横断歩道（しま模様）
  const zebra = (x0, x1, z0, z1, alongX) => { if (alongX) for (let x = x0; x < x1; x += 1) box(x, x + .5, .004, .01, z0, z1, white, { col: false, cast: false }); else for (let z = z0; z < z1; z += 1) box(x0, x1, .004, .01, z, z + .5, white, { col: false, cast: false }); };
  zebra(-69.2, -66, -56, -48, false);           // 泉南通りを渡る（駅の前）
  zebra(-92, -70, -61.5, -58.8, true); zebra(-92, -70, -45.2, -42.5, true); // 環七を渡る
  // ガードレール（歩道と車道の境）
  const gr = M({ color: 0xe8e8e2, rough: .4, metal: .5 });
  for (const [z0, z1] of [[-140, -61.5], [-42.5, 40]]) { box(-69.9, -69.8, .45, .75, z0, z1, gr); for (let z = z0; z < z1; z += 2) box(-69.9, -69.8, 0, .75, z, z + .08, gr, { col: false }); }
  for (const [x0, x1] of [[-66, -14], [-2, 62]]) for (const z of [-48.1, -55.9]) { box(x0, x1, .5, .78, z - .04, z + .04, gr); for (let x = x0; x < x1; x += 2.2) box(x, x + .08, 0, .78, z - .04, z + .04, gr, { col: false }); }
  addCol(-96.2, -96, -1, 6, -140, 40); addCol(62, 62.2, -1, 6, -60, -45);
  // 交差点の信号
  for (const [x, z, ry] of [[-69.6, -58.4, 0], [-69.6, -45.6, Math.PI], [-92.4, -58.4, 0], [-92.4, -45.6, Math.PI]]) signalPole(x, z, ry);
  pedSignal(-69.4, -47.8, Math.PI); pedSignal(-69.4, -56.2, 0);
  // 歩道橋の代わりに、遠くの環七沿いのビル
  const bM = [0xa8a49a, 0x9a9ca0, 0xb8b0a0, 0x8f9498].map(c => M({ map: TX.stucco, color: c, uv: 3 }));
  for (let z = -130; z < 30; z += R(10, 16)) { if (z > -64 && z < -40) continue; const h = R(10, 26), d = R(10, 16); box(-96 - d, -96.3, 0, h, z, z + R(8, 13), pick(bM), { col: false }); TOWN.windows.push(winPanel(-96.32, 2, h - 1, z + .5, z + 7, 'x+')); }
  for (let z = -130; z < -64; z += R(10, 16)) { const h = R(8, 18); box(-69.5 + 0.1, -60 + R(-2, 0), 0, h, z, z + R(8, 12), pick(bM), { col: false }); }
  // ---- 商店街
  const N = 'n', S = 's';
  shop(-67, -60.5, N, { name: '喫茶 ロア', col: 0x5a3a2a, awn: [0x5a3a2a, 0xe8d8b8], type: 'cafe' });
  shop(-60.5, -54, N, { name: 'はやし書店', col: 0x2a4a7a, awn: [0x2a4a7a, 0xffffff], type: 'books' });
  shop(-54, -47.5, N, { name: 'くすりのヤマイチ', col: 0x2a8a4a, awn: [0x2a8a4a, 0xffffff], type: 'pharma' });
  shop(-47.5, -41, N, { name: 'そば処 更科庵', col: 0x3a2a1a, awn: null, type: 'soba', noren: true });
  shop(-41, -34.5, N, { name: 'ハラルフード サラーム', col: 0x1a6a4a, awn: [0x1a6a4a, 0xe8c040], type: 'halal' });
  shop(-34.5, -28, N, { name: '酒のたかの', col: 0x8a1a1a, awn: [0x8a1a1a, 0xffffff], type: 'liquor' });
  shop(-28, -21.2, N, { name: '相川米穀店', col: 0x6a4a2a, awn: [0xc8a040, 0x6a4a2a], type: 'rice' });
  shop(20.5, 27, N, { name: '青木青果', col: 0x2a6a2a, awn: [0x2a8a2a, 0xffffff], type: 'veg', open: true });
  shop(27, 33.5, N, { name: '理容 カネダ', col: 0x2a3a6a, awn: [0x2a3a6a, 0xffffff], type: 'barber', pole: true });
  shop(33.5, 40, N, { name: 'クリーニング しらかば', col: 0x3a7ab8, awn: [0x3a7ab8, 0xffffff], type: 'clean' });
  shop(40, 47, N, { name: '不動産 かねこ', col: 0x7a5a2a, awn: [0x7a5a2a, 0xffffff], type: 'fudosan' });
  shop(47, 58, N, { name: '', col: 0x888888, awn: null, type: 'shutter', closed: true });
  shop(-60, -52, S, { name: 'ゲームコーナー ハロー', col: 0x8a2a8a, awn: [0xe8e040, 0x8a2a8a], type: 'arcade', arcade: true, depth: 9 });
  shop(-52, -44, S, { name: 'パン ピエール', col: 0xa86a3a, awn: [0xa86a3a, 0xf0e0c0], type: 'bakery' });
  shop(-44, -36, S, { name: '', col: 0x888888, awn: null, type: 'shutter', closed: true });
  shop(-36, -26, S, { name: '眼鏡の光和堂', col: 0x3a3a5a, awn: [0x3a3a5a, 0xffffff], type: 'glasses' });
  shop(-26, -12, S, { name: 'スーパーみやま', col: 0xd02a2a, awn: null, type: 'super', super: true, depth: 16 });
  shop(-12, -4, S, { name: '金物 やまだ', col: 0x5a5a5a, awn: [0x5a5a5a, 0xe8c040], type: 'hardware' });
  shop(-4, 6, S, { name: '', col: 0x999999, awn: null, type: 'shutter', closed: true });
  shop(6, 16, S, { name: '中華 萬来', col: 0xc83a1a, awn: [0xc83a1a, 0xf0e040], type: 'chinese', noren: true });
  shop(16, 30, S, { name: '', col: 0xa0a0a0, awn: null, type: 'apart' });
  shop(30, 44, S, { name: '', col: 0xa8a098, awn: null, type: 'apart' });
  shop(44, 58, S, { name: '', col: 0x9a9890, awn: null, type: 'apart' });
  // 住宅側を泉南通りから仕切る塀
  blockWallX(-45.9, -21.2, -9.55, []); blockWallX(-45.9, -4.0, 20.5, []);
  // ---- バス停
  busStop(-33, -46.6, Math.PI, '京王バス', 0xb82a3a, ['新宿駅西口', '中野駅', '佼成会聖堂普門館前', '中野車庫']);
  busStop(-40, -57.4, 0, '都営バス', 0x3a8a3a, ['渋谷駅', '阿佐ケ谷駅', '杉並車庫']);
  // ---- 電柱（泉南通り）
  for (let x = -60; x < 60; x += 18) cyl(x, 0, 10, -45.6, .16, MT.pole, { r2: .12, seg: 12, col: true });
  // ---- 駅
  buildStation();
  // ---- 公衆電話（駅の入口の横）
  const phM = M({ color: 0x5a8a5a, rough: .4, metal: .2 });
  box(-62.9, -62.3, SW_Y, 1.05, -57.95, -57.45, M({ color: 0x8a8a86, rough: .5 }));
  box(-62.85, -62.35, 1.05, 1.55, -57.9, -57.55, phM);
  box(-63.2, -62.0, 2.25, 2.3, -58.1, -57.3, M({ color: 0xd8d8d0, rough: .5 }), { col: false });
  const pt = labelTex(256, 64, (g, w, h) => { g.fillStyle = '#1a6a3a'; g.fillRect(0, 0, w, h); g.fillStyle = '#fff'; g.font = `bold 36px ${GOTH}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('公衆電話', w / 2, h / 2 + 2); });
  decal(pt, .6, .15, new V3(-62.6, 2.45, -57.28), 0);
  TOWN.phone = hitProxy(-62.9, -62.3, 1.0, 1.6, -57.95, -57.45, { label: () => '電話をかける', act: () => openPhone() });
}
function signalPole(x, z, ry) {
  const Mx = new THREE.Matrix4().makeRotationY(ry).setPosition(x, 0, z), P = (a, b, c) => new V3(a, b, c).applyMatrix4(Mx);
  cyl(x, 0, 5.4, z, .1, MT.railLight, { col: true, seg: 10 }); beam(P(0, 5.2, 0), P(-4.5, 5.2, 0), .09, MT.railLight);
  const hM = M({ color: 0x3a3a3a, rough: .5 }); orientedBox(P(-4.3, 5.0, 0), new V3(1, 0, 0).transformDirection(Mx), new V3(0, 1, 0), new V3(0, 0, 1).transformDirection(Mx), 1.3, .42, .3, hM);
  const lamps = []; for (let i = 0; i < 3; i++) { const m = new THREE.MeshBasicMaterial({ color: 0x222222 }); const l = new THREE.Mesh(new THREE.CircleGeometry(.14, 16), m); l.position.copy(P(-4.72 + i * .42, 5.0, .16)); l.rotation.y = ry; scene.add(l); lamps.push(m); }
  TOWN.signals.push({ lamps, kind: 'car' });
}
function pedSignal(x, z, ry) {
  cyl(x, 0, 2.6, z, .06, MT.railLight, { seg: 8 });
  const lamps = []; for (let i = 0; i < 2; i++) { const m = new THREE.MeshBasicMaterial({ color: 0x222222 }); const l = new THREE.Mesh(new THREE.PlaneGeometry(.26, .26), m); l.position.set(x, 2.95 - i * .32, z + (ry ? -.07 : .07)); l.rotation.y = ry; scene.add(l); lamps.push(m); }
  box(x - .16, x + .16, 2.6, 3.28, z - .06, z + .06, M({ color: 0x333333 }), { col: false });
  TOWN.signals.push({ lamps, kind: 'ped' });
}
// ビルの窓（夜は明かり）
function winPanel(x, y0, y1, z0, z1, face) {
  const t = labelTex(128, 256, (g, w, h) => { g.fillStyle = '#6a6c70'; g.fillRect(0, 0, w, h); for (let y = 6; y < h; y += 22) for (let xx = 6; xx < w; xx += 20) { g.fillStyle = hash2(xx + y, y) > .6 ? '#e8d8a0' : '#2a3440'; g.fillRect(xx, y, 14, 14); } });
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(Math.max(1, (z1 - z0) / 6), Math.max(1, (y1 - y0) / 8));
  const m = new THREE.MeshStandardMaterial({ map: t, emissive: 0x000000, emissiveMap: t, roughness: .6 });
  const p = new THREE.Mesh(new THREE.PlaneGeometry(z1 - z0, y1 - y0), m); p.position.set(x, (y0 + y1) / 2, (z0 + z1) / 2); p.rotation.y = face === 'x+' ? Math.PI / 2 : -Math.PI / 2; scene.add(p); return m;
}
// ---- お店
function shopInteriorTex(type) {
  return labelTex(512, 256, (g, w, h) => {
    const r = mulberry32(type.length * 97 + 5);
    g.fillStyle = { cafe: '#6a4a30', books: '#d8d0b8', pharma: '#f0f0ea', soba: '#3a2a1a', halal: '#d8c8a0', liquor: '#d8d0c0', rice: '#d8c8a8', veg: '#6a5a40', barber: '#e8e8e0', clean: '#e8f0f0', fudosan: '#e8e4d8', bakery: '#f0e0c0', glasses: '#e0e0e8', hardware: '#b8b0a0', chinese: '#8a2a1a' }[type] || '#999';
    g.fillRect(0, 0, w, h);
    const shelf = (colors, rows = 4) => { for (let y = 0; y < rows; y++) { g.fillStyle = 'rgba(80,60,40,.8)'; g.fillRect(0, 40 + y * 52, w, 5); for (let x = 4; x < w - 10; x += 10 + r() * 14) { g.fillStyle = colors[Math.floor(r() * colors.length)]; const hh = 18 + r() * 26; g.fillRect(x, 40 + y * 52 - hh, 8 + r() * 8, hh); } } };
    if (type === 'books') shelf(['#a33', '#36a', '#3a6', '#aa3', '#555', '#a63', '#eee'], 4);
    else if (type === 'pharma') { shelf(['#e33', '#3ae', '#fff', '#fc3', '#3c6'], 4); g.fillStyle = '#e22'; g.font = `bold 40px ${GOTH}`; g.fillText('特価', 20, 240); }
    else if (type === 'liquor') shelf(['#6a3', '#a52', '#ddd', '#382', '#c93', '#224'], 4);
    else if (type === 'halal') shelf(['#c83', '#ea3', '#6a3', '#a33', '#dc8'], 4);
    else if (type === 'rice') { for (let i = 0; i < 12; i++) { g.fillStyle = r() < .5 ? '#f0e8d0' : '#e8d8b0'; g.fillRect(10 + (i % 6) * 82, 110 + Math.floor(i / 6) * 70, 70, 60); g.fillStyle = '#a22'; g.font = `18px ${MIN}`; g.fillText('新米', 30 + (i % 6) * 82, 140 + Math.floor(i / 6) * 70); } }
    else if (type === 'veg') { for (let i = 0; i < 40; i++) { g.fillStyle = ['#e33', '#3a3', '#fa3', '#ed3', '#6c3', '#a3c'][i % 6]; g.beginPath(); g.arc(20 + (i % 10) * 50, 150 + Math.floor(i / 10) * 26, 12, 0, 7); g.fill(); } }
    else if (type === 'bakery') { for (let i = 0; i < 24; i++) { g.fillStyle = ['#c8883a', '#a86a2a', '#e8c080'][i % 3]; g.beginPath(); g.ellipse(30 + (i % 8) * 60, 90 + Math.floor(i / 8) * 55, 22, 14, 0, 0, 7); g.fill(); } }
    else if (type === 'fudosan') { for (let i = 0; i < 18; i++) { g.fillStyle = '#fff'; g.fillRect(10 + (i % 6) * 82, 20 + Math.floor(i / 6) * 76, 72, 66); g.fillStyle = '#333'; g.font = `12px ${GOTH}`; g.fillText('2DK 7.8万', 16 + (i % 6) * 82, 40 + Math.floor(i / 6) * 76); g.fillText('駅5分', 16 + (i % 6) * 82, 58 + Math.floor(i / 6) * 76); } }
    else if (type === 'clean') { for (let i = 0; i < 20; i++) { g.fillStyle = ['#eee', '#88a', '#a88', '#444'][i % 4]; g.fillRect(10 + i * 25, 40, 20, 120); } g.fillStyle = '#555'; g.fillRect(0, 36, w, 4); }
    else if (type === 'barber') { g.fillStyle = '#aac'; g.fillRect(40, 30, 180, 120); g.fillStyle = '#333'; g.fillRect(80, 150, 60, 80); g.fillRect(300, 150, 60, 80); g.fillStyle = '#aac'; g.fillRect(260, 30, 180, 120); }
    else if (type === 'cafe') { g.fillStyle = '#2a1a10'; g.fillRect(0, 170, w, 86); for (let i = 0; i < 6; i++) { g.fillStyle = '#8a3a2a'; g.fillRect(20 + i * 85, 140, 50, 40); } g.fillStyle = 'rgba(255,220,150,.3)'; g.fillRect(0, 0, w, 120); }
    else if (type === 'glasses') { for (let i = 0; i < 24; i++) { g.strokeStyle = '#333'; g.lineWidth = 3; const x = 30 + (i % 8) * 60, y = 60 + Math.floor(i / 8) * 60; g.strokeRect(x, y, 18, 12); g.strokeRect(x + 24, y, 18, 12); } }
    else if (type === 'hardware') shelf(['#888', '#c93', '#36a', '#a33', '#ccc'], 4);
    else if (type === 'chinese' || type === 'soba') { g.fillStyle = 'rgba(255,200,120,.35)'; g.fillRect(0, 0, w, h); g.fillStyle = '#1a0a05'; g.fillRect(0, 160, w, 96); for (let i = 0; i < 5; i++) { g.fillStyle = '#6a3a1a'; g.fillRect(30 + i * 100, 120, 60, 12); } }
  });
}
function shop(x0, x1, side, o) {
  const D = o.depth ?? 7, H = o.h ?? (o.type === 'apart' ? R(8.5, 11.5) : pick([5.6, 6.3, 6.3, 7.4, 8.6])), zf = side === 'n' ? -45.8 : -58.2, dir = side === 'n' ? 1 : -1, out = -dir;
  const zb = zf + dir * D, zA = Math.min(zf, zb), zB = Math.max(zf, zb), cx = (x0 + x1) / 2, w = x1 - x0;
  const wm = M({ map: TX.stucco, color: o.type === 'apart' ? o.col : pick([0xd8d0c0, 0xc8c0b0, 0xe0d8c8, 0xb8b4a8, 0xd0c8b8, 0xa8b0b0, 0xc8b8a0, 0xe8e0d0]), uv: 2, ph: { key: 'stucco', uv: 2 } });
  if (!o.super && !o.arcade) box(x0 + .05, x1 - .05, 0, H, zA, zB, wm);
  // 屋根の縁と室外機
  box(x0, x1, H, H + .25, zA - .1, zB + .1, MT.concrete, { col: false });
  box(x0 + .5, x0 + 1.3, H + .25, H + .85, zB - (dir > 0 ? 1.2 : -.4) - .6, zB - (dir > 0 ? 1.2 : -.4), MT.ac, { col: false });
  if (o.super) { buildSuper(x0, x1, zf, zb, dir, o); return; }
  if (o.arcade) { if (!FG.scene) fgInit(); buildArcade(x0, x1, zf, zb, dir, o, H); return; }
  const fz = zf + out * .02; // 正面
  if (o.type === 'apart') { for (let f = 0; f < 3; f++) for (let i = 0; i < Math.floor(w / 3.2); i++) { const wx = x0 + 1 + i * 3.2; box(wx, wx + 1.8, 1 + f * 2.8, 2.4 + f * 2.8, fz - .02, fz + .02, rng() < .4 ? MT.glassA : MT.glassB, { col: false, cast: false }); } return; }
  // 1階の店先
  if (o.closed) {
    const sh = labelTex(256, 256, (g, ww, hh) => { g.fillStyle = '#9a9c98'; g.fillRect(0, 0, ww, hh); for (let y = 0; y < hh; y += 8) { g.fillStyle = y % 16 ? '#8a8c88' : '#aaaca8'; g.fillRect(0, y, ww, 4); } if (o.note) { g.fillStyle = '#fff'; g.fillRect(70, 100, 116, 56); g.fillStyle = '#c22'; g.font = `bold 28px ${GOTH}`; g.textAlign = 'center'; g.fillText(o.note, 128, 138); } });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w - .6, 2.8), new THREE.MeshStandardMaterial({ map: sh, roughness: .5, metalness: .4 })); m.position.set(cx, 1.4, fz); m.rotation.y = out > 0 ? 0 : Math.PI; scene.add(m);
  } else {
    const it = shopInteriorTex(o.type), mat = new THREE.MeshStandardMaterial({ map: it, emissive: 0xffffff, emissiveMap: it, emissiveIntensity: .25, roughness: .3 });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w - .8, 2.5), mat); m.position.set(cx, 1.3, fz); m.rotation.y = out > 0 ? 0 : Math.PI; scene.add(m); TOWN.shops.push(mat);
    box(x0 + .3, x0 + .4, 0, 2.6, fz - .05, fz + .05, MT.alu, { col: false }); box(x1 - .4, x1 - .3, 0, 2.6, fz - .05, fz + .05, MT.alu, { col: false }); box(x0 + .3, x1 - .3, 2.55, 2.65, fz - .05, fz + .05, MT.alu, { col: false });
    const L = new THREE.PointLight(0xfff0d8, 0, 5, 1.8); L.position.set(cx, 2.2, zf + out * .8); scene.add(L); TOWN.shops.push(L);
  }
  // 日よけ（テント）
  if (o.awn) {
    const at = labelTex(256, 64, (g, ww, hh) => { for (let x = 0; x < ww; x += 32) { g.fillStyle = (x / 32) % 2 ? '#' + o.awn[1].toString(16).padStart(6, '0') : '#' + o.awn[0].toString(16).padStart(6, '0'); g.fillRect(x, 0, 32, hh); } g.fillStyle = 'rgba(0,0,0,.15)'; g.fillRect(0, hh - 10, ww, 10); });
    at.wrapS = THREE.RepeatWrapping; at.repeat.set(w / 2.5, 1);
    const am = new THREE.MeshStandardMaterial({ map: at, roughness: .9, side: THREE.DoubleSide });
    const a = new THREE.Mesh(new THREE.PlaneGeometry(w - .2, 1.45), am); a.position.set(cx, 2.72, zf + out * .62); a.rotation.x = out > 0 ? -1.1 : 1.1; if (out < 0) a.rotation.y = Math.PI; a.castShadow = true; a.receiveShadow = true; scene.add(a);
  }
  // 看板
  if (o.name) {
    const st = labelTex(512, 96, (g, ww, hh) => { g.fillStyle = '#' + o.col.toString(16).padStart(6, '0'); g.fillRect(0, 0, ww, hh); g.fillStyle = '#fff'; g.font = `bold 50px ${o.type === 'soba' || o.type === 'rice' ? MIN : GOTH}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(o.name, ww / 2, hh / 2 + 3); });
    const sm = new THREE.MeshStandardMaterial({ map: st, emissive: 0xffffff, emissiveMap: st, emissiveIntensity: .05, roughness: .5 });
    const s = new THREE.Mesh(new THREE.PlaneGeometry(Math.min(w - .4, 5.6), .95), sm); s.position.set(cx, 3.65, fz + out * .03); s.rotation.y = out > 0 ? 0 : Math.PI; scene.add(s); TOWN.shops.push(sm);
  }
  // 2階の窓
  for (let f = 0; f < (H > 8 ? 2 : 1); f++) for (let i = 0; i < 2; i++) { const wx = x0 + w * (.18 + i * .42), y0 = 4.3 + f * 2.5; box(wx, wx + w * .26, y0, y0 + 1.2, fz - .02, fz + .02, rng() < .5 ? MT.glassA : MT.glassB, { col: false, cast: false }); box(wx - .05, wx + w * .26 + .05, y0 - .05, y0, fz, fz + out * .12, MT.alu, { col: false }); if (rng() < .4) box(wx + .1, wx + .9, y0 - .6, y0 - .1, fz + out * .05, fz + out * .35, MT.ac, { col: false }); }
  // 店先の小物
  const sx0 = x0 + .6, sz = zf + out * 1.0;
  if (o.type === 'veg') for (let i = 0; i < 5; i++) { box(sx0 + i * 1.1, sx0 + i * 1.1 + .9, SW_Y, SW_Y + .5, sz - .35, sz + .35, MT.furn); const g = new THREE.Mesh(new THREE.SphereGeometry(.4, 10, 6, 0, 6.3, 0, 1.2), M({ color: [0xe03030, 0x40a030, 0xf0a030, 0xe0d040, 0x70c040][i], rough: .6 })); g.scale.set(1.05, .45, .8); g.position.set(sx0 + i * 1.1 + .45, SW_Y + .5, sz); scene.add(g); }
  if (o.type === 'liquor') { box(sx0, sx0 + .8, SW_Y, SW_Y + 1.8, sz - .3, sz + .3, M({ color: 0x2a3a8a, rough: .4 })); for (let i = 0; i < 4; i++) box(sx0 + 1.2 + i * .45, sx0 + 1.6 + i * .45, SW_Y, SW_Y + .3 + (i % 2) * .3, sz - .25, sz + .25, M({ color: 0xc8a030, rough: .6 })); }
  if (o.type === 'rice') { for (let i = 0; i < 3; i++) box(sx0 + i * .7, sx0 + i * .7 + .55, SW_Y, SW_Y + .35, sz - .25, sz + .25, M({ color: 0xe8dcc0, rough: 1 })); }
  if (o.noren) { const nt = labelTex(256, 128, (g, ww, hh) => { g.fillStyle = o.type === 'soba' ? '#1a2a4a' : '#c83a1a'; g.fillRect(0, 0, ww, hh); g.fillStyle = '#fff'; g.font = `bold 60px ${MIN}`; g.textAlign = 'center'; g.fillText(o.type === 'soba' ? 'そば' : 'ラーメン', ww / 2, 85); for (let x = 64; x < ww; x += 64) { g.fillStyle = 'rgba(0,0,0,.4)'; g.fillRect(x - 1, 0, 2, hh); } }); const nm = new THREE.Mesh(new THREE.PlaneGeometry(1.8, .7), new THREE.MeshStandardMaterial({ map: nt, side: THREE.DoubleSide, roughness: 1 })); nm.position.set(cx, 2.15, fz + out * .15); nm.rotation.y = out > 0 ? 0 : Math.PI; scene.add(nm); }
  if (o.pole) { const pt = labelTex(64, 256, (g, ww, hh) => { for (let y = -hh; y < hh * 2; y += 48) { g.save(); g.translate(0, y); g.rotate(-.5); g.fillStyle = '#d22'; g.fillRect(-40, 0, 200, 16); g.fillStyle = '#fff'; g.fillRect(-40, 16, 200, 16); g.fillStyle = '#22a'; g.fillRect(-40, 32, 200, 16); g.restore(); } }); pt.wrapT = THREE.RepeatWrapping; const pm = new THREE.Mesh(new THREE.CylinderGeometry(.1, .1, .8, 16), new THREE.MeshStandardMaterial({ map: pt, emissive: 0xffffff, emissiveMap: pt, emissiveIntensity: .4 })); pm.position.set(x0 + .5, 1.8, fz + out * .25); scene.add(pm); W.anim.push((t) => { pt.offset.y = -t * .5; }); }
  // コライダー（店先の小物も含めて歩道の奥側）
  addCol(x0, x1, 0, H, Math.min(zf, zf + out * .05), Math.max(zf, zf + out * .05));
}
// ---- バス停
function busStop(x, z, ry, company, col, dests) {
  const Mx = new THREE.Matrix4().makeRotationY(ry).setPosition(x, SW_Y, z), P = (a, b, c) => new V3(a, b, c).applyMatrix4(Mx);
  cyl(x, SW_Y, SW_Y + 2.3, z, .04, MT.railLight, { seg: 8, col: true });
  const head = labelTex(256, 256, (g, w, h) => { g.fillStyle = '#fff'; g.beginPath(); g.arc(128, 128, 124, 0, 7); g.fill(); g.strokeStyle = '#' + col.toString(16).padStart(6, '0'); g.lineWidth = 16; g.stroke(); g.fillStyle = '#' + col.toString(16).padStart(6, '0'); g.font = `bold 30px ${GOTH}`; g.textAlign = 'center'; g.fillText(company, 128, 90); g.fillStyle = '#222'; g.font = `bold 48px ${MIN}`; g.fillText('泉南駅', 128, 155); g.font = `20px ${GOTH}`; g.fillText('のりば', 128, 195); });
  for (const s of [0, Math.PI]) { const m = new THREE.Mesh(new THREE.CircleGeometry(.32, 32), new THREE.MeshStandardMaterial({ map: head, roughness: .5 })); m.position.copy(P(0, 2.55, s ? -.02 : .02)); m.rotation.y = ry + s; scene.add(m); }
  const tt = labelTex(256, 512, (g, w, h) => { g.fillStyle = '#f4f2e8'; g.fillRect(0, 0, w, h); g.fillStyle = '#' + col.toString(16).padStart(6, '0'); g.fillRect(0, 0, w, 60); g.fillStyle = '#fff'; g.font = `bold 26px ${GOTH}`; g.fillText('行き先', 14, 40); g.fillStyle = '#222'; g.font = `bold 24px ${GOTH}`; dests.forEach((d, i) => g.fillText('● ' + d + ' 行', 14, 100 + i * 44)); g.font = `16px ${GOTH}`; g.fillStyle = '#555'; for (let hh = 6; hh < 22; hh++) g.fillText(`${hh}  ${(hh * 7) % 60 < 10 ? '0' : ''}${(hh * 7) % 60}  ${(hh * 13 + 20) % 60}`, 20, 290 + (hh - 6) * 13); });
  const tm = new THREE.Mesh(new THREE.PlaneGeometry(.42, .84), new THREE.MeshStandardMaterial({ map: tt, roughness: .6 })); tm.position.copy(P(0, 1.4, .06)); tm.rotation.y = ry; scene.add(tm);
  interactable(tm, { label: () => '時刻表を見る', act: () => G.notice(company + '　泉南', '行き先：<br>' + dests.map(d => '・' + d + ' 行').join('<br>') + '<br><span style="color:#777">時刻表の数字が、日に焼けて薄くなっている。</span>') });
  // 屋根付きのベンチ
  box(...[P(.8, 0, -.4), P(2.6, 0, .1)].reduce((a, p, i) => { a[0] = i ? Math.min(a[0], p.x) : p.x; a[1] = i ? Math.max(a[1], p.x) : p.x; return a; }, [0, 0]), SW_Y + .42, SW_Y + .47, Math.min(P(.8, 0, -.4).z, P(2.6, 0, .1).z), Math.max(P(.8, 0, -.4).z, P(2.6, 0, .1).z), MT.furn);
  TOWN.busStops = TOWN.busStops || []; TOWN.busStops.push({ x, z, company, dests });
}
// ---- 泉南駅（地下）
function buildStation() {
  const Y = -4.5, C = MT.concrete, tileW = M({ color: 0xe8e4d8, rough: .4 }), floorM = M({ map: TX.pave, color: 0xb8b8b0, uv: 1.5, ph: { key: 'pave', uv: 2 } });
  // 地上の入口（屋根・囲い・看板）
  box(-68.6, -68.4, 0, 1.1, -66.5, -58.4, tileW); box(-63.6, -63.4, 0, 1.1, -66.5, -58.4, tileW); box(-68.6, -63.4, 0, 1.1, -66.7, -66.5, tileW);
  box(-68.8, -63.2, 2.9, 3.05, -67, -57.9, M({ color: 0xd8d8d0, rough: .4, metal: .3 }), { col: false });
  for (const [x, z] of [[-68.5, -58.2], [-63.5, -58.2], [-68.5, -66.6], [-63.5, -66.6]]) cyl(x, 0, 2.9, z, .06, MT.railLight, { seg: 8 });
  const sg = labelTex(512, 160, (g, w, h) => { g.fillStyle = '#1a2a4a'; g.fillRect(0, 0, w, h); g.fillStyle = '#e03030'; g.beginPath(); g.arc(80, 80, 52, 0, 7); g.fill(); g.fillStyle = '#1a2a4a'; g.beginPath(); g.arc(80, 80, 30, 0, 7); g.fill(); g.textAlign = 'left'; g.fillStyle = '#fff'; g.font = `bold 56px ${GOTH}`; g.fillText('泉南駅', 150, 78); g.font = `26px ${GOTH}`; g.fillText('丸ノ内線　出入口 1', 152, 124); });
  const sgm = new THREE.MeshStandardMaterial({ map: sg, emissive: 0xffffff, emissiveMap: sg, emissiveIntensity: .35 });
  const sgp = new THREE.Mesh(new THREE.PlaneGeometry(2.8, .88), sgm); sgp.position.set(-66, 3.5, -57.95); scene.add(sgp); TOWN.stationSign = sgm;
  cyl(-66, 0, 3.05, -57.95, .07, MT.railLight, { seg: 8 });
  // 階段（北から南へ下る）
  const x0 = -68.4, x1 = -63.6, zTop = -58.4, zBot = -66.4;
  for (let i = 0; i < 26; i++) { const za = zTop - i * (zTop - zBot) / 26, zb2 = za - (zTop - zBot) / 26, top = SW_Y + (Y - SW_Y) * (i + 1) / 26; box(x0, x1, top - .4, top, Math.min(za, zb2), Math.max(za, zb2), C, { col: false }); box(x0, x1, top - .005, top + .004, zb2 - .02, zb2 + .03, M({ color: 0xd8c040 }), { col: false, cast: false }); }
  ramp(x0, x1, zBot, zTop, 'z', Y, SW_Y);
  box(-68.6, -68.4, Y, 0, -66.5, -58.4, tileW); box(-63.6, -63.4, Y, 0, -66.5, -58.4, tileW);
  beam(new V3(-68.3, .9, -58.4), new V3(-68.3, Y + .9, -66.4), .05, MT.railLight); beam(new V3(-63.7, .9, -58.4), new V3(-63.7, Y + .9, -66.4), .05, MT.railLight);
  TOWN.holes.push({ x0: -68.4, x1: -63.6, z0: -66.5, z1: -58.3 });
  // コンコース
  const cx0 = -76, cx1 = -56, cz0 = -84, cz1 = -66.4, CY = Y + 3.1;
  box(cx0, cx1, Y - .2, Y, cz0, cz1, floorM, { col: false }); surf(cx0, cx1, cz0, cz1, Y);
  box(cx0, cx1, CY, CY + .3, cz0, cz1, M({ color: 0xe8e8e0, rough: .6 }), { col: false });
  box(cx0 - .2, cx0, Y, CY, cz0, cz1, tileW); box(cx1, cx1 + .2, Y, CY, cz0, cz1, tileW); box(cx0, cx1, Y, CY, cz0 - .2, cz0, tileW);
  box(cx0, x0, Y, CY, cz1, cz1 + .2, tileW); box(x1, cx1, Y, CY, cz1, cz1 + .2, tileW);
  // 地下の上をふさぐ地面（階段の穴だけ残す）
  const gcM = M({ map: TX.soil, uv: 3, ph: { key: 'soil', uv: 3 } });
  box(-80, -68.6, -.3, -.005, -86, -58.3, gcM, { col: false }); box(-63.4, -54, -.3, -.005, -86, -58.3, gcM, { col: false }); box(-68.6, -63.4, -.3, -.005, -86, -66.7, gcM, { col: false });
  // 天井の蛍光灯
  TOWN.stLamps = [];
  for (let x = cx0 + 2; x < cx1; x += 4) for (let z = cz0 + 2; z < cz1; z += 4) box(x - .6, x + .6, CY - .06, CY, z - .08, z + .08, M({ color: 0xffffff, emissive: 0xf4f8ff, ei: 1.6 }), { col: false, cast: false });
  for (const [x, z] of [[-66, -69.5], [-62, -77], [-72, -77]]) { const L = new THREE.PointLight(0xeef4ff, 6, 11, 1.4); L.position.set(x, CY - .3, z); scene.add(L); }
  // 改札（自動改札機が5台）
  const gM = M({ color: 0xb8bcc0, rough: .35, metal: .5 }), gz = -74;
  for (let i = 0; i < 6; i++) { const gx = -71 + i * 2.2; box(gx - .18, gx + .18, Y, Y + 1.0, gz - .9, gz + .9, gM); box(gx - .2, gx + .2, Y + 1.0, Y + 1.04, gz - .9, gz + .9, M({ color: 0x3a3a3a }), { col: false }); }
  box(cx0, -71.2, Y, Y + 1.1, gz - .1, gz + .1, gM); box(-60, cx1, Y, Y + 1.1, gz - .1, gz + .1, gM);
  TOWN.gateZ = gz;
  const gs = labelTex(512, 96, (g, w, h) => { g.fillStyle = '#222'; g.fillRect(0, 0, w, h); g.fillStyle = '#fff'; g.font = `bold 40px ${GOTH}`; g.textAlign = 'center'; g.fillText('改札口　Ticket Gate', w / 2, 62); });
  decal(gs, 4, .75, new V3(-66, CY - .6, gz + .5), 0, { emissive: 0xffffff, ei: .5 });
  // 券売機・運賃表
  for (let i = 0; i < 4; i++) { const bx = cx1 - .7; box(bx, cx1, Y, Y + 1.7, -70 - i * 1.1, -69.2 - i * 1.1, M({ color: 0xd8d8d0, rough: .4 })); decal(labelTex(64, 128, (g) => { g.fillStyle = '#223'; g.fillRect(0, 0, 64, 128); g.fillStyle = '#6cf'; for (let k = 0; k < 8; k++) g.fillRect(8 + (k % 2) * 26, 10 + Math.floor(k / 2) * 18, 20, 12); g.fillStyle = '#fc3'; g.fillRect(12, 96, 40, 20); }), .55, 1.0, new V3(bx - .01, Y + 1.15, -69.6 - i * 1.1), -Math.PI / 2, { emissive: 0xffffff, ei: .4 }); }
  const fare = labelTex(512, 256, (g, w, h) => { g.fillStyle = '#f4f4ee'; g.fillRect(0, 0, w, h); g.fillStyle = '#c22'; g.fillRect(0, 0, w, 40); g.fillStyle = '#fff'; g.font = `bold 26px ${GOTH}`; g.fillText('地下鉄　運賃表（中野坂上方面）', 16, 30); g.fillStyle = '#222'; g.font = `20px ${GOTH}`; ['中野富士見町 160', '中野新橋 160', '中野坂上 160', '新宿 160', '四ツ谷 190', '東京 190', '池袋 190'].forEach((s, i) => g.fillText(s, 20 + (i % 2) * 250, 80 + Math.floor(i / 2) * 40)); });
  decal(fare, 3.2, 1.6, new V3(cx1 - .02, Y + 2.3, -71.5), -Math.PI / 2);
  // 改札の向こう：ホームへの階段（暗い）
  box(-72, -60, Y - 3, Y, -84, -78, M({ color: 0x1a1a1a, rough: 1 }), { col: false });
  const hs = labelTex(512, 96, (g, w, h) => { g.fillStyle = '#e8e8e0'; g.fillRect(0, 0, w, h); g.fillStyle = '#c22'; g.beginPath(); g.arc(46, 48, 30, 0, 7); g.fill(); g.fillStyle = '#e8e8e0'; g.beginPath(); g.arc(46, 48, 17, 0, 7); g.fill(); g.fillStyle = '#222'; g.textAlign = 'left'; g.font = `bold 34px ${GOTH}`; g.fillText('1番線　中野坂上 方面 ↓', 90, 60); });
  decal(hs, 4, .75, new V3(-66, CY - .55, -77.9), 0, { emissive: 0xffffff, ei: .4 });
  addCol(cx0, cx1, Y, CY, cz0, -78);
  // 駅のポスター・ベンチ
  for (let i = 0; i < 3; i++) { const pt = labelTex(256, 360, (g, w, h) => { const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, ['#3a6ab8', '#c86a3a', '#3a8a5a'][i]); gr.addColorStop(1, '#f0e8d8'); g.fillStyle = gr; g.fillRect(0, 0, w, h); g.fillStyle = '#fff'; g.font = `bold 34px ${GOTH}`; g.textAlign = 'center'; g.fillText(['夏休み', '納涼', 'ことしの夏'][i], w / 2, 70); g.font = `bold 26px ${GOTH}`; g.fillText(['地下鉄で', '花火大会', 'プールへ'][i], w / 2, 110); }); decal(pt, .7, 1.0, new V3(cx0 + .21, Y + 1.7, -70 - i * 2.2), Math.PI / 2); }
  box(cx0 + .3, cx0 + .8, Y, Y + .45, -78, -74.8, MT.furn);
}
// ---- スーパーみやま（中に入れる）
function buildSuper(x0, x1, zf, zb, dir, o) {
  const H = o.h ?? 6.3, zA = Math.min(zf, zb), zB = Math.max(zf, zb), out = -dir, cx = (x0 + x1) / 2;
  const wm = M({ map: TX.stucco, color: 0xe8e4dc, uv: 2 }), inW = M({ color: 0xf0eee8, rough: .7 }), fl = M({ map: TX.toilet, color: 0xe8e8e0, uv: .6, rough: .35 });
  // 外壁（正面は入口とガラス）
  box(x0, x1, 3.2, H, zf - .1, zf + .1, wm, { col: false });
  box(x0, x0 + .2, 0, H, zA, zB, wm); box(x1 - .2, x1, 0, H, zA, zB, wm); box(x0, x1, 0, H, dir > 0 ? zB - .2 : zA, dir > 0 ? zB : zA + .2, wm);
  const doorX0 = cx - 1.2, doorX1 = cx + 1.2;
  box(x0 + .2, doorX0, 0, 3.2, zf - .05, zf + .05, M({ color: 0x9ab0c0, rough: .05, metal: .6, transparent: true, opacity: .35 }), { cast: false });
  box(doorX1, x1 - .2, 0, 3.2, zf - .05, zf + .05, M({ color: 0x9ab0c0, rough: .05, metal: .6, transparent: true, opacity: .35 }), { cast: false });
  // 自動ドア
  const dm = M({ color: 0xa8c0d0, rough: .05, metal: .5, transparent: true, opacity: .4 });
  const dl = new THREE.Mesh(new THREE.BoxGeometry(1.2, 2.4, .04), dm), dr = dl.clone(); dl.position.set(cx - .6, 1.2, zf); dr.position.set(cx + .6, 1.2, zf); scene.add(dl, dr);
  const dcol = addCol(doorX0, doorX1, 0, 2.4, zf - .05, zf + .05); dcol.door = true;
  TOWN.superDoor = { dl, dr, cx, zf, col: dcol, o: 0 };
  // 床・天井
  box(x0, x1, 0, SW_Y, zA, zB, fl, { col: false }); surf(x0 + .2, x1 - .2, zA, zB, SW_Y); box(x0, x1, 3.3, 3.4, zA, zB, M({ color: 0xf4f4ee, rough: .8 }), { col: false });
  TOWN.superBox = { x0, x1, z0: zA, z1: zB };
  // 看板
  const st = labelTex(1024, 160, (g, w, h) => { g.fillStyle = '#d82a2a'; g.fillRect(0, 0, w, h); g.fillStyle = '#fff'; g.font = `bold 96px ${GOTH}`; g.textAlign = 'center'; g.fillText('スーパーみやま', w / 2, 112); g.fillStyle = '#f0d040'; g.fillRect(0, h - 16, w, 16); });
  const sm = new THREE.MeshStandardMaterial({ map: st, emissive: 0xffffff, emissiveMap: st, emissiveIntensity: .25 });
  const sg = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0 - 1, 1.4), sm); sg.position.set(cx, 4.3, zf + out * .12); sg.rotation.y = out > 0 ? 0 : Math.PI; scene.add(sg); TOWN.shops.push(sm);
  const sale = labelTex(512, 256, (g, w, h) => { g.fillStyle = '#ffec40'; g.fillRect(0, 0, w, h); g.fillStyle = '#d22'; g.font = `bold 70px ${GOTH}`; g.fillText('本日の特売', 30, 90); g.fillStyle = '#222'; g.font = `bold 44px ${GOTH}`; g.fillText('キャベツ 98円', 30, 160); g.fillText('卵10個 158円', 30, 220); });
  decal(sale, 1.6, .8, new V3(x0 + 2.2, 1.6, zf + out * .07), out > 0 ? 0 : Math.PI);
  // 棚（商品が並ぶ）
  const prod = labelTex(512, 256, (g, w, h) => { g.fillStyle = '#e8e8e0'; g.fillRect(0, 0, w, h); const r = mulberry32(12); for (let y = 0; y < 4; y++) { g.fillStyle = '#888'; g.fillRect(0, 60 + y * 64, w, 4); for (let x = 2; x < w - 12; x += 11 + r() * 12) { g.fillStyle = `hsl(${r() * 360},${50 + r() * 40}%,${40 + r() * 30}%)`; const hh = 20 + r() * 34; g.fillRect(x, 60 + y * 64 - hh, 9 + r() * 9, hh); g.fillStyle = 'rgba(255,255,255,.5)'; g.fillRect(x + 2, 60 + y * 64 - hh + 4, 4, 6); } } });
  prod.wrapS = THREE.RepeatWrapping; const pm = M({ map: prod, rough: .6 }), shelfM = M({ color: 0xd8d8d0, rough: .5, metal: .3 });
  const zIn0 = zf + dir * 2.5, zIn1 = zf + dir * 13;
  for (let i = 0; i < 4; i++) {
    const sx = x0 + 2.2 + i * 3.1; const za = Math.min(zIn0, zIn1), zb2 = Math.max(zIn0, zIn1);
    box(sx - .5, sx + .5, SW_Y, 1.9, za + 1, zb2 - 1, shelfM);
    for (const sd of [-1, 1]) { const p = new THREE.Mesh(new THREE.PlaneGeometry(zb2 - za - 2, 1.7), pm); p.position.set(sx + sd * .505, 1.0, (za + zb2) / 2); p.rotation.y = sd * Math.PI / 2; scene.add(p); }
  }
  // 冷蔵ケース（奥の壁ぞい）
  const fzBack = dir > 0 ? zB - .9 : zA + .9, fr = labelTex(512, 256, (g, w, h) => { g.fillStyle = '#dfefff'; g.fillRect(0, 0, w, h); const r = mulberry32(3); for (let y = 0; y < 3; y++) for (let x = 0; x < w; x += 18) { g.fillStyle = ['#fff', '#fe8', '#8cf', '#f88', '#9e9'][Math.floor(r() * 5)]; g.fillRect(x + 2, 30 + y * 80, 14, 50); } });
  const frm = new THREE.MeshStandardMaterial({ map: fr, emissive: 0xffffff, emissiveMap: fr, emissiveIntensity: .7 });
  box(x0 + .5, x1 - .5, SW_Y, 2.0, Math.min(fzBack, fzBack + dir * .7), Math.max(fzBack, fzBack + dir * .7), M({ color: 0xe8e8e8, rough: .4 }));
  const fp = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0 - 1.2, 1.5), frm); fp.position.set(cx, 1.2, fzBack - dir * .01); fp.rotation.y = dir > 0 ? Math.PI : 0; scene.add(fp);
  interactable(fp, { label: () => 'アイスを見る', act: () => G.thought(G.flags.ice ? 'もうお金がない。' : (G.flags.ice = true, 'ガリガリしたソーダ味のアイスを、一本買った。……レジのおばさんが「ありがとうございましたー」と言った。')) });
  // レジ
  for (let i = 0; i < 2; i++) { const rx = x1 - 2.5 - i * 2.2, rz = zf + dir * 1.6; box(rx - .5, rx + .5, SW_Y, .95, rz - .3, rz + .3, M({ color: 0x3a3a3a, rough: .5 })); box(rx - .15, rx + .15, .95, 1.25, rz - .15, rz + .15, M({ color: 0xd8d8d0 })); }
  // 天井の照明
  for (let x = x0 + 1.5; x < x1 - 1; x += 3) for (let k = 0; k < 4; k++) { const z = zf + dir * (2 + k * 3.2); box(x - .9, x + .9, 3.24, 3.3, z - .1, z + .1, M({ color: 0xffffff, emissive: 0xffffff, ei: 1.8 }), { col: false, cast: false }); }
  for (const k of [0, 1]) { const L = new THREE.PointLight(0xf8fbff, 9, 12, 1.3); L.position.set(cx + (k ? 3 : -3), 3.0, zf + dir * 7); scene.add(L); }
  TOWN.superZoneZ = [Math.min(zf, zb), Math.max(zf, zb)];
}
