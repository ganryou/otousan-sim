import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// ============================================================
// 基本
// ============================================================
const V3 = THREE.Vector3;
const $ = id => document.getElementById(id);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const rng = mulberry32(19970815);
const R = (a, b) => a + (b - a) * rng();
const RI = (a, b) => Math.floor(R(a, b + 1));
const pick = arr => arr[Math.floor(rng() * arr.length)];
const MR = Math.random;

const QUALITY = { high: { shadow: 4096, pr: Math.min(devicePixelRatio, 2), samples: 4, pshadow: 1024, ao: true }, mid: { shadow: 2048, pr: Math.min(devicePixelRatio, 1.25), samples: 2, pshadow: 512 } };
let Q = QUALITY.high;

const canvas = $('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Q.pr);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
const ANISO = Math.min(8, renderer.capabilities.getMaxAnisotropy());

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(66, innerWidth / innerHeight, 0.05, 1400);
camera.rotation.order = 'YXZ';
scene.add(camera);

// ============================================================
// ノイズ
// ============================================================
function noise2(px, py, seed) {
  const r = mulberry32(seed); const v = new Float32Array(px * py); for (let i = 0; i < v.length; i++) v[i] = r();
  return (x, y) => {
    const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
    const u = xf * xf * (3 - 2 * xf), w = yf * yf * (3 - 2 * yf);
    const x0 = ((xi % px) + px) % px, x1 = (x0 + 1) % px, y0 = ((yi % py) + py) % py, y1 = (y0 + 1) % py;
    const a = v[y0 * px + x0], b = v[y0 * px + x1], c = v[y1 * px + x0], d = v[y1 * px + x1];
    return a + (b - a) * u + (c - a) * w + (a - b - c + d) * u * w;
  };
}
function fbm(S, px, py, seed, oct) {
  const out = new Float32Array(S * S); let amp = 1, tot = 0;
  for (let o = 0; o < oct; o++) {
    const qx = px << o, qy = py << o, n = noise2(qx, qy, seed + o * 131), sx = qx / S, sy = qy / S;
    for (let y = 0, i = 0; y < S; y++) for (let x = 0; x < S; x++, i++) out[i] += n(x * sx, y * sy) * amp;
    tot += amp; amp *= 0.5;
  }
  for (let i = 0; i < out.length; i++) out[i] /= tot;
  return out;
}
function hash2(a, b) { let h = (a * 374761393 + b * 668265263) | 0; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }

// ============================================================
// テクスチャ生成（assets.js に同名の画像があればそちらを優先）
// ============================================================
function finishTex(t, opt = {}) {
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = opt.linear ? THREE.NoColorSpace : THREE.SRGBColorSpace;
  t.anisotropy = ANISO; return t;
}
function assetTex(name) {
  const src = window.ASSETS && window.ASSETS[name]; if (!src) return null;
  const img = new Image(); img.src = src; const t = new THREE.Texture(img); img.onload = () => { t.needsUpdate = true; }; return finishTex(t);
}
function pixTex(S, fn, post, opt = {}) {
  const c = document.createElement('canvas'); c.width = opt.w || S; c.height = opt.h || S; const g = c.getContext('2d');
  if (fn) {
    const W = c.width, H = c.height, id = g.createImageData(W, H), d = id.data;
    for (let y = 0, i = 0; y < H; y++) for (let x = 0; x < W; x++, i++) { const col = fn(x, y, i); d[i * 4] = col[0]; d[i * 4 + 1] = col[1]; d[i * 4 + 2] = col[2]; d[i * 4 + 3] = col[3] ?? 255; }
    g.putImageData(id, 0, 0);
  }
  if (post) post(g, c.width, c.height);
  return finishTex(new THREE.CanvasTexture(c), opt);
}
function tex(name, gen) { return gen(); }
// Poly Haven の写真素材（色・凹凸・ツヤ）。色は明るさ・彩度・色味を調整してから使う
const PHC = {};
function phLoad(key, kind, adj = {}) {
  const src = window.ASSETS && window.ASSETS[key + '_' + kind]; if (!src) return null;
  const ck = key + kind + JSON.stringify(adj); if (PHC[ck]) return PHC[ck];
  const cv = document.createElement('canvas'); cv.width = cv.height = 1024; const cg = cv.getContext('2d'); cg.fillStyle = kind === 'n' ? '#8080ff' : kind === 'r' ? '#c8c8c8' : '#9a968e'; cg.fillRect(0, 0, 1024, 1024); const t = new THREE.CanvasTexture(cv);
  const img = new Image(); img.onload = () => {
    const c2 = cv; if (img.width !== 1024 || img.height !== 1024) { c2.width = img.width; c2.height = img.height; } const g = c2.getContext('2d'); g.drawImage(img, 0, 0);
    if (kind === 'd' && (adj.gain || adj.sat !== undefined || adj.tint)) {
      const id = g.getImageData(0, 0, c2.width, c2.height), d = id.data, gn = adj.gain ?? 1, st = adj.sat ?? 1, [tr, tg, tb] = adj.tint ?? [1, 1, 1];
      for (let i = 0; i < d.length; i += 4) { const l = d[i] * .299 + d[i + 1] * .587 + d[i + 2] * .114; d[i] = (l + (d[i] - l) * st) * gn * tr; d[i + 1] = (l + (d[i + 1] - l) * st) * gn * tg; d[i + 2] = (l + (d[i + 2] - l) * st) * gn * tb; }
      g.putImageData(id, 0, 0);
    }
    t.image = c2; t.needsUpdate = true;
  }; img.src = src;
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = ANISO; t.colorSpace = kind === 'd' ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  if (adj.rot) { t.center.set(.5, .5); t.rotation = adj.rot; }
  PHC[ck] = t; return t;
}

const TX = {};
function genTextures() {
  TX.concrete = tex('concrete', () => { const S = 512, f = fbm(S, 4, 4, 11, 6), h = fbm(S, 48, 48, 12, 2); return pixTex(S, (x, y, i) => { const n = (f[i] - .5) * 48 + (h[i] - .5) * 30; return [170 + n, 168 + n, 161 + n * .95]; }, (g, S) => { const r = mulberry32(5); for (let k = 0; k < 50; k++) { const x = r() * S, w = 2 + r() * 12, len = S * (.12 + r() * .7); const gr = g.createLinearGradient(0, 0, 0, len); gr.addColorStop(0, `rgba(48,44,36,${.05 + r() * .13})`); gr.addColorStop(1, 'rgba(48,44,36,0)'); g.fillStyle = gr; g.fillRect(x, 0, w, len); } for (let k = 0; k < 300; k++) { g.fillStyle = `rgba(30,30,28,${r() * .3})`; const s = r() * 2 + .5; g.fillRect(r() * S, r() * S, s, s); } }); });
  TX.paint = tex('paint', () => { const S = 512, f = fbm(S, 3, 3, 21, 5), h = fbm(S, 64, 64, 22, 2); return pixTex(S, (x, y, i) => { const n = (f[i] - .5) * 26 + (h[i] - .5) * 12; return [214 + n, 206 + n, 188 + n * .9]; }, (g, S) => { const r = mulberry32(8); for (let k = 0; k < 36; k++) { const x = r() * S, w = 1 + r() * 8, len = S * (.1 + r() * .5); const gr = g.createLinearGradient(0, 0, 0, len); gr.addColorStop(0, `rgba(70,62,48,${.05 + r() * .12})`); gr.addColorStop(1, 'rgba(70,62,48,0)'); g.fillStyle = gr; g.fillRect(x, 0, w, len); } const gr = g.createLinearGradient(0, S * .8, 0, S); gr.addColorStop(0, 'rgba(60,52,38,0)'); gr.addColorStop(1, 'rgba(60,52,38,.22)'); g.fillStyle = gr; g.fillRect(0, 0, S, S); }); });
  TX.tile = tex('tile', () => { const S = 512, f = fbm(S, 8, 8, 31, 4), tw = 64, th = 16, gw = 2; return pixTex(S, (x, y, i) => { const row = Math.floor(y / th), off = (row % 2) * tw / 2, xx = (x + off) % S, col = Math.floor(xx / tw), lx = xx % tw, ly = y % th; const n = (f[i] - .5) * 30; if (lx < gw || ly < gw) return [128 + n * .5, 122 + n * .5, 112 + n * .5]; const v = (hash2(row, col) - .5) * 44, w = (hash2(col, row + 99) - .5) * 14; const hl = ly < gw + 2 ? 14 : 0; return [148 + v + n + hl, 110 + v * .85 + n + w + hl, 78 + v * .6 + n * .8 + hl]; }); });
  TX.asphalt = tex('asphalt', () => { const S = 512, f = fbm(S, 4, 4, 41, 5), h = fbm(S, 128, 128, 42, 2); return pixTex(S, (x, y, i) => { const s = h[i] > .78 ? 12 : h[i] < .22 ? -10 : 0; const n = (f[i] - .5) * 22 + s + (hash2(x, y) - .5) * 10; return [80 + n, 80 + n, 82 + n]; }, (g, S) => { const r = mulberry32(3); g.strokeStyle = 'rgba(25,25,25,.55)'; g.lineWidth = 1.2; for (let k = 0; k < 7; k++) { g.beginPath(); let x = r() * S, y = r() * S; g.moveTo(x, y); for (let j = 0; j < 12; j++) { x += (r() - .5) * 40; y += (r() - .5) * 40; g.lineTo(x, y); } g.stroke(); } g.fillStyle = 'rgba(30,30,32,.35)'; for (let k = 0; k < 3; k++) g.fillRect(r() * S, r() * S, 60 + r() * 120, 40 + r() * 90); }); });
  TX.block = tex('block', () => { const S = 512, f = fbm(S, 6, 6, 51, 5), bw = 128, bh = 64; return pixTex(S, (x, y, i) => { const row = Math.floor(y / bh), off = (row % 2) * bw / 2, xx = (x + off) % S, col = Math.floor(xx / bw), lx = xx % bw, ly = y % bh; const n = (f[i] - .5) * 34; if (lx < 4 || ly < 4) return [118 + n, 116 + n, 110 + n]; const v = (hash2(row, col + 7) - .5) * 26; const moss = y > S * .8 ? (y - S * .8) / (S * .2) : 0; return [150 + v + n - moss * 40, 150 + v + n - moss * 18, 145 + v + n - moss * 45]; }); });
  TX.wood = tex('wood', () => { const S = 512, g1 = fbm(S, 64, 2, 61, 4), g2 = fbm(S, 8, 8, 62, 3); const pw = 64; return pixTex(S, (x, y, i) => { const p = Math.floor(x / pw), seg = Math.floor((y + hash2(p, 1) * S) / (S * .5)); const lx = x % pw; const v = (hash2(p, seg) - .5) * 40; const grain = (g1[i] - .5) * 60 + (g2[i] - .5) * 20; const edge = lx < 2 ? -40 : 0; const joint = Math.abs(((y + hash2(p, 1) * S) % (S * .5))) < 2 ? -35 : 0; return [148 + v + grain + edge + joint, 98 + v * .8 + grain * .8 + edge + joint, 58 + v * .5 + grain * .5 + edge + joint]; }); });
  TX.furn = tex('furn', () => { const S = 256, g1 = fbm(S, 32, 2, 63, 4); return pixTex(S, (x, y, i) => { const n = (g1[i] - .5) * 60; return [128 + n, 86 + n * .8, 52 + n * .5]; }); });
  TX.wallpaper = tex('wallpaper', () => { const S = 512, f = fbm(S, 128, 8, 71, 3), h = fbm(S, 4, 4, 72, 3); return pixTex(S, (x, y, i) => { const n = (f[i] - .5) * 12 + (h[i] - .5) * 16; const pat = ((x + y) % 32 < 1 || (x - y + 1024) % 32 < 1) ? -6 : 0; return [224 + n + pat, 218 + n + pat, 200 + n * 1.2 + pat]; }); });
  TX.ceiling = tex('ceiling', () => { const S = 512, f = fbm(S, 8, 8, 81, 3); return pixTex(S, (x, y, i) => { const n = (f[i] - .5) * 10; return [232 + n, 230 + n, 222 + n]; }, (g, S) => { const r = mulberry32(81); g.strokeStyle = 'rgba(90,85,75,.55)'; g.lineCap = 'round'; for (let k = 0; k < 900; k++) { g.lineWidth = .8 + r() * 1.6; const x = r() * S, y = r() * S; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + (r() - .5) * 10, y + (r() - .5) * 10, x + (r() - .5) * 14, y + (r() - .5) * 14); g.stroke(); } g.fillStyle = 'rgba(120,110,95,.25)'; g.fillRect(0, 0, S, 2); g.fillRect(0, 0, 2, S); }); });
  TX.carpet = tex('carpet', () => { const S = 256, f = fbm(S, 64, 64, 91, 2), h = fbm(S, 4, 4, 92, 3); return pixTex(S, (x, y, i) => { const n = (f[i] - .5) * 30 + (h[i] - .5) * 14; return [164 + n, 146 + n, 118 + n]; }); });
  TX.genkan = tex('genkan', () => { const S = 256, f = fbm(S, 64, 64, 93, 2); return pixTex(S, (x, y, i) => { const n = (f[i] - .5) * 90; const s = hash2(x >> 2, y >> 2) > .8 ? 30 : 0; return [118 + n * .6 + s, 110 + n * .6 + s, 100 + n * .6 + s]; }); });
  TX.toilet = tex('toiletTile', () => { const S = 512, f = fbm(S, 8, 8, 94, 3), tw = 64; return pixTex(S, (x, y, i) => { const lx = x % tw, ly = y % tw, n = (f[i] - .5) * 10; if (lx < 3 || ly < 3) return [220 + n, 220 + n, 212 + n]; const v = (hash2(x >> 6, y >> 6) - .5) * 8; return [180 + v + n, 204 + v + n, 196 + v + n]; }); });
  TX.steel = tex('steel', () => { const S = 256, f = fbm(S, 4, 4, 95, 4); return pixTex(S, (x, y, i) => { const n = (f[i] - .5) * 22; return [200 + n, 200 + n, 196 + n]; }, (g, S) => { const r = mulberry32(95); g.strokeStyle = 'rgba(60,55,50,.25)'; for (let k = 0; k < 40; k++) { g.lineWidth = .6; g.beginPath(); const x = r() * S, y = r() * S; g.moveTo(x, y); g.lineTo(x + (r() - .5) * 30, y + (r() - .5) * 6); g.stroke(); } const gr = g.createLinearGradient(0, S * .85, 0, S); gr.addColorStop(0, 'rgba(110,70,40,0)'); gr.addColorStop(1, 'rgba(110,70,40,.35)'); g.fillStyle = gr; g.fillRect(0, 0, S, S); }); });
  TX.stucco = tex('stucco', () => { const S = 512, f = fbm(S, 128, 128, 101, 2), h = fbm(S, 4, 4, 102, 4); return pixTex(S, (x, y, i) => { const n = (f[i] - .5) * 44 + (h[i] - .5) * 26; return [226 + n, 224 + n, 218 + n]; }, (g, S) => { const r = mulberry32(102); for (let k = 0; k < 30; k++) { const x = r() * S, w = 2 + r() * 10, len = S * (.1 + r() * .45); const gr = g.createLinearGradient(0, 0, 0, len); gr.addColorStop(0, `rgba(50,48,40,${.06 + r() * .14})`); gr.addColorStop(1, 'rgba(50,48,40,0)'); g.fillStyle = gr; g.fillRect(x, 0, w, len); } }); });
  TX.slate = tex('slate', () => { const S = 512, f = fbm(S, 8, 8, 111, 4), rh = 32; return pixTex(S, (x, y, i) => { const row = Math.floor(y / rh), ly = y % rh, off = (row % 2) * 48, col = Math.floor((x + off) / 96), lx = (x + off) % 96; const n = (f[i] - .5) * 24, v = (hash2(row, col) - .5) * 16; if (ly < 3) return [34, 36, 40]; if (lx < 2) return [50, 52, 56]; const shade = ly / rh * 18; return [70 + n + v + shade, 74 + n + v + shade, 82 + n + v + shade]; }); });
  TX.kawara = tex('kawara', () => { const S = 512, f = fbm(S, 8, 8, 121, 3), cw = 64, rh = 64; return pixTex(S, (x, y, i) => { const lx = x % cw, ly = y % rh; const s = Math.sin(lx / cw * Math.PI * 2) * 22; const n = (f[i] - .5) * 18; const lip = ly < 6 ? -30 : 0; return [88 + s + n + lip, 94 + s + n + lip, 104 + s + n + lip]; }); });
  TX.soil = tex('soil', () => { const S = 512, f = fbm(S, 8, 8, 131, 5), h = fbm(S, 128, 128, 132, 2); return pixTex(S, (x, y, i) => { const p = h[i] > .7 ? 26 : 0; const n = (f[i] - .5) * 40 + p; return [118 + n, 106 + n, 88 + n]; }); });
  TX.pave = tex('pave', () => { const S = 512, f = fbm(S, 4, 4, 141, 5), h = fbm(S, 256, 8, 142, 2); return pixTex(S, (x, y, i) => { const n = (f[i] - .5) * 30 + (h[i] - .5) * 10; const j = (x % 256 < 2 || y % 256 < 2) ? -40 : 0; return [158 + n + j, 156 + n + j, 148 + n + j]; }); });
  TX.frp = tex('frp', () => pixTex(256, (x, y) => { const j = (x % 64 < 2 || y % 64 < 2) ? -30 : 0; const n = (hash2(x, y) - .5) * 8; return [176 + j + n, 190 + j + n, 196 + j + n]; }));
  TX.grille = pixTex(128, null, (g, S) => { g.fillStyle = '#c9c7c0'; g.fillRect(0, 0, S, S); g.fillStyle = '#26272a'; g.beginPath(); g.arc(S / 2, S / 2, S * .42, 0, 7); g.fill(); g.strokeStyle = '#8a8a86'; g.lineWidth = 2; for (let r = 8; r < S * .42; r += 7) { g.beginPath(); g.arc(S / 2, S / 2, r, 0, 7); g.stroke(); } g.beginPath(); g.moveTo(S / 2, 8); g.lineTo(S / 2, S - 8); g.moveTo(8, S / 2); g.lineTo(S - 8, S / 2); g.stroke(); });
  TX.curtain = pixTex(256, (x, y) => { const s = Math.sin(x / 256 * Math.PI * 14) * 18 + Math.sin(x / 256 * Math.PI * 5) * 10; return [230 + s, 200 + s, 150 + s * .8]; });
  TX.lace = pixTex(256, (x, y) => { const s = Math.sin(x / 256 * Math.PI * 18) * 25; const p = ((x >> 3) + (y >> 3)) % 2 ? 10 : 0; return [210 + s + p, 212 + s + p, 205 + s + p]; });
  TX.fusuma = tex('fusuma', () => pixTex(256, (x, y) => { const n = (hash2(x >> 1, y >> 1) - .5) * 10; return [226 + n, 214 + n, 184 + n]; }, (g, W, H) => {
    g.strokeStyle = 'rgba(168,140,82,.35)'; g.lineWidth = 1.4; const r0 = 22;
    for (let row = 0; row < 7; row++) for (let c = -1; c < 7; c++) { const cx = c * r0 * 2 + (row % 2) * r0, cy = H - 20 - row * r0 * .9; for (let k = 1; k <= 3; k++) { g.beginPath(); g.arc(cx, cy, r0 * k / 3, Math.PI, 0); g.stroke(); } }
    const gr = g.createLinearGradient(0, H * .4, 0, H * .7); gr.addColorStop(0, 'rgba(226,214,184,1)'); gr.addColorStop(1, 'rgba(226,214,184,0)'); g.fillStyle = gr; g.fillRect(0, 0, W, H * .7);
    const r = mulberry32(7); for (let k = 0; k < 14; k++) { g.fillStyle = `rgba(150,120,70,${r() * .12})`; g.beginPath(); g.arc(r() * W, r() * H, 3 + r() * 14, 0, 7); g.fill(); }
    g.fillStyle = 'rgba(80,60,30,.5)'; g.beginPath(); g.moveTo(170, H - 60); g.lineTo(186, H - 52); g.lineTo(176, H - 40); g.closePath(); g.fill();
  }, { w: 256, h: 512 }));
  TX.faceOld = (skin, pale) => pixTex(128, null, (g, S) => { g.fillStyle = skin; g.fillRect(0, 0, S, S); g.fillStyle = pale ? '#1a1a1a' : '#241a14'; g.beginPath(); g.ellipse(42, 60, 7, pale ? 9 : 6, 0, 0, 7); g.ellipse(86, 60, 7, pale ? 9 : 6, 0, 0, 7); g.fill(); g.fillStyle = 'rgba(40,25,15,.8)'; g.fillRect(32, 44, 20, 4); g.fillRect(76, 44, 20, 4); g.fillStyle = 'rgba(120,60,50,.7)'; g.fillRect(54, 94, 20, 3); g.fillStyle = 'rgba(0,0,0,.08)'; g.fillRect(60, 64, 8, 20); });
}

function makeFaceTex(skin, pale) {
  return pixTex(256, null, (g, S) => {
    g.fillStyle = skin; g.fillRect(0, 0, S, S);
    const sh = g.createRadialGradient(128, 118, 30, 128, 128, 150); sh.addColorStop(0, 'rgba(255,230,210,.18)'); sh.addColorStop(1, 'rgba(80,40,30,.25)'); g.fillStyle = sh; g.fillRect(0, 0, S, S);
    // 眉
    g.strokeStyle = 'rgba(35,24,18,.85)'; g.lineWidth = 7; g.lineCap = 'round';
    g.beginPath(); g.moveTo(64, 92); g.quadraticCurveTo(84, 84, 106, 90); g.stroke(); g.beginPath(); g.moveTo(150, 90); g.quadraticCurveTo(172, 84, 192, 92); g.stroke();
    // 目
    for (const cx of [86, 170]) { g.fillStyle = pale ? '#e8e2dc' : '#f4ede4'; g.beginPath(); g.ellipse(cx, 118, 17, pale ? 11 : 8, 0, 0, 7); g.fill(); g.fillStyle = '#2a1c14'; g.beginPath(); g.arc(cx + 1, 118, pale ? 9 : 7.5, 0, 7); g.fill(); g.fillStyle = '#050403'; g.beginPath(); g.arc(cx + 1, 118, 4, 0, 7); g.fill(); g.fillStyle = 'rgba(255,255,255,.8)'; g.beginPath(); g.arc(cx - 3, 115, 2, 0, 7); g.fill(); g.strokeStyle = 'rgba(40,25,18,.9)'; g.lineWidth = 3.5; g.beginPath(); g.ellipse(cx, 118, 18, pale ? 12 : 9, 0, Math.PI * 1.08, Math.PI * 1.92); g.stroke(); }
    // 鼻
    const ns = g.createLinearGradient(118, 0, 140, 0); ns.addColorStop(0, 'rgba(90,50,35,0)'); ns.addColorStop(1, 'rgba(90,50,35,.28)'); g.fillStyle = ns; g.fillRect(122, 112, 16, 44);
    g.fillStyle = 'rgba(90,45,35,.35)'; g.beginPath(); g.ellipse(120, 158, 5, 3, 0, 0, 7); g.ellipse(138, 158, 5, 3, 0, 0, 7); g.fill();
    // 口
    g.strokeStyle = pale ? 'rgba(120,70,70,.7)' : 'rgba(140,60,50,.85)'; g.lineWidth = 4; g.beginPath(); g.moveTo(108, 190); g.quadraticCurveTo(128, pale ? 188 : 194, 150, 190); g.stroke();
    // 頬
    if (!pale) { g.fillStyle = 'rgba(210,110,90,.12)'; g.beginPath(); g.arc(70, 160, 20, 0, 7); g.arc(186, 160, 20, 0, 7); g.fill(); }
  });
}
// ============================================================
// ラベル（看板・貼り紙）
// ============================================================
function labelTex(w, h, draw) { const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'); draw(g, w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = ANISO; return t; }
const GOTH = '"Yu Gothic","Hiragino Kaku Gothic ProN","Meiryo",sans-serif';
const MIN = '"Yu Mincho","Hiragino Mincho ProN",serif';

// ============================================================
// マテリアル
// ============================================================
function M(o = {}) {
  const m = new THREE.MeshStandardMaterial({
    color: o.color ?? 0xffffff, map: o.map ?? null, roughness: o.rough ?? .88, metalness: o.metal ?? 0,
    emissive: o.emissive ?? 0x000000, emissiveIntensity: o.ei ?? 1, emissiveMap: o.emap ?? null,
    transparent: o.transparent ?? false, opacity: o.opacity ?? 1, side: o.side ?? THREE.FrontSide, flatShading: o.flat ?? false,
    depthWrite: o.depthWrite ?? true,
  });
  if (o.bump && o.map) { m.bumpMap = o.map; m.bumpScale = o.bump; }
  m.userData.uv = o.uv ?? 1;
  if (o.ph) {
    const p = o.ph, adj = { gain: p.gain, sat: p.sat, tint: p.tint, rot: p.rot }, d = phLoad(p.key, 'd', adj), n = phLoad(p.key, 'n', { rot: p.rot }), r = phLoad(p.key, 'r', { rot: p.rot });
    if (d || n) { if (d) m.map = d; if (n) { m.normalMap = n; m.normalScale.set(p.ns ?? 1, p.ns ?? 1); } if (r) { m.roughnessMap = r; m.roughness = p.rough ?? 1; } m.bumpMap = null; m.userData.uv = p.uv ?? m.userData.uv; }
  }
  return m;
}
const MT = {};
function nameMaterials() { for (const [k, v] of Object.entries(MT)) { if (v && v.isMaterial) v.name = k; else if (Array.isArray(v)) v.forEach((m, i) => { if (m && m.isMaterial) m.name = k + '_' + i; }); } }
function genMaterials() {
  MT.concrete = M({ ph: { key: 'concrete', uv: 2.5 }, map: TX.concrete, uv: 2.2, bump: 1.2 });
  MT.slab = M({ ph: { key: 'concrete', uv: 3 }, map: TX.concrete, color: 0xd8d6d0, uv: 3 });
  MT.paint = M({ ph: { key: 'paint', uv: 2.5 }, map: TX.paint, uv: 2.5, bump: .6 });
  MT.paintDark = M({ ph: { key: 'paint', uv: 2.5 }, map: TX.paint, color: 0xb8b0a0, uv: 2.5 });
  MT.tile = M({ ph: { key: 'tile', uv: 3, rot: Math.PI / 2, gain: 1.45, sat: .9, tint: [1.18, .98, .8] }, map: TX.tile, uv: 1.82, bump: 1.4, rough: .7 });
  MT.asphalt = M({ ph: { key: 'asphalt', uv: 4 }, map: TX.asphalt, uv: 5, bump: .8, rough: .95 });
  MT.block = M({ ph: { key: 'block', uv: 2, gain: 2.2, sat: .15 }, map: TX.block, uv: 1.6, bump: 1.2 });
  MT.pave = M({ ph: { key: 'pave', uv: 4 }, map: TX.pave, uv: 4, bump: .4 });
  MT.soil = M({ ph: { key: 'soil', uv: 3 }, map: TX.soil, uv: 3, bump: 1 });
  MT.gutter = M({ map: TX.concrete, color: 0x9a978e, uv: 1 });
  MT.wood = M({ ph: { key: 'wood', uv: 1.1, gain: 1.08, rough: .8 }, map: TX.wood, uv: 1.1, rough: .55 });
  MT.furn = M({ map: TX.furn, uv: 1, rough: .6 });
  MT.furnDark = M({ map: TX.furn, color: 0x6a5a4a, uv: 1, rough: .6 });
  MT.wallpaper = M({ ph: { key: 'wallpaper', uv: 1, gain: 1.42, sat: .35 }, map: TX.wallpaper, uv: .7 });
  MT.ceiling = M({ ph: { key: 'ceiling', uv: 1.5, gain: 1.9, sat: .25, ns: .6 }, map: TX.ceiling, uv: .91 });
  MT.carpet = M({ ph: { key: 'carpet', uv: .8, gain: 2.5, sat: .4, tint: [1.08, 1, .9] }, map: TX.carpet, uv: .6, rough: 1 });
  MT.genkan = M({ ph: { key: 'genkan', uv: 2.4 }, map: TX.genkan, uv: .5, rough: .7 });
  MT.toiletTile = M({ map: TX.toilet, uv: .8, rough: .35 });
  MT.steelDoor = M({ map: TX.steel, color: 0x7c8778, uv: 1, rough: .55, metal: .25 });
  MT.steelDoor2 = M({ map: TX.steel, color: 0x8a7c6a, uv: 1, rough: .55, metal: .25 });
  MT.steelDoor3 = M({ map: TX.steel, color: 0x6e7886, uv: 1, rough: .55, metal: .25 });
  MT.rail = M({ color: 0x3c3f3a, rough: .5, metal: .5 });
  MT.railLight = M({ color: 0xb8b8b0, rough: .45, metal: .6 });
  MT.alu = M({ color: 0xb9bcb8, rough: .35, metal: .8 });
  MT.white = M({ color: 0xeeeeea, rough: .5 });
  MT.black = M({ color: 0x151515, rough: .5 });
  MT.darkGlass = M({ color: 0x2a3440, rough: .08, metal: .9 });
  MT.glassA = M({ color: 0x2a3440, rough: .1, metal: .85, emissive: 0x000000, emap: TX.curtain });
  MT.glassB = M({ color: 0x33404c, rough: .12, metal: .8 });
  MT.frosted = M({ color: 0xc8d0d4, rough: .3, metal: .1, emissive: 0x000000 });
  MT.frostedA = M({ color: 0xc8d0d4, rough: .3, metal: .1, emissive: 0x000000 });
  MT.stucco = [0xe6dccb, 0xd9d4c8, 0xcfc4ae, 0xe8e2d6, 0xc9cfc9, 0xd8c8b8].map(c => M({ map: TX.stucco, color: c, uv: 2, bump: 1, ph: { key: 'stucco', uv: 2 } }));
  MT.slate = M({ map: TX.slate, uv: 1.8, rough: .7 });
  MT.kawara = M({ map: TX.kawara, uv: 1.2, rough: .5, metal: .15 });
  MT.fence = M({ color: 0x6a6f6a, rough: .6, metal: .4 });
  MT.pole = M({ map: TX.concrete, color: 0xb0aea6, uv: 1.2 });
  MT.wire = M({ color: 0x151515, rough: .7 });
  MT.trunk = M({ color: 0x4a3c30, rough: 1 });
  MT.leaf = [0x3f6b2e, 0x4e7a34, 0x36602a, 0x5a8a3a].map(c => M({ color: c, rough: .9, flat: true }));
  MT.hedge = M({ color: 0x3a5e2a, rough: .95, flat: true });
  MT.gutters = [M({ color: 0xd8d4c8, rough: .5 }), M({ color: 0x9a8a78, rough: .5 }), M({ color: 0x5a5a58, rough: .5 })];
  MT.pot = M({ color: 0xa8603a, rough: .8 });
  MT.guard = M({ map: labelTex(64, 256, (g, w, h) => { for (let y = 0; y < h; y += 32) { g.fillStyle = (y / 32) % 2 ? '#111' : '#e8c020'; g.fillRect(0, y, w, 32); } }), rough: .5 });
  MT.frp = M({ map: TX.frp, uv: 2, rough: .6 });
  MT.ac = M({ color: 0xd8d6cc, rough: .5 });
  MT.grille = M({ map: TX.grille, rough: .5 });
  MT.lamp = M({ color: 0xe8e8e0, emissive: 0x000000 });
  MT.lampCorr = M({ color: 0xe8e8e0, emissive: 0x000000 });
  MT.tatami = M({ color: 0xb8b078, ph: { key: 'tatami', uv: 1.9 } });
  MT.toiletFloor = M({ map: TX.toilet, uv: .8, rough: .35, ph: { key: 'toiletTile', uv: .6, rough: .7 } });
  MT.skin = M({ color: 0xd9a886, rough: .7 });
  MT.skinPale = M({ color: 0xd8b8a4, rough: .7, emissive: 0x2c221c, ei: 1 });
  MT.hair = M({ color: 0x1a1512, rough: .6 });
  MT.shirtF = M({ color: 0x4a5e78, rough: .9 });
  MT.shortsF = M({ color: 0x2e2f33, rough: .9 });
  MT.shirtB = M({ color: 0xcfcfc4, rough: .9 });
  MT.shortsB = M({ color: 0x5b4a3a, rough: .9 });
  MT.sock = M({ color: 0xe5e2da, rough: 1 });
  MT.plastic = M({ color: 0x2a2a2c, rough: .4 });
  MT.plasticG = M({ color: 0x8e8e8c, rough: .45 });
  MT.porcelain = M({ color: 0xf2f0ea, rough: .15 });
  MT.cloth = [0xc84a3a, 0x3a6ac8, 0xe8e2c8, 0x7aa860, 0xe0b040].map(c => M({ color: c, rough: 1, side: THREE.DoubleSide }));
}
