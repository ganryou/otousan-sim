// src/ を1つの index.html にまとめる（ファイルを直接開いても動くように）
// assets/textures/ の画像は assets/assets.js に埋め込む（ファイル直開きでも WebGL で使えるように）
const fs = require('fs'), path = require('path');
const S = f => fs.readFileSync(path.join(__dirname, 'src', f), 'utf8');
const js = ['01_core.js', '02_world.js', '03_actors.js', '026_town.js', '027_town_logic.js', '028_arcade.js', '029_fighter.js', '035_elevator.js', '04_audio.js', '05_rpg.js', '055_talk.js', '057_props.js', '058_people.js', '059_events.js', '06_game.js'].map(S).join('\n');
fs.writeFileSync(path.join(__dirname, 'index.html'), S('head.html') + '<script type="module">\n' + js + '\n</script>\n' + S('tail.html'));
const td = path.join(__dirname, 'assets', 'textures');
if (fs.existsSync(td)) {
  const ent = fs.readdirSync(td).filter(f => /\.(jpe?g|png)$/i.test(f)).map(f => {
    const key = f.replace(/\.\w+$/, ''), mime = f.toLowerCase().endsWith('png') ? 'png' : 'jpeg';
    return `A[${JSON.stringify(key)}]="data:image/${mime};base64,${fs.readFileSync(path.join(td, f)).toString('base64')}";`;
  });
  // 焼き込み結果（Blender の出力）
  const bd = path.join(__dirname, 'assets', 'bake');
  if (fs.existsSync(path.join(bd, 'bake_out.glb'))) {
    ent.push('A["bake_glb"]="data:application/octet-stream;base64,' + fs.readFileSync(path.join(bd, 'bake_out.glb')).toString('base64') + '";');
    for (const k of ['day', 'eve', 'ao']) { const jf = path.join(bd, 'bake_' + k + '.jpg'), isJ = fs.existsSync(jf), f = isJ ? jf : path.join(bd, 'bake_' + k + '.png'); if (fs.existsSync(f)) ent.push('A["bake_' + k + '"]="data:image/' + (isJ ? 'jpeg' : 'png') + ';base64,' + fs.readFileSync(f).toString('base64') + '";'); }
    const mf = path.join(bd, 'bake_meta.json'); if (fs.existsSync(mf)) ent.push('A["bake_meta"]=' + JSON.stringify(fs.readFileSync(mf, 'utf8')) + ';');
  }
  // 声（assets/voice/vo_*.wav）
  const vd = path.join(__dirname, 'assets', 'voice');
  if (fs.existsSync(vd)) for (const f of fs.readdirSync(vd).filter(f => f.endsWith('.wav'))) ent.push('A[' + JSON.stringify(f.slice(0, -4)) + ']="data:audio/wav;base64,' + fs.readFileSync(path.join(vd, f)).toString('base64') + '";');
  // 3Dモデル（assets/models/*.glb → キー mdl_名前）
  const md = path.join(__dirname, 'assets', 'models');
  if (fs.existsSync(md)) for (const f of fs.readdirSync(md).filter(f => f.endsWith('.glb'))) ent.push('A[' + JSON.stringify('mdl_' + f.slice(0, -4)) + ']="data:model/gltf-binary;base64,' + fs.readFileSync(path.join(md, f)).toString('base64') + '";');
  // 効果音（効果音/【名前】xxx.wav → キー se_名前）
  const sd = path.join(__dirname, '効果音');
  if (fs.existsSync(sd)) for (const f of fs.readdirSync(sd).filter(f => /.(wav|mp3|ogg)$/i.test(f))) {
    const m = f.match(/【(.+?)】/); if (!m) continue; const ext = f.split('.').pop().toLowerCase(), mime = ext === 'mp3' ? 'mpeg' : ext;
    ent.push('A[' + JSON.stringify('se_' + m[1]) + ']="data:audio/' + mime + ';base64,' + fs.readFileSync(path.join(sd, f)).toString('base64') + '";');
  }
  // GitHub の上限（1ファイル100MB）に収まるよう、約40MBずつに分けて書き出す
  // 効果音（Windows XP の音）は別ファイル assets_se.js（公開しない）
  const ad = path.join(__dirname, 'assets');
  for (const f of fs.readdirSync(ad)) if (/^assets(_\d+|_se|_list)?\.js$/.test(f)) fs.unlinkSync(path.join(ad, f));
  const wrap = list => 'window.ASSETS=window.ASSETS||{};(function(A){\n' + list.join('\n') + '\n})(window.ASSETS);';
  const se = ent.filter(e => e.startsWith('A["se_')), rest = ent.filter(e => !e.startsWith('A["se_'));
  const parts = [[]]; let sz = 0;
  for (const e of rest) { if (sz + e.length > 40e6 && parts[parts.length - 1].length) { parts.push([]); sz = 0; } parts[parts.length - 1].push(e); sz += e.length; }
  parts.forEach((p, i) => fs.writeFileSync(path.join(ad, `assets_${i + 1}.js`), wrap(p)));
  fs.writeFileSync(path.join(ad, 'assets_se.js'), wrap(se));
  fs.writeFileSync(path.join(ad, 'assets_list.js'), `window.ASSET_PARTS=${parts.length};`);
  console.log(`assets ${rest.length}件を${parts.length}個に分割 (${(rest.join('').length / 1048576).toFixed(1)}MB) / 効果音 ${se.length}件`);
}
console.log('index.html built', (fs.statSync(path.join(__dirname, 'index.html')).size / 1024).toFixed(0) + 'KB');
