#!/usr/bin/env node
import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';
import { mkdir, stat, writeFile } from 'node:fs/promises';
import { extname, join, normalize, resolve } from 'node:path';

const root = resolve(process.cwd());
const port = Math.max(1024, Number(process.argv[2]) || 4325);
const outputFile = resolve(process.argv[3] || join(root, 'artifacts', 'sky-room-linkedin-raw.webm'));
const maxUploadBytes = 240 * 1024 * 1024;
const mimeTypes = {
  '.css': 'text/css; charset=utf-8',
  '.glb': 'model/gltf-binary',
  '.html': 'text/html; charset=utf-8',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.mp3': 'audio/mpeg',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webm': 'video/webm',
  '.webp': 'image/webp'
};

function sendJson(response, statusCode, value) {
  response.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store'
  });
  response.end(JSON.stringify(value));
}

const server = createServer(async (request, response) => {
  const url = new URL(request.url || '/', `http://${request.headers.host || '127.0.0.1'}`);
  if (request.method === 'POST' && url.pathname === '/api/promo-recording') {
    const chunks = [];
    let size = 0;
    request.on('data', chunk => {
      size += chunk.length;
      if (size > maxUploadBytes) request.destroy(new Error('promo recording exceeded 240 MB'));
      else chunks.push(chunk);
    });
    request.on('error', error => {
      if (!response.headersSent) sendJson(response, 413, { ok: false, error: error.message });
    });
    request.on('end', async () => {
      try {
        await mkdir(resolve(outputFile, '..'), { recursive: true });
        await writeFile(outputFile, Buffer.concat(chunks));
        sendJson(response, 200, { ok: true, file: outputFile, bytes: size });
        console.info(`[promo-server] saved ${size} bytes to ${outputFile}`);
      } catch (error) {
        sendJson(response, 500, { ok: false, error: error.message });
      }
    });
    return;
  }

  if (request.method !== 'GET' && request.method !== 'HEAD') {
    response.writeHead(405);
    response.end('Method not allowed');
    return;
  }

  let pathname = decodeURIComponent(url.pathname);
  if (pathname === '/') pathname = '/sky-room.html';
  const relative = normalize(pathname).replace(/^(\.\.(\/|\\|$))+/, '').replace(/^[/\\]+/, '');
  const file = resolve(join(root, relative));
  if (!file.startsWith(`${root}/`) && file !== root) {
    response.writeHead(403);
    response.end('Forbidden');
    return;
  }

  try {
    const info = await stat(file);
    if (!info.isFile()) throw new Error('not a file');
    response.writeHead(200, {
      'Content-Type': mimeTypes[extname(file).toLowerCase()] || 'application/octet-stream',
      'Content-Length': info.size,
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff'
    });
    if (request.method === 'HEAD') response.end();
    else createReadStream(file).pipe(response);
  } catch {
    response.writeHead(404);
    response.end('Not found');
  }
});

server.listen(port, '127.0.0.1', () => {
  console.info(`[promo-server] http://127.0.0.1:${port}/sky-room.html`);
  console.info(`[promo-server] output ${outputFile}`);
});
