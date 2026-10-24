// 開発用サーバー（http://localhost:8765）。POST /save/<名前> で assets/bake/ にファイルを保存できる
const http = require('http'), fs = require('fs'), path = require('path');
const T = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.png': 'image/png', '.jpg': 'image/jpeg', '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.glb': 'model/gltf-binary' };
http.createServer((q, r) => {
  let p = decodeURIComponent(q.url.split('?')[0]);
  if (q.method === 'POST' && p.startsWith('/save/')) {
    const name = path.basename(p.slice(6)); const dir = path.join(__dirname, 'assets', 'bake'); fs.mkdirSync(dir, { recursive: true });
    const chunks = []; q.on('data', c => chunks.push(c)); q.on('end', () => { fs.writeFileSync(path.join(dir, name), Buffer.concat(chunks)); r.writeHead(200); r.end('saved ' + name); console.log('saved', name); });
    return;
  }
  if (p === '/') p = '/index.html';
  const f = path.join(__dirname, p);
  fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'Content-Type': T[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-store' }); r.end(d); });
}).listen(8765, () => console.log('http://localhost:8765'));
