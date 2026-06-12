#!/usr/bin/env node
// Local-only LLM proxy.
// Reads secrets from .env and keeps API keys out of browser JavaScript.

const { createServer } = require("node:http");
const { readFileSync, existsSync } = require("node:fs");
const { resolve } = require("node:path");

const ROOT = resolve(__dirname, "..");
loadEnv(resolve(ROOT, ".env"));

const PORT = Number(process.env.LLM_PROXY_PORT || 8787);
const API_KEY = process.env.OPENAI_API_KEY;
const BASE_URL = (process.env.OPENAI_BASE_URL || "https://api.openai.com/v1").replace(/\/$/, "");
const DEFAULT_MODEL = process.env.OPENAI_MODEL || "gpt-4.1-mini";

const server = createServer(async (req, res) => {
  setCorsHeaders(res, req);

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.method !== "POST" || req.url !== "/api/chat") {
    sendJson(res, 404, { error: "Not found" }, req);
    return;
  }

  if (!API_KEY) {
    sendJson(res, 500, { error: "Missing OPENAI_API_KEY in .env" }, req);
    return;
  }

  try {
    const body = await readJson(req);
    const messages = Array.isArray(body.messages) ? body.messages : [];
    const model = body.model || DEFAULT_MODEL;

    const upstream = await fetch(`${BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: 0.8,
      }),
    });

    const text = await upstream.text();
    res.writeHead(upstream.status, {
      "Content-Type": upstream.headers.get("content-type") || "application/json",
      ...corsHeaders(req.headers.origin || ""),
    });
    res.end(text);
  } catch (err) {
    sendJson(res, 500, { error: String(err?.message || err) }, req);
  }
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`LLM proxy running at http://127.0.0.1:${PORT}/api/chat`);
});

function loadEnv(path) {
  if (!existsSync(path)) return;
  const text = readFileSync(path, "utf8");
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim().replace(/^['"]|['"]$/g, "");
    if (key && process.env[key] === undefined) process.env[key] = value;
  }
}

function readJson(req) {
  return new Promise((resolvePromise, reject) => {
    let data = "";
    req.on("data", (chunk) => {
      data += chunk;
      if (data.length > 1_000_000) {
        reject(new Error("Request body too large"));
        req.destroy();
      }
    });
    req.on("end", () => {
      try {
        resolvePromise(data ? JSON.parse(data) : {});
      } catch {
        reject(new Error("Invalid JSON"));
      }
    });
    req.on("error", reject);
  });
}

function corsHeaders(origin = "") {
  const isLocal =
    origin.startsWith("http://127.0.0.1:") ||
    origin.startsWith("http://localhost:");
  return {
    "Access-Control-Allow-Origin": isLocal ? origin : "http://127.0.0.1:8022",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

function setCorsHeaders(res, req) {
  const origin = req?.headers?.origin || "";
  for (const [key, value] of Object.entries(corsHeaders(origin))) {
    res.setHeader(key, value);
  }
}

function sendJson(res, status, payload, req = null) {
  const origin = req?.headers?.origin || "";
  res.writeHead(status, {
    "Content-Type": "application/json",
    ...corsHeaders(origin),
  });
  res.end(JSON.stringify(payload));
}
