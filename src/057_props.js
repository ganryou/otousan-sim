// ============================================================
// 3Dモデルの小物・植物（Poly Haven CC0）
// モデルが読み込めたら、仮の形（W.fallback）を隠して差し替える
// ============================================================
const MDL = {};
const PROPS = { trees: [], pots: [], hedges: [] };
function b64buf(s) { return Uint8Array.from(atob(s.split(',')[1]), c => c.charCodeAt(0)).buffer; }
async function loadModels() {
  const A = window.ASSETS || {}; const keys = Object.keys(A).filter(k => k.startsWith('mdl_')); if (!keys.length) return false;
  const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js'); const L = new GLTFLoader();
  for (const k of keys) {
    try {
      const g = await L.parseAsync(b64buf(A[k]), '');
      g.scene.traverse(o => { if (!o.isMesh) return; o.castShadow = true; o.receiveShadow = true; for (const m of [].concat(o.material)) { for (const t of ['map', 'normalMap', 'roughnessMap']) if (m[t]) m[t].anisotropy = ANISO; if (m.alphaTest > 0 || m.transparent) { m.alphaTest = Math.max(m.alphaTest, .45); m.transparent = false; m.side = THREE.DoubleSide; } } });
      g.scene.updateMatrixWorld(true);
      // 1つのファイルに形違いが並んでいる場合は、1つずつに分ける
      let parts = g.scene.children; while (parts.length === 1 && parts[0].children.length > 1 && !parts[0].isMesh) parts = parts[0].children;
      const vars = parts.map(p => ({ obj: p, bb: new THREE.Box3().setFromObject(p) })).filter(v => !v.bb.isEmpty());
      MDL[k.slice(4)] = { vars: vars.length ? vars : [{ obj: g.scene, bb: new THREE.Box3().setFromObject(g.scene) }] };
    } catch (e) { console.warn('model', k, e); }
  }
  return true;
}
// 高さ h（メートル）に合わせて置く。底面を y に、中心を x,z に
function place(name, x, y, z, o = {}) {
  const M0 = MDL[name]; if (!M0) return null;
  const m = M0.vars[o.v !== undefined ? o.v % M0.vars.length : Math.floor(Math.random() * M0.vars.length)];
  const s = o.s ?? (o.h ? o.h / Math.max(.001, m.bb.max.y - m.bb.min.y) : 1);
  const c = m.bb.getCenter(new V3());
  const inner = m.obj.clone(true); inner.updateMatrix(); const hold = new THREE.Group(); hold.add(inner); hold.position.set(-c.x, -m.bb.min.y, -c.z);
  inner.position.copy(m.obj.position); inner.quaternion.copy(m.obj.quaternion); inner.scale.copy(m.obj.scale);
  const g = new THREE.Group(); g.add(hold); g.scale.setScalar(s * (o.sx ?? 1)); g.scale.y = s * (o.sy ?? 1);
  g.position.set(x, y, z); g.rotation.y = o.ry ?? 0; scene.add(g);
  if (o.col) { const w = (m.bb.max.x - m.bb.min.x) * s / 2 * .8, d = (m.bb.max.z - m.bb.min.z) * s / 2 * .8, r = Math.max(w, d); addCol(x - r, x + r, y, y + (m.bb.max.y - m.bb.min.y) * s, z - r, z + r); }
  return g;
}
// 葉の板を集めて作る茂み（生け垣・木の枝葉）
let LEAF_MAT = null, CORE_MAT = null;
function leafMat() {
  if (LEAF_MAT) return LEAF_MAT;
  const t = labelTex(256, 256, (g, w, h) => {
    g.clearRect(0, 0, w, h); const r = mulberry32(31);
    for (let i = 0; i < 70; i++) { const x = 20 + r() * 216, y = 20 + r() * 216, a = r() * 6.28, L = 16 + r() * 18; const hue = 85 + r() * 35, li = 18 + r() * 22;
      g.save(); g.translate(x, y); g.rotate(a); const gr = g.createLinearGradient(-L, 0, L, 0); gr.addColorStop(0, `hsl(${hue},45%,${li - 6}%)`); gr.addColorStop(1, `hsl(${hue},50%,${li + 10}%)`);
      g.fillStyle = gr; g.beginPath(); g.ellipse(0, 0, L, L * .42, 0, 0, 7); g.fill(); g.strokeStyle = `hsla(${hue},40%,${li - 10}%,.6)`; g.lineWidth = 1; g.beginPath(); g.moveTo(-L, 0); g.lineTo(L, 0); g.stroke(); g.restore(); }
  });
  LEAF_MAT = new THREE.MeshStandardMaterial({ map: t, alphaTest: .5, side: THREE.DoubleSide, roughness: .75 });
  CORE_MAT = new THREE.MeshStandardMaterial({ color: 0x1e3316, roughness: 1 });
  return LEAF_MAT;
}
function foliage(cx, cy, cz, rx, ry, rz, n, seed) {
  const r = mulberry32(seed), pos = [], nor = [], uv = [];
  const q = new THREE.Quaternion(), e = new THREE.Euler();
  for (let i = 0; i < n; i++) {
    // 楕円体の表面近くに多め、中にも少し
    let x, y, z; do { x = r() * 2 - 1; y = r() * 2 - 1; z = r() * 2 - 1; } while (x * x + y * y + z * z > 1);
    const k = .55 + .45 * Math.pow(r(), .35), len = Math.hypot(x, y, z) || 1; x = x / len * k; y = y / len * k; z = z / len * k;
    const px = cx + x * rx, py = cy + y * ry, pz = cz + z * rz, s = (.28 + r() * .22) * Math.min(1.4, (rx + ry + rz) / 2.4 + .4);
    const nn = new V3(x / rx, y / ry, z / rz).normalize(); nn.y += .35; nn.normalize();
    e.set(r() * 6.28, r() * 6.28, r() * 6.28); q.setFromEuler(e);
    const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, b]) => new V3(a * s / 2, b * s / 2, 0).applyQuaternion(q).add(new V3(px, py, pz)));
    const u0 = Math.floor(r() * 2) * .5, v0 = Math.floor(r() * 2) * .5;
    for (const idx of [0, 1, 2, 0, 2, 3]) { const c = corners[idx]; pos.push(c.x, c.y, c.z); nor.push(nn.x, nn.y, nn.z); const [a, b] = [[0, 0], [1, 0], [1, 1], [0, 1]][idx]; uv.push(u0 + a * .5, v0 + b * .5); }
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  const m = new THREE.Mesh(g, leafMat()); m.castShadow = true; m.receiveShadow = true; scene.add(m);
  const core = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8), CORE_MAT); core.scale.set(rx * .72, ry * .7, rz * .72); core.position.set(cx, cy, cz); core.castShadow = true; core.receiveShadow = true; scene.add(core);
  return m;
}
async function setupProps() {
  const ok = await loadModels(); if (!ok || !Object.keys(MDL).length) return;
  const rr = mulberry32(777), RR = (a, b) => a + (b - a) * rr(), PK = a => a[Math.floor(rr() * a.length)];
  const shrubs = ['shrub_02', 'shrub_03', 'shrub_04'].filter(n => MDL[n]);
  if (W.fallback) W.fallback.visible = false;
  // 植え込み
  for (const [x, z] of PROPS.hedges) foliage(x, .82, z, .62, .42, .32, 150, Math.floor(x * 100));
  // 木（幹はそのまま、枝葉を低木のモデルで）
  for (const t of PROPS.trees) {
    const nClump = t.r > 1.6 ? 4 : 3;
    for (let i = 0; i < nClump; i++) { const a = i / nClump * 6.28 + RR(0, 1), d = i === 0 ? 0 : t.r * .45; foliage(t.x + Math.cos(a) * d, t.h * (i === 0 ? .78 : RR(.6, .72)), t.z + Math.sin(a) * d, t.r * RR(.7, .85), t.r * RR(.5, .62), t.r * RR(.7, .85), Math.floor(260 * t.r), Math.floor(t.x * 37 + t.z * 11 + i)); }
  }
  // 植木鉢
  const potM = new THREE.MeshStandardMaterial({ color: 0xa0583a, roughness: .85 });
  for (const p of PROPS.pots) { const h = RR(.22, .3), rt = RR(.13, .17); const pot = new THREE.Mesh(new THREE.CylinderGeometry(rt, rt * .78, h, 16), potM); pot.position.set(p.x, p.y + h / 2, p.z); pot.castShadow = pot.receiveShadow = true; scene.add(pot); foliage(p.x, p.y + h + RR(.12, .2), p.z, RR(.2, .28), RR(.16, .24), RR(.2, .28), 45, Math.floor(p.x * 91 + p.z * 7 + p.y * 3)); }
  // ゴミ置き場
  for (const [x, z, h] of [[-3.55, 1.85, .55], [-3.2, 2.1, .5], [-3.6, 2.45, .6], [-3.15, 2.55, .45], [-3.4, 2.2, .5]]) place('trashbag', x, 0, z, { h, ry: RR(0, 6.28) });
  place('cardboard_box_01', -2.95, 0, 1.75, { h: .32, ry: .4 });
  addCol(-3.95, -2.75, 0, .6, 1.55, 2.8);
  // 自販機の横の空き缶入れ
  place('metal_trash_can', -2.95, 0, 3.3, { h: .78, col: true });
  // 駐輪場・廊下の小物
  place('plastic_crate_01', 5.6, 0, 3.55, { h: .32, ry: .2 }); place('cardboard_box_01', 5.2, 0, 3.6, { h: .28, ry: -.3 });
  place('plastic_crate_01', 26.4, .1, .45, { h: .3, ry: 1.2 });
  place('watering_can_metal_01', 1.9, .1, .35, { h: .3, ry: 2 }); place('watering_can_metal_01', -10.4, 0, -5.2, { h: .3, ry: .5 });
  // 電気の箱（1階の外壁）
  const ub = place('utility_box_01', 26.6, .9, .06, { h: .55 }); if (ub) ub.rotation.y = 0;
  // 梅崎の部屋の小物
  place('boombox', 15.95, 3.71, -3.05, { h: .2, ry: .1 });
  place('alarm_clock_01', 17.5, 2.95, -.45, { h: .11, ry: -.6 });
  place('desk_lamp_arm_01', 15.55, 3.71, -3.12, { h: .42, ry: .8 });
  W.propsReady = true;
}
