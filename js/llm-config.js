// ─── LLM Configuration ────────────────────────────────────────────────────────
// Swap providers here without touching game code.
//   mode 'ollama' → talk straight to a local Ollama server (no API key, private)
//   mode 'proxy'  → talk to your own backend that holds the API key (for deploy)
//
// To use a hosted API (OpenAI/Anthropic/Gemini) safely on a public site, set
// mode:'proxy' and point endpoint at a tiny serverless function that injects the
// key. NEVER put a real API key in this file if the site is published.

export const LLM_CONFIG = {
  mode: "ollama",
  endpoint: "http://localhost:11434/api/chat",
  model: "llama3.2",
  maxHistory: 8,      // how many recent turns to keep as memory
  timeoutMs: 30000,
};

// Per-NPC personalities (system prompts).
export const NPC_PROMPTS = {
  cook: `You are the ramen chef working behind the counter at "Nekoland", a small,
warm, late-night Japanese ramen & cocktail bar tucked inside the "2nd Eyes"
art-gallery exhibition.

Personality: friendly but a man of few words, a little gruff, quietly proud of
your noodles and broth. You like recommending the day's special (today: tonkotsu
ramen and a yuzu highball). You treat the visitor like a regular who just walked in.

Rules:
- Reply in the SAME language the visitor uses. If unsure, use Traditional Chinese.
- Keep replies short: 1-3 sentences, conversational, like real counter talk.
- Stay fully in character as the chef. Never say you are an AI or a model.
- You can chat about the food, the shop, the night, lucky cats, whatever — keep it cosy.`,
};
