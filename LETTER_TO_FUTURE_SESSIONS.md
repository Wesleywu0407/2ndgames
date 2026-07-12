# Letter To Future Sessions

## 1. Three Important Things The User Did Not Ask For But Future Models Must Know

### 1. The repo may already contain user work in progress

During creation of this system, `git status --short` showed modified and untracked application files. Future agents must treat the worktree as shared space. Do not clean, reset, or overwrite files just because they look temporary.

### 2. This project needs visual validation

The repository is a browser-based interactive/game project. Many errors will not show up through syntax checks. For UI changes, run the local server and inspect the affected page at mobile and desktop sizes.

### 3. The AI system should stay lightweight

The point of these files is to help weaker models act better. If the files become long essays, they will fail. Prefer checklists, exact commands, stop rules, and examples.

## 2. Most Likely Ways This System Will Degrade

1. `CLAUDE.md` becomes a dumping ground for every new rule.
2. Agents add abstract advice without examples or verification.
3. Old commands remain after the project structure changes.
4. Model routing rules are ignored and expensive models do bulk work.
5. Failed attempts are not recorded, so the same mistake repeats.

## 3. How To Prevent Degradation

1. Check `CLAUDE.md` line count after every edit.
2. Move long explanations into companion files.
3. Delete duplicated rules when adding new ones.
4. Add every repeated failure to `MAINTENANCE_PROTOCOL.md`.
5. Re-audit launch commands and project structure after major repo changes.

## 4. Lowest-Confidence Files And Why

### `MODEL_ROUTING_RULES.md`

Confidence: medium.

Reason: The current session could not verify the user's future model menu, pricing, effort settings, or subagent availability. Rules are written generically and should be adapted when the actual future environment is known.

### `TASK_PROMPT_TEMPLATES.md`

Confidence: medium.

Reason: Templates cover the user's stated use cases, but future workflows may need more specialized templates for specific report formats, dashboards, or design systems.

### `CLAUDE.md`

Confidence: medium-high.

Reason: Project structure and launch command were verified, but no README/tests existed to confirm intended development workflow.

## 5. What To Improve In The Next High-End Model Session

1. Verify the actual Claude/Codex model options, effort settings, memory system, MCP servers, and subagent tools.
2. Add project-specific validation commands after tests or scripts exist.
3. Create a compact `README.md` if the user wants human-facing project onboarding.
4. Review real future failures and convert them into maintenance lessons.
5. Build specialized prompts for the user's most common report/dashboard formats.

## 6. What Not To Waste Expensive Model Time On

Do not spend high-end model time on:

- Bulk file reading.
- Formatting Markdown.
- Applying a proven edit pattern across many files.
- Copy-editing long reports after the critique pattern is established.
- Re-running routine validation commands.
- Generating long source inventories that a cheaper model can produce.

Use high-end model time for:

- Deciding what matters.
- Designing systems and rubrics.
- Handling ambiguous failures.
- Reviewing high-impact conclusions.
- Creating rules that weaker models can follow later.
