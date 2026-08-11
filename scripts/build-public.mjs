/**
 * Builds public/ — the exact set of files that ships to Cloudflare static assets.
 *
 * Copies rather than symlinks: wrangler does not follow symlinks reliably, and an
 * explicit allow-list is what DEPLOYMENT_PLAN.md section 9 asks for (ship only what
 * the game references; never the root videos, artifacts, .env, .git or node_modules).
 *
 * Files above Cloudflare's 25 MiB per-asset limit are excluded here and uploaded to
 * R2 by scripts/upload-large-assets.mjs. Keep LARGE_ASSETS in sync with the
 * LARGE_ASSET_PATHS set in worker/index.ts.
 */
import { cp, mkdir, rm, readdir, stat, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const out = path.join(root, "public");

/**
 * Large binaries can be read from a resident mirror instead of the repo. On this
 * machine the project lives on an iCloud-backed Desktop with "Optimise Mac Storage"
 * on, so assets get evicted back to the cloud mid-build; SKYVEIL_ASSET_SRC points at
 * a local copy that macOS will not purge. Falls back to the repo when unset.
 */
const assetSrc = process.env.SKYVEIL_ASSET_SRC || root;
const from = (rel) => {
  const mirrored = path.join(assetSrc, rel);
  return assetSrc !== root && existsSync(mirrored) ? mirrored : path.join(root, rel);
};

/** Cloudflare Workers static assets reject any single file above this. */
export const MAX_ASSET_BYTES = 25 * 1024 * 1024;

/** Served from R2 instead of static assets. Paths are site-absolute. */
export const LARGE_ASSETS = [
  "assets/models/architecture/skyveil-academy/skyveil-academy.glb",
  "assets/video/skyveil/skyveil-opening-1080p.mp4",
];

const PAGES = ["index.html", "sky-room.html", "rain-room.html", "nekoland-room.html", "candy-maze.html"];
const DIRS = ["css", "js", "data", "assets/models", "assets/video"];
const FILES = ["assets/images/nekoland-room-bg-clean.png"];

const large = new Set(LARGE_ASSETS.map(p => path.basename(p)));

async function main() {
  await rm(out, { recursive: true, force: true });
  await mkdir(out, { recursive: true });

  const missing = [];

  for (const page of PAGES) {
    if (!existsSync(from(page))) {
      missing.push(page);
      continue;
    }
    await cp(from(page), path.join(out, page));
  }

  for (const dir of [...DIRS, ...FILES.map(f => path.dirname(f))]) {
    await mkdir(path.join(out, dir), { recursive: true });
  }

  for (const dir of DIRS) {
    const source = from(dir);
    if (!existsSync(source)) {
      missing.push(dir);
      continue;
    }
    await cp(source, path.join(out, dir), {
      recursive: true,
      filter: src => !large.has(path.basename(src)) && !path.basename(src).startsWith("."),
    });
  }

  for (const file of FILES) {
    if (!existsSync(from(file))) {
      missing.push(file);
      continue;
    }
    await cp(from(file), path.join(out, file));
  }

  if (missing.length) {
    console.error("Missing required source files:\n  " + missing.join("\n  "));
    process.exit(1);
  }

  // Verify the result: nothing oversized, nothing empty (an un-hydrated iCloud
  // placeholder reads as 0 bytes and would ship a broken asset).
  const shipped = await walk(out);
  const oversized = [];
  const empty = [];
  let total = 0;

  for (const file of shipped) {
    const info = await stat(file);
    total += info.size;
    if (info.size > MAX_ASSET_BYTES) oversized.push([file, info.size]);
    if (info.size === 0) empty.push(file);
  }

  for (const asset of LARGE_ASSETS) {
    if (!existsSync(from(asset))) missing.push(asset);
  }

  if (oversized.length) {
    console.error("Files exceed Cloudflare's 25 MiB static asset limit:");
    for (const [file, size] of oversized) {
      console.error(`  ${(size / 1048576).toFixed(1)} MiB  ${path.relative(out, file)}`);
    }
    console.error("Add them to LARGE_ASSETS here and to LARGE_ASSET_PATHS in worker/index.ts.");
    process.exit(1);
  }

  if (empty.length) {
    console.error(`${empty.length} shipped file(s) are 0 bytes (un-hydrated iCloud placeholders?):`);
    for (const file of empty.slice(0, 10)) console.error(`  ${path.relative(out, file)}`);
    process.exit(1);
  }

  await writeFile(
    path.join(out, "build-manifest.json"),
    JSON.stringify(
      {
        builtAt: new Date().toISOString(),
        staticFiles: shipped.length,
        staticBytes: total,
        r2Assets: LARGE_ASSETS,
      },
      null,
      2,
    ),
  );

  console.log(`public/: ${shipped.length} files, ${(total / 1048576).toFixed(1)} MiB static`);
  console.log(`R2: ${LARGE_ASSETS.length} large assets (upload with npm run assets:upload)`);
}

async function walk(dir) {
  const found = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) found.push(...(await walk(full)));
    else found.push(full);
  }
  return found;
}

main();
