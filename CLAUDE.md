# CLAUDE.md

This file is an index/router for future AI agents. Keep it under 150 lines. Put detailed rules in the linked files, not here.

## Project Snapshot

- Static browser game / interactive site in `/Users/wumingjuan/Desktop/2ndgames`.
- Main files: `index.html`, `rain-room.html`, `nekoland.html`, `nekoland-room.html`, `candy-maze.html`, `css/`, `js/`, `assets/`, `server/llm-proxy.js`.
- Known local launch command: `npx http-server . -p 4322 -c-1`.
- `.env` exists. Do not print secrets. Use `.env.example` for variable names.

## Read First

- System diagnosis: `AI_SYSTEM_DIAGNOSIS.md`
- Model/delegation routing: `MODEL_ROUTING_RULES.md`
- Judgment checklists: `JUDGMENT_CHECKLISTS.md`
- Copy-paste task prompts: `TASK_PROMPT_TEMPLATES.md`
- Maintenance rules: `MAINTENANCE_PROTOCOL.md`
- Future-session handoff: `LETTER_TO_FUTURE_SESSIONS.md`

## Before Editing Files

1. Run `git status --short`.
2. Identify allowed files and files not allowed to touch.
3. If the worktree is dirty, do not revert or overwrite user changes.
4. Use `rg` before opening large files.
5. For files over 300 lines, search first, then read only relevant sections.
6. Do not edit `.env`, `.git/`, generated assets, or binary files unless the user explicitly asks.

## When To Ask The User

Ask before continuing if:

- The request requires deleting files, resetting Git state, or overwriting user changes.
- More than 5 files need edits and the scope was not requested.
- Secrets, credentials, paid APIs, or production deployment are involved.
- Requirements conflict and a safe assumption is not obvious.
- A command needs permission outside the workspace or network access.

Do not ask if a reasonable, low-risk assumption lets you proceed.

## When To Delegate

Delegate or use a subagent when:

- Bulk reading, repetitive edits, or broad repo searches are needed.
- A fresh-context review is needed after implementation.
- Research requires collecting many sources.
- The commander has solved the pattern and batch application remains.

Delegation prompts must include goal, motivation, allowed files, acceptance criteria, and report format. See `MODEL_ROUTING_RULES.md`.

## Validation Rules

- Code changes: run the narrowest relevant test or syntax check available.
- UI changes: run the local server and inspect affected pages at mobile and desktop widths.
- Research/report changes: verify claims against sources and mark uncertainty.
- If validation cannot run, say exactly why and list the highest remaining risk.

## Reporting Back

Report in this order:

1. What changed.
2. Files changed.
3. Verification run and result.
4. Remaining risks or follow-up.

Keep final reports concise. Put long logs in files, not chat.
