// ============================================================
// ジオメトリ補助（静的ジオメトリはマテリアルごとに結合）
// ============================================================
const batches = new Map();
const cols = [];      // {x0,x1,y0,y1,z0,z1,on}
const surfs = [];     // 歩ける面
const staticMeshes = [];
const W = { lamps: [], interact: [], anim: [], glassLitA: [], looks: [] };

const MATREG = {}; let _matN = 0;
const BAKE_BOX = { x0: 14.08, x1: 20.87, y0: 2.75, y1: 5.45, z0: -9.87, z1: -0.17 };
const EXT_BOX = { x0: -3.2, x1: 30.3, y0: -0.06, y1: 11.5, z0: -11.8, z1: 1.9 };
function inBake(g) {
  g.computeBoundingBox(); const bb = g.boundingBox, c = bb.getCenter(new V3()), sz = bb.getSize(new V3());
  if (c.x > BAKE_BOX.x0 && c.x < BAKE_BOX.x1 && c.y > BAKE_BOX.y0 && c.y < BAKE_BOX.y1 && c.z > BAKE_BOX.z0 && c.z < BAKE_BOX.z1) return 'in';
  if (Math.max(sz.x, sz.z) < 40 && c.x > EXT_BOX.x0 && c.x < EXT_BOX.x1 && c.y > EXT_BOX.y0 && c.y < EXT_BOX.y1 && c.z > EXT_BOX.z0 && c.z < EXT_BOX.z1) return 'ext';
  return null;
}
let FB = false; const fallback = fn => { FB = true; try { fn(); } finally { FB = false; } };
function addGeo(geo, mat, cast = true) {
  if (!mat.name) mat.name = 'm' + (_matN++); MATREG[mat.name] = mat;
  const bake = FB ? null : inBake(geo);
  const key = mat.uuid + (cast ? 'c' : 'n') + (bake || '') + (FB ? 'F' : '');
  let b = batches.get(key); if (!b) { b = { mat, cast, geos: [], bake, fb: FB }; batches.set(key, b); }
  b.geos.push(geo.index ? geo.toNonIndexed() : geo);
}
function flushStatic() {
  for (const b of batches.values()) {
    const g = mergeGeometries(b.geos, false); if (!g) continue;
    g.computeBoundingSphere();
    const m = new THREE.Mesh(g, b.mat); m.castShadow = b.cast; m.receiveShadow = true; m.matrixAutoUpdate = false; m.updateMatrix();
    if (b.fb) { if (!W.fallback) { W.fallback = new THREE.Group(); scene.add(W.fallback); } W.fallback.add(m); } else scene.add(m); staticMeshes.push(m);
    if (b.bake === 'in') { m.name = b.mat.name; (W.bakeMeshes = W.bakeMeshes || []).push(m); }
    if (b.bake === 'ext') { m.name = b.mat.name; (W.extMeshes = W.extMeshes || []).push(m); }
  }
  batches.clear();
}
function boxUV(g, w, h, d, s) {
  const uv = g.attributes.uv, dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let f = 0; f < 6; f++) for (let k = 0; k < 4; k++) { const i = f * 4 + k; uv.setXY(i, uv.getX(i) * dims[f][0] / s, uv.getY(i) * dims[f][1] / s); }
}
function addCol(x0, x1, y0, y1, z0, z1) { const c = { x0: Math.min(x0, x1), x1: Math.max(x0, x1), y0, y1, z0: Math.min(z0, z1), z1: Math.max(z0, z1), on: true }; cols.push(c); return c; }
function box(x0, x1, y0, y1, z0, z1, mat, o = {}) {
  if (x1 < x0) [x0, x1] = [x1, x0]; if (z1 < z0) [z0, z1] = [z1, z0]; if (y1 < y0) [y0, y1] = [y1, y0];
  const w = x1 - x0, h = y1 - y0, d = z1 - z0; if (w <= 0 || h <= 0 || d <= 0) return;
  const g = new THREE.BoxGeometry(w, h, d); boxUV(g, w, h, d, o.uv ?? mat.userData.uv ?? 1);
  g.translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
  if (o.mesh) { const m = new THREE.Mesh(g, mat); m.castShadow = o.cast ?? true; m.receiveShadow = true; scene.add(m); if (o.col) addCol(x0, x1, y0, y1, z0, z1); return m; }
  addGeo(g, mat, o.cast ?? Math.min(w, h, d) >= .03);
  if (o.col !== false) addCol(x0, x1, y0, y1, z0, z1);
}
// 変換行列付きの箱（コライダーなし）
function boxM(x0, x1, y0, y1, z0, z1, M4, mat, o = {}) {
  const w = x1 - x0, h = y1 - y0, d = z1 - z0; if (w <= 0 || h <= 0 || d <= 0) return;
  const g = new THREE.BoxGeometry(w, h, d); boxUV(g, w, h, d, o.uv ?? mat.userData.uv ?? 1);
  g.translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2); g.applyMatrix4(M4); addGeo(g, mat, o.cast ?? true);
}
function orientedBox(center, ax, ay, az, sx, sy, sz, mat, o = {}) {
  if (new V3().crossVectors(ax, ay).dot(az) < 0) ax = ax.clone().negate();
  const g = new THREE.BoxGeometry(sx, sy, sz); boxUV(g, sx, sy, sz, o.uv ?? mat.userData.uv ?? 1);
  const m4 = new THREE.Matrix4().makeBasis(ax, ay, az).setPosition(center); if (o.M) m4.premultiply(o.M);
  g.applyMatrix4(m4); addGeo(g, mat, o.cast ?? true);
}
function beam(a, b, t, mat, o = {}) {
  const dir = new V3().subVectors(b, a), len = dir.length(); if (len < 1e-4) return; dir.divideScalar(len);
  const up = Math.abs(dir.y) > .95 ? new V3(1, 0, 0) : new V3(0, 1, 0);
  const ax = new V3().crossVectors(up, dir).normalize(), ay = new V3().crossVectors(dir, ax);
  orientedBox(new V3().addVectors(a, b).multiplyScalar(.5), ax, ay, dir, o.w ?? t, t, len, mat, o);
}
function cyl(x, y0, y1, z, r, mat, o = {}) {
  const g = new THREE.CylinderGeometry(o.r2 ?? r, r, y1 - y0, o.seg ?? 12, 1, false); g.translate(x, (y0 + y1) / 2, z);
  if (o.M) g.applyMatrix4(o.M); addGeo(g, mat, o.cast ?? true);
  if (o.col) addCol(x - r, x + r, y0, y1, z - r, z + r);
}
function surf(x0, x1, z0, z1, y) { surfs.push({ x0: Math.min(x0, x1), x1: Math.max(x0, x1), z0: Math.min(z0, z1), z1: Math.max(z0, z1), y }); }
function ramp(x0, x1, z0, z1, axis, ya, yb) { surfs.push({ x0: Math.min(x0, x1), x1: Math.max(x0, x1), z0: Math.min(z0, z1), z1: Math.max(z0, z1), ramp: axis, ya, yb }); }
// 開口付きの壁。axis='x' → x方向に伸びる壁（厚みは z）
function wall(axis, c0, c1, a0, a1, y0, y1, holes, mat, o = {}) {
  const seg = (a, b, ya, yb, col) => { if (b - a < 1e-3 || yb - ya < 1e-3) return; if (axis === 'x') box(a, b, ya, yb, c0, c1, mat, { col: col && o.col !== false, cast: o.cast }); else box(c0, c1, ya, yb, a, b, mat, { col: col && o.col !== false, cast: o.cast }); };
  const hs = (holes || []).slice().sort((p, q) => p.a - q.a); let cur = a0;
  // 同じ位置に縦に並んだ開口（各階の扉など）はまとめて処理する
  const groups = []; for (const h of hs) { const gr = groups.find(q => q.a === h.a && q.b === h.b); if (gr) gr.list.push(h); else groups.push({ a: h.a, b: h.b, list: [h] }); }
  for (const gr of groups) {
    seg(cur, gr.a, y0, y1, true);
    let yc = y0; for (const h of gr.list.sort((p, q) => p.y0 - q.y0)) { seg(gr.a, gr.b, yc, h.y0, true); yc = h.y1; if (!h.pass && o.col !== false) { if (axis === 'x') addCol(h.a, h.b, h.y0, h.y1, c0, c1); else addCol(c0, c1, h.y0, h.y1, h.a, h.b); } }
    seg(gr.a, gr.b, yc, y1, true);
    cur = gr.b;
  }
  seg(cur, a1, y0, y1, true);
}
// 平面の貼り物（看板・ポスターなど）
function decal(texture, w, h, pos, rotY, o = {}) {
  const mat = new THREE.MeshStandardMaterial({ map: texture, roughness: o.rough ?? .8, transparent: o.transparent ?? false, emissive: o.emissive ?? 0x000000, emissiveMap: o.emissive ? texture : null, emissiveIntensity: o.ei ?? 1, side: o.side ?? THREE.FrontSide, polygonOffset: true, polygonOffsetFactor: -2 });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat); m.position.copy(pos); m.rotation.y = rotY; if (o.rotX) m.rotation.x = o.rotX;
  m.receiveShadow = true; scene.add(m); return m;
}
function stairsZ(x0, x1, zs, ze, ys, ye, n, mat, solid) {
  for (let i = 0; i < n; i++) {
    const za = zs + (ze - zs) * i / n, zb = zs + (ze - zs) * (i + 1) / n, top = ys + (ye - ys) * (i + 1) / n;
    box(x0, x1, solid ? 0 : top - .32, top, za, zb, mat, { col: false });
    box(x0, x1, top - .005, top + .003, zb - (ze - zs) / n * .12, zb, MT.rail, { col: false, cast: false });
  }
}
function interactable(mesh, def) { mesh.userData.it = def; W.interact.push(mesh); return mesh; }
function hitProxy(x0, x1, y0, y1, z0, z1, def) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0), new THREE.MeshBasicMaterial({ visible: false }));
  m.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2); scene.add(m); return interactable(m, def);
}

// ============================================================
// 道路・地面
// ============================================================
function buildGround() {
  // 地面（泉南駅の地下部分だけ穴をあける）
  const gp = (x0, x1, z0, z1) => { const g = new THREE.PlaneGeometry(x1 - x0, z1 - z0); g.rotateX(-Math.PI / 2); const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * (x1 - x0) / 3, uv.getY(i) * (z1 - z0) / 3); g.translate((x0 + x1) / 2, -0.01, (z0 + z1) / 2); addGeo(g, MT.soil, false); };
  gp(-350, 350, -58.3, 350); gp(-350, 350, -350, -86); gp(-350, -80, -86, -58.3); gp(-54, 350, -86, -58.3);
  TX.lid = pixTex(256, (x, y) => { const n = (hash2(x >> 1, y >> 1) - .5) * 18; const j = (y % 128 < 3) ? -45 : 0; const e = (x < 4 || x > 251) ? -25 : 0; return [150 + n + j + e, 148 + n + j + e, 142 + n + j + e]; });
  MT.lid = M({ map: TX.lid, uv: 1.2, bump: 1 });
  const road = (x0, x1, z0, z1) => { box(x0, x1, -0.02, 0.0, z0, z1, MT.asphalt, { col: false, cast: false }); };
  // 東側の道（南北）: x -9.1〜-4.35
  road(-9.1, -4.35, -60, 9.1);
  // 北側の道（東西）: z 4.35〜9.1
  road(-24, 60, 4.35, 9.1);
  // 南の広い道（先は次の段階）
  // 側溝のふた
  box(-9.45, -9.1, -0.02, 0.02, -46, 3.9, MT.lid, { col: false, cast: false });
  box(-4.35, -4.0, -0.02, 0.02, -46, 4.35, MT.lid, { col: false, cast: false, uv: 1.2 });
  box(-24, 60, -0.02, 0.02, 9.1, 9.45, MT.lid, { col: false, cast: false });
  box(-24, -9.45, -0.02, 0.02, 4.0, 4.35, MT.lid, { col: false, cast: false });
  box(30, 60, -0.02, 0.02, 4.0, 4.35, MT.lid, { col: false, cast: false });
  // 白線
  const white = M({ color: 0xdedcd2, rough: .7 });
  box(-8.85, -8.75, 0, 0.004, -46, 4.35, white, { col: false, cast: false });
  box(-4.7, -4.6, 0, 0.004, -46, 4.35, white, { col: false, cast: false });
  box(-9.1, 60, 0, 0.004, 8.75, 8.85, white, { col: false, cast: false });
  box(-4.35, 60, 0, 0.004, 4.6, 4.7, white, { col: false, cast: false });
  box(-8.75, -4.7, 0, 0.004, 1.6, 1.9, white, { col: false, cast: false }); // 停止線
  const tomare = labelTex(512, 256, (g, w, h) => { g.fillStyle = 'rgba(0,0,0,0)'; g.fillRect(0, 0, w, h); g.fillStyle = '#e2dfd4'; g.font = `bold 200px ${GOTH}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('止まれ', w / 2, h / 2 + 10); });
  const tm = decal(tomare, 3.4, 2.4, new V3(-6.7, 0.006, -0.4), 0, { transparent: true, rotX: -Math.PI / 2 }); tm.rotation.set(-Math.PI / 2, 0, Math.PI);
  // マンホール
  const mh = labelTex(256, 256, (g, w) => { g.fillStyle = '#3a3a3a'; g.beginPath(); g.arc(128, 128, 126, 0, 7); g.fill(); g.strokeStyle = '#5a5854'; g.lineWidth = 5; for (let r = 20; r < 120; r += 18) { g.beginPath(); g.arc(128, 128, r, 0, 7); g.stroke(); } for (let a = 0; a < 16; a++) { g.beginPath(); g.moveTo(128, 128); g.lineTo(128 + Math.cos(a / 16 * 6.283) * 120, 128 + Math.sin(a / 16 * 6.283) * 120); g.stroke(); } g.fillStyle = '#6a6862'; g.font = `bold 30px ${GOTH}`; g.textAlign = 'center'; g.fillText('下水', 128, 138); });
  for (const [x, z] of [[-6.7, -20], [12, 6.7], [-6.7, -38]]) decal(mh, .64, .64, new V3(x, 0.005, z), 0, { transparent: true, rotX: -Math.PI / 2 });
}

// ============================================================
// 敷地（駐車場・駐輪場・自販機）
// ============================================================
function buildLot() {
  box(-4, 30, -0.02, 0.01, 1.4, 4.0, MT.pave, { col: false, cast: false });
  box(-4, -2.75, -0.02, 0.01, -24, 1.4, MT.pave, { col: false, cast: false });
  box(28, 30, -0.02, 0.01, -11.2, 1.4, MT.pave, { col: false, cast: false });
  box(-2.75, 30, -0.02, 0.008, -24, -11.2, MT.asphalt, { col: false, cast: false });
  const white = M({ color: 0xdedcd2, rough: .7 });
  for (let i = 0; i < 7; i++) { const x = 1 + i * 3.6; box(x, x + .1, 0.008, 0.012, -23.5, -18.5, white, { col: false, cast: false }); }
  // 敷地の塀
  const bw = (x0, x1, z0, z1, h = 1.4) => { box(x0, x1, 0, h, z0, z1, MT.block); box(x0 - .02, x1 + .02, h, h + .06, z0 - .02, z1 + .02, MT.concrete, { col: false }); };
  bw(-4.15, -4.0, -24, -14); bw(-4.15, -4.0, -9, -1.2);
  bw(-4.15, 30.15, -24.15, -24); bw(30, 30.15, -24, 4.0);
  // 門柱と館名板
  box(-3.95, -3.35, 0, 1.25, 3.65, 3.95, MT.tile);
  const nameT = labelTex(512, 128, (g, w, h) => { g.fillStyle = '#2d2a26'; g.fillRect(0, 0, w, h); g.fillStyle = '#d9d2bf'; g.font = `64px ${MIN}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('和泉コーポ', w / 2, h / 2 + 4); });
  decal(nameT, .56, .14, new V3(-3.65, 1.0, 3.955), 0);
  // 植え込み
  box(7, 23, 0, 0.35, 3.45, 3.95, MT.block);
  fallback(() => { for (let x = 7.3; x < 23; x += .9) { const g = new THREE.IcosahedronGeometry(R(.45, .6), 1); g.scale(1, .8, .9); g.translate(x, .75, 3.7); addGeo(g, MT.hedge); } });
  for (let x = 7.5; x < 23; x += 1.05) PROPS.hedges.push([x, 3.7]);
  addCol(7, 23, 0, 1.1, 3.45, 3.95);
  // 車止め
  for (let x = 25; x < 30; x += 1.5) cyl(x, 0, .8, 3.8, .06, M({ color: 0xd0c040, rough: .5 }), { col: true });
  // 駐輪場
  const roofM = M({ color: 0x8b958f, rough: .5, metal: .5 });
  for (const x of [1, 6]) for (const z of [2.1, 3.8]) cyl(x, 0, 2.2, z, .04, MT.railLight, { col: true });
  box(.8, 6.2, 2.2, 2.25, 1.9, 4.0, roofM, { col: false });
  for (let i = 0; i < 4; i++) bicycle(1.6 + i * 1.1, 2.9, Math.PI / 2 + R(-.1, .1), pick([0x8a2a2a, 0x2a4a8a, 0xc8c8c0, 0x3a3a3a]));
  // 自販機
  vending(-3.6, 3.27, -Math.PI / 2);
  // 駐車場の車
  car(4.8, -21, 0, 0xc8c8c4); car(12, -21, 0, 0x2b3a55); car(22.8, -21, 0, 0x9a2d2a);
  // 自転車（壁際）
  bicycle(-3.5, -6, 0, 0x406040);
}
function bicycle(x, z, rot, color) {
  const Mx = new THREE.Matrix4().makeRotationY(rot).setPosition(x, 0, z);
  const fm = M({ color, rough: .4, metal: .5 });
  for (const zz of [-.52, .52]) { const g = new THREE.TorusGeometry(.33, .025, 6, 20); g.rotateY(Math.PI / 2); g.translate(0, .35, zz); g.applyMatrix4(Mx); addGeo(g, MT.black); }
  const P = (a, b, c) => new V3(a, b, c).applyMatrix4(Mx);
  beam(P(0, .35, -.52), P(0, .72, -.05), .03, fm); beam(P(0, .72, -.05), P(0, .75, .45), .03, fm); beam(P(0, .35, -.52), P(0, .38, .1), .03, fm); beam(P(0, .38, .1), P(0, .75, .45), .03, fm);
  beam(P(0, .35, .52), P(0, .9, .42), .03, fm); beam(P(-.25, .95, .4), P(.25, .95, .4), .025, MT.alu);
  beam(P(0, .72, -.1), P(0, .86, -.14), .02, fm); boxM(-.08, .08, .86, .92, -.26, -.02, Mx, MT.black);
  boxM(-.16, .16, .72, .9, .48, .72, Mx, MT.railLight); // かご
}
function car(x, z, rot, color) {
  const Mx = new THREE.Matrix4().makeRotationY(rot).setPosition(x, 0, z);
  const body = M({ color, rough: .3, metal: .6 });
  boxM(-.85, .85, .3, .95, -2.1, 2.1, Mx, body); boxM(-.8, .8, .95, 1.45, -1.1, .9, Mx, body);
  boxM(-.78, .78, 1.0, 1.4, .88, .93, Mx, MT.darkGlass); boxM(-.78, .78, 1.0, 1.4, -1.13, -1.08, Mx, MT.darkGlass);
  boxM(-.82, -.78, 1.0, 1.4, -1.0, .8, Mx, MT.darkGlass); boxM(.78, .82, 1.0, 1.4, -1.0, .8, Mx, MT.darkGlass);
  for (const [a, b] of [[-.8, 1.35], [.8, 1.35], [-.8, -1.35], [.8, -1.35]]) { const g = new THREE.CylinderGeometry(.3, .3, .2, 14); g.rotateZ(Math.PI / 2); g.translate(a, .3, b); g.applyMatrix4(Mx); addGeo(g, MT.black); }
  const c = [new V3(-.9, 0, -2.2), new V3(.9, 0, 2.2)].map(v => v.applyMatrix4(Mx)); addCol(c[0].x, c[1].x, 0, 1.45, c[0].z, c[1].z);
}
function vending(x, z, rot) {
  const Mx = new THREE.Matrix4().makeRotationY(rot).setPosition(x, 0, z);
  const body = M({ color: 0xd8dce0, rough: .35, metal: .2 });
  boxM(-.37, .37, 0, 1.83, -.35, .35, Mx, body);
  const face = labelTex(256, 512, (g, w, h) => {
    g.fillStyle = '#f4f6f6'; g.fillRect(0, 0, w, h); const cols = ['#b22', '#246', '#d80', '#263', '#fff', '#842', '#39c', '#c33'];
    for (let r = 0; r < 3; r++) for (let c = 0; c < 6; c++) { const cx = 22 + c * 38, cy = 40 + r * 92; g.fillStyle = cols[(r * 6 + c) % 8]; g.fillRect(cx - 12, cy, 24, 50); g.fillStyle = 'rgba(255,255,255,.5)'; g.fillRect(cx - 9, cy + 4, 4, 42); g.fillStyle = '#e22'; g.fillRect(cx - 14, cy + 58, 28, 10); g.fillStyle = '#fff'; g.font = '9px sans-serif'; g.textAlign = 'center'; g.fillText('110', cx, cy + 66); }
    g.fillStyle = '#1b3c7a'; g.fillRect(0, 300, w, 60); g.fillStyle = '#fff'; g.font = `bold 30px ${GOTH}`; g.textAlign = 'center'; g.fillText('つめた〜い', w / 2, 342);
    g.fillStyle = '#333'; g.fillRect(40, 400, 176, 70); g.fillStyle = '#111'; g.fillRect(50, 410, 156, 50);
  });
  const fm = new THREE.MeshStandardMaterial({ map: face, emissive: 0xffffff, emissiveMap: face, emissiveIntensity: .42, roughness: .3 });
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(.66, 1.32), fm); plane.position.set(0, 1.08, .352).applyMatrix4(Mx); plane.rotation.y = rot; scene.add(plane);
  const p = new V3(0, 0, 0).applyMatrix4(Mx); addCol(p.x - .38, p.x + .38, 0, 1.83, p.z - .38, p.z + .38);
  W.vending = { pos: new V3(0, 1.0, .6).applyMatrix4(Mx), mat: fm };
  interactable(plane, { label: () => 'ジュースを買う（110円）', act: () => G.buyJuice() });
  const vl = new THREE.PointLight(0xe8f4ff, .9, 3.5, 2); vl.position.copy(W.vending.pos); scene.add(vl); W.vendingLight = vl;
}

// ============================================================
// マンション（和泉コーポ）
// ============================================================
const FLR = [0.1, 2.8, 5.6];
function buildMansion() {
  // 共用廊下の床とスラブ
  box(0, 28, 0, 0.1, 0, 1.4, MT.pave, { col: false });
  surf(0, 28, 0, 1.4, 0.1);
  for (const k of [1, 2, 3]) { const y = k * 2.8; box(0, 28, y - .2, y, -11.2, 1.4, MT.slab, { col: false }); }
  surf(0, 28, 0, 1.4, 2.8); surf(0, 28, 0, 1.4, 5.6);
  for (const y of [2.8, 5.6]) box(0, 28, y, y + .004, 1.02, 1.25, M({ color: 0x55605a, rough: .6 }), { col: false, cast: false });
  // 北面の外壁（203の玄関だけ本物の開口）
  wall('x', -0.15, 0, 0, 28, 0, 8.4, [{ a: 14.5, b: 15.18, y0: 2.8, y1: 4.85, pass: true }], MT.paint, { col: false });
  // 住戸のコライダー
  addCol(0, 28, 0, 2.72, -11.2, 0);
  addCol(0, 14.1, 2.72, 5.5, -11.2, 0); addCol(20.85, 28, 2.72, 5.5, -11.2, 0); addCol(14.1, 20.85, 2.72, 5.5, -11.2, -9.8);
  addCol(14.1, 14.5, 2.8, 5.4, -0.2, 0); addCol(15.18, 20.85, 2.8, 5.4, -0.2, 0);
  addCol(0, 28, 5.52, 8.4, -11.2, 0);
  // 妻壁・南面
  box(-0.0, 0.15, 0, 8.4, -10, 0, MT.tile, { col: false }); box(27.85, 28, 0, 8.4, -10, 0, MT.tile, { col: false });
  box(0, 28, 0, 8.4, -10, -9.85, MT.tile, { col: false });
  wall('z', 27.85, 28, 0, 1.4, 0, 8.4, FLR.map(f => ({ a: .2, b: 1.1, y0: f, y1: f + 2.05, pass: true })), MT.paint);
  // 手すり壁
  for (const y of [2.8, 5.6]) { box(0, 27.85, y, y + 1.05, 1.25, 1.4, MT.paint); box(0, 27.85, y + 1.05, y + 1.1, 1.2, 1.45, MT.paintDark, { col: false }); }
  box(0, 28, 8.4, 9.0, 1.25, 1.4, MT.paint, { col: false });
  // 柱
  for (const x of [7, 14, 21]) box(x - .18, x + .18, 0, 8.4, 1.1, 1.62, MT.paint);
  // 住戸ごとの外観
  const numT = {};
  for (let k = 0; k < 3; k++) for (let u = 0; u < 4; u++) {
    const x0 = u * 7, f = FLR[k], num = `${k + 1}0${u + 1}`, is203 = (k === 1 && u === 2);
    // 玄関扉
    const dm = [MT.steelDoor, MT.steelDoor2, MT.steelDoor3][(k + u) % 3];
    if (!is203) { box(x0 + .5, x0 + 1.18, f, f + 2.02, 0, 0.035, dm, { col: false }); box(x0 + 1.04, x0 + 1.12, f + 0.95, f + 1.0, 0.035, 0.08, MT.alu, { col: false }); hitProxy(x0 + .5, x0 + 1.18, f, f + 2.02, 0, .08, { label: () => '玄関', act: () => G.thought(pick(['知らない家だ。', '表札の名前は、読めなかった。', '中から、テレビの音がする。']), undefined, 'ティロッ') }); }
    box(x0 + .45, x0 + .5, f, f + 2.07, 0, .06, MT.alu, { col: false }); box(x0 + 1.18, x0 + 1.23, f, f + 2.07, 0, .06, MT.alu, { col: false }); box(x0 + .45, x0 + 1.23, f + 2.02, f + 2.07, 0, .06, MT.alu, { col: false });
    // 部屋番号
    const nt = labelTex(128, 64, (g, w, h) => { g.fillStyle = '#e8e4d8'; g.fillRect(0, 0, w, h); g.fillStyle = '#222'; g.font = `bold 40px ${GOTH}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(num, w / 2, h / 2 + 2); });
    decal(nt, .16, .08, new V3(x0 + .84, f + 2.2, .005), 0);
    // メーターボックス
    box(x0 + 1.4, x0 + 2.0, f + .25, f + 2.0, 0, .03, MT.steelDoor, { col: false });
    for (let j = 0; j < 6; j++) box(x0 + 1.48, x0 + 1.92, f + 1.6 + j * .05, f + 1.62 + j * .05, .03, .04, MT.rail, { col: false, cast: false });
    // 面格子付きの窓
    const wx0 = x0 + 2.8, wx1 = x0 + 4.8, wy0 = f + 1.05, wy1 = f + 2.05;
    const gm = is203 ? (MT.friendWinExt = M({ color: 0xc8d0d4, rough: .3, metal: .1, emissive: 0x000000 })) : (rng() < .5 ? MT.frostedA : MT.frosted);
    box(wx0, wx1, wy0, wy1, 0, .02, gm, { col: false, cast: false });
    box(wx0 - .04, wx1 + .04, wy0 - .04, wy0, 0, .06, MT.alu, { col: false }); box(wx0 - .04, wx1 + .04, wy1, wy1 + .04, 0, .06, MT.alu, { col: false });
    box(wx0 - .04, wx0, wy0, wy1, 0, .06, MT.alu, { col: false }); box(wx1, wx1 + .04, wy0, wy1, 0, .06, MT.alu, { col: false }); box((wx0 + wx1) / 2 - .02, (wx0 + wx1) / 2 + .02, wy0, wy1, 0, .05, MT.alu, { col: false });
    for (let j = 0; j <= 9; j++) { const x = wx0 + j * (wx1 - wx0) / 9; box(x - .012, x + .012, wy0 - .08, wy1 + .08, .1, .125, MT.railLight, { col: false }); }
    box(wx0 - .05, wx1 + .05, wy0 - .1, wy0 - .07, 0, .13, MT.railLight, { col: false }); box(wx0 - .05, wx1 + .05, wy1 + .07, wy1 + .1, 0, .13, MT.railLight, { col: false });
    // 廊下の照明
    const ly = k === 0 ? 2.52 : f + 2.52;
    box(x0 + 3.2, x0 + 3.8, ly, ly + .08, .6, .75, MT.lampCorr, { col: false, cast: false });
    // 南面：掃き出し窓・ベランダ
    const sx0 = x0 + 1.6, sx1 = x0 + 6.6, sy0 = f + .1, sy1 = f + 2.1;
    const sg = is203 ? (MT.livingWin = M({ color: 0x3a4550, rough: .15, metal: .6, emissive: 0x000000, emap: TX.lace })) : (rng() < .45 ? MT.glassA : MT.glassB);
    box(sx0, sx1, sy0, sy1, -10.03, -10.0, sg, { col: false, cast: false });
    box(sx0 - .05, sx1 + .05, sy1, sy1 + .05, -10.06, -10, MT.alu, { col: false }); box(sx0 - .05, sx1 + .05, sy0 - .05, sy0, -10.06, -10, MT.alu, { col: false });
    for (const xx of [sx0, (sx0 + sx1) / 2, sx1]) box(xx - .03, xx + .03, sy0, sy1, -10.06, -10, MT.alu, { col: false });
    if (k > 0) {
      box(x0 + .5, x0 + 1.3, f, f + .6, -10.9, -10.62, MT.ac, { col: false }); decal(TX.grille, .42, .42, new V3(x0 + .82, f + .3, -10.905), Math.PI);
      beam(new V3(x0 + 1.5, f + 1.95, -10.75), new V3(x0 + 6.5, f + 1.95, -10.75), .03, MT.alu);
      if (rng() < .7) for (let j = 0; j < RI(2, 5); j++) { const xx = x0 + 2 + j * .9 + R(0, .3); box(xx, xx + .5, f + 1.25, f + 1.93, -10.76, -10.74, pick(MT.cloth), { col: false }); }
    }
  }
  // ベランダの手すり壁と隔て板
  for (const k of [1, 2]) { const f = FLR[k]; box(0, 28, f, f + 1.05, -11.2, -11.05, MT.paint, { col: false }); box(0, 28, f + 1.05, f + 1.1, -11.25, -11.0, MT.paintDark, { col: false }); for (const x of [7, 14, 21]) box(x - .02, x + .02, f, f + 2.1, -11.05, -10, M({ color: 0xd8d4c8, rough: .6 }), { col: false }); }
  box(0, 28, 0, 1.0, -11.2, -11.15, MT.fence, { col: false });
  // 布団が干してある
  box(1.2, 2.8, 6.2, 6.9, -11.35, -11.0, MT.cloth[4], { col: false });
  // 屋上
  box(0, 28, 8.4, 9.0, -10, -9.85, MT.paint, { col: false }); box(0, .15, 8.4, 9.0, -10, 1.4, MT.paint, { col: false }); box(27.85, 28, 8.4, 9.0, -10, 1.4, MT.paint, { col: false });
  for (const [x, z] of [[19.3, -6.7], [22.7, -6.7], [19.3, -3.3], [22.7, -3.3]]) beam(new V3(x, 8.4, z), new V3(x, 9.4, z), .12, MT.rail);
  box(19, 23, 9.4, 11.3, -7, -3, MT.frp, { col: false });
  for (let i = 0; i < 6; i++) { const x = R(3, 26), z = R(-8, -1); beam(new V3(x, 8.4, z), new V3(x, 11 + R(0, 1.5), z), .04, MT.railLight); for (let j = 0; j < 6; j++) beam(new V3(x - .35, 10.4 + R(0, .8), z + (j - 2.5) * .15), new V3(x + .35, 10.4 + R(0, .8) * 0, z + (j - 2.5) * .15), .012, MT.railLight); }
  beam(new V3(1, 8.4, -1), new V3(1, 13, -1), .03, MT.railLight);
  // 1階の郵便受け・掲示板（階段下の壁面）
  const mb = labelTex(256, 128, (g, w, h) => { g.fillStyle = '#9aa0a0'; g.fillRect(0, 0, w, h); for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++) { const x = 6 + c * 62, y = 6 + r * 40; g.fillStyle = '#b8bcbc'; g.fillRect(x, y, 58, 36); g.fillStyle = '#333'; g.fillRect(x + 8, y + 6, 42, 4); g.fillStyle = '#eee'; g.fillRect(x + 36, y + 20, 18, 10); g.fillStyle = '#222'; g.font = '9px sans-serif'; g.fillText(`${r + 1}0${c + 1}`, x + 38, y + 29); } });
  box(-1.2, -0.05, .8, 1.5, 1.4, 1.62, MT.alu, { col: false }); decal(mb, 1.15, .7, new V3(-.625, 1.15, 1.625), 0);
  const board = labelTex(512, 320, (g, w, h) => { g.fillStyle = '#6a4a2a'; g.fillRect(0, 0, w, h); g.fillStyle = '#c9b48a'; g.fillRect(12, 12, w - 24, h - 24); const P = (x, y, ww, hh, rot, lines) => { g.save(); g.translate(x, y); g.rotate(rot); g.fillStyle = '#f2efe4'; g.fillRect(0, 0, ww, hh); g.fillStyle = '#222'; g.font = `14px ${GOTH}`; lines.forEach((l, i) => g.fillText(l, 8, 22 + i * 18)); g.restore(); }; P(30, 30, 200, 120, -.03, ['お知らせ', 'ゴミは朝8時までに', '指定の場所へ', '管理組合']); P(260, 26, 210, 150, .02, ['断水のお知らせ', '8月21日(木)', '10時〜15時', '受水槽清掃のため']); P(60, 170, 190, 110, .04, ['自転車は', '所定の場所へ', 'お願いします']); P(290, 190, 170, 90, -.02, ['盆踊り大会', '町会']); });
  const bd = decal(board, 1.1, .69, new V3(-.625, 2.05, 1.625), 0);
  interactable(bd, { label: () => '掲示板を読む', act: () => G.notice('掲示板', 'ゴミは朝8時までに、指定の場所へ。<br>断水のお知らせ　8月21日（木）10時〜15時　受水槽清掃のため。<br>自転車は所定の場所へお願いします。<br>盆踊り大会のお知らせ（町会）<br><span style="color:#777">……紙の端が日に焼けて、丸まっている。</span>') });
  // たて樋・ガス管
  for (const x of [6.7, 13.7, 20.7]) beam(new V3(x, 9, 1.66), new V3(x, 0, 1.66), .08, MT.gutters[1], { cast: false });
  for (const x of [.4, 27.6]) beam(new V3(x, 9, -10.08), new V3(x, 0, -10.08), .09, MT.gutters[1], { cast: false });
  for (let k = 0; k < 3; k++) beam(new V3(0, FLR[k] + 2.35, .06), new V3(27.8, FLR[k] + 2.35, .06), .03, M({ color: 0xc8b048, rough: .5, metal: .3 }), { cast: false });
  // 玄関先の小物（傘・三輪車・植木鉢）
  for (const [x, y] of [[1.4, 2.8], [8.3, 5.6], [22.4, 2.8], [8.2, 0.1]]) { fallback(() => { cyl(x, y, y + .3, .35, .13, MT.pot, { r2: .16, seg: 10 }); const gg = new THREE.IcosahedronGeometry(.25, 1); gg.translate(x, y + .5, .35); addGeo(gg, MT.leaf[1]); }); PROPS.pots.push({ x, y, z: .35 }); }
  beam(new V3(21.8, 2.8, .1), new V3(21.84, 3.7, .12), .025, M({ color: 0x3a5a9a, rough: .6 }), { cast: false });
  buildStairs();
}
function W_doorProxy(x0, x1, y0, y1) { return hitProxy(x0, x1, y0, y1, 0, .08, {}); }

function buildStairs() {
  const C = MT.concrete;
  const bands = []; for (let k = 0; k < 3; k++) bands.push({ a: -3.6, b: 0.9, y0: k * 2.8 + 1.35, y1: k * 2.8 + 2.4, pass: false });
  wall('z', -2.75, -2.6, -4.15, 1.4, 0, 8.4, bands, C);
  wall('x', -4.15, -4.0, -2.75, 0, 0, 8.4, [{ a: -2.3, b: -.4, y0: 2.2, y1: 3.0, pass: false }, { a: -2.3, b: -.4, y0: 5.0, y1: 5.8, pass: false }], C);
  box(-1.35, -1.25, 0, 8.4, -2.6, 0.2, C);
  box(-1.25, 0, 0, 1.38, -2.6, 1.4, C); box(-1.25, 0, 1.38, 2.6, 1.25, 1.4, C, { col: false });
  // 踊り場・スラブ
  box(-2.6, 0, 1.2, 1.4, -4, -2.6, C, { col: false }); surf(-2.6, 0, -4, -2.6, 1.4);
  box(-2.6, 0, 2.6, 2.8, 0.2, 1.4, C, { col: false }); surf(-2.6, 0, 0.2, 1.4, 2.8);
  box(-2.6, 0, 4.0, 4.2, -4, -2.6, C, { col: false }); surf(-2.6, 0, -4, -2.6, 4.2);
  box(-2.6, 0, 5.4, 5.6, 0.2, 1.4, C, { col: false }); surf(-2.6, 0, 0.2, 1.4, 5.6);
  box(-2.75, 0, 8.2, 8.4, -4.15, 1.4, C, { col: false });
  // 手すり壁
  for (const y of [2.8, 5.6]) box(-2.6, 0, y, y + 1.1, 1.25, 1.4, MT.paint);
  // 階段
  stairsZ(-2.6, -1.35, 1.4, -2.6, 0, 1.4, 8, C, true); ramp(-2.6, -1.35, -2.6, 1.4, 'z', 1.4, 0);
  stairsZ(-1.25, 0, -2.6, 0.2, 1.4, 2.8, 8, C, false); ramp(-1.25, 0, -2.6, 0.2, 'z', 1.4, 2.8);
  stairsZ(-2.6, -1.35, 0.2, -2.6, 2.8, 4.2, 8, C, false); ramp(-2.6, -1.35, -2.6, 0.2, 'z', 4.2, 2.8);
  stairsZ(-1.25, 0, -2.6, 0.2, 4.2, 5.6, 8, C, false); ramp(-1.25, 0, -2.6, 0.2, 'z', 4.2, 5.6);
  // 手すり
  const hr = (x, z0, y0, z1, y1) => beam(new V3(x, y0 + .85, z0), new V3(x, y1 + .85, z1), .045, MT.railLight);
  hr(-2.56, 1.4, 0, -2.6, 1.4); hr(-.2, -2.6, 1.4, .2, 2.8); hr(-2.56, .2, 2.8, -2.6, 4.2); hr(-.2, -2.6, 4.2, .2, 5.6);
  // 階段の照明
  for (const [y, z] of [[2.55, -3.3], [5.35, -3.3], [5.35, .8], [8.15, .8]]) box(-1.6, -1.0, y, y + .07, z - .08, z + .08, MT.lampCorr, { col: false, cast: false });
}

// ============================================================
// 203号室（梅崎家）
// ============================================================
function buildUnit203() {
  const WP = MT.wallpaper, Y0 = 2.8, YF = 2.95, YC = 5.35;
  // 内装の壁
  wall('x', -0.2, -0.15, 14.15, 20.8, Y0, YC, [{ a: 14.5, b: 15.18, y0: Y0, y1: 4.85, pass: true }], WP, { col: false });
  wall('x', -9.85, -9.8, 14.15, 20.8, Y0, YC, [], WP, { col: false });
  box(14.1, 14.15, Y0, YC, -9.85, -0.15, WP, { col: false }); box(20.8, 20.85, Y0, YC, -9.85, -0.15, WP, { col: false });
  wall('z', 15.2, 15.3, -9.8, -0.2, Y0, YC, [{ a: -2.25, b: -1.45, y0: Y0, y1: 4.85, pass: true }, { a: -4.65, b: -3.85, y0: Y0, y1: 4.85, pass: false }], WP);
  wall('x', -3.45, -3.35, 15.3, 20.8, Y0, YC, [], WP);
  wall('x', -5.75, -5.65, 15.3, 20.8, Y0, YC, [], WP);
  wall('x', -8.7, -8.6, 14.15, 15.2, Y0, YC, [{ a: 14.35, b: 15.0, y0: Y0, y1: 4.85, pass: true }], WP);
  // 床
  box(14.15, 15.2, Y0, 2.81, -1.1, -0.2, MT.genkan, { col: false }); surf(14.15, 15.2, -1.1, -0.2, 2.81); surf(14.5, 15.18, -0.2, 0, 2.81);
  box(14.15, 15.2, Y0, YF, -1.18, -1.1, MT.furn, { col: false });
  box(14.15, 15.2, Y0, YF, -8.6, -1.18, MT.wood, { col: false }); surf(14.15, 15.2, -8.6, -1.1, YF);
  box(15.2, 20.8, Y0, YF, -3.35, -0.2, MT.carpet, { col: false }); surf(15.2, 20.8, -3.35, -0.2, YF);
  box(15.3, 20.8, Y0, YF, -5.65, -3.45, MT.tatami, { col: false });
  box(15.3, 20.8, Y0, YF, -9.8, -5.75, MT.tatami, { col: false });
  box(14.15, 15.2, Y0, 2.97, -9.8, -8.6, MT.toiletFloor, { col: false }); surf(14.15, 15.2, -9.8, -8.6, 2.97);
  box(14.15, 20.8, YC, YC + .05, -9.8, -0.2, MT.ceiling, { col: false });
  // 巾木
  const hb = MT.furnDark;
  box(14.15, 14.17, YF, YF + .07, -8.6, -1.1, hb, { col: false }); box(15.18, 15.2, YF, YF + .07, -8.6, -1.1, hb, { col: false });
  box(15.3, 20.8, YF, YF + .07, -0.22, -0.2, hb, { col: false }); box(15.3, 20.8, YF, YF + .07, -3.35, -3.33, hb, { col: false }); box(20.78, 20.8, YF, YF + .07, -3.35, -0.2, hb, { col: false });
  // トイレの腰壁タイル
  box(14.15, 14.16, 2.97, 4.0, -9.8, -8.7, MT.toiletTile, { col: false }); box(15.19, 15.2, 2.97, 4.0, -9.8, -8.7, MT.toiletTile, { col: false }); box(14.15, 15.2, 2.97, 4.0, -9.8, -9.79, MT.toiletTile, { col: false });

  // --- 玄関 ---
  box(14.15, 14.5, 2.81, 3.7, -1.02, -0.22, MT.furn); box(14.15, 14.52, 3.7, 3.73, -1.04, -0.2, MT.furnDark, { col: false });
  for (const z of [-0.62]) box(14.495, 14.5, 2.9, 3.6, z - .005, z + .005, MT.black, { col: false });
  // 木彫りの熊
  box(14.24, 14.4, 3.73, 3.83, -0.75, -0.55, M({ color: 0x5a3d25, rough: .8 }), { col: false }); box(14.28, 14.38, 3.76, 3.88, -0.8, -0.7, M({ color: 0x5a3d25, rough: .8 }), { col: false });
  cyl(14.32, 3.73, 3.95, -0.35, .05, M({ color: 0x2a5a8a, rough: .2 }), { r2: .03 });
  // 靴
  const shoe = (x, z, mat, len = .27, h = .09) => { box(x - .045, x + .045, 2.81, 2.81 + h, z - len / 2, z + len / 2, mat, { col: false }); };
  const leather = M({ color: 0x141210, rough: .25, metal: .1 });
  shoe(14.72, -0.5, leather); shoe(14.84, -0.52, leather);
  shoe(14.98, -0.78, M({ color: 0xe0e0dc, rough: .8 }), .24, .08); shoe(15.08, -0.8, M({ color: 0xe0e0dc, rough: .8 }), .24, .08);
  shoe(14.66, -0.9, M({ color: 0x6a4a2a, rough: .9 }), .25, .03);
  W.looks.push({ id: 'shoes', pos: new V3(14.78, 2.85, -0.5), dist: 2.2, dot: .93, text: '大人の革靴が、きちんと揃えてある。' });
  cyl(15.05, 2.81, 3.35, -0.35, .1, M({ color: 0x505050, rough: .6, metal: .4 }));
  // 電話台
  box(14.15, 14.45, YF, 3.7, -1.9, -1.4, MT.furn);
  box(14.2, 14.42, 3.7, 3.8, -1.82, -1.48, M({ color: 0xe8e2d4, rough: .4 }), { col: false });
  hitProxy(14.15, 14.45, 3.6, 3.85, -1.9, -1.4, { label: () => '電話', act: () => G.thought('他人の家の電話だ。……触らないでおこう。') });
  // 柱時計
  box(14.15, 14.28, 4.0, 4.75, -6.95, -6.55, MT.furnDark, { col: false });
  const clockT = labelTex(128, 128, (g, w) => { g.fillStyle = '#efe8d4'; g.beginPath(); g.arc(64, 64, 60, 0, 7); g.fill(); g.fillStyle = '#222'; g.font = `12px ${MIN}`; g.textAlign = 'center'; g.textBaseline = 'middle'; for (let i = 1; i <= 12; i++) { const a = i / 12 * 6.283 - 1.571; g.fillText(['Ⅰ', 'Ⅱ', 'Ⅲ', 'Ⅳ', 'Ⅴ', 'Ⅵ', 'Ⅶ', 'Ⅷ', 'Ⅸ', 'Ⅹ', 'Ⅺ', 'Ⅻ'][i - 1], 64 + Math.cos(a) * 48, 64 + Math.sin(a) * 48); } g.strokeStyle = '#111'; g.lineWidth = 3; g.beginPath(); g.moveTo(64, 64); g.lineTo(64 + 20, 64 - 22); g.moveTo(64, 64); g.lineTo(64 - 5, 64 + 36); g.stroke(); });
  decal(clockT, .3, .3, new V3(14.285, 4.52, -6.75), Math.PI / 2);
  const pend = new THREE.Group(); pend.position.set(14.29, 4.3, -6.75);
  const rod = new THREE.Mesh(new THREE.BoxGeometry(.01, .22, .01), MT.alu); rod.position.y = -.11; pend.add(rod);
  const bob = new THREE.Mesh(new THREE.CylinderGeometry(.045, .045, .01, 16), M({ color: 0xc8a040, metal: .9, rough: .3 })); bob.rotation.z = Math.PI / 2; bob.position.y = -.23; pend.add(bob); scene.add(pend);
  W.anim.push(t => { pend.rotation.x = Math.sin(t * Math.PI) * .18; });
  hitProxy(14.15, 14.3, 4.0, 4.75, -6.95, -6.55, { label: () => '柱時計', act: () => G.thought('振り子時計。……少し遅れている気がする。') });
  // カレンダー
  const cal = labelTex(256, 360, (g, w, h) => { g.fillStyle = '#f4f1e6'; g.fillRect(0, 0, w, h); g.fillStyle = '#8a2a1e'; g.fillRect(0, 0, w, 70); g.fillStyle = '#fff'; g.font = `bold 26px ${MIN}`; g.textAlign = 'center'; g.fillText('相川米穀店', w / 2, 44); g.fillStyle = '#222'; g.font = `bold 44px ${MIN}`; g.fillText('8', 70, 130); g.font = `18px ${MIN}`; g.fillText('1997', 170, 118); g.font = `13px ${GOTH}`; const d0 = 5; for (let d = 1; d <= 31; d++) { const i = d + d0 - 1, c = i % 7, r = Math.floor(i / 7); g.fillStyle = c === 0 ? '#b22' : '#333'; g.fillText(String(d), 22 + c * 35, 176 + r * 34); } });
  decal(cal, .26, .36, new V3(14.155, 4.25, -8.1), Math.PI / 2);
  hitProxy(14.15, 14.2, 4.05, 4.45, -8.25, -7.95, { label: () => 'カレンダー', act: () => G.thought('米屋のカレンダー。何も書き込まれていない。') });
  // スイッチ
  const sw = (x, z, ry) => { const m = decal(labelTex(32, 48, (g, w, h) => { g.fillStyle = '#eeebe2'; g.fillRect(0, 0, w, h); g.fillStyle = '#ccc'; g.fillRect(9, 12, 14, 24); }), .07, .11, new V3(x, 4.1, z), ry); return m; };
  interactable(sw(14.155, -8.42, Math.PI / 2), { label: () => (G.toiletLight ? 'トイレの電気を消す' : 'トイレの電気をつける'), act: () => G.toggleToiletLight() });
  interactable(sw(15.195, -1.25, -Math.PI / 2), { label: () => (G.hallLight ? '廊下の電気を消す' : '廊下の電気をつける'), act: () => G.toggleHallLight() });
  // 廊下のペンダント
  beam(new V3(14.68, 5.35, -4.8), new V3(14.68, 5.0, -4.8), .01, MT.black);
  const shade = new THREE.Mesh(new THREE.ConeGeometry(.16, .12, 16, 1, true), M({ color: 0xe8e0c8, side: THREE.DoubleSide, emissive: 0x000000 })); shade.position.set(14.68, 4.96, -4.8); scene.add(shade); W.hallShade = shade;
  // ふすま
  const fz = [-8.1, -7.2, -6.3];
  box(15.14, 15.2, 4.75, 4.84, -8.15, -6.25, MT.furn, { col: false }); box(15.14, 15.2, YF, YF + .02, -8.15, -6.25, MT.furn, { col: false });
  MT.fusuma = new THREE.MeshStandardMaterial({ map: TX.fusuma, roughness: .9, emissive: 0x8090b0, emissiveMap: TX.fusuma, emissiveIntensity: 0.0 });
  const lacq = M({ color: 0x141210, rough: .25 });
  W.fusumaPanels = [];
  for (let i = 0; i < 2; i++) {
    const za = fz[i], zb = fz[i + 1], off = i === 0 ? 0 : -0.025;
    const p = new THREE.Mesh(new THREE.BoxGeometry(.02, 1.78, zb - za - .04), [lacq, MT.fusuma, lacq, lacq, lacq, lacq]);
    p.position.set(15.18 + off, YF + .02 + .89, (za + zb) / 2); p.castShadow = true; p.receiveShadow = true; scene.add(p);
    const pm = p.material; pm[1] = MT.fusuma;
    box(15.165 + off, 15.19 + off, YF + .02, YF + 1.82, za, za + .022, lacq, { col: false }); box(15.165 + off, 15.19 + off, YF + .02, YF + 1.82, zb - .022, zb, lacq, { col: false });
    box(15.165 + off, 15.19 + off, YF + 1.79, YF + 1.82, za, zb, lacq, { col: false }); box(15.165 + off, 15.19 + off, YF + .02, YF + .05, za, zb, lacq, { col: false });
    const hz = i === 0 ? zb - .12 : za + .12; cyl(15.165 + off, 3.86, 3.87, hz, .03, M({ color: 0x3a2a1a, metal: .6, rough: .4 }), { M: new THREE.Matrix4() , seg: 14 });
    interactable(p, { label: () => 'ふすまに手をかける', act: () => G.touchFusuma() });
    W.fusumaPanels.push(p);
  }
  // ふすまの隙間（向こうのテレビの光）
  MT.gap = new THREE.MeshBasicMaterial({ color: 0x000000 });
  const gap = new THREE.Mesh(new THREE.BoxGeometry(.004, 1.74, .006), MT.gap); gap.position.set(15.17, YF + .92, -7.2); scene.add(gap);
  const gap2 = new THREE.Mesh(new THREE.BoxGeometry(.004, .006, 1.78), MT.gap); gap2.position.set(15.16, YF + .03, -7.2); scene.add(gap2);
  W.fusumaPos = new V3(15.15, 3.9, -7.2);

  // --- 友だちの部屋 ---
  // 窓（網戸と面格子の向こうは明るい）
  const wx0 = 16.8, wx1 = 18.8, wy0 = 3.85, wy1 = 4.85, zI = -0.2;
  MT.friendWinIn = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const outPlane = new THREE.Mesh(new THREE.PlaneGeometry(wx1 - wx0, wy1 - wy0), MT.friendWinIn); outPlane.position.set((wx0 + wx1) / 2, (wy0 + wy1) / 2, -0.16); outPlane.rotation.y = Math.PI; scene.add(outPlane);
  MT.skyView = outPlane.material;
  for (let j = 0; j <= 9; j++) { const x = wx0 + j * (wx1 - wx0) / 9; box(x - .012, x + .012, wy0, wy1, -.18, -.17, MT.rail, { col: false, cast: false }); }
  const screenMesh = M({ color: 0x404448, transparent: true, opacity: .45, rough: 1 }); box(17.8, 18.8, wy0, wy1, zI + .012, zI + .016, screenMesh, { col: false, cast: false });
  box(wx0, 17.82, wy0, wy1, zI + .02, zI + .03, MT.frosted, { col: false, cast: false });
  box(wx0 - .05, wx1 + .05, wy0 - .05, wy0, zI, zI + .06, MT.alu, { col: false }); box(wx0 - .05, wx1 + .05, wy1, wy1 + .05, zI, zI + .06, MT.alu, { col: false });
  box(wx0 - .05, wx0, wy0, wy1, zI, zI + .06, MT.alu, { col: false }); box(wx1, wx1 + .05, wy0, wy1, zI, zI + .06, MT.alu, { col: false }); box(17.79, 17.83, wy0, wy1, zI, zI + .05, MT.alu, { col: false });
  box(wx0 - .05, wx1 + .05, wy0 - .08, wy0 - .05, zI, zI + .12, MT.furn, { col: false });
  const curtain = M({ color: 0x9fb4c0, rough: 1 });
  box(16.35, 16.8, 3.7, 4.98, -.34, -.28, curtain, { col: false }); box(18.8, 19.2, 3.7, 4.98, -.34, -.28, curtain, { col: false });
  beam(new V3(16.3, 5.0, -.3), new V3(19.3, 5.0, -.3), .02, MT.alu);
  hitProxy(wx0, wx1, wy0, wy1, zI, zI + .08, { label: () => G.zone === 'friend' ? '窓の外を見る' : '', act: () => G.thought(G.evening ? '面格子の向こうが、橙色に染まっている。' : '網戸の向こうで、セミが鳴いている。まぶしい。') });
  // ベッド
  box(15.35, 17.3, YF, 3.28, -1.15, -0.22, MT.furn);
  box(15.38, 17.27, 3.28, 3.42, -1.12, -0.25, M({ color: 0x6a7a9a, rough: 1 }), { col: false });
  box(15.45, 15.9, 3.42, 3.52, -1.0, -0.37, M({ color: 0xe8e4da, rough: 1 }), { col: false });
  box(16.4, 17.2, 3.42, 3.46, -1.1, -0.3, M({ color: 0xc8a060, rough: 1 }), { col: false });
  // 机と椅子
  box(15.4, 16.6, 3.66, 3.71, -3.33, -2.75, MT.furn, { col: false }); box(15.4, 15.45, YF, 3.66, -3.33, -2.75, MT.furn, { col: false }); box(16.1, 16.6, YF, 3.66, -3.33, -2.75, MT.furn, { col: false });
  addCol(15.4, 16.6, YF, 3.71, -3.33, -2.75);
  box(15.45, 16.55, 3.71, 4.25, -3.33, -3.25, MT.furn, { col: false }); box(15.45, 16.55, 4.1, 4.13, -3.33, -3.05, MT.furn, { col: false });
  box(15.7, 16.2, 3.4, 3.45, -2.7, -2.25, MT.plastic, { col: false }); box(15.7, 16.2, 3.45, 3.95, -2.28, -2.23, MT.plastic, { col: false }); cyl(15.95, YF, 3.4, -2.47, .025, MT.alu); addCol(15.65, 16.25, YF, 3.95, -2.72, -2.2);
  box(15.5, 15.9, 3.71, 3.74, -3.2, -2.9, M({ color: 0x2a4a3a, rough: .8 }), { col: false });
  box(16.25, 16.5, 3.71, 3.99, -3.25, -3.1, M({ color: 0x222222, rough: .5 }), { col: false });
  // 本棚と漫画
  box(16.75, 17.75, YF, 4.75, -3.33, -3.05, MT.furn);
  const spines = labelTex(512, 512, (g, w, h) => { g.fillStyle = '#5a3a22'; g.fillRect(0, 0, w, h); const r = mulberry32(44); for (let s = 0; s < 5; s++) { let x = 6; const y0 = 8 + s * 102; while (x < w - 20) { const bw = 12 + r() * 14, bh = 70 + r() * 22; g.fillStyle = `hsl(${r() * 360},${30 + r() * 50}%,${35 + r() * 35}%)`; g.fillRect(x, y0 + 92 - bh, bw, bh); g.fillStyle = 'rgba(255,255,255,.6)'; g.fillRect(x + 2, y0 + 92 - bh + 8, bw - 4, 3); g.fillStyle = 'rgba(0,0,0,.35)'; g.font = '9px sans-serif'; g.fillText(String(1 + Math.floor(r() * 40)), x + 2, y0 + 86); x += bw + 1; if (r() < .06) x += 20; } } });
  decal(spines, .96, 1.76, new V3(17.25, 3.85, -3.049), 0);
  hitProxy(16.75, 17.75, YF, 4.75, -3.1, -3.0, { label: () => '本棚を見る', act: () => G.thought(pick(['漫画が並んでいる。どれも途中の巻から揃っている。', '攻略本が一冊だけ、背表紙がぼろぼろだ。', '一番上の段に、小さいころのアルバムがある。'])) });
  // ポスター
  const poster = labelTex(256, 360, (g, w, h) => { const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#20305a'); gr.addColorStop(.6, '#8a4a3a'); gr.addColorStop(1, '#e0a050'); g.fillStyle = gr; g.fillRect(0, 0, w, h); g.fillStyle = '#1a1210'; g.beginPath(); g.moveTo(0, h * .8); for (let x = 0; x <= w; x += 16) g.lineTo(x, h * .8 - Math.abs(Math.sin(x * .05)) * 60 - (x > 90 && x < 170 ? 80 : 0)); g.lineTo(w, h); g.lineTo(0, h); g.fill(); g.fillStyle = '#f0e0b0'; g.font = `bold 34px ${MIN}`; g.textAlign = 'center'; g.fillText('大地の記憶', w / 2, 60); g.font = `14px ${GOTH}`; g.fillText('SUPER GAIA SYSTEM', w / 2, 84); });
  decal(poster, .62, .87, new V3(18.9, 4.25, -3.348), 0);
  // テレビ台とブラウン管
  box(20.3, 20.8, YF, 3.4, -2.3, -1.3, MT.furnDark);
  box(20.35, 20.8, 3.4, 3.87, -2.075, -1.525, M({ color: 0x3a3a3c, rough: .4 }));
  box(20.33, 20.36, 3.4, 3.87, -2.075, -1.525, M({ color: 0x2a2a2c, rough: .35 }), { col: false });
  box(20.32, 20.33, 3.41, 3.46, -1.7, -1.56, M({ color: 0x777777, rough: .4 }), { col: false });
  box(20.8 - .2, 20.8, 3.87, 3.95, -1.95, -1.65, MT.plastic, { col: false });
  box(19.95, 20.26, YF, YF + .08, -1.36, -1.08, M({ color: 0x9a9a98, rough: .45 }), { col: false });
  box(20.0, 20.1, YF + .08, YF + .085, -1.3, -1.2, M({ color: 0x404040, rough: .5 }), { col: false });
  // ちゃぶ台と麦茶
  cyl(18.0, 3.25, 3.28, -2.0, .42, MT.furn, { seg: 24 }); for (const [a, b] of [[.25, .25], [-.25, .25], [.25, -.25], [-.25, -.25]]) box(18 + a - .02, 18 + a + .02, YF, 3.25, -2 + b - .02, -2 + b + .02, MT.furnDark, { col: false });
  addCol(17.6, 18.4, YF, 3.28, -2.4, -1.6);
  const glassM = M({ color: 0x9a6a30, rough: .1, transparent: true, opacity: .75 });
  cyl(17.85, 3.28, 3.39, -1.9, .035, glassM, { seg: 12 }); cyl(18.1, 3.28, 3.39, -2.15, .035, glassM, { seg: 12 });
  box(18.12, 18.34, 3.28, 3.31, -1.85, -1.7, M({ color: 0xd8b030, rough: .5 }), { col: false });
  hitProxy(17.78, 18.18, 3.27, 3.45, -2.25, -1.8, { label: () => '麦茶を飲む', act: () => G.drinkTea() });
  // 座布団
  const cushion = box(18.45, 18.95, YF, YF + .08, -2.75, -2.25, M({ color: 0x7a3a3a, rough: 1 }), { col: false, mesh: true });
  interactable(cushion, { label: () => G.seated ? '' : '座る', act: () => G.sit() });
  box(18.7, 19.2, YF, YF + .06, -1.75, -1.25, M({ color: 0x3a5a6a, rough: 1 }), { col: false });
  // 天井の照明（丸型蛍光灯）
  MT.roomLamp = M({ color: 0xf4f4ee, emissive: 0x000000 });
  cyl(18.0, 5.25, 5.33, -1.8, .26, MT.roomLamp, { seg: 24, cast: false });
  beam(new V3(18.05, 5.25, -1.8), new V3(18.05, 4.8, -1.8), .005, MT.black);
  // 扇風機
  const fan = new THREE.Group(); fan.position.set(17.55, YF, -2.95);
  const fb = new THREE.Mesh(new THREE.CylinderGeometry(.16, .18, .05, 18), MT.white); fb.position.y = .025; fan.add(fb);
  const fp = new THREE.Mesh(new THREE.CylinderGeometry(.018, .018, .7, 8), MT.white); fp.position.y = .4; fan.add(fp);
  const head = new THREE.Group(); head.position.y = .78; fan.add(head);
  const motor = new THREE.Mesh(new THREE.CylinderGeometry(.07, .07, .14, 14), MT.white); motor.rotation.x = Math.PI / 2; motor.position.z = -.06; head.add(motor);
  const cage = new THREE.Mesh(new THREE.TorusGeometry(.19, .006, 5, 32), MT.alu); cage.position.z = .06; head.add(cage);
  const blades = new THREE.Group(); blades.position.z = .05; head.add(blades);
  for (let i = 0; i < 3; i++) { const b = new THREE.Mesh(new THREE.CircleGeometry(.16, 12, 0, .75), M({ color: 0x9fc8e0, transparent: true, opacity: .7, side: THREE.DoubleSide })); b.rotation.z = i * 2.094; blades.add(b); }
  fan.traverse(o => { if (o.isMesh) o.castShadow = true; }); scene.add(fan); addCol(17.35, 17.75, YF, 3.8, -3.15, -2.75);
  W.fan = { head, blades, pos: new V3(17.55, 3.7, -2.95) };
  W.anim.push((t, dt) => { blades.rotation.z -= dt * 22; head.rotation.y = .5 + Math.sin(t * .45) * .7; });
  // テレビ画面の位置
  W.tvPos = new V3(20.322, 3.635, -1.8);

  // --- 弟の部屋（暗い） ---
  box(19.6, 20.75, YF, 3.7, -5.6, -5.0, MT.furnDark); box(15.4, 16.2, YF, 4.2, -5.6, -5.3, MT.furnDark);
  box(17.5, 18.5, YF, YF + .1, -4.6, -3.6, M({ color: 0x5a5a6a, rough: 1 }), { col: false });

  // --- トイレ ---
  box(14.45, 14.95, 3.4, 3.8, -9.8, -9.6, MT.porcelain);
  box(14.47, 14.93, 3.8, 3.84, -9.8, -9.58, MT.porcelain, { col: false });
  cyl(14.7, 2.97, 3.35, -9.3, .19, MT.porcelain, { r2: .13, seg: 20 });
  cyl(14.7, 3.35, 3.38, -9.28, .2, M({ color: 0xc89868, rough: .5 }), { seg: 20 });
  box(14.55, 14.85, 3.38, 3.8, -9.6, -9.56, M({ color: 0xc89868, rough: .5 }), { col: false });
  cyl(14.7, 3.84, 3.95, -9.7, .012, MT.alu, { seg: 8 });
  addCol(14.45, 14.95, 2.97, 3.8, -9.8, -9.05);
  const toiletHit = hitProxy(14.45, 14.95, 2.97, 3.5, -9.55, -9.05, { label: () => G.toiletDone ? '' : '用を足す', act: () => G.useToilet() });
  box(14.16, 14.2, 3.6, 3.72, -9.2, -9.05, MT.alu, { col: false }); cyl(14.25, 3.66, 3.66 + .001, -9.12, .06, MT.white, { M: new THREE.Matrix4(), seg: 16 });
  box(14.55, 14.85, 2.97, 3.0, -8.95, -8.8, M({ color: 0xd87a90, rough: 1 }), { col: false });
  box(14.96, 15.08, 3.84, 3.99, -9.78, -9.66, M({ color: 0x4a9a6a, rough: .3 }), { col: false });
  MT.bulb = M({ color: 0xfff4d8, emissive: 0x000000 });
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(.05, 12, 10), MT.bulb); bulb.position.set(14.68, 5.25, -9.2); scene.add(bulb);
  // 居間の気配（外から見えるカーテンの影）
  W.livingWinPos = new V3(18.1, 3.95, -10.05);
  W.friendWinPos = new V3(17.8, 4.35, 0.02);
}

// ============================================================
// 周りの家
// ============================================================
function gableGeo(w, d, h, s) {
  const pos = [], nor = [], uv = [];
  for (const sx of [1, -1]) {
    const x = sx * w / 2; const v = sx > 0 ? [[x, 0, d / 2], [x, 0, -d / 2], [x, h, 0]] : [[x, 0, -d / 2], [x, 0, d / 2], [x, h, 0]];
    for (const p of v) { pos.push(...p); nor.push(sx, 0, 0); uv.push((p[2] + d / 2) / s, p[1] / s); }
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); return g;
}
function house(cx, cz, rot, w, d, o = {}) {
  const Mh = new THREE.Matrix4().makeRotationY(rot).setPosition(cx, 0, cz);
  const floors = o.floors ?? 2, fh = 2.7, H = .45 + floors * fh, wm = o.wall ?? pick(MT.stucco), roofM = o.roof ?? (rng() < .5 ? MT.kawara : MT.slate);
  const B = (x0, x1, y0, y1, z0, z1, m) => boxM(x0, x1, y0, y1, z0, z1, Mh, m);
  B(-w / 2, w / 2, 0, .45, -d / 2, d / 2, MT.concrete);
  B(-w / 2 + .03, w / 2 - .03, .45, H, -d / 2 + .03, d / 2 - .03, wm);
  // 屋根
  const rh = o.rh ?? R(1.4, 2.1), oh = .5;
  const gg = gableGeo(w - .06, d - .06, rh, wm.userData.uv); gg.translate(0, H, 0); gg.applyMatrix4(Mh); addGeo(gg, wm);
  const len = Math.hypot(d / 2, rh), L = len + oh;
  for (const sd of [1, -1]) {
    const dir = new V3(0, -rh / len, sd * (d / 2) / len), ax = new V3(1, 0, 0), ay = new V3().crossVectors(dir, ax).multiplyScalar(sd > 0 ? -1 : -1);
    const nrm = new V3().crossVectors(ax, dir); if (nrm.y < 0) nrm.negate();
    const ridge = new V3(0, H + rh + .06, 0), c = ridge.clone().addScaledVector(dir, L / 2).addScaledVector(nrm, .04);
    orientedBox(c, ax, nrm, dir, w + oh * 1.2, .09, L, roofM, { M: Mh });
  }
  B(-w / 2 - oh * .6, w / 2 + oh * .6, H + rh, H + rh + .16, -.12, .12, roofM);
  // 窓
  const win = (x, y, face, ww, wh, opt = {}) => {
    const lit = rng() < .45, gm = lit ? MT.glassA : MT.glassB;
    if (face === 'f' || face === 'b') {
      const z = face === 'f' ? d / 2 : -d / 2, s = face === 'f' ? 1 : -1;
      B(x - ww / 2, x + ww / 2, y, y + wh, z - .02 * s, z + .02 * s, gm);
      B(x - ww / 2 - .05, x + ww / 2 + .05, y - .05, y, z, z + .07 * s, MT.alu); B(x - ww / 2 - .05, x + ww / 2 + .05, y + wh, y + wh + .05, z, z + .07 * s, MT.alu);
      B(x - ww / 2 - .05, x - ww / 2, y, y + wh, z, z + .07 * s, MT.alu); B(x + ww / 2, x + ww / 2 + .05, y, y + wh, z, z + .07 * s, MT.alu); B(x - .02, x + .02, y, y + wh, z, z + .05 * s, MT.alu);
      if (opt.shutter) B(x - ww / 2 - .02, x + ww / 2 + .02, y, y + wh, z + .05 * s, z + .09 * s, M_SHUT);
      if (opt.grid) for (let j = 0; j <= 6; j++) { const xx = x - ww / 2 + j * ww / 6; B(xx - .01, xx + .01, y - .05, y + wh + .05, z + .1 * s, z + .12 * s, MT.railLight); }
    } else {
      const xw = face === 'r' ? w / 2 : -w / 2, s = face === 'r' ? 1 : -1;
      B(xw - .02 * s, xw + .02 * s, y, y + wh, x - ww / 2, x + ww / 2, gm);
      B(xw, xw + .07 * s, y - .05, y, x - ww / 2 - .05, x + ww / 2 + .05, MT.alu); B(xw, xw + .07 * s, y + wh, y + wh + .05, x - ww / 2 - .05, x + ww / 2 + .05, MT.alu);
    }
  };
  for (let f = 0; f < floors; f++) {
    const y = .45 + f * fh;
    if (f === 0) { win(-w / 4, y + .9, 'f', 1.7, 1.1, { grid: rng() < .5 }); win(w / 2 - 1.6, y + 1.5, 'f', .6, .5); }
    else { win(-w / 4, y + .5, 'f', 1.7, 1.8, { shutter: rng() < .3 }); win(w / 4, y + .9, 'f', 1.2, 1.0); }
    win(-w / 4, y + .9, 'b', 1.6, 1.1); win(w / 4, y + .9, 'b', 1.0, .9);
    win(0, y + .9, 'r', 1.0, 1.0); win(d / 4 - .5, y + .9, 'l', .9, .9);
  }
  // 玄関
  const dx = o.doorX ?? w / 2 - 2.8;
  B(dx - .45, dx + .45, .45, 2.45, d / 2 - .01, d / 2 + .04, M_DOOR[RI(0, 2)]);
  B(dx - .8, dx + .8, 2.6, 2.68, d / 2, d / 2 + .9, MT.slate);
  B(dx - .6, dx + .6, 0, .45, d / 2, d / 2 + .8, MT.concrete);
  // 2階ベランダ
  if (floors > 1 && rng() < .75) {
    const y = .45 + fh; B(-w / 2 + .5, 1.2, y - .12, y, d / 2, d / 2 + .9, MT.concrete);
    B(-w / 2 + .5, 1.2, y, y + .95, d / 2 + .86, d / 2 + .9, MT.fence); B(-w / 2 + .5, 1.2, y + .95, y + 1.0, d / 2 + .84, d / 2 + .92, MT.alu);
    if (rng() < .7) for (let j = 0; j < RI(2, 5); j++) { const xx = -w / 2 + 1 + j * .8; B(xx, xx + .45, y + 1.1, y + 1.8, d / 2 + .5, d / 2 + .52, pick(MT.cloth)); }
    const P = (a, b, c) => new V3(a, b, c).applyMatrix4(Mh); beam(P(-w / 2 + .6, y + 1.85, d / 2 + .5), P(1.1, y + 1.85, d / 2 + .5), .03, MT.alu);
  }
  // 室外機
  B(w / 2 + .1, w / 2 + .38, 0, .6, -1.2, -.4, MT.ac);
  // コライダー
  const pts = [[-w / 2 - .1, -d / 2 - .1], [w / 2 + .4, d / 2 + .9]].map(([a, b]) => new V3(a, 0, b).applyMatrix4(Mh));
  addCol(Math.min(pts[0].x, pts[1].x), Math.max(pts[0].x, pts[1].x), 0, H + rh, Math.min(pts[0].z, pts[1].z), Math.max(pts[0].z, pts[1].z));
  if (o.tree) { const p = new V3(-w / 2 + .8, 0, d / 2 + .75).applyMatrix4(Mh); tree(p.x, p.z, R(3.5, 5), R(1.0, 1.5)); }
  {
    const P = (a, b, c) => new V3(a, b, c).applyMatrix4(Mh), gm = pick(MT.gutters);
    const ye = H + rh + .06 - rh / len * L - .1, ze = (d / 2) / len * L;
    for (const sd of [1, -1]) beam(P(-w / 2 - oh * .6, ye, sd * ze), P(w / 2 + oh * .6, ye, sd * ze), .11, gm, { cast: false });
    for (const [x, z] of [[w / 2 + .15, ze], [-w / 2 - .15, -ze]]) { beam(P(x, ye, z), P(x, ye - .3, z * .96), .06, gm, { cast: false }); beam(P(x, ye - .3, z * .96), P(x, .05, z * .96), .07, gm, { cast: false }); }
    if (rng() < .8) { const ax = R(-w / 4, w / 4), top = H + rh + .1; beam(P(ax, top - .2, 0), P(ax, top + 1.7, 0), .035, MT.railLight, { cast: false }); for (let j = 0; j < 7; j++) beam(P(ax - .05, top + 1.45, (j - 3) * .13), P(ax + .05, top + 1.45, (j - 3) * .13), .012, MT.railLight, { cast: false }); beam(P(ax, top + 1.45, -.45), P(ax, top + 1.45, .45), .02, MT.railLight, { cast: false }); for (let j = 0; j < 5; j++) beam(P(ax - .3 + j * .15, top + 1.2, -.05), P(ax - .3 + j * .15, top + 1.2, .05), .01, MT.railLight, { cast: false }); }
    B(w / 2 + .02, w / 2 + .2, .8, 1.15, 1.0, 1.35, MT.ac);
    const nPot = RI(1, 4); for (let j = 0; j < nPot; j++) { const px = dx + .7 + j * .4, pz = d / 2 + .25 + R(0, .2), pp = P(px, 0, pz); fallback(() => { cyl(pp.x, 0, .26, pp.z, .12, MT.pot, { r2: .15, seg: 10 }); const gg = new THREE.IcosahedronGeometry(R(.14, .24), 1); gg.translate(pp.x, .36 + R(0, .1), pp.z); addGeo(gg, pick(MT.leaf)); }); PROPS.pots.push({ x: pp.x, y: 0, z: pp.z }); }
  }
  return Mh;
}
let M_SHUT, M_DOOR;
function blockWallX(z, x0, x1, gaps, h = 1.3) {
  const segs = []; let cur = x0; for (const [a, b] of gaps.sort((p, q) => p[0] - q[0])) { segs.push([cur, a]); cur = b; } segs.push([cur, x1]);
  for (const [a, b] of segs) if (b - a > .05) { box(a, b, 0, h, z - .075, z + .075, MT.block); box(a - .02, b + .02, h, h + .06, z - .1, z + .1, MT.concrete, { col: false }); }
}
function blockWallZ(x, z0, z1, gaps, h = 1.3) {
  const segs = []; let cur = z0; for (const [a, b] of gaps.sort((p, q) => p[0] - q[0])) { segs.push([cur, a]); cur = b; } segs.push([cur, z1]);
  for (const [a, b] of segs) if (b - a > .05) { box(x - .075, x + .075, 0, h, a, b, MT.block); box(x - .1, x + .1, h, h + .06, a - .02, b + .02, MT.concrete, { col: false }); }
}
function buildHouses() {
  M_SHUT = M({ color: 0x8a8e8a, rough: .5, metal: .4 });
  M_DOOR = [M({ color: 0x5a4030, rough: .5 }), M({ color: 0x8a8070, rough: .5, metal: .3 }), M({ color: 0x3a3a38, rough: .4, metal: .3 })];
  // 東側の道沿い（道に面して西向き）
  const eastZ = [[-39, 9], [-28.5, 9], [-18, 9], [-7.5, 9], [0, 7]];
  for (const [z, w] of eastZ) house(-15.5, z, Math.PI / 2, w, 9, { tree: rng() < .5 });
  blockWallZ(-9.55, -46, 4.0, eastZ.map(([z, w]) => [z - w / 2 + 2.2, z - w / 2 + 3.2]));
  blockWallX(3.92, -24, -9.55, []);
  // 北側の道沿い
  const northX = [-19, -7, 5, 17, 29, 41, 53];
  for (const x of northX) house(x, 15, Math.PI, 10, 9, { tree: rng() < .5 });
  blockWallX(9.55, -24, 60, northX.map(x => [x - 2.7, x - 1.7]));
  // マンションの西側・南側
  for (const [x, z] of [[36, -1], [48, -1], [36, -14], [48, -14]]) house(x, z, 0, 10, 8, { tree: rng() < .4 });
  blockWallX(3.92, 30, 60, [[37.3, 38.3], [49.3, 50.3]]);
  for (const x of [2, 14, 26]) house(x, -29.5, 0, 10, 9, { tree: rng() < .5 });
  for (const x of [2, 14]) house(x, -40, 0, 10, 9);
  blockWallZ(-4.0, -46, -24.2, [[-37, -36]]);
  // 道の突き当たり
  addCol(-24.5, -24.2, -1, 5, 3.9, 9.6); addCol(59.8, 60.2, -1, 5, 3.9, 9.6);
}

// ============================================================
// 電柱・電線・街灯
// ============================================================
function buildPoles() {
  const poles = [[-9.25, -42], [-9.25, -26], [-9.25, -10], [-9.25, 5.5], [6, 9.25], [22, 9.25], [38, 9.25], [54, 9.25]];
  const top = [];
  for (const [x, z] of poles) {
    cyl(x, 0, 10.5, z, .16, MT.pole, { r2: .12, seg: 12, col: true });
    const alongX = z > 9; const ca = alongX ? new V3(0, 0, 1) : new V3(1, 0, 0);
    beam(new V3(x, 9.6, z).addScaledVector(ca, -.8), new V3(x, 9.6, z).addScaledVector(ca, .8), .08, MT.rail);
    beam(new V3(x, 7.6, z).addScaledVector(ca, -.4), new V3(x, 7.6, z).addScaledVector(ca, .4), .06, MT.rail);
    top.push([new V3(x, 9.7, z).addScaledVector(ca, -.7), new V3(x, 9.7, z), new V3(x, 9.7, z).addScaledVector(ca, .7), new V3(x, 7.7, z)]);
    if (rng() < .5) { cyl(x + (alongX ? 0 : .35), 8.0, 8.9, z + (alongX ? .35 : 0), .22, M({ color: 0x8a908a, rough: .5, metal: .4 }), { seg: 12 }); }
    const plate = labelTex(64, 256, (g, w, h) => { g.fillStyle = '#eee'; g.fillRect(0, 0, w, h); g.fillStyle = '#123'; g.font = `bold 22px ${GOTH}`; g.textAlign = 'center'; '和泉２'.split('').forEach((c, i) => g.fillText(c, 32, 40 + i * 30)); g.fillStyle = '#1a3a8a'; g.fillRect(0, 170, w, 86); g.fillStyle = '#fff'; g.font = `14px ${GOTH}`; g.fillText('杉並区', 32, 210); });
    const dir = alongX ? -1 : 1; const pm = decal(plate, .18, .72, new V3(x + (alongX ? 0 : .17 * dir), 2.4, z + (alongX ? -.17 : 0)), alongX ? Math.PI : Math.PI / 2);
  }
  for (let i = 0; i < top.length - 1; i++) for (let k = 0; k < 4; k++) wire(top[i][k], top[i + 1][k], k === 3 ? .9 : .6);
  // 支線と黄色い支線ガード
  for (const [x, z, dx, dz] of [[-9.25, -26, -1.8, 0], [22, 9.25, 0, 1.6]]) { const a = new V3(x, 8.6, z), b = new V3(x + dx, 0, z + dz); beam(a, b, .02, MT.wire, { cast: false }); const c = new V3().lerpVectors(b, a, .22); beam(b, c, .09, MT.guard, { cast: true }); }
  wire(top[3][1], new V3(-11, 5.0, -2), .3); wire(top[5][2], new V3(24, 9.0, 1.2), .5);
  // 街灯（最初は消えている）
  const lampAt = [[-9.25, -42, 1], [-9.25, -26, 1], [-9.25, -10, 1], [-9.25, 5.5, 1], [6, 9.25, 2], [22, 9.25, 2]];
  for (const [x, z, t] of lampAt) {
    const off = t === 1 ? new V3(1, 0, 0) : new V3(0, 0, -1);
    const a = new V3(x, 5.2, z), b = a.clone().addScaledVector(off, .9); b.y = 5.45;
    beam(a, b, .05, MT.railLight);
    const mat = M({ color: 0xeeeeea, emissive: 0x000000 });
    const head = new THREE.Mesh(new THREE.BoxGeometry(t === 1 ? .55 : .14, .08, t === 1 ? .14 : .55), mat); head.position.copy(b).addScaledVector(off, .15); head.position.y -= .05; scene.add(head);
    const L = new THREE.PointLight(0xdff0ff, 0, 16, 1.6); L.position.copy(head.position); L.position.y -= .15; scene.add(L);
    W.lamps.push({ mat, light: L, on: false, at: 0 });
  }
}
function wire(a, b, sag) { const n = 10; let p = a.clone(); for (let i = 1; i <= n; i++) { const t = i / n; const q = new V3().lerpVectors(a, b, t); q.y -= sag * 4 * t * (1 - t); beam(p, q, .018, MT.wire, { cast: false }); p = q; } }

// ============================================================
// 木
// ============================================================
function tree(x, z, h, r) {
  cyl(x, 0, h * .7, z, .14 * r / 1.3, MT.trunk, { r2: .09 * r / 1.3, seg: 8, col: true });
  fallback(() => { for (let i = 0; i < 7; i++) { const g = new THREE.IcosahedronGeometry(r * R(.5, .85), 1); const a = rng() * 6.28, rr = r * R(0, .6); g.translate(x + Math.cos(a) * rr, h * R(.62, 1.0), z + Math.sin(a) * rr); addGeo(g, pick(MT.leaf)); } });
  PROPS.trees.push({ x, z, h, r });
  W.trees = W.trees || []; W.trees.push(new V3(x, h * .8, z));
}
// 雑草（壁ぎわ・側溝ぎわ）
function buildWeeds() {
  const tx = labelTex(128, 128, (g, w, h) => { g.clearRect(0, 0, w, h); const r = mulberry32(12); for (let i = 0; i < 26; i++) { const x = 10 + r() * 108, hh = 40 + r() * 80, lean = (r() - .5) * 40; g.strokeStyle = `hsl(${80 + r() * 40},${35 + r() * 25}%,${22 + r() * 22}%)`; g.lineWidth = 2 + r() * 3; g.beginPath(); g.moveTo(x, h); g.quadraticCurveTo(x + lean * .3, h - hh * .6, x + lean, h - hh); g.stroke(); } });
  const mat = new THREE.MeshStandardMaterial({ map: tx, alphaTest: .45, side: THREE.DoubleSide, roughness: 1 });
  const g1 = new THREE.PlaneGeometry(.45, .38); g1.translate(0, .19, 0); const g2 = g1.clone(); g2.rotateY(Math.PI / 2); const geo = mergeGeometries([g1, g2]);
  const spots = [];
  for (let z = -45; z < 3.5; z += R(.5, 1.6)) { spots.push([-9.35, z]); if (z < -24.5 || (z > -14 && z < -9) === false) spots.push([-4.2, z]); }
  for (let x = -23; x < 59; x += R(.6, 1.8)) { spots.push([x, 9.32]); if (x < -9.6 || x > 30.2) spots.push([x, 4.18]); }
  for (let x = -3.8; x < 30; x += R(.8, 2.2)) spots.push([x, -23.85]);
  for (let z = -23.8; z < 3.8; z += R(.8, 2.2)) spots.push([29.85, z]);
  for (let z = -23.8; z < 1.2; z += R(.7, 1.8)) spots.push([-3.85, z]);
  const im = new THREE.InstancedMesh(geo, mat, spots.length), m4 = new THREE.Matrix4(), q = new THREE.Quaternion();
  spots.forEach(([x, z], i) => { const s = R(.6, 1.4); q.setFromAxisAngle(new V3(0, 1, 0), R(0, 3.14)); m4.compose(new V3(x + R(-.08, .08), 0, z), q, new V3(s, s * R(.7, 1.3), s)); im.setMatrixAt(i, m4); });
  im.receiveShadow = true; scene.add(im);
}
function buildTrees() {
  tree(25.5, 3.4, 6.5, 1.8); tree(-1.8, -21.5, 6, 2.2); tree(29, -19, 5.5, 1.8); tree(-14, 13, 6, 2.2);
}

// ============================================================
// 遠景
// ============================================================
function buildDistant() {
  const bm = [0x9a9ca0, 0xa8a49a, 0x8f9498, 0xb0aca4].map(c => M({ map: TX.concrete, color: c, uv: 6 }));
  const winT = labelTex(128, 256, (g, w, h) => { g.fillStyle = '#9a9ca0'; g.fillRect(0, 0, w, h); for (let y = 6; y < h; y += 16) for (let x = 6; x < w; x += 14) { g.fillStyle = hash2(x, y) > .7 ? '#e8d8a0' : '#3a4450'; g.fillRect(x, y, 9, 8); } });
  winT.wrapS = winT.wrapT = THREE.RepeatWrapping; winT.repeat.set(3, 3);
  const bwm = new THREE.MeshStandardMaterial({ map: winT, roughness: .8, emissive: 0x000000, emissiveMap: winT });
  MT.distantWin = bwm;
  for (let i = 0; i < 26; i++) {
    const a = i / 26 * Math.PI * 2 + R(-.1, .1), rr = R(95, 170), x = 8 + Math.cos(a) * rr, z = -8 + Math.sin(a) * rr;
    const w = R(12, 30), d = R(10, 20), h = R(12, 42);
    const g = new THREE.BoxGeometry(w, h, d); g.rotateY(-a); g.translate(x, h / 2, z);
    const m = new THREE.Mesh(g, bwm); scene.add(m);
  }
  // 遠くの送電塔と給水塔
  for (const [x, z] of [[-120, 60], [-60, 150]]) { for (let j = 0; j < 4; j++) { const s = j < 2 ? 1 : -1, t = j % 2 ? 1 : -1; beam(new V3(x + s * 4, 0, z + t * 4), new V3(x + s * .8, 42, z + t * .8), .35, MT.rail, { cast: false }); } for (const y of [28, 34, 40]) beam(new V3(x - 7, y, z), new V3(x + 7, y, z), .3, MT.rail, { cast: false }); }
  cyl(140, 0, 26, -90, 6, M({ color: 0xb8b8b0 }), { seg: 20, cast: false }); cyl(140, 26, 30, -90, 7.5, M({ color: 0xa8a8a0 }), { seg: 20, cast: false });
}

function buildWorld() {
  buildGround(); buildLot(); buildMansion(); buildUnit203(); buildHouses(); buildPoles(); buildTrees(); buildDistant(); buildElevator(); buildWeeds(); buildTown();
  flushStatic();
}
