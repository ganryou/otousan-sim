// ============================================================
// ドア
// ============================================================
class Door {
  // hinge: 蝶番の位置, along: 閉じた状態で扉が伸びる方向（'+x','-z' など）, len: 幅
  constructor({ hinge, along, len, h, t = .04, mat, open = 0, openAngle, col, zone }) {
    this.g = new THREE.Group(); this.g.position.copy(hinge);
    const geo = new THREE.BoxGeometry(along.includes('x') ? len : t, h, along.includes('z') ? len : t);
    const s = along[0] === '-' ? -1 : 1;
    if (along.includes('x')) geo.translate(s * len / 2, h / 2, 0); else geo.translate(0, h / 2, s * len / 2);
    this.panel = new THREE.Mesh(geo, mat); this.panel.castShadow = true; this.panel.receiveShadow = true; this.g.add(this.panel);
    // 取っ手
    const hx = along.includes('x') ? s * (len - .08) : 0, hz = along.includes('z') ? s * (len - .08) : 0;
    const handle = new THREE.Mesh(new THREE.BoxGeometry(along.includes('x') ? .12 : .1, .025, along.includes('z') ? .12 : .1), MT.alu); handle.position.set(hx, .95, hz); this.g.add(handle);
    scene.add(this.g);
    this.openAngle = openAngle; this.target = open; this.cur = open; this.g.rotation.y = open;
    this.col = col ? addCol(col[0], col[1], col[2], col[3], col[4], col[5]) : null; if (this.col) this.col.door = true;
    this.zone = zone;
    this.update(0);
  }
  get isOpen() { return Math.abs(this.cur) > .5; }
  set(open) { this.target = open ? this.openAngle : 0; }
  toggle() { this.set(!(Math.abs(this.target) > .01)); return Math.abs(this.target) > .01; }
  update(dt) { this.cur = lerp(this.cur, this.target, 1 - Math.exp(-dt * 5)); if (Math.abs(this.cur - this.target) < .002) this.cur = this.target; this.g.rotation.y = this.cur; if (this.col) this.col.on = Math.abs(this.cur) < .35; }
}
const DOORS = {};
function buildDoors() {
  DOORS.front = new Door({ hinge: new V3(14.5, 2.81, -0.03), along: '+x', len: .68, h: 2.02, t: .045, mat: MT.steelDoor, openAngle: -Math.PI * .5, col: [14.5, 15.18, 2.8, 4.85, -0.2, 0] });
  DOORS.friend = new Door({ hinge: new V3(15.25, 2.95, -1.45), along: '-z', len: .8, h: 1.9, t: .035, mat: M({ color: 0xe0d8c4, rough: .6 }), open: -Math.PI * .47, openAngle: -Math.PI * .47, col: [15.2, 15.3, 2.8, 4.85, -2.25, -1.45] });
  DOORS.brother = new Door({ hinge: new V3(15.25, 2.95, -3.85), along: '-z', len: .8, h: 1.9, t: .035, mat: M({ color: 0xe0d8c4, rough: .6 }), open: -0.3, openAngle: -0.3 });
  DOORS.toilet = new Door({ hinge: new V3(14.35, 2.97, -8.62), along: '+x', len: .65, h: 1.88, t: .035, mat: M({ color: 0xe6e0d0, rough: .6 }), openAngle: -Math.PI * .5, col: [14.35, 15.0, 2.8, 4.85, -8.7, -8.6] });
  interactable(DOORS.front.panel, { label: () => G.frontDoorLabel(), act: () => G.frontDoorAct() });
  interactable(DOORS.toilet.panel, { label: () => DOORS.toilet.isOpen ? 'ドアを閉める' : 'ドアを開ける', act: () => { const o = DOORS.toilet.toggle(); SFX.door(o, new V3(14.7, 3.9, -8.6)); } });
  interactable(DOORS.friend.panel, { label: () => DOORS.friend.isOpen ? 'ドアを閉める' : 'ドアを開ける', act: () => { const o = DOORS.friend.toggle(); SFX.door(o, new V3(15.25, 3.9, -1.85)); } });
  interactable(DOORS.brother.panel, { label: () => 'ドア', act: () => G.thought('弟の部屋だ。……開けるのはやめておこう。') });
}

// ============================================================
// 人物（ローポリ）
// ============================================================
function makeKid({ shirt, shorts, skinMat, scale = 1, pale = false, pants = null, shoes = null }) {
  const legM = pants || skinMat, wide = pants ? 1.35 : 1;
  const root = new THREE.Group();
  const P = (geo, mat, x, y, z) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; return m; };
  const body = new THREE.Group(); root.add(body);
  const torso = P(new THREE.CapsuleGeometry(.14, .16, 6, 16), shirt, 0, .01, 0); torso.scale.set(1.05, 1, .62); body.add(torso); const collar = P(new THREE.TorusGeometry(.055, .012, 6, 16), shirt, 0, .2, 0); collar.rotation.x = Math.PI / 2; body.add(collar);
  const sleeveL = P(new THREE.CapsuleGeometry(.05, .07, 4, 10), shirt, -.18, .09, 0), sleeveR = P(new THREE.CapsuleGeometry(.05, .07, 4, 10), shirt, .18, .09, 0); sleeveL.rotation.z = .35; sleeveR.rotation.z = -.35; body.add(sleeveL, sleeveR);
  const neck = P(new THREE.CylinderGeometry(.045, .05, .06, 8), skinMat, 0, .22, 0); body.add(neck);
  const head = new THREE.Group(); head.position.set(0, .36, 0); body.add(head);
  const skull = P(new THREE.SphereGeometry(.105, 24, 18), skinMat, 0, 0, 0); skull.scale.set(1, 1.12, 1.02); head.add(skull);
  const faceMat = new THREE.MeshStandardMaterial({ map: makeFaceTex(pale ? '#d8b8a4' : '#d9a886', pale), roughness: .7, emissive: pale ? 0x2c221c : 0, emissiveMap: null });
  const face = P(new THREE.SphereGeometry(.1062, 24, 18, Math.PI * .22, Math.PI * .56, Math.PI * .22, Math.PI * .56), faceMat, 0, 0, .002); const nose = P(new THREE.ConeGeometry(.012, .03, 8), skinMat, 0, -.012, .108); nose.rotation.x = Math.PI / 2 + .3; head.add(nose); face.scale.set(1, 1.12, 1.02); face.rotation.y = 0; head.add(face);
  const hair = P(new THREE.SphereGeometry(.112, 16, 12, 0, Math.PI * 2, 0, Math.PI * .5), MT.hair, 0, .012, -.006); hair.scale.set(1.02, 1.14, 1.06); head.add(hair); const back = P(new THREE.SphereGeometry(.108, 14, 10, Math.PI * 1.15, Math.PI * .7, Math.PI * .45, Math.PI * .35), MT.hair, 0, .0, -.004); back.scale.set(1.02, 1.12, 1.06); head.add(back);
  
  const earL = P(new THREE.SphereGeometry(.022, 8, 6), skinMat, -.105, 0, 0), earR = P(new THREE.SphereGeometry(.022, 8, 6), skinMat, .105, 0, 0); head.add(earL, earR);
  const arm = (sx) => { const sh = new THREE.Group(); sh.position.set(sx * .2, .14, 0); const up = P(new THREE.CapsuleGeometry(.033, .18, 4, 10), skinMat, 0, -.13, 0); sh.add(up); const el = new THREE.Group(); el.position.set(0, -.26, 0); sh.add(el); const lo = P(new THREE.CapsuleGeometry(.029, .17, 4, 10), skinMat, 0, -.11, 0); el.add(lo); const hand = P(new THREE.SphereGeometry(.036, 12, 10), skinMat, 0, -.235, 0); hand.scale.set(.8, 1.1, 1); el.add(hand); body.add(sh); return { sh, el }; };
  const aL = arm(-1), aR = arm(1);
  const leg = (sx) => { const hip = new THREE.Group(); hip.position.set(sx * .08, -.2, 0); const th = P(new THREE.CapsuleGeometry(.066, .1, 4, 12), shorts, 0, -.08, 0); hip.add(th); const up = P(new THREE.CapsuleGeometry(.045 * wide, .13, 4, 10), legM, 0, -.24, 0); hip.add(up); const kn = new THREE.Group(); kn.position.set(0, -.34, 0); hip.add(kn); const lo = P(new THREE.CapsuleGeometry(.038 * (pants ? 1.25 : 1), .27, 4, 10), legM, 0, -.17, 0); kn.add(lo); const ft = P(new THREE.CapsuleGeometry(.04, .12, 4, 8), shoes || MT.sock, 0, -.35, .04); ft.rotation.x = Math.PI / 2; kn.add(ft); body.add(hip); return { hip, kn }; };
  const lL = leg(-1), lR = leg(1);
  root.scale.setScalar(scale);
  const k = { root, body, head, aL, aR, lL, lR, walkT: 0 };
  k.stand = () => { body.position.set(0, .93, 0); for (const l of [lL, lR]) l.hip.rotation.order = 'XYZ'; body.rotation.set(0, 0, 0); for (const l of [lL, lR]) { l.hip.rotation.set(0, 0, 0); l.kn.rotation.set(0, 0, 0); } for (const a of [aL, aR]) { a.sh.rotation.set(0, 0, 0); a.el.rotation.set(0, 0, 0); } aL.sh.rotation.z = .08; aR.sh.rotation.z = -.08; };
  k.squat = () => { body.position.set(0, .5, .05); body.rotation.x = .25; for (const [l, s] of [[lL, 1], [lR, -1]]) { l.hip.rotation.order = 'YXZ'; l.hip.rotation.set(-1.9, -s * .35, 0); l.kn.rotation.set(2.35, 0, 0); } for (const [a, s] of [[aL, 1], [aR, -1]]) { a.sh.rotation.set(-.9, 0, s * .1); a.el.rotation.set(-.6, 0, 0); } };
  k.sitChair = () => { body.position.set(0, .62, 0); body.rotation.x = .05; for (const [l, s] of [[lL, 1], [lR, -1]]) { l.hip.rotation.order = 'XYZ'; l.hip.rotation.set(-1.5, 0, s * .06); l.kn.rotation.set(1.5, 0, 0); } for (const [a, s] of [[aL, 1], [aR, -1]]) { a.sh.rotation.set(-1.0, 0, s * .2); a.el.rotation.set(-.4, 0, s * -.3); } };
  k.sitCross = () => { body.position.set(0, .3, 0); body.rotation.x = .12; for (const [l, s] of [[lL, 1], [lR, -1]]) { l.hip.rotation.order = 'YXZ'; l.hip.rotation.set(-1.52, -s * .6, 0); l.kn.rotation.set(0, 0, s * 2.0); } for (const [a, s] of [[aL, 1], [aR, -1]]) { a.sh.rotation.set(-.75, 0, s * .15); a.el.rotation.set(-.9, 0, s * -.25); } };
  k.walk = (dt, speed) => { k.walkT += dt * speed * 5.2; const s = Math.sin(k.walkT); lL.hip.rotation.x = s * .45; lR.hip.rotation.x = -s * .45; lL.kn.rotation.x = Math.max(0, -s) * .6; lR.kn.rotation.x = Math.max(0, s) * .6; aL.sh.rotation.x = -s * .35; aR.sh.rotation.x = s * .35; body.position.y = .93 + Math.abs(Math.cos(k.walkT)) * .02; };
  k.stand();
  return k;
}
const FRIEND = {}, BROTHER = {};
function buildPeople() {
  const f = makeKid({ shirt: MT.shirtF, shorts: MT.shortsF, skinMat: MT.skin });
  scene.add(f.root); f.root.visible = false; Object.assign(FRIEND, f);
  // コントローラー
  const pad = new THREE.Mesh(new THREE.BoxGeometry(.14, .03, .07), M({ color: 0x6a6a70, rough: .4 })); pad.position.set(0, -.2, .02); f.aR.el.add(pad); FRIEND.pad = pad;
  interactable(f.body.children[0], { label: () => G.sticky ? 'ベタベタの手で首をさわる' : '話しかける', act: () => G.sticky ? stickyPrank() : G.talkFriend() });
  interactable(f.head.children[0], { label: () => G.sticky ? 'ベタベタの手で首をさわる' : '話しかける', act: () => G.sticky ? stickyPrank() : G.talkFriend() });
  const b = makeKid({ shirt: MT.shirtB, shorts: MT.shortsB, skinMat: MT.skinPale, scale: .86, pale: true });
  scene.add(b.root); b.root.visible = false; Object.assign(BROTHER, b);
  b.root.position.set(15.5, 2.95, -4.42); b.root.rotation.y = -Math.PI / 2;
}

// ============================================================
// 光と空
// ============================================================
const LT = {};
function buildLights() {
  LT.sun = new THREE.DirectionalLight(0xffffff, 3.2);
  LT.sun.castShadow = true; LT.sun.shadow.mapSize.set(Q.shadow, Q.shadow);
  const sc = LT.sun.shadow.camera; sc.left = -34; sc.right = 34; sc.top = 34; sc.bottom = -34; sc.near = 1; sc.far = 420;
  LT.sun.shadow.bias = -0.0003; LT.sun.shadow.normalBias = 0.035;
  LT.sun.target.position.set(8, 0, -10); scene.add(LT.sun, LT.sun.target);
  LT.hemi = new THREE.HemisphereLight(0xa8c4ff, 0x7f7a70, 1.0); scene.add(LT.hemi);
  LT.amb = new THREE.AmbientLight(0xffffff, 0.05); scene.add(LT.amb);
  // 友だちの部屋：窓からの昼光
  LT.window = new THREE.PointLight(0xdce8ff, 3.2, 6.5, 1.6); LT.window.position.set(17.8, 4.3, -1.25);
  LT.window.castShadow = true; LT.window.shadow.mapSize.set(Q.pshadow, Q.pshadow); LT.window.shadow.bias = -0.002; LT.window.shadow.camera.near = .1; scene.add(LT.window);
  LT.room = new THREE.PointLight(0xf0f6ff, 0, 7, 1.5); LT.room.position.set(18.0, 5.05, -1.8); scene.add(LT.room);
  LT.tv = new THREE.PointLight(0x88aaff, .6, 3.2, 1.8); LT.tv.position.set(20.1, 3.65, -1.8); scene.add(LT.tv);
  LT.toilet = new THREE.PointLight(0xffd8a0, 0, 3.0, 1.6); LT.toilet.position.set(14.68, 5.1, -9.2); LT.toilet.castShadow = true; LT.toilet.shadow.mapSize.set(256, 256); LT.toilet.shadow.bias = -0.003; scene.add(LT.toilet);
  LT.hall = new THREE.PointLight(0xffd49a, 0, 5.5, 1.7); LT.hall.position.set(14.68, 4.85, -4.8); scene.add(LT.hall);
  LT.fusuma = new THREE.PointLight(0xffe8c8, .9, 3.2, 1.6); LT.fusuma.position.set(14.5, 3.55, -7.2); scene.add(LT.fusuma);
  LT.brother = new THREE.PointLight(0xa0b0d8, 1.1, 3.0, 1.6); LT.brother.position.set(16.3, 3.9, -4.4); scene.add(LT.brother);
  LT.stair = new THREE.PointLight(0xe8f0ff, 0, 7, 1.6); LT.stair.position.set(-1.3, 5.2, -1.5); scene.add(LT.stair);
  LT.corr = new THREE.PointLight(0xe8f0ff, 0, 7, 1.6); LT.corr.position.set(17.5, 5.2, .7); scene.add(LT.corr);
  LT.corr1 = new THREE.PointLight(0xe8f0ff, 0, 7, 1.6); LT.corr1.position.set(10.5, 2.4, .7); scene.add(LT.corr1);
}
const SKY = {};
function buildSky() {
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { zen: { value: new THREE.Color() }, hor: { value: new THREE.Color() }, sunDir: { value: new V3() }, sunCol: { value: new THREE.Color() }, time: { value: 0 }, cloudCol: { value: new THREE.Color() }, cloudShade: { value: new THREE.Color() } },
    vertexShader: `varying vec3 vDir; void main(){ vec4 wp = modelMatrix*vec4(position,1.); vDir = wp.xyz - cameraPosition; vec4 p = projectionMatrix*viewMatrix*wp; gl_Position = p.xyww; }`,
    fragmentShader: `uniform vec3 zen, hor, sunDir, sunCol, cloudCol, cloudShade; uniform float time; varying vec3 vDir;
      float h(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
      float n(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f); return mix(mix(h(i),h(i+vec2(1,0)),f.x), mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x), f.y); }
      float fbm(vec2 p){ float s=0., a=.5; for(int i=0;i<6;i++){ s+=a*n(p); p=p*2.03+vec2(1.7,9.2); a*=.5; } return s; }
      void main(){ vec3 d = normalize(vDir); float y = d.y;
        vec3 col = mix(hor, zen, pow(clamp(y,0.,1.), .55));
        if (y < 0.) col = mix(hor, hor*.55, clamp(-y*6.,0.,1.));
        float sd = max(dot(d, sunDir), 0.);
        col += sunCol*(pow(sd, 900.)*60. + pow(sd, 18.)*.25 + pow(sd, 4.)*.1);
        // 入道雲（地平線近く）
        float az = atan(d.z, d.x);
        vec2 cp = vec2(az*3.2, y*9.) + vec2(time*.004, 0.);
        float tower = fbm(cp*vec2(1.0,.7)) - smoothstep(.02, .42, y)*.9 + .05;
        float c = smoothstep(.42, .6, tower) * smoothstep(-.02, .03, y);
        float lit = clamp(fbm(cp*vec2(1.,.7)+vec2(.3,.4)) - fbm(cp*vec2(1.,.7)) + .6, 0., 1.);
        vec3 cc = mix(cloudShade, cloudCol, lit) + sunCol*pow(sd,6.)*.25;
        // 高い薄雲
        vec2 up = d.xz/(y+.12)*.8 + time*.002;
        float ci = smoothstep(.55, .85, fbm(up*1.6)) * smoothstep(.05, .3, y) * .5;
        col = mix(col, cloudCol*.95, ci);
        col = mix(col, cc, c);
        gl_FragColor = vec4(col, 1.);
      }`
  });
  SKY.mesh = new THREE.Mesh(new THREE.SphereGeometry(900, 32, 16), mat); SKY.mesh.frustumCulled = false; SKY.mesh.renderOrder = -10; scene.add(SKY.mesh);
  SKY.u = mat.uniforms;
}
const TOD = {
  day: { sunPos: new V3(22, 70, -48), sun: 0xfff4e0, sunI: 3.4, hs: 0xa9c6ff, hg: 0x8a8578, hI: 1.6, fog: 0xc4d2e0, fogN: 70, fogF: 520, zen: 0x2f67c8, hor: 0xc9dcee, sunCol: 0xffeecc, cloud: 0xffffff, cloudS: 0xaab4c4, expOut: .86 },
  eve: { sunPos: new V3(90, 9, 30), sun: 0xff9a50, sunI: 2.6, hs: 0x8a86b8, hg: 0x6a4a3a, hI: .7, fog: 0xd8a080, fogN: 50, fogF: 420, zen: 0x3a4f8a, hor: 0xf0a070, sunCol: 0xffa050, cloud: 0xffc090, cloudS: 0x7a6078, expOut: 1.0 },
};
let curTOD = TOD.day;
function applyTOD(t) {
  curTOD = t;
  LT.sun.color.set(t.sun); LT.sun.intensity = t.sunI; LT.sunDir = t.sunPos.clone().normalize(); updateSunShadow(camera.position);
  LT.hemi.color.set(t.hs); LT.hemi.groundColor.set(t.hg); LT.hemiBase = t.hI;
  scene.fog = new THREE.Fog(t.fog, t.fogN, t.fogF);
  SKY.u.zen.value.set(t.zen); SKY.u.hor.value.set(t.hor); SKY.u.sunDir.value.copy(t.sunPos).normalize(); SKY.u.sunCol.value.set(t.sunCol); SKY.u.cloudCol.value.set(t.cloud); SKY.u.cloudShade.value.set(t.cloudS);
}

function updateSunShadow(p) {
  // 影の範囲をプレイヤー周辺に追従（テクセル単位でスナップしてちらつきを防ぐ）
  const step = 68 / Q.shadow * 4; const tx = Math.round(p.x / step) * step, tz = Math.round(p.z / step) * step;
  LT.sun.target.position.set(tx, 0, tz); LT.sun.target.updateMatrixWorld(); LT.sun.position.set(tx, 0, tz).addScaledVector(LT.sunDir, 160);
}
