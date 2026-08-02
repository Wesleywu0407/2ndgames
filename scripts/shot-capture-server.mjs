#!/usr/bin/env node
/**
 * Frame-sequence capture for trailer shots.
 *
 * Serves the project and accepts numbered PNG frames at
 * POST /api/frame?shot=<name>&n=<index>, writing them to
 * artifacts/trailer/frames/<shot>/frame-00001.png
 *
 * Frames are rendered deterministically by qa/shot-render.html — the animation
 * mixer is stepped by hand and the canvas is read after each render, so nothing
 * depends on requestAnimationFrame running at any particular rate (it does not
 * run at all in a backgrounded tab, which is what froze earlier capture
 * attempts on the first pose).
 *
 * Usage:
 *   node scripts/shot-capture-server.mjs [port]
 *   ffmpeg -framerate 24 -i artifacts/trailer/frames/<shot>/frame-%05d.png \
 *          -c:v libx264 -pix_fmt yuv420p artifacts/trailer/<shot>.mp4
 */
import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';
import { mkdir, stat, writeFile } from 'node:fs/promises';
import { extname, join, normalize, resolve } from 'node:path';

const root = resolve(process.cwd());
const port = Math.max(1024, Number(process.argv[2]) || 4327);
const framesRoot = resolve(root, 'artifacts', 'trailer', 'frames');
const maxFrameBytes = 24 * 1024 * 1024;

const mimeTypes = {
  '.css': 'text/css; charset=utf-8',
  '.glb': 'model/gltf-binary',
  '.html': 'text/html; charset=utf-8',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp'
};

const safeName = value => String(value || '').replace(/[^a-zA-Z0-9._-]/g, '');

function sendJson(response, statusCode, value) {
  response.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store'
  });
  response.end(JSON.stringify(value));
}

const server = createServer(async (request, response) => {
  const url = new URL(request.url || '/', `http://${request.headers.host || '127.0.0.1'}`);

  if (request.method === 'POST' && url.pathname === '/api/frame') {
    const shot = safeName(url.searchParams.get('shot')) || 'shot';
    const index = Number(url.searchParams.get('n'));
    if (!Number.isFinite(index) || index < 0) {
      sendJson(response, 400, { ok: false, error: 'n must be a non-negative number' });
      return;
    }
    const chunks = [];
    let size = 0;
    request.on('data', chunk => {
      size += chunk.length;
      if (size > maxFrameBytes) request.destroy(new Error('frame exceeded 24 MB'));
      else chunks.push(chunk);
    });
    request.on('error', error => {
      if (!response.headersSent) sendJson(response, 413, { ok: false, error: error.message });
    });
    request.on('end', async () => {
      try {
        const dir = join(framesRoot, shot);
        await mkdir(dir, { recursive: true });
        const name = `frame-${String(index).padStart(5, '0')}.png`;
        await writeFile(join(dir, name), Buffer.concat(chunks));
        sendJson(response, 200, { ok: true, shot, frame: name, bytes: size });
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
  if (pathname === '/') pathname = '/qa/shot-render.html';
  const relative = normalize(pathname).replace(/^(\.\.(\/|\\|$))+/, '').replace(/^[/\\]+/, '');
  const file = resolve(join(root, relative));
  if (!file.startsWith(root)) {
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
      'Cache-Control': 'no-store'
    });
    if (request.method === 'HEAD') { response.end(); return; }
    createReadStream(file).pipe(response);
  } catch {
    response.writeHead(404);
    response.end('Not found');
  }
});

server.listen(port, '127.0.0.1', () => {
  console.info(`[shot-capture] http://127.0.0.1:${port}/qa/shot-render.html`);
  console.info(`[shot-capture] frames -> ${framesRoot}/<shot>/`);
});
