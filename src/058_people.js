// ============================================================
// 声（VOICEVOX で作った音声）・お母さん・通行人
// ============================================================
// 声の鍵：話し手と文から作る（tools/gen_voice.js と同じ計算）
function voClean(t) { return t.replace(/<[^>]+>/g, '').replace(/（[^）]*）/g, '').replace(/\s+/g, '').trim(); }
function voKey(who, text) { const s = who + '|' + voClean(text); let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } return 'vo_' + h.toString(16).padStart(8, '0'); }
const VO = { buf: {}, pending: {} };
function voiceLoad() {
  for (const [k, v] of Object.entries(window.ASSETS || {})) if (k.startsWith('vo_')) VO.pending[k] = v;
}
async function voBuf(k) {
  if (VO.buf[k]) return VO.buf[k]; const v = VO.pending[k]; if (!v) return null;
  const bin = Uint8Array.from(atob(v.split(',')[1]), c => c.charCodeAt(0)).buffer; VO.buf[k] = await AU.ctx.decodeAudioData(bin); return VO.buf[k];
}
function hasVoice(who, text) { return !!(VO.pending[voKey(who, text)] || VO.buf[voKey(who, text)]); }
// 話し手ごとの鳴らし方（位置・遮音）
const VO_SRC = {};
function voSource(who) {
  if (!AU.ready) return null;
  if (who === 'father') return { dest: FATHER.dest };
  if (who === 'announcer' || who === 'announcer2') return TVB.in ? { dest: TVB.in } : null;
  const where = { friend: () => FRIEND.root, brother: () => BROTHER.root, mother: () => MOTHER.root, oldman: () => PASSERS.old && PASSERS.old.k.root, man: () => PASSERS.man && PASSERS.man.k.root }[who];
  const obj = where && where(); const p = obj ? obj.getWorldPosition(new V3()).add(new V3(0, 1.3, 0)) : camera.position.clone();
  if (!VO_SRC[who]) VO_SRC[who] = mkSrc(p, G.zoneAt(p), 1, { ref: 1.2, dyn: pos => { const o = where && where(); if (o) { o.getWorldPosition(pos); pos.y += 1.3; } } });
  const s = VO_SRC[who]; s.zone = G.zoneAt(s.pos); return { dest: s.input };
}
async function sayVoice(who, text, o = {}) {
  if (!AU.ready) return false; const k = voKey(who, text); if (!VO.pending[k] && !VO.buf[k]) return false;
  const b = await voBuf(k); if (!b) return false; const src = voSource(who); if (!src) return false;
  const s = AU.ctx.createBufferSource(); s.buffer = b; const g = gainN(o.gain ?? { father: 1.5, brother: .7, oldman: .9 }[who] ?? 1.1);
  const t0 = now() + (o.when ?? 0);
  if (who === 'father') {
    // 低く、重く：再生を少し遅く・低音を持ち上げ・1オクターブ下の響きをかすかに重ねる
    s.playbackRate.value = .9; const ls = filt('lowshelf', 170); ls.gain.value = 8; const pk = filt('peaking', 2600, 1); pk.gain.value = -5;
    s.connect(ls); ls.connect(pk); pk.connect(g); g.connect(src.dest);
    const sub = AU.ctx.createBufferSource(); sub.buffer = b; sub.playbackRate.value = .45; const sl = filt('lowpass', 260), sg = gainN(.22); sub.connect(sl); sl.connect(sg); sg.connect(src.dest); sub.start(t0); sub.stop(t0 + b.duration / .9 + .1);
  } else { s.connect(g); g.connect(src.dest); }
  s.start(t0); return true;
}
const WHO_KEY = { '梅崎': 'friend', '弟': 'brother', 'ふすまの向こう': 'father', 'お母さん': 'mother', 'おじいさん': 'oldman', '会社員': 'man' };

// ------------------------------------------------------------
// お母さん（こわくない。夕方にパートから帰ってくる）
// ------------------------------------------------------------
const MOTHER = {};
function buildMother() {
  MT.blouse = M({ color: 0xd8c8a8, rough: .9 }); MT.skirt = M({ color: 0x5a4a6a, rough: .9 }); MT.apron = M({ color: 0xc86a5a, rough: .95 });
  const k = makeKid({ shirt: MT.blouse, shorts: MT.skirt, skinMat: MT.skin, scale: 1.17 });
  const hair = new THREE.Mesh(new THREE.CapsuleGeometry(.09, .1, 4, 10), MT.hair); hair.position.set(0, -.06, -.06); hair.scale.set(1.15, 1, .7); k.head.add(hair);
  const apron = new THREE.Mesh(new THREE.BoxGeometry(.25, .5, .015), MT.apron); apron.position.set(0, -.14, .072); k.body.add(apron);
  k.root.visible = false; scene.add(k.root); Object.assign(MOTHER, k);
  interactable(k.body.children[0], { label: () => '話しかける', act: () => G.talkMother() });
}
const MOTHER_TALK = ['スイカ、食べてってね。', 'ゆっくりしていってね。', 'うちの子、無口でしょう。ごめんなさいね。', '暑かったでしょう。', 'お家の人、心配しない？', 'また遊びに来てね。'];
function motherWalk(pts, done) { MOTHER.path = { pts: pts.map(p => new V3(...p)), i: 0, done }; MOTHER.stand(); }
function motherUpdate(dt) {
  const f = MOTHER.path; if (!f || !MOTHER.root.visible) return; const p = MOTHER.root.position, tgt = f.pts[f.i], d = new V3().subVectors(tgt, p); d.y = 0; const dist = d.length();
  if (dist < .05) { f.i++; if (f.i >= f.pts.length) { MOTHER.path = null; MOTHER.stand(); p.y = tgt.y; f.done && f.done(); } }
  else { p.addScaledVector(d.normalize(), Math.min(dist, 1.0 * dt)); p.y = tgt.y; MOTHER.root.rotation.y = Math.atan2(d.x, d.z); MOTHER.walk(dt, 1.0); }
}
async function motherComesHome() {
  if (G.flags.mother) return; G.flags.mother = true;
  SFX.latch(new V3(14.8, 3.8, 0)); DOORS.front.set(true); SFX.door(true, new V3(14.8, 3.8, 0), true);
  MOTHER.root.visible = true; MOTHER.root.position.set(14.85, 2.81, -.3); MOTHER.root.rotation.y = Math.PI;
  showSub('ただいまー。', { who: 'お母さん' }); await wait(1.2);
  DOORS.front.set(false); SFX.door(false, new V3(14.8, 3.8, 0), true);
  if (G.zone === 'friend') { await wait(1.2); G.friendSays('……母さん、帰ってきた。'); }
  motherWalk([[14.7, 2.95, -1.6], [15.55, 2.95, -1.85]], async () => {
    MOTHER.root.rotation.y = Math.PI / 2;
    showSub('あら、いらっしゃい。スイカ切ったから、食べてってね。', { who: 'お母さん', dur: 4 });
    W.suika.visible = true; await wait(4.5);
    motherWalk([[14.7, 2.95, -1.9], [14.7, 2.95, -7.2]], () => { SFX.fusuma && SFX.fusuma(); MOTHER.root.visible = false; setTimeout(() => { if (AU.ready) sayVoice('mother', 'お父さん、テレビの音、ちょっと大きいわよ。'); }, 2500); });
  });
}
const G_EXT = {
  talkMother() { showSub(pickNR('mo', MOTHER_TALK), { who: 'お母さん' }); },
  eatSuika() { if (G.flags.suika) { G.thought('皮だけになった。'); return; } G.flags.suika = true; SFX.tea(); W.suikaFlesh.visible = false; G.thought('よく冷えていて、甘い。種を皿に出した。'); setTimeout(() => G.friendSays('……うち、毎年スイカばっか。'), 900); },
};
function buildSuika() {
  const g = new THREE.Group(); g.position.set(18.05, 3.285, -2.0); scene.add(g); g.visible = false; W.suika = g;
  const plate = new THREE.Mesh(new THREE.CylinderGeometry(.13, .1, .015, 24), MT.porcelain); g.add(plate);
  const fl = new THREE.Group(); g.add(fl); W.suikaFlesh = fl;
  for (let i = 0; i < 3; i++) { const w = new THREE.Mesh(new THREE.CylinderGeometry(.09, .09, .04, 16, 1, false, 0, Math.PI * .45), [M({ color: 0x2f6a2a }), M({ color: 0xd8383a }), M({ color: 0xd8383a })]); w.rotation.z = Math.PI / 2; w.rotation.y = i * .9 - .9; w.position.set((i - 1) * .05, .06, 0); fl.add(w); }
  interactable(plate, { label: () => W.suikaFlesh.children.some(c => c.visible) ? 'スイカを食べる' : '', act: () => eatSuikaSlice() });
  for (const c of fl.children) interactable(c, { label: () => c.visible ? 'スイカを食べる' : '', act: () => eatSuikaSlice() });
}

// ------------------------------------------------------------
// 通行人（道を歩いている人たち）
// ------------------------------------------------------------
const PASSERS = {};
function buildPassers() {
  const mk = (shirt, pants, scale, hat) => { const k = makeKid({ shirt: M({ color: shirt, rough: .9 }), shorts: M({ color: pants, rough: .9 }), skinMat: MT.skin, scale }); if (hat) { const h = new THREE.Mesh(new THREE.CylinderGeometry(.13, .14, .08, 16), M({ color: hat, rough: .9 })); h.position.y = .1; k.head.add(h); const b = new THREE.Mesh(new THREE.CylinderGeometry(.2, .2, .01, 20), M({ color: hat, rough: .9 })); b.position.y = .065; k.head.add(b); } scene.add(k.root); return k; };
  // 会社員：東側の道を行き来する
  PASSERS.man = { k: mk(0xeeeeea, 0x44464a, 1.22), pts: [[-40, SW_Y, -47], [-6.0, 0, -44], [-6.0, 0, 6.6], [30, 0, 6.6], [-6.0, 0, 6.6], [-6.0, 0, -44], [-40, SW_Y, -47], [-66, SW_Y, -47]].map(p => new V3(...p)), i: 1, sp: 1.35, wait: 0 };
  // おじいさん：北の道をゆっくり
  PASSERS.old = { k: mk(0xb8b0a0, 0x5a5448, 1.12, 0xd8d0b8), pts: [[-22, 0, 7.3], [48, 0, 7.3]].map(p => new V3(...p)), i: 1, sp: .55, wait: 0, lines: ['暑いねえ。', 'こんにちは。', '夕立、来そうだねえ。'] };
  PASSERS.man.k.root.position.copy(PASSERS.man.pts[0]); PASSERS.old.k.root.position.copy(PASSERS.old.pts[0]);
  PASSERS.old.k.root.scale.y *= .96;
}
function passersUpdate(dt) {
  for (const n of Object.values(PASSERS)) {
    const k = n.k, p = k.root.position; if (n.wait > 0) { n.wait -= dt; k.stand(); continue; }
    const tgt = n.pts[n.i], d = new V3().subVectors(tgt, p); d.y = 0; const dist = d.length();
    // プレイヤーが目の前にいたら少し待つ
    const toP = new V3(P.pos.x - p.x, 0, P.pos.z - p.z); if (toP.length() < .9 && toP.dot(d) > 0 && G.zone === 'out') { k.stand(); continue; }
    if (dist < .1) { n.i = (n.i + 1) % n.pts.length; if (n === PASSERS.old) n.wait = 3; continue; }
    p.addScaledVector(d.normalize(), Math.min(dist, n.sp * dt)); k.root.rotation.y = Math.atan2(d.x, d.z); k.walk(dt, n.sp);
    if (n.lines && G.zone === 'out' && toP.length() < 2.6 && !n.greetT) { n.greetT = 40; showSub(pickNR('old', n.lines), { who: 'おじいさん' }); }
    if (n.greetT) n.greetT = Math.max(0, n.greetT - dt);
  }
  // 夕方は会社員が帰ってくる時間なので少し増やす…の代わりに歩く速さを落とす
}
