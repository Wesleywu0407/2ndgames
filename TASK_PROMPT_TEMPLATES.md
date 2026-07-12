# Task Prompt Templates

Copy one template, fill every field, and delete irrelevant lines. Do not leave vague placeholders.

## 1. Search / Research Task

```text
Context:
I need research on [topic] for [decision/report/project].

Goal:
Answer [specific question].

Constraints:
- Use current sources when facts may have changed.
- Prefer primary sources.
- Separate evidence, inference, and recommendation.
- Mark uncertainty as UNCONFIRMED.

Files allowed to touch:
- [list files or "none"]

Files not allowed to touch:
- .env
- .git/
- [other files]

Acceptance criteria:
1. Includes source links and dates for every major claim.
2. Identifies at least 3 risks or counterarguments.
3. Ends with a recommendation and confidence level.

Verification steps:
1. Check source dates.
2. Re-open the most important sources.
3. Confirm no unsupported current facts remain.

Report format:
- Executive answer
- Evidence table
- Risks/counterevidence
- Recommendation
- Open questions
```

## 2. Code Implementation Task

```text
Context:
Repository: /Users/wumingjuan/Desktop/2ndgames
Feature/background: [describe current behavior].

Goal:
Implement [specific behavior].

Constraints:
- Preserve existing style and patterns.
- Keep changes narrowly scoped.
- Do not edit secrets or binary assets.

Files allowed to touch:
- [exact files/directories]

Files not allowed to touch:
- .env
- .git/
- [exact files/directories]

Acceptance criteria:
1. [observable behavior]
2. [edge case]
3. [regression that must still work]

Verification steps:
1. Run `git status --short` before edits.
2. Run [test/lint/command].
3. If UI: run `npx http-server . -p 4322 -c-1` and inspect affected page.

Report format:
- Changed files
- What changed
- Verification result
- Remaining risks
```

## 3. Refactor Task

```text
Context:
[Module/function/page] is hard to maintain because [reason].

Goal:
Refactor without changing user-visible behavior.

Constraints:
- No feature changes.
- No broad renames unless required.
- Preserve public APIs and asset paths unless listed.

Files allowed to touch:
- [exact files]

Files not allowed to touch:
- .env
- .git/
- [exact files]

Acceptance criteria:
1. Behavior before and after is equivalent for [flows].
2. Duplication or complexity is reduced in [specific area].
3. No unrelated formatting churn.

Verification steps:
1. Search callers with `rg`.
2. Run relevant tests/checks.
3. For UI flows, inspect before/after pages.

Report format:
- Refactor summary
- Behavior preserved
- Verification
- Any follow-up cleanup not done
```

## 4. Debugging Task

```text
Context:
Observed problem: [exact symptom].
Where seen: [page/command/browser/viewport].

Goal:
Find root cause and fix it.

Constraints:
- Reproduce before editing unless impossible.
- Same issue maximum two retry loops.
- Write a failure trace if not fixed after two attempts.

Files allowed to touch:
- [exact files/directories]

Files not allowed to touch:
- .env
- .git/
- [exact files/directories]

Acceptance criteria:
1. Symptom no longer occurs.
2. Root cause is explained with file path and line number.
3. Related regression path still works.

Verification steps:
1. Reproduce symptom.
2. Apply smallest fix.
3. Re-run reproduction.
4. Check one likely regression path.

Report format:
- Root cause
- Fix
- Verification
- Remaining risk
```

## 5. Report Review Task

```text
Context:
Review [document/report] for [audience/decision].

Goal:
Identify factual, logical, structural, and clarity issues.

Constraints:
- Prioritize findings by severity.
- Do not rewrite the whole report unless asked.
- Mark unsupported facts.

Files allowed to touch:
- [report path or "none"]

Files not allowed to touch:
- [list]

Acceptance criteria:
1. Findings include exact section/page/line references.
2. Major claims are checked for source quality.
3. Recommendations are separated from evidence.

Verification steps:
1. Scan all headings.
2. Check claims that affect decisions.
3. Look for missing counterarguments.

Report format:
- Critical issues
- Major issues
- Minor issues
- Source/verification gaps
- Suggested next edits
```

## 6. UI / UX Critique Task

```text
Context:
Review [page/component] for [target users].

Goal:
Find usability, visual hierarchy, accessibility, and interaction issues.

Constraints:
- Use actual viewport sizes.
- Do not propose generic redesigns.
- Respect the existing visual direction.

Files allowed to touch:
- [if implementing, list files; if critique only, "none"]

Files not allowed to touch:
- .env
- .git/
- [list]

Acceptance criteria:
1. Review includes mobile and desktop observations.
2. Each issue includes user impact.
3. Each recommendation is concrete and testable.

Verification steps:
1. Inspect 390x844.
2. Inspect 1440x900.
3. Check text clipping, overlap, tap targets, and key flows.

Report format:
- Top issues by severity
- Screens/viewport checked
- Recommended changes
- Open questions
```

## 7. Data Pipeline / Dashboard Task

```text
Context:
Pipeline/dashboard purpose: [describe].
Data sources: [list].

Goal:
Build or fix [specific output].

Constraints:
- Preserve raw data.
- Log row counts before and after transforms.
- Do not silently drop invalid records.
- Mark stale or missing data.

Files allowed to touch:
- [exact files/directories]

Files not allowed to touch:
- .env
- .git/
- raw data files unless explicitly listed

Acceptance criteria:
1. Output contains expected columns/metrics.
2. Row counts reconcile.
3. Dashboard/report labels data freshness.

Verification steps:
1. Validate schema.
2. Compare row counts at each stage.
3. Spot-check 5 records.
4. Check dashboard rendering.

Report format:
- Data sources
- Transform summary
- Validation table
- Known data gaps
- Changed files
```

## 8. Git Safety / Repo Audit Task

```text
Context:
Audit repository safety before [work/release/commit].

Goal:
Identify dirty files, risky changes, secrets risk, and validation gaps.

Constraints:
- Do not modify files unless asked.
- Do not run destructive Git commands.
- Do not print secret values.

Files allowed to touch:
- none

Files not allowed to touch:
- all files

Acceptance criteria:
1. Reports `git status --short`.
2. Separates tracked, untracked, and ignored concerns.
3. Identifies files that require user confirmation before editing.

Verification steps:
1. Run `git status --short`.
2. Check top-level docs/config.
3. Check for `.env` without printing contents.

Report format:
- Worktree status
- Risks
- Safe next actions
- User confirmations needed
```

## 9. Fresh-Context Review Task

```text
Context:
Another agent completed [task]. Review independently.

Goal:
Find bugs, missed acceptance criteria, unsafe edits, and missing verification.

Constraints:
- Review only; do not edit unless explicitly asked.
- Prioritize findings over praise.
- Every finding needs file path and line number.

Files allowed to touch:
- none

Files not allowed to touch:
- all files

Acceptance criteria:
1. Checks changed files against original request.
2. Reports only actionable issues.
3. States if no issues are found.

Verification steps:
1. Read original request.
2. Inspect diff.
3. Run or review validation evidence.
4. Check for unrelated changes.

Report format:
- Findings by severity
- Missing tests/verification
- Open questions
- Brief summary
```
