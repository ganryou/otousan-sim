// ============================================================
// ポストエフェクト
// ============================================================
let composer, bloom, grade;
function buildPost() {
  const rt = new THREE.WebGLRenderTarget(innerWidth * Q.pr, innerHeight * Q.pr, { type: THREE.HalfFloatType, samples: Q.samples });
  composer = new EffectComposer(renderer, rt);
  composer.setPixelRatio(Q.pr); composer.setSize(innerWidth, innerHeight);
  composer.addPass(new RenderPass(scene, camera));
  // 物陰・隅の暗がり（アンビエントオクルージョン）
  if (Q.ao) { const ao = new GTAOPass(scene, camera, innerWidth, innerHeight); ao.output = GTAOPass.OUTPUT.Default; ao.blendIntensity = .9; ao.updateGtaoMaterial({ radius: .55, distanceExponent: 1.4, thickness: 1.2, scale: 1.1, samples: 12 }); ao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 5, rings: 2, samples: 16 }); composer.addPass(ao); W.ao = ao; }
  bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), .32, .55, .92); composer.addPass(bloom);
  grade = new ShaderPass({
    uniforms: { tDiffuse: { value: null }, time: { value: 0 }, vig: { value: .9 }, grain: { value: .035 }, haze: { value: 0 }, sat: { value: .92 }, tint: { value: new THREE.Color(1, 1, 1) } },
    vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
    fragmentShader: `uniform sampler2D tDiffuse; uniform float time, vig, grain, haze, sat; uniform vec3 tint; varying vec2 vUv;
      float h(vec2 p){ return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453); }
      void main(){ vec2 uv=vUv;
        float hz = haze*smoothstep(.56,.47,uv.y)*smoothstep(.4,.47,uv.y); uv.x += sin(uv.y*220.+time*3.)*hz*.00045;
        vec2 ca = (vUv-.5)*.0016; vec3 c = vec3(texture2D(tDiffuse, uv+ca).r, texture2D(tDiffuse, uv).g, texture2D(tDiffuse, uv-ca).b);
        float l = dot(c, vec3(.299,.587,.114)); c = mix(vec3(l), c, sat) * tint;
        vec3 sh = vec3(.93,.98,1.06), hi = vec3(1.04,1.0,.95); c *= mix(sh, hi, smoothstep(.05,.6,l));
        vec2 d = vUv-.5; c *= 1. - vig*dot(d,d)*.9;
        c += (h(vUv*vec2(1920.,1080.)+fract(time)*37.)-.5)*grain*(.35+l);
        gl_FragColor = vec4(c,1.); }`,
  });
  composer.addPass(grade);
  composer.addPass(new OutputPass());
}

// ============================================================
// UI
// ============================================================
const UI = { sub: $('sub'), prompt: $('prompt'), obj: $('obj'), watch: $('watch'), watchT: $('watchT'), fade: $('fade'), fadeText: $('fadeText'), cross: $('cross'), pad: $('pad'), notice: $('notice') };
// メッセージウインドウ（XP風）。表示は即時で、前のメッセージは差し替える
let subTimer = 0;
function showSub(text, o = {}) {
  const who = o.cls === 'thought' ? '（心の声）' : (o.who || (o.cls === 'far' ? '？？？' : 'メッセージ'));
  UI.sub.className = 'xp ' + (o.cls || '') + (o.who === 'ふすまの向こう' || o.cls === 'far' ? ' far' : '');
  $('msgWho').textContent = who;
  $('msgText').innerHTML = (o.said ? `<div class="said">自分：${escapeHTML(o.said)}</div>` : '') + text;
  UI.sub.style.opacity = 1; UI.sub.style.transform = 'translateX(-50%) scale(1)';
  if (AU.ready && o.se !== false) { if (!(o.se && playSE(o.se, { gain: .55 }))) SFX.ui('msg'); }
  const wk = WHO_KEY[o.who];
  if (wk && AU.ready && !o.noVoice) sayVoice(wk, text).then(ok => { if (!ok && wk === 'father' && voClean(text)) voice(FATHER.dest, { n: Math.min(12, voClean(text).length), f0: 100, rate: 6.4, gain: .8, vowels: 'aeaiuoa', decl: .2, breath: .15 }); });
  clearTimeout(subTimer);
  const dur = o.dur ?? Math.max(2.4, text.length * .14 + 1.4) + (o.said ? 1.2 : 0);
  subTimer = setTimeout(() => { UI.sub.style.opacity = 0; UI.sub.style.transform = 'translateX(-50%) scale(.98)'; }, dur * 1000);
}
function escapeHTML(s) { return s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
// キーボードで話しかける
const CHAT = { open: false };
function openChat() {
  if (CHAT.open || G.busy || G.phase === 'end') return;
  const t = G.talkTarget(); CHAT.target = t; CHAT.open = true;
  $('chatWho').textContent = t === 'passer' ? 'あいさつする' : t === 'mother' ? 'お母さんに話しかける' : t === 'friend' ? '梅崎に話しかける' : t === 'father' ? 'ふすまの向こうに話しかける' : t === 'brother' ? '弟に話しかける' : 'ひとりごと';
  $('chat').style.display = 'block'; const inp = $('chatIn'); inp.value = ''; SFX.ui('open');
  if (document.pointerLockElement) document.exitPointerLock();
  setTimeout(() => inp.focus(), 0);
}
function closeChat(send) {
  if (!CHAT.open) return; const txt = $('chatIn').value.trim(); CHAT.open = false; $('chat').style.display = 'none'; $('chatIn').blur();
  if (send && txt) G.reply(txt, CHAT.target);
  canvas.requestPointerLock()?.catch?.(() => { });
}
$('chatIn').addEventListener('keydown', e => { e.stopPropagation(); if (e.isComposing || e.keyCode === 229) return; if (e.key === 'Enter') { e.preventDefault(); closeChat(true); } if (e.key === 'Escape') { e.preventDefault(); closeChat(false); } });
$('chatIn').addEventListener('keyup', e => e.stopPropagation());
$('chatSend').addEventListener('click', () => closeChat(true));
$('chatClose').addEventListener('click', () => closeChat(false));
function setObj(t) { UI.obj.style.opacity = 0; setTimeout(() => { UI.obj.textContent = t; UI.obj.style.opacity = t ? 1 : 0; }, 900); }
function fadeOut(sec = 1.6, text = '') { return new Promise(r => { UI.fade.style.transition = `opacity ${sec}s`; UI.fade.style.opacity = 1; UI.fadeText.textContent = text; setTimeout(() => { if (text) UI.fadeText.style.opacity = 1; r(); }, sec * 1000); }); }
function fadeIn(sec = 1.6) { UI.fadeText.style.opacity = 0; return new Promise(r => { setTimeout(() => { UI.fade.style.transition = `opacity ${sec}s`; UI.fade.style.opacity = 0; setTimeout(r, sec * 1000); }, 500); }); }
const wait = s => new Promise(r => setTimeout(r, s * 1000));

// ============================================================
// プレイヤー
// ============================================================
const P = { pos: new V3(-66, -4.5, -76.2), yaw: Math.PI, pitch: 0, vy: 0, eye: 1.36, bob: 0, stepD: 0, vel: new V3(), r: .22 };
const KEYS = {};
let sens = 1, locked = false, started = false;
const DEBUG = location.search.includes("debug");
function groundAt(x, z, cy) {
  let best = cy + .45 >= 0 && !TOWN.holes.some(h => x > h.x0 && x < h.x1 && z > h.z0 && z < h.z1) ? 0 : -99;
  for (const s of surfs) {
    if (x < s.x0 || x > s.x1 || z < s.z0 || z > s.z1) continue;
    let y = s.y; if (s.ramp) { const t = s.ramp === 'z' ? (z - s.z0) / (s.z1 - s.z0) : (x - s.x0) / (s.x1 - s.x0); y = s.ya + (s.yb - s.ya) * t; }
    if (y <= cy + .45 && y > best) best = y;
  }
  return best;
}
function collide(p) {
  const y0 = p.y + .35, y1 = p.y + 1.45, r = P.r;
  for (let it = 0; it < 3; it++) for (const c of cols) {
    if (!c.on || c.y1 < y0 || c.y0 > y1) continue;
    if (p.x < c.x0 - r || p.x > c.x1 + r || p.z < c.z0 - r || p.z > c.z1 + r) continue;
    const qx = clamp(p.x, c.x0, c.x1), qz = clamp(p.z, c.z0, c.z1), dx = p.x - qx, dz = p.z - qz, d2 = dx * dx + dz * dz;
    if (d2 > r * r) continue;
    if (d2 > 1e-8) { const d = Math.sqrt(d2), k = (r - d) / d; p.x += dx * k; p.z += dz * k; }
    else { const px = [c.x0 - r - p.x, c.x1 + r - p.x], pz = [c.z0 - r - p.z, c.z1 + r - p.z]; const ax = Math.abs(px[0]) < Math.abs(px[1]) ? px[0] : px[1], az = Math.abs(pz[0]) < Math.abs(pz[1]) ? pz[0] : pz[1]; if (Math.abs(ax) < Math.abs(az)) p.x += ax; else p.z += az; }
  }
  // 人物
  if (FRIEND.root.visible) { const f = FRIEND.root.position, dx = p.x - f.x, dz = p.z - f.z, d = Math.hypot(dx, dz), rr = .42; if (d < rr && d > 1e-4 && Math.abs(p.y - f.y) < 1) { p.x = f.x + dx / d * rr; p.z = f.z + dz / d * rr; } }
}
function segBlocked(a, b) {
  const d = new V3().subVectors(b, a), len = d.length(); d.divideScalar(len);
  for (const c of cols) {
    if (!c.on || c.door) continue; let tmin = 0, tmax = len - .05;
    for (const [o, dd, lo, hi] of [[a.x, d.x, c.x0, c.x1], [a.y, d.y, c.y0, c.y1], [a.z, d.z, c.z0, c.z1]]) {
      if (Math.abs(dd) < 1e-8) { if (o < lo || o > hi) { tmin = 1; tmax = 0; break; } continue; }
      let t1 = (lo - o) / dd, t2 = (hi - o) / dd; if (t1 > t2) [t1, t2] = [t2, t1]; tmin = Math.max(tmin, t1); tmax = Math.min(tmax, t2); if (tmin > tmax) break;
    }
    if (tmin <= tmax && tmin > .02) return true;
  }
  return false;
}
function surfaceType(p) {
  const z = G.zoneAt(new V3(p.x, p.y + 1, p.z));
  if (z === 'hall') return p.y < 2.9 ? 'genkan' : 'wood'; if (z === 'friend') return 'carpet'; if (z === 'toilet') return 'tile';
  if (p.x < 0 && p.x > -2.7 && p.z > -4.2 && p.z < 1.4 && p.y > .05) return 'stair';
  return 'out';
}

// ============================================================
// ゲーム進行
// ============================================================
const G = {
  zone: 'out', evening: false, phase: 'approach', clock: 13 * 60 + 10, seated: false, holdPad: false,
  rang: false, entered: false, roomT: 0, lineT: 18, needToilet: false, toiletDone: false, afterT: 0, skipped: false, leaving: false, left: false,
  linger: 0, fatherStage: 0, earOnFusuma: false, toiletLight: false, hallLight: false, brother: { state: 'hidden', t: 0, seen: 0 }, flags: {}, padOffer: 0,
  zoneAt(p) {
    if (p.x > 14.12 && p.x < 20.83 && p.z > -9.83 && p.z < -0.17 && p.y > 2.7 && p.y < 5.4) {
      if (p.x > 15.25) { if (p.z > -3.4) return 'friend'; if (p.z > -5.7) return 'brother'; return 'living'; }
      if (p.z < -8.65) return 'toilet'; return 'hall';
    }
    if (p.y < -1 && p.x > -77 && p.x < -55 && p.z < -58 && p.z > -86) return 'station';
    const sb = TOWN.superBox; if (sb && p.x > sb.x0 && p.x < sb.x1 && p.z > sb.z0 && p.z < sb.z1 - 0 && p.y < 3.4) return 'store';
    return 'out';
  },
  thought(t, dur, se) { showSub(t, { cls: 'thought', dur, se }); },
  friendSays(t, dur, said) { showSub(t, { who: '梅崎', dur, said }); },
  far(t, who, dur) { showSub(t, { cls: 'far', who, dur }); },
  notice(title, html) { UI.notice.innerHTML = `<h3>${title}</h3>${html}<div style="margin-top:14px;font-size:12px;color:#777">［E］で閉じる</div>`; UI.notice.style.display = 'block'; G.noticeOpen = true; },
  // --- 玄関 ---
  frontDoorLabel() {
    if (G.zone === 'out') return G.left ? '（鍵がかかっている）' : (G.rang ? '' : 'チャイムを押す');
    return G.skipped ? '帰る' : 'ドア';
  },
  async frontDoorAct() {
    if (G.zone === 'out') { if (G.rang || G.left) return; G.rang = true; SFX.chime(new V3(14.8, 4.6, -0.6)); setObj(''); G.thought('ピンポーン……'); await wait(1.3); SFX.latch(new V3(14.8, 3.8, 0)); DOORS.front.set(true); SFX.door(true, new V3(14.8, 3.8, 0), true); FRIEND.root.visible = true; FRIEND.stand(); FRIEND.root.position.set(14.85, 2.81, -0.75); FRIEND.root.rotation.y = 0; G.friendSays('……おう。上がれよ。'); await wait(1.4); G.walkFriend([[14.7, 2.95, -1.7], [15.6, 2.95, -1.85], [18.95, 2.95, -1.5]], () => { FRIEND.sitCross(); FRIEND.root.rotation.y = Math.PI / 2; FRIEND.sitting = true; }); return; }
    if (!G.skipped) { G.thought('まだ来たばかりだ。'); return; }
    if (G.leaving) return; G.leave();
  },
  walkFriend(pts, done) { G.fw = { pts: pts.map(p => new V3(...p)), i: 0, done }; FRIEND.sitting = false; FRIEND.stand(); },
  // --- 友だちの部屋 ---
  sit() { if (G.seated) return; G.seated = true; P.pos.set(18.7, 2.95, -2.5); P.yaw = -1.98; P.pitch = -.08; if (!G.flags.sat) { G.flags.sat = true; G.friendSays('……それ、昨日やっと遺跡まで来た。'); } },
  stand() { G.seated = false; G.holdPad = false; RPG.mode = 'ai'; P.pos.set(18.7, 2.95, -2.95); },
  talkFriend() { if (G.leaving) return; if (G.mood === 'bad') { G.friendSays(pickNR('mb', MOOD_BAD)); return; } G.friendSays(G.skipped ? pickNR('tE', ['……ん。', '……もう暗いな。', '……親、そろそろ帰ってくる。', '今日、なんか早かったな。']) : pickNR('tD', TALK_E)); },
  talkTarget() {
    const cp = camera.position;
    if (G.brother.state === 'watch' && cp.distanceTo(new V3(15.72, 3.9, -4.2)) < 3.5) return 'brother';
    if (G.zone === 'hall' && cp.distanceTo(new V3(15.0, cp.y, -7.2)) < 1.4) return 'father';
    if (MOTHER.root && MOTHER.root.visible && cp.distanceTo(MOTHER.root.position) < 3) return 'mother';
    if (FRIEND.root.visible && cp.distanceTo(FRIEND.root.position) < 4 && G.zone !== 'out') return 'friend';
    if (G.zone === 'out' && nearPasser()) return 'passer';
    return 'self';
  },
  reply(text, target) {
    const said = text;
    if (target === 'friend') { G.friendSays(G.mood === 'bad' ? pickNR('mb', MOOD_BAD) : friendReply(text), undefined, said); return; }
    if (target === 'passer') { const n = nearPasser(); if (n) { const who = n === PASSERS.old ? 'おじいさん' : '会社員'; n.wait = Math.max(n.wait, 2.5); showSub(pickNR('g' + who, n === PASSERS.old ? OLD_TALK : MAN_TALK), { who, said }); return; } }
    if (target === 'father') { G.linger += 4; { const r = fatherReply(text); showSub(r.t, { cls: 'far', who: 'ふすまの向こう', said, se: voClean(r.t) ? 'ブオン' : undefined }); } return; }
    if (target === 'mother') { showSub(pickNR('mo', MOTHER_TALK), { who: 'お母さん', said }); return; }
    if (target === 'brother') { showSub(Math.random() < .2 ? '……（小さく、うなずいた）' : '……。', { who: '弟', said }); return; }
    showSub(pickNR('self', ['（自分の声が、やけに大きく聞こえた）', '（誰も聞いていない）', '（セミの声にかき消された）', '（口に出してから、少し恥ずかしくなった）']), { cls: 'thought', said });
  },
  drinkTea() { SFX.tea(); G.thought(G.flags.tea ? '氷がほとんど溶けている。' : 'ぬるくなりかけの麦茶。少しだけ甘い気がする。'); G.flags.tea = true; },
  // --- 廊下・ふすま ---
  touchFusuma() { G.thought((G.fatherCount || 0) > 0 ? '……開けられるわけがない。' : pick(['ふすまに手をかけて、やめた。', '向こうで、テレビの音がしている。', '紙が少し破れている。のぞけそうで、のぞけない。'])); },
  toggleToiletLight() { G.toiletLight = !G.toiletLight; SFX.click(new V3(14.2, 4.1, -8.4)); },
  toggleHallLight() { G.hallLight = !G.hallLight; SFX.click(new V3(15.15, 4.1, -1.25)); },
  async useToilet() {
    if (G.toiletDone) return;
    if (!G.needToilet) { G.thought('今は、いい。'); return; }
    if (DOORS.toilet.isOpen) { G.thought('……ドアを閉めよう。'); return; }
    G.busy = true; await fadeOut(.6); await wait(.6); SFX.flush(new V3(14.7, 3.6, -9.6)); await wait(.6); G.toiletDone = true; await fadeIn(.8); G.busy = false;
    if (!G.toiletLight) G.thought('暗い中で、なんとか済ませた。'); setObj('');
  },
  buyJuice() { if (G.flags.juice) { G.thought('もう小銭がない。'); return; } G.flags.juice = true; SFX.juice(W.vending.pos); G.thought('ガコン。……冷たい缶を、首に当てた。'); },
  // --- 帰る ---
  async leave() {
    G.leaving = true; G.stand(); setObj('');
    if (FRIEND.sitting) G.walkFriend([[18.6, 2.95, -1.9], [15.8, 2.95, -1.85], [14.6, 2.95, -2.75]], () => { FRIEND.root.rotation.y = 0; });
    G.friendSays('……じゃあな。'); await wait(1.8);
    if (Math.random() < .6) { BROTHER.root.visible = true; G.brother.state = 'watch'; G.brother.noGreet = true; DOORS.brother.target = -1.15; }
    G.friendSays('親父、別に怖くないよ。', 3.4); await wait(1.2);
    if (G.flags.mother) { MOTHER.root.visible = true; MOTHER.root.position.set(14.7, 2.95, -6.6); MOTHER.root.rotation.y = Math.PI; MOTHER.stand(); await wait(2.2); showSub('気をつけて帰ってね。また遊びにいらっしゃい。', { who: 'お母さん', dur: 3.6 }); await wait(1.5); }
    SFX.latch(new V3(14.8, 3.8, 0)); DOORS.front.set(true); SFX.door(true, new V3(14.8, 3.8, 0), true);
    G.phase = 'leaving';
  },
  // --- 電話 ---
  async phoneCall() {
    const hallPhone = new V3(14.3, 3.8, -1.65), livingPhone = new V3(19.5, 3.5, -7.0);
    for (let i = 0; i < 4; i++) { if (!playSE('電話かかる', { pos: hallPhone, zone: 'hall', gain: .9 })) SFX.chime(hallPhone); playSE('電話かかる', { pos: livingPhone, zone: 'living', gain: .7 }); await wait(2.6); }
    TVB.out.gain.setTargetAtTime(.3, now(), .3); FATHER.silent = true;
    if (G.zone === 'friend') G.friendSays('……親父が出るから、いいよ。');
    await wait(1.4);
    const say = async (t, n) => { if (!(await sayVoice('father', t))) voice(FATHER.dest, { n, f0: 100, rate: 6, gain: .75, vowels: 'aeaio' }); };
    G.far('（ふすまの向こうで、父親が電話に出た）', null, 3); say('はい、梅崎です。', 6); await wait(2.8); say('ああ、どうも。', 5); await wait(2.6); say('ええ。……ええ。', 4); await wait(3.2);
    say('いや、あいつは今パートで。夕方には帰ると思います。', 14); await wait(4.6); say('はい。それじゃ、また。', 7);
    await wait(2); SFX.click(livingPhone); if (G.fatherStage < 3) FATHER.silent = false; TVB.out.gain.setTargetAtTime(1, now(), 2);
  },
  // --- 時間経過 ---
  async timeSkip() {
    G.skipped = true; G.busy = true; await fadeOut(2.4, '……\n\n気づくと、網戸の向こうが橙色になっていた。'); await wait(3.2);
    G.setEvening(); G.clock = 18 * 60 + 12; await fadeIn(2.2); G.busy = false;
    setTimeout(() => G.friendSays('……もうこんな時間か。'), 1500); setTimeout(() => motherComesHome(), 6000); setTimeout(() => { G.friendSays('そろそろ帰る？'); setObj('帰る（玄関）'); }, 21000);
  },
  setEvening() {
    G.evening = true; applyTOD(TOD.eve); setBakeEvening();
    LT.window.color.set(0xffb070); LT.window.intensity = 3.5; MT.skyView.color.set(0xffc08a);
    LT.room.intensity = 9; MT.roomLamp.emissive.set(0xf4f8ff); MT.roomLamp.emissiveIntensity = 1.4;
    MT.friendWinExt.emissive.set(0xe8f0ff); MT.friendWinExt.emissiveIntensity = 1.1;
    MT.livingWin.emissive.set(0xffd8a0); MT.livingWin.emissiveIntensity = .9;
    MT.glassA.emissive.set(0xffc880); MT.glassA.emissiveIntensity = .7; MT.frostedA.emissive.set(0xdce8f0); MT.frostedA.emissiveIntensity = .7;
    MT.distantWin.emissive.set(0xffd890); MT.distantWin.emissiveIntensity = .6;
    MT.lampCorr.emissive.set(0xeef4ff); MT.lampCorr.emissiveIntensity = 1.6; LT.stair.intensity = 5; LT.corr.intensity = 6; LT.corr1.intensity = 4;
    if (SRC.higu) { for (const k in SRC) if (k.startsWith('cicada')) SRC[k].mul = .3; SRC.higu.mul = 1; SRC.higu.base = .5; SRC.higu2.base = .4; }
    grade.uniforms.tint.value.setRGB(1.04, .98, .92);
  },
  async ending() {
    G.phase = 'end'; G.busy = true; playSE('あれ落ちた', { gain: .5 }); await fadeOut(3.5); await wait(1);
    UI.fadeText.textContent = 'あの家では、今もテレビがついている。\n\n\n―― 第一段階　おわり ――'; UI.fadeText.style.opacity = 1;
    for (const s of AU.sources) s.mul = 0;
  },
};

Object.assign(G, G_EXT);
// ============================================================
// 入力
// ============================================================
addEventListener('keydown', e => {
  if (CHAT.open) return; KEYS[e.code] = true; if (!started) return;
  if (e.code === 'Enter' || e.code === 'NumpadEnter') { e.preventDefault(); openChat(); return; }
  if (e.code === 'KeyE') { if (G.noticeOpen) { UI.notice.style.display = 'none'; G.noticeOpen = false; return; } if (G.seated && !CUR_IT) { G.stand(); return; } if (CUR_IT && !G.busy) { const it = CUR_IT.userData.it; if (it.act) it.act(); } }
  if (e.code === 'KeyF' && G.seated && G.padOffer > 0 && !G.holdPad) { G.holdPad = true; RPG.mode = 'player'; G.padOffer = 0; G.friendSays('……ほら。', 1.6); }
  if (e.code === 'KeyQ' && G.holdPad) { G.holdPad = false; RPG.mode = 'ai'; G.friendSays(pick(['……おう。', '……うまいじゃん。', '……そこ、惜しかった。']), 2); }
  if (e.code === 'KeyT') { UI.watch.style.opacity = 1; clearTimeout(UI.wt); UI.wt = setTimeout(() => UI.watch.style.opacity = 0, 2500); }
});
addEventListener('keyup', e => { KEYS[e.code] = false; });
addEventListener('mousemove', e => { if (!locked) return; const k = .0022 * sens; P.yaw -= e.movementX * k; P.pitch = clamp(P.pitch - e.movementY * k, -1.45, 1.45); });
document.addEventListener('pointerlockchange', () => { locked = document.pointerLockElement === canvas; if (started) { $('pause').style.display = locked || G.phase === 'end' || CHAT.open ? 'none' : 'flex'; if (AU.ready) { if (locked || CHAT.open) AU.ctx.resume(); else AU.ctx.suspend(); } } });
$('pause').addEventListener('click', () => canvas.requestPointerLock());
canvas.addEventListener('click', () => { if (started && !locked) canvas.requestPointerLock(); });
addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); composer.setSize(innerWidth, innerHeight); });

// ============================================================
// 毎フレーム
// ============================================================
const ray = new THREE.Raycaster(); let CUR_IT = null;
let expo = .8, hemiK = 1;
function updatePlayer(dt) {
  if (G.seated || G.busy || G.phase === 'end') { P.vel.set(0, 0, 0); return; }
  const f = new V3(-Math.sin(P.yaw), 0, -Math.cos(P.yaw)), r = new V3(-f.z, 0, f.x);
  const want = new V3(); if (KEYS.KeyW) want.add(f); if (KEYS.KeyS) want.sub(f); if (KEYS.KeyD) want.add(r); if (KEYS.KeyA) want.sub(r);
  const indoor = G.zone !== 'out', sp = (KEYS.ShiftLeft || KEYS.ShiftRight) && !indoor ? 3.3 : (indoor ? 1.25 : 1.7);
  if (want.lengthSq() > 0) want.normalize().multiplyScalar(sp);
  P.vel.lerp(want, 1 - Math.exp(-dt * 10));
  const np = P.pos.clone().addScaledVector(P.vel, dt);
  const gy = groundAt(np.x, np.z, P.pos.y);
  if (gy - P.pos.y > .46) { np.x = P.pos.x; np.z = P.pos.z; }
  collide(np);
  const g2 = groundAt(np.x, np.z, P.pos.y);
  if (g2 >= P.pos.y - .02) { np.y = g2 > P.pos.y ? lerp(P.pos.y, g2, 1 - Math.exp(-dt * 18)) : g2; P.vy = 0; }
  else { P.vy -= 9.8 * dt; np.y = P.pos.y + P.vy * dt; if (np.y < g2) { np.y = g2; P.vy = 0; } }
  const moved = Math.hypot(np.x - P.pos.x, np.z - P.pos.z);
  P.pos.copy(np);
  if (moved > 1e-4) { P.bob += moved * 5.2; P.stepD += moved; const stride = indoor ? .55 : .7; if (P.stepD > stride) { P.stepD = 0; const s = surfaceType(P.pos); SFX.step(s, s === 'wood' && Math.random() < .07); } }
}
function updateCamera() {
  if (G.seated) { camera.position.set(18.7, 2.95 + .78, -2.5); }
  else camera.position.set(P.pos.x, P.pos.y + P.eye + Math.sin(P.bob) * .022, P.pos.z);
  camera.rotation.set(P.pitch, P.yaw, Math.sin(P.bob * .5) * .004);
}
function updateInteract() {
  ray.setFromCamera({ x: 0, y: 0 }, camera); ray.far = 2.1;
  const hits = ray.intersectObjects(W.interact, false); CUR_IT = null;
  for (const h of hits) { const it = h.object.userData.it; if (!it || !it.label) continue; const lab = it.label(); if (!lab) continue; if (segBlocked(camera.position, h.point)) break; CUR_IT = h.object; UI.prompt.innerHTML = `<b>E</b>${lab}`; break; }
  if (G.seated && !CUR_IT) UI.prompt.innerHTML = '<b>E</b>立ち上がる';
  UI.prompt.style.opacity = (CUR_IT || G.seated) && !G.busy ? 1 : 0; UI.cross.className = CUR_IT ? 'on' : '';
  UI.pad.style.opacity = G.seated ? 1 : 0; UI.pad.innerHTML = G.holdPad ? 'WASD 移動 ／ Space こうげき<br>Q コントローラーを返す' : (G.padOffer > 0 ? 'F コントローラーを借りる' : '');
}
function updateLooks() {
  const fw = new V3(); camera.getWorldDirection(fw);
  for (const l of W.looks) { if (G.flags['look_' + l.id]) continue; if (l.when && !l.when()) continue; const d = new V3().subVectors(l.pos, camera.position), dist = d.length(); if (dist > l.dist) continue; if (d.normalize().dot(fw) < l.dot) continue; if (l.noBlock !== true && segBlocked(camera.position, l.pos)) continue; G.flags['look_' + l.id] = true; G.thought(l.text); }
}
function updateStory(dt) {
  const z = G.zone;
  if (!G.entered && z === 'hall' && P.pos.y > 2.9) { G.entered = true; G.thought('靴を脱いで、上がった。'); setTimeout(() => { if (!DOORS.front.target) return; DOORS.front.set(false); SFX.door(false, new V3(14.8, 3.8, 0), true); }, 1200); }
  if (G.entered && !G.leaving && DOORS.front.target && P.pos.z < -1.3 && G.zone !== 'out') { DOORS.front.set(false); SFX.door(false, new V3(14.8, 3.8, 0), true); }
  // 部屋での時間
  if (z === 'friend' && G.entered && !G.skipped) {
    G.roomT += dt; G.lineT -= dt;
    if (G.lineT <= 0 && !G.needToilet || (G.lineT <= 0 && G.toiletDone)) { G.lineT = 28 + Math.random() * 22; if (G.mood !== 'bad') G.friendSays(pickNR('room', ROOM_LINES)); }
    if (G.seated && !G.holdPad && G.roomT > 45 && !G.flags.offer) { G.flags.offer = true; G.padOffer = 20; G.friendSays('……やる？'); }
    if (!G.flags.phone && G.roomT > 68 && !G.needToilet) { G.flags.phone = true; G.phoneCall(); }
    if (!G.needToilet && G.roomT > 100) { G.needToilet = true; G.thought('……トイレに行きたくなってきた。'); setTimeout(() => { G.friendSays('トイレ？　廊下の突き当たり。電気、外にスイッチあるから。', 4.2); setObj('トイレ（廊下の突き当たり）'); }, 4500); }
    if (G.toiletDone) { if (!G.flags.back) { G.flags.back = true; setTimeout(() => { if (G.flags.fatherSpoke) { G.friendSays('……親父、なんか言ってた？'); setTimeout(() => G.friendSays('……ふーん。'), 4000); } else G.friendSays('……。'); }, 1200); } G.afterT += dt; if (G.afterT > 40 && !G.skipped) G.timeSkip(); }
  }
  G.padOffer = Math.max(0, G.padOffer - dt);
  // 廊下にとどまると父親が反応する
  const inCorr = z === 'hall' && P.pos.z < -3.2 && P.pos.z > -8.6 && !G.leaving;
  const nearF = P.pos.distanceTo(new V3(15.0, P.pos.y, -7.2)) < .75;
  const fw = new V3(); camera.getWorldDirection(fw); G.earOnFusuma = nearF && fw.x > .55;
  if (inCorr && G.entered) G.linger += dt * (G.earOnFusuma ? 1.9 : 1); else G.linger = Math.max(0, G.linger - dt * .6);
  if (G.fatherCD > 0) G.fatherCD -= dt;
  if (G.fatherStage === 0 && G.linger > 10 && !(G.fatherCD > 0)) { G.fatherStage = 1; fatherLaugh(); G.far('（ふすまの向こうで、低く笑う声がした）', null, 3); }
  if (G.fatherStage === 1 && G.linger > 15.5) { G.fatherStage = 2; showSub('……誰かいるのか？', { cls: 'far', who: 'ふすまの向こう', dur: 3, se: 'ブオン' }); G.flags.fatherSpoke = true; }
  if (G.fatherStage === 2 && G.linger > 21.5) { G.fatherStage = 3; showSub('……そこでなにやってるんだ。', { cls: 'far', who: 'ふすまの向こう', dur: 3.4, se: 'ブオン' }); FATHER.silent = true; TVB.out.gain.setTargetAtTime(.35, now() + 1.5, 1); setTimeout(() => { TVB.out.gain.setTargetAtTime(1, now(), 3); FATHER.silent = false; }, 16000); G.fatherStage = 0; G.linger = 0; G.fatherCD = 7; G.fatherCount = (G.fatherCount || 0) + 1; }
  // 弟
  const B = G.brother;
  // 部屋から廊下に出た瞬間に、ときどき弟がドアのすき間に立っている（最初のトイレでは必ず）
  if (z === 'hall' && G.lastZone && G.lastZone !== 'hall' && B.state === 'hidden' && G.entered && !G.leaving) {
    const first = G.needToilet && !B.seen, chance = first ? 1 : (B.seen < 4 ? .45 : .2);
    if (Math.random() < chance) { B.state = 'watch'; B.seen = (B.seen || 0) + 1; B.noGreet = B.seen > 2; BROTHER.root.visible = true; DOORS.brother.target = -1.15; }
  }
  G.lastZone = z;
  if (B.state === 'watch') {
    const bp = new V3(15.5, 3.9, -4.42), d = new V3().subVectors(bp, camera.position), dist = d.length(); d.normalize(); const look = d.dot(fw);
    BROTHER.head.rotation.y = clamp(Math.atan2(camera.position.x - 15.5, camera.position.z + 4.42) + Math.PI / 2, -.6, .6);
    if (dist < 3.4 && look > .8 && !B.greeted) { B.greeted = true; if (!B.noGreet && Math.random() < .15) setTimeout(() => showSub('……こんにちは。', { who: '弟', dur: 2.4 }), 600); else if (!B.noGreet) G.thought('……弟だ。じっとこっちを見ている。'); }
    if (B.greeted && look < .3) { B.t += dt; if (B.t > .7) { B.state = 'hidden'; B.t = 0; B.greeted = false; BROTHER.root.visible = false; DOORS.brother.target = -.12; SFX.click(new V3(15.3, 3.9, -4.2)); } } else B.t = 0;
    if (dist > 7 && G.leaving) { }
  }
  // 帰り
  if (G.phase === 'leaving' && z === 'out' && P.pos.z > .3) { G.phase = 'outside'; G.left = true; DOORS.front.set(false); SFX.door(false, new V3(14.8, 3.8, 0), true); setTimeout(() => SFX.latch(new V3(14.8, 3.8, 0)), 900); FRIEND.root.visible = false; BROTHER.root.visible = false; setObj(''); G.outT = 0; }
  if (G.phase === 'outside') {
    G.outT += dt;
    W.lamps.forEach((l, i) => { const on = G.outT > 6 + i * 5; if (on && !l.on) { l.on = true; l.at = G.outT; } if (l.on) { const k = G.outT - l.at; const fl = k < 1.4 ? (Math.sin(k * 40) > .2 ? 1 : .05) : 1; l.mat.emissive.setRGB(.9, .97, 1); l.mat.emissiveIntensity = 2.2 * fl; l.light.intensity = 9 * fl; } });
    if (!G.flags.tofu && G.outT > 25) { G.flags.tofu = true; SFX.tofu(new V3(-40, 2, -20)); }
    if (!G.flags.backHint && G.outT > 4) { G.flags.backHint = true; setObj('泉南駅へ（改札を通ると、おわり）'); }
  }
  if (G.phase === 'approach' && P.pos.z > -6 && !G.flags.obj1) { G.flags.obj1 = true; }
}
function updateLights(t, dt) {
  // テレビの光（画面の平均色で近似）
  const h = RPG.hero, tint = RPG.flash > 0 ? 1.8 : 1; LT.tv.intensity = (.9 + Math.sin(t * 7) * .06 + Math.random() * .04) * tint;
  // ふすまの向こうのテレビのちらつき
  const fl = .5 + .5 * Math.sin(t * 2.3) * Math.sin(t * 5.1 + 1) + (Math.random() < .03 ? .6 : 0);
  const tvb = fl * (G.fatherStage >= 3 ? .5 : 1);
  if (!G.evening) { MT.fusuma.emissive.setRGB(1 - tvb * .25, .92 - tvb * .12, .78 + tvb * .1); MT.fusuma.emissiveIntensity = .085 + tvb * .02; MT.gap.color.setRGB(.9 + tvb * .2, .86 + tvb * .2, .8 + tvb * .35); LT.fusuma.color.setRGB(1, .9 - tvb * .1, .75 + tvb * .2); LT.fusuma.intensity = .42 + tvb * .14; }
  else { MT.fusuma.emissive.setRGB(1 - tvb * .4, .78 - tvb * .15, .55 + tvb * .3); MT.fusuma.emissiveIntensity = .07 + tvb * .035; MT.gap.color.setRGB(1 + tvb * .3, .8 + tvb * .3, .55 + tvb * .6); LT.fusuma.color.setRGB(1, .75, .5 + tvb * .4); LT.fusuma.intensity = .4 + tvb * .25; }
  if (G.evening) { MT.livingWin.emissive.setRGB(1, .85 - fl * .2, .62 + fl * .25); }
  // スイッチ類
  LT.toilet.intensity = G.toiletLight ? 4.5 : 0; MT.bulb.emissive.set(G.toiletLight ? 0xffe0a0 : 0x000000); MT.bulb.emissiveIntensity = 3;
  LT.hall.intensity = G.hallLight ? 4 : 0; W.hallShade.material.emissive.set(G.hallLight ? 0x664a20 : 0x000000);
  // 室内外の明るさ（目の順応）
  const z = G.zone, targetE = z === 'out' ? curTOD.expOut : z === 'hall' ? (G.hallLight ? 1.3 : 1.55) : z === 'friend' ? 1.25 : z === 'toilet' ? (G.toiletLight ? 1.2 : 2.4) : z === 'station' ? 1.2 : z === 'store' ? 1.0 : 1.5;
  expo = lerp(expo, targetE, 1 - Math.exp(-dt * (targetE > expo ? .9 : 2.2))); renderer.toneMappingExposure = expo;
  const hk = z === 'out' ? 1 : .045; hemiK = lerp(hemiK, hk, 1 - Math.exp(-dt * 3)); LT.hemi.intensity = LT.hemiBase * hemiK;
  LT.amb.intensity = z === 'out' ? .05 : .012;
  grade.uniforms.haze.value = z === 'out' && !G.evening ? 1 : 0;
}
let last = performance.now(), T = 0, rpgAcc = 0;
function loop() {
  requestAnimationFrame(loop);
  const n = performance.now(), dt = Math.min(.05, (n - last) / 1000); last = n;
  if (!started || !(locked || DEBUG || CHAT.open) && G.phase !== 'end') { if (started) composer.render(); return; }
  frame(dt, true);
}
function frame(dt, draw) {
  T += dt; G.clock += dt * (G.evening ? 1 / 30 : 1 / 20);
  G.zone = G.zoneAt(new V3(P.pos.x, P.pos.y + 1, P.pos.z));
  elvUpdate(dt); updatePlayer(dt); updateCamera(); motherUpdate(dt); passersUpdate(dt); eventsUpdate(dt); townUpdate(dt);
  for (const d of Object.values(DOORS)) d.update(dt);
  for (const a of W.anim) a(T, dt);
  // 友だちの移動
  if (G.fw) { const f = G.fw, p = FRIEND.root.position, tgt = f.pts[f.i], d = new V3().subVectors(tgt, p); d.y = 0; const dist = d.length(); if (dist < .05) { f.i++; if (f.i >= f.pts.length) { G.fw = null; FRIEND.stand(); p.y = tgt.y; f.done && f.done(); } } else { const st = Math.min(dist, 1.1 * dt); p.addScaledVector(d.normalize(), st); p.y = tgt.y; FRIEND.root.rotation.y = Math.atan2(d.x, d.z); FRIEND.walk(dt, 1.1); } }
  if (FRIEND.sitting) { FRIEND.head.rotation.y = Math.sin(T * .3) * .05; FRIEND.head.rotation.x = .1 + Math.sin(T * .7) * .03; const press = RPG.hero.atk > 0 ? .05 : 0; FRIEND.aR.el.rotation.x = -.9 - press; FRIEND.pad.visible = !G.holdPad; }
  // RPG
  rpgAcc += dt; if (rpgAcc > 1 / 30) { const inp = G.holdPad ? { x: (KEYS.KeyD || KEYS.ArrowRight ? 1 : 0) - (KEYS.KeyA || KEYS.ArrowLeft ? 1 : 0), y: (KEYS.KeyS || KEYS.ArrowDown ? 1 : 0) - (KEYS.KeyW || KEYS.ArrowUp ? 1 : 0), atk: KEYS.Space } : null; rpgUpdate(rpgAcc, inp); rpgDraw(); rpgAcc = 0; }
  RPG.smat.uniforms.time.value = T;
  updateStory(dt); updateLights(T, dt); updateInteract(); updateLooks();
  audioUpdate(camera.position, G.zone);
  SKY.mesh.position.copy(camera.position); SKY.u.time.value = T; updateSunShadow(camera.position);
  const hh = Math.floor(G.clock / 60) % 24, mm = Math.floor(G.clock % 60); UI.watchT.textContent = `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
  grade.uniforms.time.value = T;
  if (draw) composer.render();
}
// 焼き込み用の書き出し（テクスチャの平均色を基本色として渡す）
function avgColor(m) {
  const c = m.color ? m.color.clone() : new THREE.Color(1, 1, 1); const img = m.map && m.map.image;
  if (img && img.width) { const cv = document.createElement('canvas'); cv.width = cv.height = 8; const g = cv.getContext('2d'); g.drawImage(img, 0, 0, 8, 8); const d = g.getImageData(0, 0, 8, 8).data; let r = 0, gg = 0, b = 0; for (let i = 0; i < d.length; i += 4) { r += d[i]; gg += d[i + 1]; b += d[i + 2]; } const n = d.length / 4, t = new THREE.Color().setRGB(r / n / 255, gg / n / 255, b / n / 255, THREE.SRGBColorSpace); c.multiply(t); }
  return c;
}
async function exportBake() {
  const { GLTFExporter } = await import('three/addons/exporters/GLTFExporter.js');
  const grp = new THREE.Group();
  for (const [pre, list] of [['bake|', W.bakeMeshes], ['ext|', W.extMeshes || []]]) for (const m of list) { const mm = new THREE.MeshStandardMaterial({ color: avgColor(m.material), roughness: .9 }); mm.name = m.material.name; const ms = new THREE.Mesh(m.geometry, mm); ms.name = pre + m.material.name; grp.add(ms); }
  // 光をさえぎるだけの物（ドア・ふすま・人物は焼き込まない）
  const occ = [DOORS.front.panel, DOORS.friend.panel, DOORS.brother.panel, DOORS.toilet.panel, ...W.fusumaPanels];
  for (const o of occ) { o.updateWorldMatrix(true, false); const g = o.geometry.clone().applyMatrix4(o.matrixWorld); const mm = new THREE.MeshStandardMaterial({ color: 0xd8d0c0 }); mm.name = 'occ'; const ms = new THREE.Mesh(g, mm); ms.name = 'occ|door'; grp.add(ms); }
  const glb = await new GLTFExporter().parseAsync(grp, { binary: true });
  const r = await fetch('/save/bake_in.glb', { method: 'POST', body: glb }); return await r.text();
}
// 焼き込み結果（壁や床で跳ね返った光）を読み込む
async function loadBake() {
  const A = window.ASSETS; if (!A || !A.bake_glb || !A.bake_day) return;
  const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js');
  const bin = Uint8Array.from(atob(A.bake_glb.split(',')[1]), ch => ch.charCodeAt(0)).buffer;
  const gltf = await new GLTFLoader().parseAsync(bin, '');
  const meta = A.bake_meta ? JSON.parse(A.bake_meta) : { day: 1, eve: 1 };
  const lt = async src => { const img = new Image(); img.src = src; await img.decode(); const t = new THREE.Texture(img); t.needsUpdate = true; t.flipY = false; t.colorSpace = THREE.SRGBColorSpace; t.channel = 1; return t; };
  W.lm = { day: await lt(A.bake_day), eve: A.bake_eve ? await lt(A.bake_eve) : null, ao: A.bake_ao ? await lt(A.bake_ao) : null, meta };
  if (W.lm.ao) W.lm.ao.colorSpace = THREE.NoColorSpace;
  W.bakedMats = []; const LMI = Math.PI * .42;
  let hasExt = false;
  gltf.scene.traverse(o => {
    if (!o.isMesh) return; const nm = o.material.name.replace(/\.\d+$/, ''), orig = MATREG[nm]; if (!orig) { o.visible = false; return; }
    let p = o; while (p && !/^(baked|ext)/.test(p.name)) p = p.parent; const isExt = p && p.name.startsWith('ext');
    const m = orig.clone();
    if (isExt) { if (W.lm.ao) { m.aoMap = W.lm.ao; m.aoMapIntensity = .55; } hasExt = true; }
    else { m.lightMap = W.lm.day; m.lightMapIntensity = LMI / meta.day; m.userData.lmBase = LMI; W.bakedMats.push(m); }
    if (m.envMap === undefined) m.envMap = null;
    o.material = m; o.castShadow = true; o.receiveShadow = true;
  });
  scene.add(gltf.scene); for (const m of W.bakeMeshes) m.visible = false; if (hasExt) for (const m of W.extMeshes || []) m.visible = false;
  W.baked = true;
}
function setBakeEvening() { if (!W.baked || !W.lm.eve) return; for (const m of W.bakedMats) { m.lightMap = W.lm.eve; m.lightMapIntensity = m.userData.lmBase / W.lm.meta.eve; } }
if (DEBUG) window.EXPORT_BAKE = exportBake;
if (DEBUG) window.STEP = (sec, dt = 1 / 30) => { for (let t = 0; t < sec; t += dt) frame(dt, false); composer.render(); };

// ============================================================
// 起動
// ============================================================
function init() {
  genTextures(); genMaterials(); nameMaterials(); buildWorld(); buildDoors(); buildPeople(); buildMother(); buildSuika(); buildPassers(); voiceLoad(); eventsInit(); townInit(); buildLights(); buildSky(); applyTOD(TOD.day); rpgInit(); buildPost();
  // 金属だけに映り込みを与える（部屋全体は明るくしない）
  const pm = new THREE.PMREMGenerator(renderer), envT = pm.fromScene(new RoomEnvironment(), .04).texture;
  scene.traverse(o => { if (!o.isMesh) return; for (const m of [].concat(o.material)) if (m && m.isMeshStandardMaterial && m.metalness >= .3 && !m.envMap) { m.envMap = envT; m.envMapIntensity = m.metalness * .7; m.needsUpdate = true; } });
  for (const k of [FRIEND, BROTHER]) k.root.traverse(o => { if (!o.isMesh) return; for (const m of [].concat(o.material)) if (m && m.isMeshStandardMaterial) { m.envMap = envT; m.envMapIntensity = .35; m.needsUpdate = true; } });
  W.looks.push({ id: 'win1', pos: W.friendWinPos, dist: 40, dot: .985, text: 'さっきまでいた部屋だ。明かりがついている。', when: () => G.phase === 'outside', noBlock: true });
  W.looks.push({ id: 'win2', pos: W.livingWinPos, dist: 40, dot: .985, text: 'カーテンの向こうで、テレビの光が揺れている。', when: () => G.phase === 'outside', noBlock: true });
  W.looks.push({ id: 'mansion', pos: new V3(14, 4, 1), dist: 40, dot: .96, text: '和泉コーポ。梅崎の家は、二階の三番目だ。', when: () => G.phase === 'approach' && P.pos.z > -12, noBlock: true });
  W.ready = Promise.all([loadBake().catch(e => console.warn('bake', e)), setupProps().catch(e => console.warn('props', e))]);
  $('startBtn').textContent = '読み込み中……'; W.ready.then(() => { $('startBtn').textContent = 'クリックして始める'; W.isReady = true; });
  updateCamera(); composer.render();
  $('load').style.display = 'none';
  loop();
}
$('title').addEventListener('click', async () => {
  if (started || !W.isReady) return;
  const q = $('q').value; if (q !== 'high') { if (W.ao) W.ao.enabled = false; Q = QUALITY[q]; renderer.setPixelRatio(Q.pr); LT.sun.shadow.mapSize.set(Q.shadow, Q.shadow); LT.sun.shadow.map?.dispose(); LT.sun.shadow.map = null; composer.setPixelRatio(Q.pr); composer.setSize(innerWidth, innerHeight); }
  sens = +$('sens').value; audioInit(+$('vol').value); startAmbience(); musicInit(); setTimeout(() => playSE('再起動', { gain: .5 }), 400);
  $('title').style.display = 'none'; started = true; canvas.requestPointerLock();
  UI.fadeText.textContent = '一九九七年　八月\n東京都杉並区　和泉'; UI.fadeText.style.opacity = 1; setTimeout(() => { SFX.train(false); }, 600);
  await wait(3.2); await fadeIn(2.4); setObj('梅崎の家（和泉コーポ 203）'); setTimeout(() => G.thought('泉南。……改札を出て、泉南通りを歩いて、米屋の先の細い道を入る。'), 1500);
});
Object.assign(window, { TOWN, TL, DOG, openPhone, phoneDial, famicomBug, stickyPrank, eatSuikaSlice, sayVoice, hasVoice, PASSERS, MOTHER, motherComesHome, THREE, composer, MDL, PROPS, ELV, elvCall, playerInCar, openChat, KEYS, G, P, DOORS, W, MT, LT, RPG, AU, camera, scene, renderer, FRIEND, BROTHER, SRC });
try { init(); } catch (e) { $('load').textContent = 'エラー: ' + e.message + ' ' + (e.stack||'').replace(/http[^ )]*:/g,'L'); console.error(e); }
