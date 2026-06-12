// ─── NPC LLM bridge ───────────────────────────────────────────────────────────
// askNPC(npcId, message) → Promise<string>
// Keeps a short per-NPC conversation memory so the chef remembers the last turns.

import { LLM_CONFIG, NPC_PROMPTS } from "./llm-config.js";

const histories = {};   // npcId → [{role, content}, ...]

export function resetNPC(npcId) {
  histories[npcId] = [];
}

export async function askNPC(npcId, message) {
  const system = {
    role: "system",
    content: NPC_PROMPTS[npcId] || "You are a friendly background character. Keep replies short.",
  };

  if (!histories[npcId]) histories[npcId] = [];
  histories[npcId].push({ role: "user", content: message });

  // keep system + most recent N turns
  const recent = histories[npcId].slice(-LLM_CONFIG.maxHistory);
  const messages = [system, ...recent];

  let reply;
  if (LLM_CONFIG.mode === "ollama" || LLM_CONFIG.mode === "proxy") {
    reply = await callChat(messages);
  } else {
    throw new Error(`Unknown LLM mode: ${LLM_CONFIG.mode}`);
  }

  histories[npcId].push({ role: "assistant", content: reply });
  return reply;
}

async function callChat(messages) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), LLM_CONFIG.timeoutMs);

  try {
    const res = await fetch(LLM_CONFIG.endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: LLM_CONFIG.model,
        messages,
        stream: false,
      }),
      signal: controller.signal,
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    // Ollama: { message: { content } }.  OpenAI-style: { choices: [{ message }] }.
    const content =
      data?.message?.content ??
      data?.choices?.[0]?.message?.content ??
      "";
    return content.trim() || "……（師傅沉默地點了點頭）";
  } finally {
    clearTimeout(timer);
  }
}

// Friendly error text shown in the chat box when the model can't be reached.
export function describeError(err) {
  if (err?.name === "AbortError") return "（師傅想了很久……回應超時了，再問一次看看？）";
  const msg = String(err?.message || err);
  if (msg.includes("Failed to fetch") || msg.includes("NetworkError")) {
    return "（連不到師傅的腦袋：請確認 `node server/llm-proxy.js` 有開，而且 `.env` 裡有 OPENAI_API_KEY。）";
  }
  return `（出了點狀況：${msg}）`;
}
