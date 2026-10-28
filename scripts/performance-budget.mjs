import { readFile } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
import path from 'node:path';
import assert from 'node:assert/strict';

const root = path.resolve('out');
for (const route of ['index.html', 'practice.html', 'beta.html']) {
  const html = await readFile(path.join(root, route), 'utf8');
  const scripts = [...new Set([...html.matchAll(/<script[^>]*src="([^"]+)"/g)].map(match => match[1]))];
  let javascript = 0;
  for (const source of scripts) {
    const pathname = new URL(source, 'https://local.invalid').pathname;
    assert.ok(pathname.startsWith('/_next/static/'), 'Initial scripts must come from the local build');
    javascript += gzipSync(await readFile(path.join(root, pathname))).length;
  }
  const document = gzipSync(html).length;
  console.log(JSON.stringify({ route, initialJavaScriptGzipBytes: javascript, htmlGzipBytes: document, scriptCount: scripts.length }));
  assert.ok(javascript <= 400 * 1024, `${route}: initial JavaScript exceeds the 400 KiB gzip budget`);
  assert.ok(document <= 80 * 1024, `${route}: HTML exceeds the 80 KiB gzip budget`);
}
