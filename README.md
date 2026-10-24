# お父さん怖いシミュレーター

1997年8月、東京都杉並区・和泉。友だちの梅崎の家に遊びに行く、一人称3Dのゲームです。
ふすまの向こうにいる「お父さん」の姿は、最後まで見えません。

**ブラウザで遊ぶ** → https://ganryou.github.io/otousan-sim/
（パソコンの Chrome / Edge 推奨。読み込みに少し時間がかかります。ヘッドホン推奨）


## 遊び方
`index.html` をダブルクリックして Chrome / Edge で開く（インターネット接続が必要：3D描画ライブラリを読み込むため）。
うまく開けない場合は `node serve.js` を実行し、http://localhost:8765 を開く。

| 操作 | キー |
|---|---|
| 移動 / 走る（屋外のみ） | WASD / Shift |
| 見回す | マウス |
| 調べる・話す・座る・立つ | E |
| 話しかける（文字を打つ。日本語入力可） | Enter → 入力 → Enter |
| コントローラーを借りる / 返す（座っているとき） | F / Q |
| 腕時計 | T |
| 一時停止 | Esc |

## 第1段階の内容
- 南の通り → 和泉コーポ（外階段・2階外廊下）→ 203号室
- 友だちの部屋（RPG『大地の記憶』、扇風機、麦茶、本棚）
- 廊下・ふすま・トイレ（電気のスイッチ、ドアの開け閉め）
- 父親：音だけ。廊下にとどまると段階的に反応（笑い声 →「誰かいるのか？」→「そこでなにやってるんだ」）
- 弟：トイレに行く途中で現れる（15%で「……こんにちは」）
- 時間経過（昼 → 夕方）、帰り道で街灯が順に点く、窓を見上げると独白
- 南の通りまで歩くと終了
- エレベーター：共用廊下の東の突き当たり（1〜3階。呼びボタン・かご内ボタンは E）

## 開発
- ソースは `src/`。編集後に `node build.js` で `index.html` を再生成する
- `?debug` を付けて開くとマウスロックなしで動く（検証用）
- `assets/assets.js` に `window.ASSETS = { concrete: 'data:image/...', ... }` を置くと、同名のテクスチャが差し替わる（AI生成テクスチャ用）

## 素材
- 質感テクスチャ：Poly Haven（https://polyhaven.com） CC0。`assets/textures/` に元画像、`node build.js` で `assets/assets.js` に埋め込まれる
- ゲームを配るときは `index.html` と `assets/` フォルダをセットで渡す

## 光の焼き込み（Blender）
1. `node serve.js` → http://localhost:8765/?debug を開き、コンソールで `await EXPORT_BAKE()`（assets/bake/bake_in.glb ができる）
2. `blender.exe -b --factory-startup -P tools/bake.py`（昼・夕方の2枚を焼く。RTX 5070 で約30秒）
3. `node build.js`
- 室内のドア・家具の配置を変えたら、1〜3をやり直す
- 3Dモデル：Poly Haven（CC0）。元データは `assets/models_src/`、`blender.exe -b --factory-startup -P tools/convert_models.py` で `assets/models/*.glb` に軽量化
- 効果音：`効果音/【名前】*.wav` を自動で読み込む（Windows XP の音は Microsoft の著作物。**配布・公開するときは外すこと**。外すと自作の電子音に戻る）
- 声：VOICEVOX（VOICEVOX:青山龍星／白上虎太郎／冥鳴ひまり／ちび式じい）。VOICEVOX を起動して `node tools/gen_voice.js` を実行すると、ゲーム内のセリフを集めて `assets/voice/` に音声を作る（作成済みのものは飛ばす）。セリフを追加・変更したら再実行 → `node build.js`

## クレジット
- 音声：VOICEVOX:青山龍星 / VOICEVOX:白上虎太郎 / VOICEVOX:冥鳴ひまり / VOICEVOX:ちび式じい / VOICEVOX:玄野武宏 / VOICEVOX:雀松朱司 / VOICEVOX:No.7 / VOICEVOX:四国めたん / VOICEVOX:麒ヶ島宗麟 / VOICEVOX:九州そら / VOICEVOX:東北イタコ / VOICEVOX:剣崎雌雄
- 質感・3Dモデル：Poly Haven（CC0） https://polyhaven.com
- 3D描画：three.js（MIT）
- 地名・店名・学校名・人物はすべて架空です。
- 公開版には Windows の効果音は含まれていません（自作の電子音で鳴ります）。
