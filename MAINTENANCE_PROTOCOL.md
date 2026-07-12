# Maintenance Protocol

## Files Weaker Models May Edit Freely

Weaker models may edit these files when the task is specifically about improving the AI operating system:

- `AI_SYSTEM_DIAGNOSIS.md`
- `MODEL_ROUTING_RULES.md`
- `JUDGMENT_CHECKLISTS.md`
- `TASK_PROMPT_TEMPLATES.md`
- `MAINTENANCE_PROTOCOL.md`
- `LETTER_TO_FUTURE_SESSIONS.md`

Rules for free edits:

1. Keep changes specific and testable.
2. Add examples when adding a rule.
3. Remove duplicated rules instead of adding another version.
4. Record major mistakes using the lesson format below.

## Files Requiring User Confirmation Before Editing

Ask the user before editing:

- `.env`
- `.git/`
- Binary assets such as images, videos, `.blend`, and design files.
- Project launch/config files when the edit changes behavior: `.claude/launch.json`, `.claude/settings.local.json`, `.vscode/settings.json`.
- More than 5 application files in one task.
- Files with existing user changes when the edit may overlap.

## `CLAUDE.md` Maintenance

Rules:

1. Keep `CLAUDE.md` under 150 lines.
2. Use it only as an index/router.
3. Move detailed explanations to companion files.
4. Keep project-specific commands in `CLAUDE.md`.
5. Do not duplicate long checklists there.

When adding a new rule:

- If it tells agents where to go, add it to `CLAUDE.md`.
- If it tells agents how to decide, add it to `JUDGMENT_CHECKLISTS.md`.
- If it tells agents which model or worker to use, add it to `MODEL_ROUTING_RULES.md`.
- If it is a copy-paste prompt, add it to `TASK_PROMPT_TEMPLATES.md`.
- If it is a maintenance lesson, add it here.

## How To Record Mistakes

Add mistakes to the "Lessons Learned" section in this file using this exact format:

```text
Date:
Project:
Mistake:
Root cause:
Bad instruction that allowed it:
New rule:
Where this rule was added:
```

## Where To Write Lessons Learned

- System-level AI process mistake: `MAINTENANCE_PROTOCOL.md`
- Model routing mistake: `MODEL_ROUTING_RULES.md`
- Quality judgment mistake: `JUDGMENT_CHECKLISTS.md`
- Prompt structure mistake: `TASK_PROMPT_TEMPLATES.md`
- Project-specific command or file routing mistake: `CLAUDE.md`

## When To Compact Or Split Files

Compact a file when:

- The same rule appears in 2 or more places.
- A section has more than 10 bullets without examples.
- A weaker model cannot identify the next action in under 30 seconds.

Split a file when:

- It exceeds 300 lines and has multiple unrelated purposes.
- A section becomes a reusable template library.
- Project-specific rules mix with global model rules.

## When To Delete Stale Rules

Delete or update a rule when:

1. The referenced file, command, tool, or workflow no longer exists.
2. Two newer rules contradict it.
3. It has not been useful and causes extra reading.
4. It is vague and cannot be verified.

Before deleting:

- Search for references to the rule.
- Preserve project-critical commands.
- Note the deletion reason in the commit or final report.

## How To Add Project-Specific Rules

Use this test:

- If the rule applies only to `/Users/wumingjuan/Desktop/2ndgames`, put it in `CLAUDE.md` or a project doc.
- If the rule applies to any coding/research assistant, put it in the system docs.
- If unsure, put it in the most specific file first.

Project-specific rule format:

```text
Rule:
Applies to:
Command or file path:
Verification:
Date added:
```

## Lessons Learned

No lessons recorded yet.
