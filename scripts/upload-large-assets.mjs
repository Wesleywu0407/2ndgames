/**
 * Uploads the >25 MiB assets to the R2 bucket the worker reads them back from.
 * Object keys match the site path exactly (no leading slash), so the worker can
 * map /assets/... straight onto a key.
 */
import { execFileSync } from "node:child_process";
import { existsSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { LARGE_ASSETS } from "./build-public.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const bucket = "skyveil-large-assets";
const remote = process.argv.includes("--local") ? "--local" : "--remote";

for (const asset of LARGE_ASSETS) {
  const file = path.join(root, asset);
  if (!existsSync(file)) {
    console.error(`missing: ${asset}`);
    process.exit(1);
  }
  const size = statSync(file).size;
  if (size === 0) {
    console.error(`empty (un-hydrated?): ${asset}`);
    process.exit(1);
  }
  console.log(`uploading ${asset} (${(size / 1048576).toFixed(1)} MiB) -> r2://${bucket}/${asset}`);
  execFileSync(
    "npx",
    ["wrangler", "r2", "object", "put", `${bucket}/${asset}`, "--file", file, remote],
    { stdio: "inherit", cwd: root },
  );
}

console.log(`done: ${LARGE_ASSETS.length} asset(s)`);
