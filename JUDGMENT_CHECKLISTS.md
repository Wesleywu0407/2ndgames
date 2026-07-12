# Judgment Checklists

Each item has a rule, positive example, negative example, and verification method so weaker models can execute it directly.

## 1. When To Upgrade Model

### Checklist Item 1

- Rule: Upgrade when the same subtask fails twice with the same error or symptom.
- Positive example: Two attempts to fix `rain-room.js` still produce the same console error, so the agent writes a failure trace and escalates.
- Negative example: The agent makes a third similar edit without explaining why the strategy changed.
- Verification method: Check the chat or notes for two failed attempts and a written failure trace.

### Checklist Item 2

- Rule: Upgrade when the task requires deciding architecture, data model, or long-term system rules.
- Positive example: A routing policy for all future AI agents is assigned to a high-end model.
- Negative example: A cheap model invents global repo rules after reading two files.
- Verification method: Confirm the task affects future decisions, not just one implementation.

### Checklist Item 3

- Rule: Upgrade when facts are uncertain and wrong conclusions would affect money, legal, medical, academic, or business decisions.
- Positive example: Market intelligence claims are checked with current sources before recommendation.
- Negative example: The agent relies on memory for current market size or competitor pricing.
- Verification method: Confirm source links, dates, and uncertainty labels exist.

## 2. When A Task Is Truly Complete

### Checklist Item 1

- Rule: Complete means every acceptance criterion is either passed or explicitly marked failed.
- Positive example: "Passed mobile 390px visual check; failed desktop screenshot due to server error."
- Negative example: "Looks good" with no criteria mentioned.
- Verification method: Compare final report against the original acceptance criteria.

### Checklist Item 2

- Rule: Code/UI tasks require at least one relevant verification command or visual check.
- Positive example: The agent runs the server and checks the edited page.
- Negative example: The agent edits CSS and reports done without opening the page.
- Verification method: Look for command, screenshot, browser check, or stated blocker.

### Checklist Item 3

- Rule: Report/research tasks require source status for all major factual claims.
- Positive example: Claims are labeled as sourced, inferred, or unverified.
- Negative example: The agent states current facts without dates or sources.
- Verification method: Scan for citations, dates, and uncertainty labels.

## 3. When To Stop And Ask The User

### Checklist Item 1

- Rule: Stop before destructive actions.
- Positive example: Ask before `rm`, Git reset, or overwriting a file with user changes.
- Negative example: Delete generated-looking files because they seem unused.
- Verification method: Check whether the action removes or irreversibly changes data.

### Checklist Item 2

- Rule: Stop when requirements conflict.
- Positive example: User asks to preserve layout and also remove the only layout container; agent asks which goal wins.
- Negative example: Agent silently chooses one requirement and ignores the other.
- Verification method: List requirements and identify contradictions.

### Checklist Item 3

- Rule: Stop before spending money, using paid APIs, or deploying externally.
- Positive example: Ask before running a paid LLM batch job.
- Negative example: Use production credentials for testing without confirmation.
- Verification method: Check whether action consumes credits, changes public state, or uses secrets.

## 4. When Repeated Retries Mean The Strategy Is Wrong

### Checklist Item 1

- Rule: Two failed retries on the same symptom means stop editing and change strategy.
- Positive example: After two failed CSS tweaks, inspect computed layout and DOM structure.
- Negative example: Keep changing random margins.
- Verification method: Count attempts tied to the same symptom.

### Checklist Item 2

- Rule: If fixes move the bug instead of removing it, gather more evidence.
- Positive example: A layout overlap moves from header to footer; agent captures viewport screenshots.
- Negative example: Agent declares progress because the original overlap disappeared.
- Verification method: Compare before/after against all acceptance criteria.

### Checklist Item 3

- Rule: If errors are not understood, reproduce before patching again.
- Positive example: Run the failing command and copy the exact stack location.
- Negative example: Edit likely files from intuition only.
- Verification method: Confirm a reproduction step exists.

## 5. How To Verify Quality

### Checklist Item 1

- Rule: Verification must match the task type.
- Positive example: UI work gets visual/browser checks; data work gets row counts and schema checks.
- Negative example: Run only a formatter after changing app behavior.
- Verification method: Match verification method to changed behavior.

### Checklist Item 2

- Rule: Check both the changed path and one likely regression path.
- Positive example: After editing `rain-room.html`, check `index.html` link navigation too.
- Negative example: Only inspect the isolated component.
- Verification method: Name the regression path in the report.

### Checklist Item 3

- Rule: Use independent validation for high-risk work.
- Positive example: Fresh-context review after a refactor touching shared state.
- Negative example: Author self-approves a broad refactor.
- Verification method: Confirm reviewer did not create the change.

## 6. How To Avoid Over-Editing

### Checklist Item 1

- Rule: Edit the smallest file set that satisfies acceptance criteria.
- Positive example: Change one CSS rule for a layout bug.
- Negative example: Rewrite all page styles while fixing one button.
- Verification method: List changed files and reason for each.

### Checklist Item 2

- Rule: Do not refactor while debugging unless the refactor is necessary to expose or fix the bug.
- Positive example: Add a guard clause in the failing function.
- Negative example: Rename modules during a bug fix.
- Verification method: Check whether each edit directly maps to the bug.

### Checklist Item 3

- Rule: Preserve existing naming and patterns unless they block the task.
- Positive example: Follow current `js/` module style.
- Negative example: Introduce a new framework for one page interaction.
- Verification method: Compare new code style to nearby code.

## 7. How To Avoid Breaking Existing Code

### Checklist Item 1

- Rule: Read callers before changing shared functions or state.
- Positive example: Search all uses of a state key before renaming it.
- Negative example: Change a function signature after checking only one caller.
- Verification method: Run `rg` for the symbol and inspect results.

### Checklist Item 2

- Rule: Do not alter public file paths for assets unless all references are updated.
- Positive example: Rename an image only after updating every HTML/CSS/JS reference.
- Negative example: Move `assets/images/...` and leave old paths in CSS.
- Verification method: Search for old and new paths.

### Checklist Item 3

- Rule: Treat `.env`, build config, and server proxy changes as high risk.
- Positive example: Ask before changing proxy behavior.
- Negative example: Modify API routing while fixing front-end layout.
- Verification method: Confirm changed files are within requested scope.

## 8. How To Review Research / Report Quality

### Checklist Item 1

- Rule: Every major claim needs source, date, and confidence.
- Positive example: "Sourced from annual report dated 2026-03-10; high confidence."
- Negative example: "The market is growing quickly" with no source.
- Verification method: Highlight unsourced claims.

### Checklist Item 2

- Rule: Separate evidence from recommendation.
- Positive example: Findings section lists data; recommendation section explains judgment.
- Negative example: Recommendation appears as if it were a fact.
- Verification method: Label each paragraph as evidence, inference, or recommendation.

### Checklist Item 3

- Rule: Check for missing counterevidence.
- Positive example: Include risks and opposing data points.
- Negative example: Only sources that support the thesis are cited.
- Verification method: Search for at least one limitation or contrary signal.

## 9. How To Review UI / UX Quality

### Checklist Item 1

- Rule: Check the actual target viewport sizes.
- Positive example: Inspect 390x844 mobile and 1440x900 desktop for this project unless another target is specified.
- Negative example: Judge only from a wide desktop browser.
- Verification method: Record viewport sizes checked.

### Checklist Item 2

- Rule: Text must not overlap, clip, or rely on hover-only access on mobile.
- Positive example: Buttons remain tappable and labels fit.
- Negative example: A tooltip contains required instructions on touch devices.
- Verification method: Inspect mobile screenshot or live page.

### Checklist Item 3

- Rule: UI changes must preserve the intended mood and interaction of the existing page.
- Positive example: A game-like page keeps its immersive visual style while fixing spacing.
- Negative example: Replace a playful interface with generic dashboard cards.
- Verification method: Compare changed page to nearby pages and existing assets.

## 10. How To Handle Uncertain Or Unverified Facts

### Checklist Item 1

- Rule: Label any unchecked fact as `UNCONFIRMED`.
- Positive example: `UNCONFIRMED - user must fill in current Claude model options.`
- Negative example: Invent model names or tool availability.
- Verification method: Search final docs for unsupported specifics.

### Checklist Item 2

- Rule: Browse or use current sources for facts likely to change.
- Positive example: Check current pricing before recommending a subscription tool.
- Negative example: Use memory for current API limits.
- Verification method: Confirm source date is current enough for the claim.

### Checklist Item 3

- Rule: Do not hide uncertainty behind confident prose.
- Positive example: "I infer this from file structure; not confirmed by docs."
- Negative example: "The app uses X architecture" without evidence.
- Verification method: Mark each inference explicitly.
