# Model Routing Rules

## Core Rule

The commander does not do bulk work. The commander decides scope, writes acceptance criteria, delegates repetitive work, checks conclusions, and performs final integration.

## Routing Table

### Cheap Model

Use for:

- Applying a solved pattern across many similar files.
- Formatting Markdown after structure is decided.
- Extracting lists from files.
- Producing first-pass summaries.
- Running simple commands and reporting exact output.

Do not use for:

- Architecture decisions.
- Ambiguous bug diagnosis.
- Security-sensitive changes.
- Final validation of its own work.

Stop rule: If the cheap model fails once on the same small task, either narrow the prompt or escalate.

### Normal Model

Use for:

- Standard code implementation.
- Focused debugging with clear reproduction steps.
- Refactors under 5 files.
- UI changes with visible acceptance criteria.

Stop rule: If the normal model fails the same subtask twice, escalate with the full failure trace.

### High-End Model

Use for:

- System design.
- Routing and delegation strategy.
- Ambiguous failures after cheaper attempts.
- Reviewing high-impact reports, market intelligence, or research conclusions.
- Identifying hidden risks and failure modes.

Do not use for:

- Bulk reading.
- Long mechanical rewrites.
- Formatting.
- Applying an already proven edit pattern.

### Fresh-Context Reviewer

Use for:

- Reviewing code after implementation.
- Checking research/report quality.
- Finding UI/UX issues after the creating agent says work is done.
- Validating that acceptance criteria were actually met.

Rule: Validation must not be done only by the same agent that created the work.

### Subagent

Use for:

- Broad searches.
- Inventory work.
- Comparing many files.
- Applying repetitive changes.
- Independent review.

Subagent output must contain only:

- Conclusions.
- File paths.
- Line numbers.
- Failed checks.
- Questions that block progress.

Subagent output must not contain:

- Full file dumps.
- Long logs.
- Unrequested rewrites.
- Speculative advice without evidence.

### Human / User Confirmation

Ask the user before:

- Deleting files.
- Resetting Git state.
- Editing secrets or credentials.
- Touching more than 5 files when the request did not imply broad edits.
- Installing dependencies.
- Spending paid API credits.
- Changing public behavior, pricing, claims, legal text, or production config.

## Delegation Prompt Format

Use this exact structure:

```text
Goal:
Why this matters:
Allowed files:
Files not allowed to touch:
Acceptance criteria:
Commands/checks to run:
Report format:
- Findings only
- File path + line number for every claim
- No full file dumps
- Max 20 bullets unless blocked
```

## Retry Rules

- Same issue maximum two retry loops.
- After two failed loops, stop changing code and write a failure trace.
- Failure trace must include command run, exact error, attempted fix, and current hypothesis.
- If a pattern is solved, downgrade to a cheap model for batch application.
- If a small model fails once, escalate or narrow the task.
- If a medium model fails twice, escalate with the full failure trace.

## Long Output Rule

If output is over 80 lines:

1. Save it to a file.
2. Summarize only the key conclusions in chat.
3. Include the file path.

## Validation Routing

- Low-risk formatting: same agent can verify by reading diff.
- Code behavior: run relevant command or browser check.
- UI behavior: visual check at mobile and desktop widths.
- Research claims: verify against primary or current sources.
- High-risk work: fresh-context reviewer required.
