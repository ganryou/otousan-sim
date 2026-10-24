// ============================================================
// エレベーター（共用廊下の東の突き当たり。1〜3階）
// ============================================================
const ELV = { floors: [0.1, 2.8, 5.6], y: 0.1, cur: 0, target: 0, state: 'closed', door: 0, t: 0, leaves: [], cols: [], ind: [] };
function buildElevator() {
  const X0 = 28, X1 = 29.75, Z0 = -0.45, Z1 = 1.6, TOP = 9.6;
  // 昇降路
  box(X0, X1, 0, TOP, 1.45, Z1, MT.tile); box(X0, X1, 0, TOP, Z0, -0.3, MT.tile); box(29.6, X1, 0, TOP, Z0, Z1, MT.tile);
  box(X0 - .05, X1 + .05, TOP - .2, TOP, Z0 - .05, Z1 + .05, MT.slab, { col: false });
  box(X0, 29.6, -0.5, 0, -0.3, 1.45, MT.concrete, { col: false });
  // かご
  const car = new THREE.Group(); scene.add(car); ELV.car = car;
  const st = M({ color: 0xb8bcbc, rough: .28, metal: .85 }), stD = M({ color: 0x8c9090, rough: .35, metal: .8 });
  const add = (x0, x1, y0, y1, z0, z1, m) => { const g = new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0); g.translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2); const mm = new THREE.Mesh(g, m); mm.castShadow = true; mm.receiveShadow = true; car.add(mm); return mm; };
  add(28.02, 29.58, -.08, 0, -.28, 1.43, M({ color: 0x5a5048, rough: .7 }));
  add(29.5, 29.58, 0, 2.2, -.28, 1.43, st); add(28.02, 29.58, 0, 2.2, -.3, -.25, st); add(28.02, 29.58, 0, 2.2, 1.4, 1.45, st);
  add(28.02, 28.08, 0, 2.2, -.28, .2, stD); add(28.02, 28.08, 0, 2.2, 1.1, 1.43, stD); add(28.02, 28.08, 2.05, 2.2, .2, 1.1, stD);
  add(28.02, 29.58, 2.2, 2.26, -.3, 1.45, stD);
  const lampM = M({ color: 0xffffff, emissive: 0xeef4ff, ei: 1.3 }); add(28.4, 29.2, 2.18, 2.2, .2, 1.0, lampM);
  add(29.44, 29.5, .85, .9, -.1, 1.3, MT.railLight);
  const L = new THREE.PointLight(0xeef4ff, 2.4, 3.2, 1.6); L.position.set(28.8, 2.0, .6); car.add(L);
  // 操作盤とボタン
  add(28.12, 28.36, .85, 1.45, 1.385, 1.4, M({ color: 0x9a9e9e, rough: .3, metal: .8 }));
  ELV.btns = [];
  for (let i = 0; i < 3; i++) {
    const tx = labelTex(64, 64, (g, w, h) => { g.fillStyle = '#222'; g.beginPath(); g.arc(32, 32, 30, 0, 7); g.fill(); g.strokeStyle = '#ccc'; g.lineWidth = 3; g.stroke(); g.fillStyle = '#eee'; g.font = `bold 34px ${GOTH}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(String(i + 1), 32, 34); });
    const bm = new THREE.MeshStandardMaterial({ map: tx, emissive: 0x000000, emissiveMap: tx, roughness: .4 });
    const b = new THREE.Mesh(new THREE.CircleGeometry(.035, 20), bm); b.position.set(28.24, 1.0 + i * .12, 1.384); b.rotation.y = Math.PI; car.add(b);
    interactable(b, { label: () => `${i + 1}階`, act: () => { bm.emissive.set(0xff9a30); ELV.pressed = bm; SFX.click(new V3(28.24, ELV.y + 1, 1.38)); elvCall(i); } });
    ELV.btns.push(bm);
  }
  // 各階の乗り場
  const leafM = M({ color: 0xa8acac, rough: .3, metal: .8 });
  for (let k = 0; k < 3; k++) {
    const f = ELV.floors[k];
    const a = new THREE.Mesh(new THREE.BoxGeometry(.04, 2.05, .45), leafM), b = new THREE.Mesh(new THREE.BoxGeometry(.04, 2.05, .45), leafM);
    a.position.set(27.93, f + 1.025, .425); b.position.set(27.93, f + 1.025, .875); a.castShadow = b.castShadow = true; scene.add(a, b); ELV.leaves.push([a, b]);
    { const c = addCol(27.85, 28.0, f, f + 2.05, .2, 1.1); c.door = true; ELV.cols.push(c); }
    surf(27.85, 28.02, .2, 1.1, f);
    box(27.82, 27.85, f + 2.05, f + 2.12, .15, 1.15, MT.alu, { col: false }); box(27.82, 27.85, f, f + 2.12, .15, .2, MT.alu, { col: false }); box(27.82, 27.85, f, f + 2.12, 1.1, 1.15, MT.alu, { col: false });
    // 呼びボタン
    const cb = box(27.83, 27.85, f + 1.0, f + 1.2, 1.16, 1.24, M({ color: 0x9a9e9e, rough: .3, metal: .8 }), { col: false, mesh: true });
    interactable(cb, { label: () => 'エレベーターを呼ぶ', act: () => { SFX.click(new V3(27.84, f + 1.1, 1.2)); elvCall(k); } });
    // 階数表示
    const cv = document.createElement('canvas'); cv.width = 96; cv.height = 48; const tx = new THREE.CanvasTexture(cv); tx.colorSpace = THREE.SRGBColorSpace;
    const im = new THREE.Mesh(new THREE.PlaneGeometry(.24, .12), new THREE.MeshBasicMaterial({ map: tx })); im.position.set(27.835, f + 2.3, .65); im.rotation.y = -Math.PI / 2; scene.add(im);
    ELV.ind.push({ cv, tx });
  }
  ELV.surf = { x0: 28.0, x1: 29.55, z0: -.28, z1: 1.43, y: .1 }; surfs.push(ELV.surf);
  elvIndicator();
}
function elvIndicator() {
  const moving = ELV.state === 'moving', dir = ELV.target > ELV.cur ? '▲' : ELV.target < ELV.cur ? '▼' : '';
  for (const { cv, tx } of ELV.ind) { const g = cv.getContext('2d'); g.fillStyle = '#120a06'; g.fillRect(0, 0, 96, 48); g.fillStyle = '#ff8a2a'; g.font = 'bold 30px Consolas,monospace'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText((moving ? dir : '') + (ELV.cur + 1), 48, 26); tx.needsUpdate = true; }
}
function elvCall(k) {
  if (k === ELV.cur && ELV.state !== 'moving') { if (ELV.state === 'closed' || ELV.state === 'closing') ELV.state = 'opening'; else ELV.t = 0; if (ELV.pressed) ELV.pressed.emissive.set(0); return; }
  ELV.target = k; if (ELV.state === 'open') ELV.state = 'closing';
}
function playerInCar() { return P.pos.x > 28.0 && P.pos.x < 29.6 && P.pos.z > -.3 && P.pos.z < 1.45 && Math.abs(P.pos.y - ELV.y) < .6; }
function elvUpdate(dt) {
  const inCar = playerInCar(), was = ELV.cur;
  switch (ELV.state) {
    case 'open': ELV.t += dt; if (ELV.t > 6 && !(P.pos.x > 27.8 && P.pos.x < 28.15 && P.pos.z > .1 && P.pos.z < 1.2)) { ELV.state = 'closing'; SFX.elvDoor(); } break;
    case 'closing': ELV.door -= dt / 1.1; if (P.pos.x > 27.8 && P.pos.x < 28.15 && P.pos.z > .1 && P.pos.z < 1.2 && Math.abs(P.pos.y - ELV.y) < .6) { ELV.state = 'opening'; break; } if (ELV.door <= 0) { ELV.door = 0; ELV.state = ELV.target !== ELV.cur ? 'moving' : 'closed'; if (ELV.state === 'moving') { SFX.elvStart(); elvIndicator(); } } break;
    case 'closed': if (ELV.target !== ELV.cur) { ELV.state = 'moving'; SFX.elvStart(); elvIndicator(); } break;
    case 'moving': {
      const ty = ELV.floors[ELV.target], d = ty - ELV.y, sp = Math.min(1.0, .25 + Math.abs(d) * .9);
      if (Math.abs(d) < .005) { ELV.y = ty; ELV.cur = ELV.target; ELV.state = 'opening'; SFX.elvArrive(); if (ELV.pressed) { ELV.pressed.emissive.set(0); ELV.pressed = null; } }
      else ELV.y += Math.sign(d) * Math.min(Math.abs(d), sp * dt);
      const near = ELV.floors.reduce((b, f, i) => Math.abs(f - ELV.y) < Math.abs(ELV.floors[b] - ELV.y) ? i : b, 0); if (near !== ELV.cur && ELV.state === 'moving') { ELV.cur = near; }
      break;
    }
    case 'opening': if (ELV.door === 0) SFX.elvDoor(); ELV.door += dt / 1.1; if (ELV.door >= 1) { ELV.door = 1; ELV.state = 'open'; ELV.t = 0; } break;
  }
  if (was !== ELV.cur || ELV.state === 'opening' && ELV.door < .05) elvIndicator();
  ELV.car.position.y = ELV.y; ELV.surf.y = ELV.y;
  if (inCar) { P.pos.y = ELV.y; P.vy = 0; }
  for (let k = 0; k < 3; k++) { const o = k === ELV.cur && ELV.state !== 'moving' ? ELV.door : 0, [a, b] = ELV.leaves[k]; a.position.z = .425 - o * .44; b.position.z = .875 + o * .44; ELV.cols[k].on = o < .85; }
  if (SRC.elv) { SRC.elv.pos.set(28.8, ELV.y + 2.4, .6); SRC.elv.mul = ELV.state === 'moving' ? 1 : 0; }
}
