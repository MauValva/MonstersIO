import { readdirSync, statSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, extname } from 'node:path';
import { gzipSync } from 'node:zlib';
const walk = (dir) => readdirSync(dir).flatMap(name => {
  const path = join(dir, name);
  return statSync(path).isDirectory() ? walk(path) : [path];
});
const files = walk('dist').map(path => {
  const extension = extname(path).toLowerCase();
  const category = extension === '.js' ? 'javascript' : /\.(png|jpe?g|webp|gif|svg)$/.test(extension) ? 'images' : /\.(mp3|ogg|wav|m4a)$/.test(extension) ? 'audio' : /\.(woff2?|ttf|otf)$/.test(extension) ? 'fonts' : 'other';
  return { path: path.replaceAll('\\', '/'), bytes: statSync(path).size, category,
    ...(category === 'javascript' ? { gzipBytes: gzipSync(readFileSync(path)).length } : {}) };
}).sort((a,b) => b.bytes-a.bytes);
const totals = { total: 0, javascript: 0, images: 0, audio: 0, fonts: 0, other: 0, jsGzip: 0, files: files.length };
for (const file of files) { totals.total += file.bytes; totals[file.category] += file.bytes; totals.jsGzip += file.gzipBytes ?? 0; }
mkdirSync('reports', { recursive:true });
writeFileSync(`reports/build-${process.argv[2] ?? 'current'}.json`, JSON.stringify({totals, files}, null, 2));
console.log(totals);
