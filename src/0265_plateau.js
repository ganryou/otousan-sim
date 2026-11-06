// ============================================================
// 試作：PLATEAU（国土交通省の3D都市モデル）で、遊べる範囲の外の街を本物の配置にする
// ?plateau を付けて開いたときだけ。付けなければ今までどおり（作り物の遠景）
// データ：tools/plateau_convert.js が作る assets/plateau/plateau.json（x＋が西、z＋が北）
// ============================================================
const PLATEAU = /[?&]plateau\b/.test(location.search) && !!(window.ASSETS && window.ASSETS.plateau);
// 手で作った範囲（ここに掛かる本物の建物・道路は置かない）
const PL_MASK = { x0: -97, x1: 63, z0: -90, z1: 26 };
const plInMask = (x, z) => x > PL_MASK.x0 && x < PL_MASK.x1 && z > PL_MASK.z0 && z < PL_MASK.z1;
function buildPlateau() {
  const D = window.ASSETS.plateau;
  // 建物の質感：低い家（モルタル）と、ビル・マンション（窓あり）
  const houseM = [0xd8d0c0, 0xc8c0b0, 0xe0d8c8, 0xb8b4a8, 0xd0c8b8, 0xc8b8a0].map(c => M({ map: TX.stucco, color: c, uv: 3 }));
  const roofM = [0x6a6a6a, 0x5a5048, 0x7a6a5a, 0x8a8a84, 0x4a5058].map(c => M({ map: TX.concrete, color: c, uv: 4 }));
  const winT = labelTex(128, 128, (g, w, h) => { g.fillStyle = '#a8a6a0'; g.fillRect(0, 0, w, h); for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) { g.fillStyle = hash2(x * 7 + y, y * 3 + x) > .65 ? '#e8d8a0' : '#3a4450'; g.fillRect(6 + x * 32, 10 + y * 32, 20, 14); } });
  winT.wrapS = winT.wrapT = THREE.RepeatWrapping;
  const bldgM = [0xb0aca4, 0x9a9ca0, 0xc0b8a8].map(c => { const m = new THREE.MeshStandardMaterial({ map: winT, color: c, roughness: .8, emissive: 0x000000, emissiveMap: winT }); m.userData.uv = 12; TOWN.windows.push(m); return m; });
  let nb = 0, nr = 0;
  for (const b of D.bldg) {
    const [h, storeys, , ...xz] = b, pts = []; for (let i = 0; i < xz.length; i += 2) pts.push(new THREE.Vector2(xz[i], -xz[i + 1]));
    if (pts.some(p => plInMask(p.x, -p.y))) continue;
    const big = h > 10.5 || storeys >= 4, k = Math.abs(Math.round(pts[0].x * 7 + pts[0].y * 13));
    const g = new THREE.ExtrudeGeometry(new THREE.Shape(pts), { depth: h, bevelEnabled: false });
    g.rotateX(-Math.PI / 2);
    // 壁と屋根を別の質感に（ExtrudeGeometry のグループ0がふた、1が側面）
    const wallMat = big ? bldgM[k % 3] : houseM[k % houseM.length], s = 1 / wallMat.userData.uv;
    const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * s, uv.getY(i) * s);
    for (const gr of g.groups) addGeo(subGeo(g, gr.start, gr.count), gr.materialIndex === 0 ? roofM[k % roofM.length] : wallMat, big);
    nb++;
  }
  // 道路（本物の道の形。手で作った範囲の外だけ）
  for (const r of D.road) {
    const pts = []; let cx = 0, cz = 0; for (let i = 0; i < r.length; i += 2) { pts.push(new THREE.Vector2(r[i], -r[i + 1])); cx += r[i]; cz += r[i + 1]; }
    cx /= pts.length; cz /= pts.length; if (plInMask(cx, cz)) continue;
    const g = new THREE.ShapeGeometry(new THREE.Shape(pts)); g.rotateX(-Math.PI / 2); g.translate(0, .003, 0);
    const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / 5, uv.getY(i) / 5);
    addGeo(g, MT.asphalt, false); nr++;
  }
  console.log(`[plateau] 建物 ${nb}棟 / 道路 ${nr}面`);
}
// ジオメトリの一部（頂点 start から count 個）を取り出す
function subGeo(g, start, count) {
  const out = new THREE.BufferGeometry();
  for (const name of ['position', 'normal', 'uv']) { const a = g.attributes[name], n = a.itemSize; out.setAttribute(name, new THREE.BufferAttribute(a.array.slice(start * n, (start + count) * n), n)); }
  return out;
}
