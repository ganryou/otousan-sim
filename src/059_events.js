// ============================================================
// 部屋での出来事（ファミコンのバグ・スイカ・ベタベタ）、帰りが遅いときのお母さん、通行人へのあいさつ
// ============================================================
const EV = {};
// ---- ファミコンがバグる：画面が乱れて真っ暗 → 梅崎の機嫌が悪くなる
async function famicomBug() {
  if (G.flags.bug) return; G.flags.bug = true;
  RPG.glitch = 2.6; chipSfx('bug');
  await wait(.8); G.friendSays('……あ？');
  await wait(2.0); RPG.glitch = 0; RPG.black = true; MUS.on = false;
  await wait(.8); G.friendSays('……は？ マジかよ。');
  G.mood = 'bad'; G.moodT = 70; FRIEND.head.rotation.x = .35;
  await wait(3.4); G.friendSays('フーッ、フーッ……。'); G.far('（梅崎が、カセットを抜いて息を吹きかけている）', null, 3);
  await wait(4.2); G.friendSays('……セーブ、消えてたら最悪。');
  await wait(5); RPG.black = false; MUS.on = true; MUS.next = now() + .2; RPG.hero.x = 8 * 16; RPG.hero.y = 38 * 16; RPG.gems = 0; RPG.message('ぼうけんを はじめから', 3);
  await wait(1.5); G.friendSays('……もういい。最初から。');
}
// ---- スイカを一切れずつ食べる → 手がベタベタ
function eatSuikaSlice() {
  const fl = W.suikaFlesh, left = fl.children.filter(c => c.visible);
  if (!left.length) { G.thought('皮だけになった。'); return; }
  left[0].visible = false; SFX.crunch();
  const n = left.length - 1;
  if (n === 2) G.thought('シャクッ。よく冷えていて、甘い。');
  else if (n === 1) { G.thought('種を皿に出した。'); if (G.mood !== 'bad') setTimeout(() => G.friendSays('……うち、毎年スイカばっか。'), 900); }
  else { G.flags.suika = true; G.sticky = true; G.thought('……手がベタベタする。'); }
}
// ---- ベタベタの手で梅崎の首をさわる
async function stickyPrank() {
  G.sticky = false; SFX.crunch(.4);
  FRIEND.head.rotation.x = -.2;
  showSub('うわっ！', { who: '梅崎' }); await wait(1.1);
  showSub('てめ、ふざけんなよー！', { who: '梅崎' });
  FRIEND.aL.sh.rotation.x = -1.6; setTimeout(() => FRIEND.sitting && FRIEND.sitCross(), 1400);
  await wait(2.6); G.mood = 'good'; G.moodT = 0; FRIEND.head.rotation.x = .1;
  G.friendSays('……ははっ。べったべたじゃん。');
}
function washHands() { G.sticky = false; SFX.wash(); G.thought('手を洗った。水がぬるい。'); }

// ---- 帰りが遅いと、お母さんが声をかけに来る
async function motherLate(i) {
  if (!MOTHER.root) return; const t = MOTHER_LONG[Math.min(i, MOTHER_LONG.length - 1)];
  MOTHER.root.visible = true; MOTHER.path = null; MOTHER.stand(); MOTHER.root.position.set(15.55, 2.95, -1.85); MOTHER.root.rotation.y = Math.PI / 2;
  if (G.zone !== 'friend') { MOTHER.root.position.set(14.7, 2.95, -6.6); MOTHER.root.rotation.y = Math.PI; }
  showSub(t, { who: 'お母さん', dur: 3.4 });
  await wait(4.6); if (G.leaving) return;
  motherWalk([[14.7, 2.95, -1.9], [14.7, 2.95, -7.2]], () => { MOTHER.root.visible = false; });
}
function lateUpdate(dt) {
  if (!G.skipped || G.leaving || !G.flags.mother) return;
  G.lateT = (G.lateT || 0) + dt; const marks = [45, 85, 125, 165, 205];
  const i = G.lateI || 0; if (i < marks.length && G.lateT > marks[i]) { G.lateI = i + 1; motherLate(i); }
}
// ---- 通行人にあいさつ
function greetPasser(n) {
  const who = n === PASSERS.old ? 'おじいさん' : '会社員', arr = n === PASSERS.old ? OLD_TALK : MAN_TALK;
  n.wait = Math.max(n.wait, 2.5); n.k.root.rotation.y = Math.atan2(P.pos.x - n.k.root.position.x, P.pos.z - n.k.root.position.z);
  showSub(pickNR('g' + who, arr), { who, said: 'こんにちは。' });
}
function nearPasser() {
  let best = null, bd = 3; for (const n of Object.values(PASSERS || {})) { const d = n.k.root.position.distanceTo(P.pos); if (d < bd) { bd = d; best = n; } } return best;
}
function eventsInit() {
  for (const n of Object.values(PASSERS)) interactable(n.k.body.children[0], { label: () => 'あいさつする', act: () => greetPasser(n) });
  hitProxy(14.45, 14.95, 3.8, 4.0, -9.8, -9.55, { label: () => G.sticky ? '手を洗う' : '', act: () => washHands() });
}
function eventsUpdate(dt) {
  if (G.zone === 'friend' && G.entered && !G.skipped && !G.flags.bug && G.roomT > 38) famicomBug();
  if (G.mood === 'bad') { G.moodT -= dt; if (G.moodT <= 0) { G.mood = 'good'; FRIEND.head.rotation.x = .1; } }
  lateUpdate(dt);
}
