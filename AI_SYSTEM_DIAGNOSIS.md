# AI System Diagnosis

## Context Confirmed

- Repository: `/Users/wumingjuan/Desktop/2ndgames`
- Project shape: static browser game / interactive site using HTML, CSS, JavaScript, image assets, and `server/llm-proxy.js`.
- Known launch command from `.claude/launch.json`: `npx http-server . -p 4322 -c-1`.
- No top-level `README`, `CLAUDE.md`, `AGENTS.md`, `docs/`, `scripts/`, or `tests/` were found during audit.
- Worktree had existing modified and untracked files during this system creation. Future agents must assume user changes may already exist.

## Top 3 Token Leaks

### 1. Reading large app files before defining the question

Fix: Before reading files over 300 lines, write a 3-line search plan:

```text
Goal:
Likely files:
Search terms:
```

Then run targeted `rg` searches before opening full files.

### 2. Pasting long findings into chat

Fix: If output is longer than 80 lines, save it to a Markdown file or summarize it in 10 bullets with file paths and line numbers.

### 3. Repeating environment discovery every session

Fix: Read `CLAUDE.md` first, then only open the linked file that matches the task type.

## Top 3 Focus-Loss Risks

### 1. Mixing system-building with normal feature work

Fix: If the task is about this AI operating system, edit only these files unless the user explicitly asks for app code changes:

- `CLAUDE.md`
- `AI_SYSTEM_DIAGNOSIS.md`
- `MODEL_ROUTING_RULES.md`
- `JUDGMENT_CHECKLISTS.md`
- `TASK_PROMPT_TEMPLATES.md`
- `MAINTENANCE_PROTOCOL.md`
- `LETTER_TO_FUTURE_SESSIONS.md`

### 2. Turning `CLAUDE.md` into a rule dump

Fix: Keep `CLAUDE.md` under 150 lines. Move detailed rubrics to linked files.

### 3. Solving unclear requests by editing many files

Fix: If more than 5 files seem necessary, pause and write:

```text
Proposed files to edit:
Reason for each:
Risk:
Validation:
```

Proceed only if the scope is obviously safe or the user confirms.

## Top 3 File / Code Safety Risks

### 1. Dirty worktree damage

Fix: Run `git status --short` before edits. Do not revert or overwrite files with existing user changes unless the user explicitly requests it.

### 2. Accidental secret exposure

Fix: Never print `.env` contents in chat. Use `.env.example` to infer variable names.

### 3. Browser UI changes without visual validation

Fix: For HTML/CSS/JS visual changes, run the local server and inspect the affected page in a browser or screenshot before reporting completion.

## Top 3 Quality Failure Modes

### 1. Generic rules that weak models cannot execute

Fix: Every rule must include an observable action, such as a command, file list, line limit, acceptance criterion, or stop condition.

### 2. Verification done only by the creating agent

Fix: For medium or high-risk work, request a fresh-context review or run independent tests after implementation.

### 3. Treating partial success as completion

Fix: Report completion only after all acceptance criteria pass or unresolved failures are listed with exact next actions.

## Bad Instruction Example

```text
Be careful with the repo and make the UI better.
```

Why it fails:

- No file boundaries.
- No definition of "better."
- No verification method.
- No stop condition.

## Improved Instruction Example

```text
Improve the mobile layout of rain-room.html.
Allowed files: rain-room.html, css/*.css, js/rain-room.js.
Do not touch: assets/, .env, server/.
Acceptance criteria:
1. No text overlaps at 390px width.
2. Main interaction remains usable with touch.
3. Existing desktop layout at 1440px still works.
Verification:
1. Run npx http-server . -p 4322 -c-1.
2. Capture or inspect 390x844 and 1440x900 views.
3. Report changed files and any remaining risks.
```
