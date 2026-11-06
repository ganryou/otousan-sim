// PLATEAU（国土交通省）の CityGML から、方南町駅まわりの建物と道路をゲーム座標の軽い JSON にする
// 使い方: node tools/plateau_convert.js <CityGML を展開したフォルダ>
//   入力: <フォルダ>/udx/bldg/*_bldg_*.gml, <フォルダ>/udx/tran/*_tran_*.gml
//   出力: assets/plateau/plateau.json（build.js が assets_N.js に埋め込む）
// ゲーム座標：x＋が西、z＋が北、単位はメートル。環七と泉南通りの交差点の中心をゲームの (-81, -52) に合わせる
const fs = require('fs'), path = require('path');
const SRC = process.argv[2]; if (!SRC) { console.log('使い方: node tools/plateau_convert.js <CityGMLのフォルダ>'); process.exit(1); }
const OUT = path.join(__dirname, '..', 'assets', 'plateau'); fs.mkdirSync(OUT, { recursive: true });
const CFG = JSON.parse(fs.readFileSync(path.join(__dirname, 'plateau_anchor.json'), 'utf8'));
const { lat0, lon0, rotDeg, radius } = CFG, GX = -81, GZ = -52;
const Rm = 6378137, kx = Math.PI / 180 * Rm * Math.cos(lat0 * Math.PI / 180), ky = Math.PI / 180 * Rm;
const cr = Math.cos(rotDeg * Math.PI / 180), sr = Math.sin(rotDeg * Math.PI / 180);
// 緯度経度 → ゲーム座標（東西・南北のメートルにして回し、西を x＋にする）
function toGame(lat, lon) {
  const e = (lon - lon0) * kx, n = (lat - lat0) * ky;
  const e2 = e * cr - n * sr, n2 = e * sr + n * cr;
  return [GX - e2, GZ + n2];
}
const r1 = v => Math.round(v * 10) / 10;
const posLists = s => [...s.matchAll(/<gml:posList[^>]*>([^<]+)<\/gml:posList>/g)].map(m => { const a = m[1].trim().split(/\s+/).map(Number), p = []; for (let i = 0; i + 2 < a.length; i += 3) p.push([a[i], a[i + 1], a[i + 2]]); return p; });
function files(kind) { const d = path.join(SRC, 'udx', kind); return fs.existsSync(d) ? fs.readdirSync(d).filter(f => f.endsWith('.gml')).map(f => path.join(d, f)) : []; }
const near = pts => pts.some(([x, z]) => Math.hypot(x - GX, z - GZ) < radius);
// ---- 建物：床の輪郭（いちばん低い面）と高さ
const bldg = [];
for (const f of files('bldg')) {
  const s = fs.readFileSync(f, 'utf8');
  for (const m of s.matchAll(/<bldg:Building[ >][\s\S]*?<\/bldg:Building>/g)) {
    const b = m[0], hm = b.match(/<bldg:measuredHeight[^>]*>([\d.]+)</);
    const solid = b.match(/<bldg:lod1Solid>[\s\S]*?<\/bldg:lod1Solid>/); if (!solid) continue;
    const polys = posLists(solid[0]); if (!polys.length) continue;
    let minY = Infinity, maxY = -Infinity; for (const p of polys) for (const q of p) { minY = Math.min(minY, q[2]); maxY = Math.max(maxY, q[2]); }
    const foot = polys.find(p => p.every(q => Math.abs(q[2] - minY) < .01)); if (!foot) continue;
    const pts = foot.slice(0, -1).map(([la, lo]) => toGame(la, lo)); if (pts.length < 3 || !near(pts)) continue;
    const h = hm ? +hm[1] : maxY - minY; if (!(h > 1)) continue;
    const st = b.match(/<bldg:storeysAboveGround>(\d+)</), use = b.match(/<bldg:usage[^>]*>(\d+)</);
    bldg.push([r1(h), st ? +st[1] : 0, use ? +use[1] : 0, ...pts.flat().map(r1)]);
  }
}
// ---- 道路：LOD1 の面（交差点・歩道を含む）
const road = [];
for (const f of files('tran')) {
  const s = fs.readFileSync(f, 'utf8');
  for (const m of s.matchAll(/<tran:Road[ >][\s\S]*?<\/tran:Road>/g)) {
    const l1 = m[0].match(/<tran:lod1MultiSurface>[\s\S]*?<\/tran:lod1MultiSurface>/); if (!l1) continue;
    for (const p of posLists(l1[0])) { const pts = p.slice(0, -1).map(([la, lo]) => toGame(la, lo)); if (pts.length >= 3 && near(pts)) road.push(pts.flat().map(r1)); }
  }
}
const out = { note: '3D都市モデル：国土交通省 PLATEAU（杉並区 2025）を加工して作成', anchor: CFG, bldg, road };
fs.writeFileSync(path.join(OUT, 'plateau.json'), JSON.stringify(out));
console.log(`建物 ${bldg.length}棟 / 道路の面 ${road.length}枚 → assets/plateau/plateau.json (${(fs.statSync(path.join(OUT, 'plateau.json')).size / 1024).toFixed(0)}KB)`);
