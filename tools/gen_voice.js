// ゲーム内のセリフを集めて、VOICEVOX（http://127.0.0.1:50021）で音声にする
// 使い方: VOICEVOX を起動してから node tools/gen_voice.js
// 出力: assets/voice/vo_xxxxxxxx.wav（鍵は src/058_people.js の voKey と同じ計算）
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.join(__dirname, '..'), SRC = f => fs.readFileSync(path.join(ROOT, 'src', f), 'utf8');
const OUT = path.join(ROOT, 'assets', 'voice'); fs.mkdirSync(OUT, { recursive: true });
const API = 'http://127.0.0.1:50021';

// 話し手ごとの声（VOICEVOX の話者ID と調整）
const CAST = {
  friend: { id: 12, speed: 1.02, pitch: -0.03, into: 0.7, vol: 1.0 },        // 白上虎太郎（ふつう）
  brother: { id: 33, speed: 0.9, pitch: 0.02, into: 0.8, vol: 0.8 },        // 白上虎太郎（びくびく）
  father: { id: 13, speed: 0.84, pitch: -0.14, into: 0.5, vol: 1.0 },       // 青山龍星（低く、抑揚を抑えて）
  mother: { id: 14, speed: 1.0, pitch: 0, into: 1.1, vol: 1.0 },            // 冥鳴ひまり
  oldman: { id: 42, speed: 0.9, pitch: 0, into: 1.0, vol: 1.0 },            // ちび式じい
  man: { id: 52, speed: 1.0, pitch: 0, into: 0.9, vol: 1.0 },               // 雀松朱司
  announcer: { id: 11, speed: 1.08, pitch: 0, into: 1.15, vol: 1.0 },       // 玄野武宏（実況）
  announcer2: { id: 39, speed: 1.15, pitch: 0.02, into: 1.45, vol: 1.0 },   // 玄野武宏（喜び・打球）
  station: { id: 30, speed: 1.0, pitch: 0, into: 1.0, vol: 1.0 },          // No.7（アナウンス）
  jiho: { id: 30, speed: 0.95, pitch: 0, into: 0.9, vol: 1.0 },
  weather: { id: 30, speed: 1.0, pitch: 0, into: 1.0, vol: 1.0 },
  op: { id: 30, speed: 1.0, pitch: 0.02, into: 0.9, vol: 1.0 },
  clerk: { id: 2, speed: 1.05, pitch: 0.02, into: 1.2, vol: 1.0 },          // 四国めたん
  driver: { id: 53, speed: 1.0, pitch: -0.03, into: 0.9, vol: 1.0 },        // 麒ヶ島宗麟
  neighbor2: { id: 16, speed: 1.0, pitch: 0, into: 1.3, vol: 1.0 },         // 九州そら
  pmom: { id: 109, speed: 1.02, pitch: 0, into: 1.05, vol: 1.0 },            // 東北イタコ（もち子さんはゲーム利用不可のため変更）
  neighbor: { id: 21, speed: 1.0, pitch: 0, into: 1.0, vol: 1.0 },          // 剣崎雌雄
  oldwoman: { id: 31, speed: 0.85, pitch: -0.04, into: 0.9, vol: 1.0 },     // No.7（読み聞かせ）
  umemom: { id: 14, speed: 1.0, pitch: 0, into: 1.1, vol: 1.0 },            // 冥鳴ひまり
  father_tel: { id: 13, speed: 0.84, pitch: -0.14, into: 0.5, vol: 1.0 },   // 青山龍星
  friend_tel: { id: 12, speed: 1.02, pitch: -0.03, into: 0.7, vol: 1.0 },   // 白上虎太郎
};
const SPECIAL = { '……そこでなにやってるんだ。': 82, 'てめ、ふざけんなよー！': 34, 'うわっ！': 33, '……は？ マジかよ。': 34 };                      // 青山龍星（不機嫌）

function voClean(t) { return t.replace(/<[^>]+>/g, '').replace(/（[^）]*）/g, '').replace(/\s+/g, '').trim(); }
function voKey(who, text) { const s = who + '|' + voClean(text); let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } return 'vo_' + h.toString(16).padStart(8, '0'); }
const READ = [['梅崎', 'うめざき'], ['和泉南', 'いずみみなみ'], ['泉南', 'せんなん'], ['和泉', 'いずみ'], ['中野坂上', 'なかのさかうえ'], ['親父', 'おやじ'], ['母さん', 'かあさん'], ['五十円', 'ごじゅうえん'], ['百十円', 'ひゃくじゅうえん']];
const forTTS = t => { let s = voClean(t); for (const [a, b] of READ) s = s.split(a).join(b); return s; };

const lines = new Map(); const add = (who, t) => { if (!t || !/[ぁ-んァ-ン一-龥A-Za-z0-9]/.test(voClean(t))) return; lines.set(voKey(who, t), { who, t }); };

// 1) 会話データ（055_talk.js）を読み込み、関数の返事も状況を変えて集める
{
  const G = { needToilet: false, toiletDone: false, skipped: false, seated: false, clock: 13 * 60, padOffer: 0 };
  const ctx = { G, Math, console }; vm.createContext(ctx);
  vm.runInContext(SRC('055_talk.js') + '\nthis.__o = { TALK_E, ROOM_LINES, FRIEND_RULES, FRIEND_FALLBACK, TV_LINES, TV_HIT, MOOD_BAD, OLD_TALK, MAN_TALK, MOTHER_LONG };', ctx);
  const o = ctx.__o;
  o.TV_LINES.forEach(t => add('announcer', t)); o.TV_HIT.forEach(t => add('announcer2', t)); o.MOOD_BAD.forEach(t => add('friend', t)); o.OLD_TALK.forEach(t => add('oldman', t)); o.MAN_TALK.forEach(t => add('man', t)); o.MOTHER_LONG.forEach(t => add('mother', t));
  for (const t of [...o.TALK_E, ...o.ROOM_LINES, ...o.FRIEND_FALLBACK]) add('friend', t);
  for (const [, r] of o.FRIEND_RULES) {
    if (typeof r !== 'function') { r.forEach(t => add('friend', t)); continue; }
    for (const st of [{}, { needToilet: true }, { needToilet: true, toiletDone: true }, { skipped: true }, { seated: true }]) { Object.assign(G, { needToilet: false, toiletDone: false, skipped: false, seated: false }, st); try { r().forEach(t => add('friend', t)); } catch (e) { } }
  }
}
// 2) ゲームのコード中のセリフ
const code = ['06_game.js', '058_people.js', '059_events.js', '055_talk.js', '027_town_logic.js'].map(SRC).join('\n');
for (const m of code.matchAll(/(?:sayLine|L)\('(\w+)', '([^']+)'/g)) add(m[1], m[2]);
for (let h = 1; h <= 12; h++) add('jiho', h + '時'); for (let m = 0; m < 60; m++) add('jiho', m + '分'); for (let s = 0; s < 60; s += 10) add('jiho', s + '秒'); for (const t of ['午前', '午後', 'を、お知らせします。']) add('jiho', t);
for (const m of code.matchAll(/friendSays\('([^']+)'/g)) add('friend', m[1]);
for (const m of code.matchAll(/showSub\('([^']+)', \{[^}]*who: '([^']+)'/g)) { const w = { '梅崎': 'friend', '弟': 'brother', 'ふすまの向こう': 'father', 'お母さん': 'mother', 'おじいさん': 'oldman', '会社員': 'man' }[m[2]]; if (w) add(w, m[1]); }
for (const m of code.matchAll(/sayVoice\('(\w+)', '([^']+)'/g)) add(m[1], m[2]);
for (const m of code.matchAll(/say\('([^']+)', \d+\)/g)) add('father', m[1]);
for (const m of code.matchAll(/MOTHER_TALK = \[([^\]]+)\]/g)) for (const s of m[1].matchAll(/'([^']+)'/g)) add('mother', s[1]);
for (const m of code.matchAll(/lines: \[([^\]]+)\]/g)) for (const s of m[1].matchAll(/'([^']+)'/g)) add('oldman', s[1]);
for (const t of ['……ああ。', '……梅崎の友達か。', '……誰かいるのか？', '……そこでなにやってるんだ。']) add('father', t);
add('brother', '……こんにちは。');

(async () => {
  let made = 0, skip = 0;
  const redo = (process.argv.find(a => a.startsWith('--redo=')) || '').slice(7).split(',').filter(Boolean);
  for (const [k, { who }] of lines) if (redo.includes(who)) { const f = path.join(OUT, k + '.wav'); if (fs.existsSync(f)) fs.unlinkSync(f); }
  for (const [k, { who, t }] of lines) {
    const f = path.join(OUT, k + '.wav'); if (fs.existsSync(f)) { skip++; continue; }
    const c = CAST[who], id = SPECIAL[t] ?? c.id, text = forTTS(t);
    const q = await (await fetch(`${API}/audio_query?speaker=${id}&text=${encodeURIComponent(text)}`, { method: 'POST' })).json();
    Object.assign(q, { speedScale: c.speed, pitchScale: c.pitch, intonationScale: c.into, volumeScale: c.vol, outputSamplingRate: 24000, outputStereo: false, prePhonemeLength: .05, postPhonemeLength: .1 });
    const r = await fetch(`${API}/synthesis?speaker=${id}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(q) });
    if (!r.ok) { console.log('NG', who, t, r.status); continue; }
    fs.writeFileSync(f, Buffer.from(await r.arrayBuffer())); made++;
  }
  if (process.argv.includes('--prune')) for (const f of fs.readdirSync(OUT)) if (!lines.has(f.replace(/.wav$/, ''))) fs.unlinkSync(path.join(OUT, f));
  const size = fs.readdirSync(OUT).reduce((a, f) => a + fs.statSync(path.join(OUT, f)).size, 0);
  console.log(`セリフ ${lines.size} 件（新規 ${made} / 既存 ${skip}）  合計 ${(size / 1048576).toFixed(1)}MB`);
  const byWho = {}; for (const { who } of lines.values()) byWho[who] = (byWho[who] || 0) + 1; console.log(byWho);
})();
