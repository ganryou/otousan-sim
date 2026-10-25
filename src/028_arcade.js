// ============================================================
// 50円ゲーセン「ゲームコーナー ハロー」と、和泉南中の不良たち
// ============================================================
const ARC = { cabs: [], att: [], acc: 0, fgAcc: 0, shake: 0, seat: null, chatT: 6, talking: false, stare: 0, stared: 0, watchT: 0, watchCD: 0, challenged: false };
const YAN = {};
// 会話（[話し手, セリフ]）。tools/gen_voice.js がこの形を拾って音声にする
const YAN_TALK = [
  [['yan1', '……なあ、明日プール行かね？'], ['yan2', '……だりい。'], ['yan1', '……だよな。']],
  [['yan2', '……ハローの格ゲー、また新しいの入るらしいぜ。'], ['yan1', '……マジで？ 五十円？'], ['yan2', '……たぶん百円。'], ['yan1', '……ふざけんなよ。']],
  [['yan1', '……センコーにバレたら、また呼び出しだぞ。'], ['yan2', '……夏休みだから関係ねえって。']],
  [['yan2', '……あちい。'], ['yan1', '……あちいな。']],
  [['yan1', '……泉南中の連中、最近調子こいてるよな。'], ['yan2', '……今度シメる？'], ['yan1', '……いや、めんどくせえ。']],
  [['yan2', '……ポケベル、鳴んねえ。'], ['yan1', '……誰も打ってねえんだろ。']],
  [['yan1', '……ジャンプ、もう読んだ？'], ['yan2', '……まだ。あとで立ち読みしてくるわ。']],
];
const YAN_STARE = [['yan1', '……なんだよ。'], ['yan2', '……見てんじゃねえよ。'], ['yan1', '……和泉南中？ ……ちげえか。']];
const YAN_ASK = [['yan1', '……あ？ なんか用かよ。'], ['yan2', '……中、入んなら入れよ。'], ['yan1', '……ガキはさっさと帰れって。']];
const YAN_IN = [['yan3', '……なに見てんだよ。'], ['yan3', '……あっち行けよ。'], ['yan3', '……チッ。'], ['yan3', '……今のなしな。'], ['yan3', '……よえーな。'], ['yan3', '……出直してこいよ。'], ['yan3', '……もう一回やれよ。']];
const yanLine = (who, t, o = {}) => { if (o.sub !== false) showSub(t, { who: o.label || '不良', cls: o.far ? 'far' : '', dur: Math.max(2, t.length * .15 + 1), noVoice: true }); return sayLine(who, t); };

// ---- 筐体の画面（ブラウン管）
function arcCRT(map, hud) {
  return new THREE.ShaderMaterial({
    uniforms: { map: { value: map }, hud: { value: hud }, useHud: { value: hud ? 1 : 0 }, time: { value: 0 }, bright: { value: 1.15 }, jolt: { value: 0 } },
    vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
    fragmentShader: `uniform sampler2D map, hud; uniform float time, bright, useHud, jolt; varying vec2 vUv;
      vec2 curve(vec2 uv){ uv=uv*2.-1.; vec2 o=abs(uv.yx)/vec2(5.,4.); uv=uv+uv*o*o; return uv*.5+.5; }
      void main(){ vec2 uv=curve(vUv); if(uv.x<0.||uv.y<0.||uv.x>1.||uv.y>1.){ gl_FragColor=vec4(0.003,0.004,0.005,1.); return; }
        uv.x += jolt*sin(uv.y*40.+time*60.)*.02;
        vec2 px = vec2(1./320., 0.);
        vec3 c = vec3(texture2D(map, uv+px).r, texture2D(map, uv).g, texture2D(map, uv-px).b);
        if (useHud > .5) { vec4 h = texture2D(hud, uv); c = mix(c, h.rgb, h.a); }
        c = min(c, vec3(1.2));
        float sl = .75 + .25*sin(uv.y*240.*6.2832);
        float mask = .88 + .12*sin(gl_FragCoord.x*2.0944);
        vec2 v = uv*(1.-uv); float vig = pow(v.x*v.y*16., .25);
        c = c*sl*mask*vig*bright + vec3(.005,.007,.009);
        gl_FragColor = vec4(c, 1.); }`,
  });
}
// ---- ほかのゲームのデモ画面（キャンバスに描いて、少しずつ動かす）
function attractScreen(kind, seed) {
  const cv = document.createElement('canvas'); cv.width = 256; cv.height = 192; const g = cv.getContext('2d'), r = mulberry32(seed);
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.magFilter = THREE.NearestFilter; tex.generateMipmaps = false; tex.minFilter = THREE.LinearFilter;
  const st = { stars: Array.from({ length: 40 }, () => [r() * 256, r() * 192, .5 + r() * 2]), en: [], blocks: [], t: r() * 10, q: 0 };
  const cols = ['#e33', '#3c3', '#36f', '#fd3', '#c3c', '#3cc'];
  const draw = dt => {
    st.t += dt; const t = st.t;
    if (kind === 'shoot') {
      g.fillStyle = '#000010'; g.fillRect(0, 0, 256, 192);
      for (const s of st.stars) { s[1] = (s[1] + s[2] * dt * 40) % 192; g.fillStyle = s[2] > 1.8 ? '#fff' : '#88a'; g.fillRect(s[0], s[1], 1, s[2] > 1.5 ? 2 : 1); }
      if (r() < dt * 2) st.en.push([20 + r() * 216, -10, (r() - .5) * 40]); for (const e of st.en) { e[1] += dt * 50; e[0] += e[2] * dt; g.fillStyle = '#f84'; g.fillRect(e[0] - 6, e[1] - 4, 12, 8); g.fillStyle = '#ff0'; g.fillRect(e[0] - 2, e[1] + 4, 4, 3); } st.en = st.en.filter(e => e[1] < 200);
      const sx = 128 + Math.sin(t * 1.3) * 80; g.fillStyle = '#6cf'; g.beginPath(); g.moveTo(sx, 160); g.lineTo(sx - 9, 176); g.lineTo(sx + 9, 176); g.fill(); g.fillStyle = '#ff8'; for (let i = 0; i < 5; i++) g.fillRect(sx - 1, 150 - ((t * 300 + i * 30) % 150), 2, 6);
      g.fillStyle = '#fff'; g.font = 'bold 10px monospace'; g.fillText('1UP  ' + String(Math.floor(t * 130) * 10).padStart(7, '0'), 6, 12); g.fillText('HI 0500000', 160, 12);
    } else if (kind === 'puzzle') {
      g.fillStyle = '#102040'; g.fillRect(0, 0, 256, 192); g.fillStyle = '#000'; g.fillRect(80, 8, 96, 176); g.strokeStyle = '#88f'; g.strokeRect(80, 8, 96, 176);
      if (!st.grid) st.grid = Array.from({ length: 22 }, (_, y) => Array.from({ length: 12 }, () => y > 13 && r() < .8 ? cols[Math.floor(r() * 6)] : null));
      st.q += dt; if (st.q > .5) { st.q = 0; const y = 13 + Math.floor(r() * 9), x = Math.floor(r() * 12); st.grid[y][x] = st.grid[y][x] ? null : cols[Math.floor(r() * 6)]; }
      for (let y = 0; y < 22; y++) for (let x = 0; x < 12; x++) if (st.grid[y][x]) { g.fillStyle = st.grid[y][x]; g.fillRect(80 + x * 8, 8 + y * 8, 7, 7); }
      const fy = (t * 30) % 110; g.fillStyle = cols[Math.floor(t / 3.6) % 6]; for (let i = 0; i < 3; i++) g.fillRect(120, 8 + fy + i * 8, 7, 7);
      g.fillStyle = '#fff'; g.font = 'bold 11px monospace'; g.fillText('COLUMN', 12, 40); g.fillText('DROP', 12, 54); g.fillText('SCORE', 190, 40); g.fillText(String(Math.floor(t * 77)), 190, 54);
    } else if (kind === 'race') {
      g.fillStyle = '#58c'; g.fillRect(0, 0, 256, 90); g.fillStyle = '#3a6a2a'; g.fillRect(0, 90, 256, 102);
      const cv2 = Math.sin(t * .5) * 50;
      for (let y = 90; y < 192; y += 2) { const k = (y - 90) / 102, w = 20 + k * 220, cx = 128 + cv2 * (1 - k) ** 2, z = 1 / (k + .05); g.fillStyle = Math.floor(z * 3 + t * 14) % 2 ? '#666' : '#5e5e5e'; g.fillRect(cx - w / 2, y, w, 2); g.fillStyle = Math.floor(z * 3 + t * 14) % 2 ? '#e33' : '#fff'; g.fillRect(cx - w / 2 - 6 * k, y, 6 * k, 2); g.fillRect(cx + w / 2, y, 6 * k, 2); }
      g.fillStyle = '#d22'; g.fillRect(110, 160, 36, 16); g.fillStyle = '#222'; g.fillRect(108, 172, 8, 6); g.fillRect(140, 172, 8, 6);
      g.fillStyle = '#ff0'; g.font = 'bold 12px monospace'; g.fillText('TIME ' + (60 - Math.floor(t % 60)), 8, 14); g.fillText(Math.floor(180 + Math.sin(t) * 40) + 'km/h', 180, 14);
    } else if (kind === 'mahjong') {
      g.fillStyle = '#0a5a2a'; g.fillRect(0, 0, 256, 192);
      for (let i = 0; i < 13; i++) { g.fillStyle = '#f4f0e0'; g.fillRect(14 + i * 17, 150, 15, 22); g.fillStyle = ['#c22', '#226', '#262'][i % 3]; g.font = '10px sans-serif'; g.fillText('一二三四五六七八九'[i % 9], 17 + i * 17, 165); }
      for (let i = 0; i < 9; i++) { g.fillStyle = '#e8e4d0'; g.fillRect(60 + i * 15, 20, 13, 18); }
      g.fillStyle = Math.floor(t * 2) % 2 ? '#ff0' : '#fff'; g.font = `bold 18px ${GOTH}`; g.fillText('麻雀 夜桜', 80, 100); g.font = 'bold 11px monospace'; g.fillText('PUSH START', 92, 130);
    } else {
      g.fillStyle = '#1838a8'; g.fillRect(0, 0, 256, 192); g.fillStyle = '#fff'; g.font = `bold 16px ${GOTH}`; g.fillText('クイズ 雑学王', 70, 30);
      g.font = `12px ${GOTH}`; const qs = ['日本でいちばん高い山は？', '「源氏物語」の作者は？', '1ダースはいくつ？', 'パンダの好物は？']; g.fillText('Q. ' + qs[Math.floor(t / 4) % 4], 20, 70);
      for (let i = 0; i < 4; i++) { g.fillStyle = Math.floor(t * 3) % 4 === i ? '#fd3' : '#4a6ad8'; g.fillRect(30, 90 + i * 24, 196, 20); g.fillStyle = '#fff'; g.fillText(['A', 'B', 'C', 'D'][i], 38, 105 + i * 24); }
    }
    tex.needsUpdate = true;
  };
  draw(0); return { tex, draw };
}
function marqueeTex(title, col) {
  return labelTex(256, 64, (g, w, h) => { const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, col); gr.addColorStop(1, '#111'); g.fillStyle = gr; g.fillRect(0, 0, w, h); g.fillStyle = '#fff'; g.strokeStyle = '#000'; g.lineWidth = 4; g.font = `bold 30px Impact,${GOTH}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.strokeText(title, w / 2, h / 2); g.fillText(title, w / 2, h / 2); });
}
// ---- 筐体（アストロシティのような、座って遊ぶ型）。ローカルでは +z が遊ぶ人の側
function arcCab(x, z, ry, scrMat, title, col) {
  const grp = new THREE.Group(); grp.position.set(x, SW_Y, z); grp.rotation.y = ry; scene.add(grp);
  const body = M({ color: 0xe8e8e4, rough: .45 }), dark = M({ color: 0x1a1a1e, rough: .5 }), panelM = M({ color: col, rough: .5 });
  const B = (w, h, d, m, px, py, pz, rx = 0) => { const g = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); g.position.set(px, py, pz); g.rotation.x = rx; g.castShadow = true; g.receiveShadow = true; grp.add(g); return g; };
  B(.74, .72, .7, body, 0, .36, -.1);                 // 下の箱
  B(.74, .12, .34, panelM, 0, .78, .22, .18);         // 操作パネル
  B(.74, 1.0, .5, body, 0, 1.22, -.2);                // 上の箱
  B(.6, .48, .06, dark, 0, 1.22, .06, -.3);           // 画面のふち
  const scr = new THREE.Mesh(new THREE.PlaneGeometry(.54, .405), scrMat); scr.position.set(0, 1.22, .095); scr.rotation.x = -.3; grp.add(scr);
  const mq = new THREE.Mesh(new THREE.BoxGeometry(.74, .16, .2), new THREE.MeshStandardMaterial({ map: marqueeTex(title, col), emissive: 0xffffff, emissiveMap: marqueeTex(title, col), emissiveIntensity: .9 })); mq.position.set(0, 1.66, .02); grp.add(mq);
  // レバーとボタン
  const stick = new THREE.Mesh(new THREE.CylinderGeometry(.008, .008, .08, 6), dark); stick.position.set(-.18, .89, .24); grp.add(stick);
  const ball = new THREE.Mesh(new THREE.SphereGeometry(.022, 10, 8), M({ color: 0xd02020, rough: .3 })); ball.position.set(-.18, .93, .24); grp.add(ball);
  for (let i = 0; i < 3; i++) { const b = new THREE.Mesh(new THREE.CylinderGeometry(.018, .018, .015, 12), M({ color: [0x2060e0, 0xe0d020, 0xe03030][i], rough: .3 })); b.position.set(.04 + i * .07, .86, .23); b.rotation.x = .18; grp.add(b); }
  B(.12, .05, .02, M({ color: 0x888888, metal: .7, rough: .3 }), .2, .55, .255);   // コイン投入口
  // 丸いすツール
  const stool = new THREE.Group(); stool.position.set(0, 0, .78); grp.add(stool);
  const seatM = M({ color: 0xb02020, rough: .6 }), legM = M({ color: 0x888888, metal: .8, rough: .3 });
  const seat = new THREE.Mesh(new THREE.CylinderGeometry(.17, .17, .06, 16), seatM); seat.position.y = .46; seat.castShadow = true; stool.add(seat);
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(.025, .025, .44, 8), legM); pole.position.y = .22; stool.add(pole);
  const foot = new THREE.Mesh(new THREE.CylinderGeometry(.16, .18, .03, 12), legM); foot.position.y = .015; stool.add(foot);
  // 当たり判定（向きは 90 度ごとなので、箱の向きを入れ替えるだけ）
  const c = Math.round(Math.cos(ry)), s = Math.round(Math.sin(ry)), lx = .4, lz0 = -.47, lz1 = .42;
  const pts = [[-lx, lz0], [lx, lz0], [-lx, lz1], [lx, lz1]].map(([a, b]) => [x + a * c + b * s, z - a * s + b * c]);
  addCol(Math.min(...pts.map(p => p[0])), Math.max(...pts.map(p => p[0])), 0, 1.8, Math.min(...pts.map(p => p[1])), Math.max(...pts.map(p => p[1])));
  const cab = { grp, scr, stool, x, z, ry, seatPos: new V3(x + .78 * s, SW_Y, z + .78 * c) };
  ARC.cabs.push(cab); return cab;
}
// ---- 建物（shop() から呼ばれる）
function buildArcade(x0, x1, zf, zb, dir, o, H) {
  const zA = Math.min(zf, zb), zB = Math.max(zf, zb), out = -dir, cx = (x0 + x1) / 2, CH = 3.0;
  const wm = M({ map: TX.stucco, color: 0xd8d0c8, uv: 2 }), inW = M({ color: 0x2a2234, rough: .9 }), fl = M({ color: 0x3a3448, rough: .95 });
  // 外壁と正面（入口のまわりはガラス）
  box(x0, x1, CH, H, zf - .1, zf + .1, wm, { col: false });
  box(x0, x0 + .2, 0, H, zA, zB, wm); box(x1 - .2, x1, 0, H, zA, zB, wm); box(x0, x1, 0, H, zA, zA + .2, wm);
  const dX0 = cx - 1.1, dX1 = cx + 1.1, glass = M({ color: 0x8090a0, rough: .05, metal: .6, transparent: true, opacity: .45 });
  box(x0 + .2, dX0, 0, CH, zf - .04, zf + .04, glass, { cast: false }); box(dX1, x1 - .2, 0, CH, zf - .04, zf + .04, glass, { cast: false });
  for (const xx of [x0 + .2, dX0, dX1, x1 - .2]) box(xx - .05, xx + .05, 0, CH, zf - .06, zf + .06, MT.alu, { col: false });
  box(x0 + .2, x1 - .2, CH - .08, CH, zf - .06, zf + .06, MT.alu, { col: false });
  // ガラスに貼られたポスター
  const poster = (title, c1, c2) => labelTex(256, 360, (g, w, h) => { const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, c1); gr.addColorStop(1, c2); g.fillStyle = gr; g.fillRect(0, 0, w, h); g.fillStyle = 'rgba(0,0,0,.35)'; for (let i = 0; i < 6; i++) { g.beginPath(); g.arc(60 + i * 30, 200 - i * 12, 40, 0, 7); g.fill(); } g.fillStyle = '#fff'; g.strokeStyle = '#000'; g.lineWidth = 5; g.font = `bold 34px Impact,${GOTH}`; g.textAlign = 'center'; g.strokeText(title, w / 2, 70); g.fillText(title, w / 2, 70); g.font = `bold 22px ${GOTH}`; g.fillText('好評稼働中！', w / 2, 320); });
  decal(poster('FIGHTING EDGE 2', '#e84020', '#401010'), .7, 1.0, new V3(x0 + .9, 1.5, zf + out * .05), out > 0 ? 0 : Math.PI);
  decal(poster('STAR BLASTER', '#2040c0', '#000020'), .7, 1.0, new V3(x1 - .9, 1.5, zf + out * .05), out > 0 ? 0 : Math.PI);
  const yen50 = labelTex(256, 128, (g, w, h) => { g.fillStyle = '#ffe020'; g.fillRect(0, 0, w, h); g.fillStyle = '#d01010'; g.font = `bold 64px ${GOTH}`; g.textAlign = 'center'; g.fillText('全機種', w / 2, 58); g.font = `bold 50px ${GOTH}`; g.fillText('50円', w / 2, 116); });
  decal(yen50, .7, .35, new V3(x0 + 1.9, 2.2, zf + out * .05), out > 0 ? 0 : Math.PI);
  // 床・天井・内壁
  box(x0, x1, 0, SW_Y, zA, zB, fl, { col: false }); surf(x0 + .2, x1 - .2, zA + .2, zB, SW_Y);
  box(x0 + .2, x1 - .2, CH, CH + .1, zA + .2, zB - .1, M({ color: 0x18161c, rough: .9 }), { col: false });
  box(x0 + .2, x0 + .22, SW_Y, CH, zA + .2, zB - .1, inW, { col: false }); box(x1 - .22, x1 - .2, SW_Y, CH, zA + .2, zB - .1, inW, { col: false }); box(x0 + .2, x1 - .2, SW_Y, CH, zA + .2, zA + .22, inW, { col: false });
  TOWN.arcBox = { x0, x1, z0: zA, z1: zB };
  // 看板（屋号）
  const st = labelTex(1024, 160, (g, w, h) => { g.fillStyle = '#7a1a8a'; g.fillRect(0, 0, w, h); g.fillStyle = '#ffe040'; g.font = `bold 92px ${GOTH}`; g.textAlign = 'center'; g.fillText('ゲームコーナー ハロー', w / 2, 112); for (let i = 0; i < 24; i++) { g.fillStyle = i % 2 ? '#fff' : '#ff4080'; g.beginPath(); g.arc(20 + i * 43, 12, 6, 0, 7); g.arc(20 + i * 43, h - 12, 6, 0, 7); g.fill(); } });
  const sm = new THREE.MeshStandardMaterial({ map: st, emissive: 0xffffff, emissiveMap: st, emissiveIntensity: .35 });
  const sg = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0 - .6, 1.2), sm); sg.position.set(cx, 3.8, zf + out * .12); sg.rotation.y = out > 0 ? 0 : Math.PI; scene.add(sg); TOWN.shops.push(sm);
  if (o.awn) {
    const at = labelTex(256, 64, (g, ww, hh) => { for (let x = 0; x < ww; x += 32) { g.fillStyle = '#' + o.awn[(x / 32) % 2].toString(16).padStart(6, '0'); g.fillRect(x, 0, 32, hh); } });
    at.wrapS = THREE.RepeatWrapping; at.repeat.set((x1 - x0) / 2.5, 1);
    const a = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0 - .2, 1.2), new THREE.MeshStandardMaterial({ map: at, roughness: .9, side: THREE.DoubleSide })); a.position.set(cx, 3.05, zf + out * .5); a.rotation.x = out > 0 ? -1.1 : 1.1; if (out < 0) a.rotation.y = Math.PI; a.castShadow = true; scene.add(a);
  }
  // 蛍光灯
  const tubeM = M({ color: 0xffffff, emissive: 0xeef4ff, ei: 1.6 });
  for (const xx of [x0 + 2, cx, x1 - 2]) for (let k = 0; k < 3; k++) { const z = zf + dir * (1.6 + k * 2.8); box(xx - .6, xx + .6, CH - .06, CH - .02, z - .05, z + .05, tubeM, { col: false, cast: false }); }
  for (const k of [0, 1]) { const L = new THREE.PointLight(0xe8f0ff, 3.2, 9, 1.4); L.position.set(cx, CH - .3, zf + dir * (2.2 + k * 4)); scene.add(L); }
  const glow = new THREE.PointLight(0x8060ff, 1.4, 5, 1.6); glow.position.set(cx - .5, 1.3, zf + dir * 4.2); scene.add(glow);
  // 筐体の配置
  const AT = [['shoot', 'STAR BLASTER', '#2848c8'], ['mahjong', '麻雀 夜桜', '#c82868'], ['puzzle', 'COLUMN DROP', '#28a848'], ['quiz', 'クイズ雑学王', '#2868c8'], ['race', 'ROAD FEVER', '#d86018'], ['puzzle', 'COLUMN DROP', '#28a848']];
  const mkAtt = (i) => { const a = attractScreen(AT[i][0], 31 + i * 7); const m = arcCRT(a.tex, null); ARC.att.push({ a, m }); return m; };
  // 西の壁ぞい（遊ぶ人は東を向く）
  [-1.9, -2.8, -3.7, -4.6].forEach((dz, i) => { const c = arcCab(x0 + .75, zf + dz * -dir, Math.PI / 2, mkAtt(i), AT[i][1], AT[i][2]); c.kind = AT[i][0]; });
  // 対戦台（背中あわせ）。手前が自分の台、奥が向こう側
  FG.crt = arcCRT(FG.rt.texture, FG.hudTex); FG.crt2 = arcCRT(FG.rt.texture, FG.hudTex);
  const vx = cx - .3, vz = zf + dir * 4.2;
  ARC.vs1 = arcCab(vx, vz, out > 0 ? 0 : Math.PI, FG.crt, 'FIGHTING EDGE 2', '#c82020');
  ARC.vs2 = arcCab(vx, vz + dir * 1.0, out > 0 ? Math.PI : 0, FG.crt2, 'FIGHTING EDGE 2', '#c82020');
  // もう一組（デモ画面だけ）
  arcCab(vx + 1.6, vz, out > 0 ? 0 : Math.PI, mkAtt(4), AT[4][1], AT[4][2]); arcCab(vx + 1.6, vz + dir * 1.0, out > 0 ? Math.PI : 0, mkAtt(5), AT[5][1], AT[5][2]);
  // クレーンゲーム（入口の右）
  const kx0 = x1 - 1.35, kx1 = x1 - .3, kz0 = zf + dir * .5, kz1 = zf + dir * 1.6;
  box(kx0, kx1, SW_Y, .9, kz0, kz1, M({ color: 0xe84080, rough: .4 }));
  box(kx0 + .03, kx1 - .03, .9, 1.95, kz0 + dir * .03, kz1 - dir * .03, M({ color: 0xc0e0ff, rough: .05, metal: .2, transparent: true, opacity: .25 }), { col: false, cast: false });
  box(kx0, kx1, 1.95, 2.25, kz0, kz1, M({ color: 0xffffff, emissive: 0xffe0f0, ei: 1.2 }), { col: false });
  addCol(kx0, kx1, 0, 2.25, kz0, kz1);
  const pr = mulberry32(77); for (let i = 0; i < 14; i++) { const p = new THREE.Mesh(new THREE.SphereGeometry(.09 + pr() * .05, 10, 8), M({ color: [0xf0c040, 0x60a0f0, 0xf06080, 0xffffff, 0x80d060][i % 5], rough: .9 })); p.position.set(lerp(kx0 + .15, kx1 - .15, pr()), 1.0 + pr() * .15, lerp(kz0, kz1, .2 + pr() * .6)); p.scale.set(1, .8, 1); scene.add(p); }
  const claw = new THREE.Mesh(new THREE.ConeGeometry(.08, .14, 3), M({ color: 0xc0c0c0, metal: .8, rough: .3 })); claw.position.set((kx0 + kx1) / 2, 1.75, (kz0 + kz1) / 2); claw.rotation.x = Math.PI; scene.add(claw); ARC.claw = claw;
  hitProxy(kx0, kx1, .9, 1.95, Math.min(kz0, kz1), Math.max(kz0, kz1), { label: () => 'クレーンゲームを見る', act: () => G.thought(pick(['黄色いクマのぬいぐるみ。アームが、いかにも弱そうだ。', '「1回100円」と書いてある。ここだけ高い。', 'ぬいぐるみの山の奥に、なぜか目覚まし時計が埋まっている。'])) });
  // 両替機と自販機（東の壁）
  const rz = zf + dir * 3.2; box(x1 - .55, x1 - .2, SW_Y, 1.5, rz - .3, rz + .3, M({ color: 0x3a5a9a, rough: .4 }));
  const ry2 = labelTex(128, 128, (g, w, h) => { g.fillStyle = '#3a5a9a'; g.fillRect(0, 0, w, h); g.fillStyle = '#fff'; g.font = `bold 26px ${GOTH}`; g.textAlign = 'center'; g.fillText('両替機', 64, 40); g.font = `16px ${GOTH}`; g.fillText('千円札→100円', 64, 74); g.fillStyle = '#ffd040'; g.fillRect(34, 92, 60, 20); });
  decal(ry2, .5, .5, new V3(x1 - .56, 1.1, rz), -Math.PI / 2);
  hitProxy(x1 - .6, x1 - .2, .6, 1.5, rz - .3, rz + .3, { label: () => '両替機', act: () => G.thought('千円札なんて持っていない。……小銭は、あと' + G.yen + '円。') });
  const vz2 = zA + .9; box(x1 - .95, x1 - .2, SW_Y, 1.85, vz2 - .4, vz2 + .4, M({ color: 0xc02020, rough: .4 }));
  const vt = labelTex(256, 256, (g, w, h) => { g.fillStyle = '#e8e8e0'; g.fillRect(0, 0, w, h); for (let i = 0; i < 12; i++) { g.fillStyle = ['#c22', '#26c', '#e92', '#2a4', '#fff', '#444'][i % 6]; g.fillRect(14 + (i % 6) * 38, 20 + Math.floor(i / 6) * 90, 28, 60); g.fillStyle = '#222'; g.font = `12px ${GOTH}`; g.fillText('110', 18 + (i % 6) * 38, 96 + Math.floor(i / 6) * 90); } });
  decal(vt, .62, .7, new V3(x1 - .96, 1.35, vz2), -Math.PI / 2, { emissive: 0xffffff, ei: .6 });
  hitProxy(x1 - 1.0, x1 - .2, .4, 1.85, vz2 - .4, vz2 + .4, { label: () => 'ジュースを買う（110円）', act: () => { if (G.yen < 110) { G.thought('110円に、足りない。'); return; } G.yen -= 110; SFX.juice && SFX.juice(new V3(x1 - .9, .5, vz2)); G.thought('ガコン。……ゲーセンの自販機のジュースは、なぜか少しぬるい。（のこり' + G.yen + '円）'); } });
  // 奥の壁：注意書き
  const warn = labelTex(512, 256, (g, w, h) => { g.fillStyle = '#fff'; g.fillRect(0, 0, w, h); g.strokeStyle = '#c00'; g.lineWidth = 8; g.strokeRect(8, 8, w - 16, h - 16); g.fillStyle = '#c00'; g.font = `bold 34px ${GOTH}`; g.textAlign = 'center'; g.fillText('お客様へ', w / 2, 60); g.fillStyle = '#111'; g.font = `bold 26px ${GOTH}`; g.fillText('16歳未満の方は', w / 2, 112); g.fillText('午後6時以降の入場を', w / 2, 150); g.fillText('お断りいたします', w / 2, 188); g.font = `18px ${GOTH}`; g.fillText('ゲームコーナー ハロー 店長', w / 2, 232); });
  decal(warn, .9, .45, new V3(cx - 1.6, 1.8, zA + .24), 0);
  interactable(decal(labelTex(256, 128, (g, w, h) => { g.fillStyle = '#ffe020'; g.fillRect(0, 0, w, h); g.fillStyle = '#111'; g.font = `bold 28px ${GOTH}`; g.textAlign = 'center'; g.fillText('台パン禁止', w / 2, 52); g.font = `20px ${GOTH}`; g.fillText('台をたたかないでください', w / 2, 96); }), .6, .3, new V3(cx + .6, 1.9, zA + .24), 0), { label: () => '貼り紙を読む', act: () => G.thought('「台パン禁止」。紙の端が、何度も貼り直されている。') });
  const door = M({ color: 0x5a5a62, rough: .5, metal: .3 }); box(x0 + .5, x0 + 1.4, SW_Y, 2.1, zA + .2, zA + .26, door, { col: false });
  decal(labelTex(256, 64, (g, w, h) => { g.fillStyle = '#eee'; g.fillRect(0, 0, w, h); g.fillStyle = '#222'; g.font = `bold 30px ${GOTH}`; g.textAlign = 'center'; g.fillText('STAFF ONLY', w / 2, 44); }), .5, .13, new V3(x0 + .95, 1.7, zA + .27), 0);
  // 灰皿スタンドとベンチ（入口の左）
  const ash = new THREE.Mesh(new THREE.CylinderGeometry(.12, .12, .7, 12), M({ color: 0x8a8a8a, metal: .7, rough: .3 })); ash.position.set(x0 + .6, SW_Y + .35, zf + dir * .6); scene.add(ash);
  box(x0 + .3, x0 + 1.5, SW_Y, SW_Y + .42, zf + dir * 1.0, zf + dir * 1.35, M({ color: 0x3a6aa8, rough: .5 }));
}

// ---- 不良たち
function buildYankees() {
  const gakuran = M({ color: 0x16171d, rough: .85 }), white = M({ color: 0xeeeeea, rough: .9 }), sandal = M({ color: 0x222222, rough: .7 }), sneak = M({ color: 0xd8d8d0, rough: .7 });
  const blond = M({ color: 0xc8a050, rough: .7 }), brown = M({ color: 0x5a3018, rough: .7 });
  const mk = (o, hairM, pomp) => { const k = makeKid({ shirt: o.shirt, shorts: gakuran, skinMat: MT.skin, scale: 1.08, pants: gakuran, shoes: o.shoes });
    k.head.traverse(m => { if (m.isMesh && m.material === MT.hair && hairM) m.material = hairM; });
    if (pomp) { const p = new THREE.Mesh(new THREE.SphereGeometry(.07, 12, 10), hairM || MT.hair); p.scale.set(1.2, .9, 1.6); p.position.set(0, .1, .07); k.head.add(p); }
    scene.add(k.root); return k; };
  YAN.a = mk({ shirt: white, shoes: sandal }, blond, true);
  YAN.b = mk({ shirt: gakuran, shoes: sneak }, brown, false);
  YAN.c = mk({ shirt: white, shoes: sneak }, null, true);
  const B = TOWN.arcBox, zf = B.z1;
  YAN.a.root.position.set(B.x0 + 1.0, SW_Y, zf + .9); YAN.b.root.position.set(B.x0 + 1.9, SW_Y, zf + 1.35);
  for (const [k, o] of [[YAN.a, YAN.b], [YAN.b, YAN.a]]) { k.squat(); const d = new V3().subVectors(o.root.position, k.root.position); k.root.rotation.y = Math.atan2(d.x, d.z) + (k === YAN.a ? .7 : -.5); k.baseRy = k.root.rotation.y; const p = k.root.position; addCol(p.x - .3, p.x + .3, 0, 1, p.z - .3, p.z + .3); }
  // 中の一人（だいたい7割の確率でいる）
  YAN.cIn = Math.random() < .7;
  const sp = ARC.vs2.seatPos; YAN.c.root.position.set(sp.x, SW_Y, sp.z); YAN.c.root.rotation.y = ARC.vs2.ry + Math.PI; YAN.c.sitChair(); YAN.c.root.visible = YAN.cIn;
  if (YAN.cIn) addCol(sp.x - .25, sp.x + .25, 0, 1.4, sp.z - .25, sp.z + .25);
  for (const k of [YAN.a, YAN.b]) for (const m of [k.body.children[0], k.head.children[0]]) interactable(m, { label: () => '話しかける', act: () => yanAsk() });
  interactable(YAN.c.body.children[0], { label: () => YAN.cIn ? '話しかける' : '', act: () => { const l = pick(YAN_IN.slice(0, 2)); yanLine(l[0], l[1]); yanLookAt(YAN.c, 1); } });
}
function yanAsk() {
  if (ARC.talking) return; const i = Math.min(ARC.asked = (ARC.asked || 0) + 1, YAN_ASK.length) - 1, [who, t] = YAN_ASK[i];
  yanLine(who, t); setTimeout(() => G.thought(i < 2 ? '……目を合わせないようにした。' : '……早く、ここから離れたい。'), 2600);
}
function yanLookAt(k, a) { k.lookAmt = a; }
// 首をこちらへ向ける（なめらかに）
function yanHead(k, dt) {
  const p = k.root.position, d = new V3().subVectors(camera.position, p), want = (k.lookAmt || 0) > 0 ? Math.atan2(d.x, d.z) - k.root.rotation.y : 0;
  let a = ((want + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI; a = clamp(a, -1.2, 1.2);
  k.head.rotation.y = lerp(k.head.rotation.y, a * (k.lookAmt || 0), 1 - Math.exp(-dt * 5)); k.head.rotation.x = lerp(k.head.rotation.x, (k.lookAmt || 0) * -.15 + .1, 1 - Math.exp(-dt * 4));
}
async function yanChat() {
  ARC.talking = true; const conv = pick(YAN_TALK);
  for (const [who, t] of conv) {
    if (ARC.stare > 0) break; const near = camera.position.distanceTo(YAN.a.root.position) < 7 && G.zone === 'out';
    const k = who === 'yan1' ? YAN.a : YAN.b; k.head.rotation.x = .2;
    const d = await yanLine(who, t, { sub: near, far: true }); await wait(Math.max(1.2, (d || t.length * .12) + .5));
  }
  ARC.talking = false;
}
function arcVoicePos(who) {
  if (who === 'yan1' && YAN.a) return [YAN.a.root.position.clone().add(new V3(0, .9, 0)), 'out'];
  if (who === 'yan2' && YAN.b) return [YAN.b.root.position.clone().add(new V3(0, .9, 0)), 'out'];
  if (who === 'yan3' && YAN.c) return [YAN.c.root.position.clone().add(new V3(0, 1.1, 0)), 'arcade'];
  if (who === 'fgann' && ARC.vs1) return [ARC.vs1.scr.getWorldPosition(new V3()), 'arcade'];
  return null;
}

// ---- 対戦台にすわって遊ぶ
function arcSit() {
  if (G.arcSeat) return; G.arcSeat = true; const sp = ARC.vs1.seatPos;
  P.pos.set(sp.x, SW_Y, sp.z); P.yaw = ARC.vs1.ry; P.pitch = -.12;
  ARC.seatCam = new V3(sp.x, SW_Y + 1.16, sp.z - Math.cos(ARC.vs1.ry) * .05);
  if (!G.flags.arcFirst) { G.flags.arcFirst = true; G.thought('丸いすに座った。レバーが少し、べたべたしている。'); }
  arcCoin();
}
function arcCoin() {
  if (FG.playing && FG.state !== 'end') return;
  if (G.yen < 50) { G.thought('もう50円玉がない。……のこり' + G.yen + '円。'); return; }
  G.yen -= 50; arcCoinSfx(ARC.vs1.scr.getWorldPosition(new V3()));
  FG.side = 0; FG.playing = true; FG.loud = true; FG.vsMan = false; FG.challenger = false; FG.onEnd = arcOnEnd; fgReset('cpu');
  // 奥の不良が乱入してくる
  if (YAN.cIn && Math.random() < (ARC.challenged ? .45 : .8)) { const id = ARC.chal = (ARC.chal || 0) + 1; setTimeout(() => { if (ARC.chal !== id || !FG.playing || !G.arcSeat || FG.state === 'end') return; arcCoinSfx(ARC.vs2.scr.getWorldPosition(new V3())); FG.challenger = true; fgSay('ニュー、チャレンジャー！'); setTimeout(() => { if (!FG.playing) return; FG.challenger = false; FG.vsMan = true; ARC.challenged = true; FG.onEnd = arcOnEnd; fgReset('vs'); }, 2200); }, 3500 + Math.random() * 5000); }
}
function arcOnEnd(res) {
  FG.playing = false; const won = res.winner === FG.side;
  if (FG.vsMan) {
    if (won && Math.random() < .65) { arcDaipan(); setTimeout(() => yanLine('yan3', '……チッ。', { label: '向こうの台' }), 500); setTimeout(() => G.thought('……向こう側から、台をたたく音がした。'), 2400); }
    else if (won) setTimeout(() => yanLine('yan3', '……今のなしな。', { label: '向こうの台' }), 600);
    else setTimeout(() => yanLine('yan3', pick(['……よえーな。', '……出直してこいよ。']), { label: '向こうの台' }), 600);
  } else if (!won) setTimeout(() => G.thought(pick(['……CPUにも勝てない。', '……50円が消えた。'])), 800);
  else setTimeout(() => G.thought('……勝った。でも、一人用はここで終わり。'), 800);
  FG.vsMan = false;
}
function arcStand() { G.arcSeat = false; FG.playing = false; FG.loud = false; ARC.chal = 0; const sp = ARC.vs1.seatPos; P.pos.set(sp.x, SW_Y, sp.z + Math.cos(ARC.vs1.ry) * .45); }
function arcDaipan() {
  ARC.shake = .45; ARC.joltT = .5; const p = ARC.vs2.scr.getWorldPosition(new V3());
  if (!AU.ready) return; SFX.at(p, 'arcade', d => { const t = now(); const n = oneNoise('pink', t, .35), lp = filt('lowpass', 420), g = gainN(0); chain(n, lp, g, d); env(g, t, .002, 2.6, .3); const o = osc('sine', 70), go = gainN(0); o.connect(go); go.connect(d); env(go, t, .002, 1.4, .25); o.start(t); o.stop(t + .4); for (const [f, g0] of [[880, .12], [1320, .08], [2210, .05]]) { const r = osc('square', f), gr = gainN(0); r.connect(gr); gr.connect(d); env(gr, t + .01, .002, g0, .18); r.start(t); r.stop(t + .3); } });
}
function arcCoinSfx(p) { if (!AU.ready) return; SFX.at(p, 'arcade', d => { const t = now(); for (const [dt, f] of [[0, 2600], [.07, 3400], [.18, 1200]]) { const o = osc(dt < .1 ? 'sine' : 'triangle', f), g = gainN(0); o.connect(g); g.connect(d); env(g, t + dt, .002, .25, dt < .1 ? .12 : .3); o.start(t + dt); o.stop(t + dt + .4); } }); }
// ---- ゲーセンの音（いくつもの台のデモ音が重なる）
function arcadeAmbience() {
  const B = TOWN.arcBox, c = new V3((B.x0 + B.x1) / 2, 1.3, (B.z0 + B.z1) / 2);
  ARC.src = mkSrc(c, 'arcade', .28, { ref: 3 }); const out = ARC.src.input;
  FG.sfxSrc = mkSrc(ARC.vs1.scr.getWorldPosition(new V3()), 'arcade', .6, { ref: 1.2 }); FG.sfxOut = FG.sfxSrc.input;
  const bass = [110, 110, 131, 147, 110, 110, 165, 147], mel = [440, 523, 587, 659, 784, 659, 587, 523, 494, 587, 659, 880];
  let next = now() + .5, step = 0;
  setInterval(() => { if (!AU.ready || !ARC.src) return; while (next < now() + .3) { const t = next;
    if (step % 2 === 0) { const o = osc('square', bass[(step / 2) % 8]), g = gainN(0), lp = filt('lowpass', 900); o.connect(lp); lp.connect(g); g.connect(out); env(g, t, .005, .05, .15); o.start(t); o.stop(t + .2); }
    if (Math.random() < .4) { const o = osc('square', mel[Math.floor(Math.random() * mel.length)] * (Math.random() < .3 ? 2 : 1)), g = gainN(0); o.connect(g); g.connect(out); env(g, t, .003, .025, .1); o.start(t); o.stop(t + .14); }
    if (Math.random() < .03) { const n = oneNoise('white', t, .5), lp = filt('lowpass', 1400), g = gainN(0); chain(n, lp, g, out); env(g, t, .005, .18, .45); }
    if (Math.random() < .015) for (let i = 0; i < 5; i++) { const o = osc('square', 1046 * Math.pow(1.26, i)), g = gainN(0); o.connect(g); g.connect(out); env(g, t + i * .05, .002, .03, .06); o.start(t + i * .05); o.stop(t + i * .05 + .1); }
    step++; next += .125; } }, 60);
  const hm = mkSrc(new V3(c.x, 2.9, c.z), 'arcade', .05, { ref: 2 }); hum(hm, [['sine', 100, .05], ['noise', 4000, .02]]);
}

function arcadeInit() { G.yen ??= 500; buildYankees(); addEventListener('keydown', e => { if (!G.arcSeat || CHAT.open) return; if (e.code === 'KeyJ') FG.pressP = true; if (e.code === 'KeyK') FG.pressK = true; if (e.code === 'Space') { e.preventDefault(); arcCoin(); } });
  const sp = ARC.vs1.seatPos; hitProxy(sp.x - .25, sp.x + .25, SW_Y, SW_Y + .9, sp.z - .25, sp.z + .25, { label: () => G.arcSeat ? '' : 'すわって遊ぶ（50円）', act: () => arcSit() });
  hitProxy(ARC.vs1.x - .35, ARC.vs1.x + .35, SW_Y + 1.0, SW_Y + 1.45, ARC.vs1.z - .1, ARC.vs1.z + .3, { label: () => G.arcSeat ? '' : '画面を見る', act: () => G.thought('「FIGHTING EDGE 2」。ポリゴンの二人が、石の舞台で殴りあっている。') });
}
function arcadeUpdate(dt) {
  if (!TOWN.arcBox) return; const B = TOWN.arcBox, cpos = camera.position, cx = (B.x0 + B.x1) / 2, cz = (B.z0 + B.z1) / 2, dist = Math.hypot(cpos.x - cx, cpos.z - cz);
  if (!ARC.ambOn && AU.ready) { ARC.ambOn = true; arcadeAmbience(); }
  ARC.shake = Math.max(0, ARC.shake - dt); ARC.joltT = Math.max(0, (ARC.joltT || 0) - dt);
  if (ARC.vs2) ARC.vs2.grp.position.x = ARC.vs2.x + (ARC.shake > 0 ? (Math.random() - .5) * .02 : 0);
  // 画面（近いときだけ動かす）
  if (dist < 18 && cpos.y > -1) {
    ARC.acc += dt; if (ARC.acc > 1 / 12) { for (const a of ARC.att) a.a.draw(ARC.acc); ARC.acc = 0; }
    ARC.fgAcc += dt; if (ARC.fgAcc > 1 / 30) { fgUpdate(ARC.fgAcc); fgRender(); ARC.fgAcc = 0; }
    for (const m of [FG.crt, FG.crt2, ...ARC.att.map(a => a.m)]) { m.uniforms.time.value = T; }
    FG.crt.uniforms.jolt.value = FG.crt2.uniforms.jolt.value = ARC.joltT > 0 ? ARC.joltT : 0;
  }
  if (ARC.claw) ARC.claw.position.x = (B.x1 - .825) + Math.sin(T * .4) * .3;
  // 外の二人：おしゃべりと、近づくと黙ってにらむ
  const dA = Math.min(cpos.distanceTo(YAN.a.root.position), cpos.distanceTo(YAN.b.root.position));
  if (dA < 2.8 && G.zone === 'out') { ARC.stare += dt; if (ARC.stare > .4 && !ARC.stareOn) { ARC.stareOn = true; yanLookAt(YAN.a, 1); yanLookAt(YAN.b, 1); if (!G.flags.yanFirst) { G.flags.yanFirst = true; setTimeout(() => G.thought('学ランの……たぶん和泉南中の人たちだ。……目を合わせないようにした。'), 400); } }
    if (ARC.stare > 4.5 && ARC.stared < YAN_STARE.length && !ARC.talking) { const [who, t] = YAN_STARE[ARC.stared++]; ARC.stare = 1.5; yanLine(who, t); } }
  else { if (ARC.stareOn && dA > 3.6) { ARC.stareOn = false; ARC.stare = 0; yanLookAt(YAN.a, 0); yanLookAt(YAN.b, 0); ARC.chatT = 3 + Math.random() * 3; } }
  if (!ARC.stareOn && !ARC.talking && dA < 30) { ARC.chatT -= dt; if (ARC.chatT <= 0) { ARC.chatT = 9 + Math.random() * 12; yanChat(); } }
  for (const k of [YAN.a, YAN.b, YAN.c]) yanHead(k, dt);
  // 中の一人：うしろからじっと見ていると
  if (YAN.cIn) {
    const sp = YAN.c.root.position, d = cpos.distanceTo(new V3(sp.x, cpos.y, sp.z)); const fw = new V3(); camera.getWorldDirection(fw);
    const to = new V3(sp.x - cpos.x, 0, sp.z - cpos.z).normalize(), ry = YAN.c.root.rotation.y, behind = (cpos.x - sp.x) * Math.sin(ry) + (cpos.z - sp.z) * Math.cos(ry) < 0;
    ARC.watchCD = Math.max(0, ARC.watchCD - dt);
    if (!G.arcSeat && d < 2.2 && behind && fw.x * to.x + fw.z * to.z > .8) { ARC.watchT += dt; if (ARC.watchT > 2.2 && ARC.watchCD <= 0) { ARC.watchT = 0; ARC.watchCD = 25; const n = ARC.watched = (ARC.watched || 0) + 1; yanLookAt(YAN.c, 1); yanLine('yan3', n === 1 ? '……なに見てんだよ。' : '……あっち行けよ。'); setTimeout(() => yanLookAt(YAN.c, 0), 3500); } }
    else ARC.watchT = Math.max(0, ARC.watchT - dt);
    // 遊んでいるふうに手を動かす
    YAN.c.aR.el.rotation.x = -.4 + (Math.sin(T * 9) > .6 ? -.08 : 0); YAN.c.aL.sh.rotation.z = .2 + Math.sin(T * 2.3) * .05;
  }
}
// 座っているときの操作説明
function arcPadUI() { UI.pad.style.opacity = 1; UI.pad.innerHTML = (FG.playing && FG.state !== 'end' ? 'A/D 移動 ／ J パンチ ／ K キック ／ L ガード<br>' : 'Space 50円を入れる<br>') + 'E 立ち上がる　（のこり' + G.yen + '円）'; UI.prompt.style.opacity = 0; UI.cross.className = ''; }
