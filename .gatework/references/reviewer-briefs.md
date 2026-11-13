# Reviewer briefs

One brief per lens, plus the shared preamble and finding contract. `<angle brackets>` are fill-ins. `gw-review` hands each reviewer its brief by path.

**Every check here traces to a failure someone already paid for.** Before adding a check, name the failure behind it, and record it in `docs/gatework/traps.md`. A lens with no recorded failure ("TypeScript expert", "performance expert") produces generically true findings at volume, none of which bite, and each costs as much to verify as a real one.

## Finding contract, every reviewer except the noise sweep, verbatim

The noise sweep has its own report shape in its brief.

> Report findings only. For each: `file:line`, severity (blocker / correctness / convention / suggestion), the claim in one sentence, and the evidence you actually observed: a quoted line, a command with its real output, or a named rule it violates.
>
> **Name the code change that would make each finding go away.** If you cannot, the finding is not actionable; drop it or mark it a suggestion.
>
> Do not include a narrative of your search, the diff restated back, or a summary of what the change does.
>
> Finding nothing is a valid and complete report. Do not pad. Stay in your lens; another reviewer owns the one next to yours.

## Shared preamble, prepend to every brief

> Review the change in `<absolute repo path>`, taken against `<base ref>...<head ref>` at `<SHA>`.
>
> **The task:** `<id, title, the brief or acceptance criteria, scope in and out>`
>
> **What you have been given:** `<the diff slice for this lens>`. The slice is deliberate. Do not ask for the rest of the diff and do not explore the repo. You may read a specific file your slice touches when a finding turns on something the diff does not show.
>
> **Read the repo's agent files** (`AGENTS.md`, `CLAUDE.md`) whatever your lens. They are the authority on repo-local mechanics. Where they and this brief disagree on the same question, report the mismatch; do not pick a winner.

---

## Scope and intent

The highest-yield lens. Gets the whole diff, because mapping every hunk to the task is the job.

> 1. **Does the diff do more than the task asked?** Name every hunk not traceable to the brief or acceptance criteria. Extra changes are a blocker even when they are improvements: they widen review and are the most common reason a PR gets overruled. A hunk mapping to nothing is either scope growth or a missing criterion; say which.
> 2. **Does it do less?** Any part of the task left unaddressed without being declared out of scope.
> 3. **Is the reported behavior actually a bug?** It may be intended product design. If the change "fixes" something a reasonable product owner would call correct, that is a blocker.
> 4. **Is the PR body succinct?** Flag any section that restates the diff. A person reads it, and repeated paragraphs go unread.
>
> **Do not flag:** code quality, style, or performance; a test added purely as a negative control (the test-validity lens owns it and wins that conflict).

## Test validity

Gets the test files in the diff plus the source files they cover.

> **Your question: for every test in this diff, name the code change that would make it fail. If you cannot, it is not a test.**
>
> 1. **Does the test fail without the change?** Verify it: revert the source change, run the test, confirm red, restore. Run every step with `git -C <code root>`, and confirm the restore (`git status` clean, HEAD unchanged) before you report; a revert against the wrong tree is the one action in a review that can destroy work. Report the real output.
> 2. **An assertion after a timer asserts the change.** Asserting the prior state passes on the first synchronous check and can never fail.
> 3. **Every new guard has a negative control, and the control varies the threshold value, not only the feature switch.**
> 4. **A deletion needs a test that fails without the deleted code**, or a named scenario the deletion cannot break. Green after deleting code is a coverage hole.
> 5. **A race or absence test removes the real thing rather than stubbing it.** Fake clocks race the framework's scheduling; deleting the global is the real absence.
> 6. **Selectors use the repo's stable test ids where the target has one,** not element type, class, or text.
> 7. **Placement is asserted by containment** in the element that draws the boundary, not by DOM order.
> 8. **A presentational change's tests stay loose:** behavior plus at most one layout check that survives a design tweak. Exact pixel or token values are a finding.
> 9. **The test is in the layer and location the repo's agent files prescribe,** and covers the actual bug rather than an adjacent easier case.
>
> **Do not flag:** missing tests for paths the task did not touch, coverage percentages, naming style, or a thin test that is genuinely falsifiable.

## Silent failure

Gets the source files on or near the primary user paths. Never drop this lens; failures nobody sees are the expensive ones.

> **Your question: when this code fails in production, does it degrade visibly, and does anyone find out?**
>
> 1. **A tree that owns a primary user path has a failure boundary** (an error boundary, a fallback, a caught error with a visible state). A missing one on a primary path is blocking severity.
> 2. **The failure path emits its own telemetry, independent of the success path.** A throw that unmounts the tree that also fires the success event makes the failure structurally invisible.
> 3. **No synchronous throw gating a mount on something loaded asynchronously.** Required shape: bounded wait, timeout, non-fatal error path, inert UI until ready.
> 4. **Readiness checks target the method, not the namespace.** A partly loaded script satisfies a truthy namespace while the method is still missing.
> 5. **A dependency swap is audited for changed error behavior,** not only changed API. Silent degradation traded for an uncaught throw is the usual regression.
> 6. **A new server-side guard that rejects a request leaves a log line or metric when it fires,** so someone can count rejections after launch.
> 7. **State initialized from a value that can differ between server and client render** may never be patched by hydration. Start client state matching the server render, then update after mount.
>
> **Do not flag:** missing boundaries far from primary paths, general defensive-coding advice, or telemetry where the change makes no failure claim.

## Evidence versus narrative

Gets **no diff**: the PR body draft, commit subjects, the task doc's Evidence section, and the diff stat. It reviews claims, not code; handing it the diff invites it to review the code instead.

> **Your question: does every claim this change makes name its evidence, and is that evidence observed rather than inferred?**
>
> 1. **Each safety claim says whether it rests on reasoning or on a check.** Walking every branch and finding no failure is real work and is not evidence, least of all where the failure is a visual defect no test can see.
> 2. **Checks are named.** "CI passed" or "tests pass" with no check names and no output is a finding.
> 3. **A performance claim cites an observed value,** not a simulated or lab projection.
> 4. **A named reference implementation was verified to apply here,** not just converged on.
> 5. **Any audit or catalog the change relies on was re-checked against the current code,** not carried over from an older read.
> 6. **Screenshots exist and show the difference their captions claim.** A caption with no image is a blocker. A design-derived criterion is compared with the mock.
> 7. **What was not verified is listed.** A body with no unverified list on a change that had one is a finding.
>
> Apply to your own findings too: **a missing permission is not an absence.**
>
> **Do not flag:** hedged prose, or missing metrics where the change makes no metric claim.

## Traps and conventions

Gets the whole diff plus `docs/gatework/traps.md`.

> **Your question: does this diff trip a hazard this repo has already been burned by, or break a rule its agent files state?**
>
> 1. Read `docs/gatework/traps.md`. Pick only the entries the diff plausibly touches and check each against the specific lines. If the diff touches an area with no recorded trap, say so; "looked and found none" is different from "did not look".
> 2. Check the diff against rules the repo's agent files state. **Quote the rule you are applying.** A convention you assume but cannot quote is not a finding.
> 3. **Reuse:** does the diff reimplement something the repo already has? Grep before claiming it. Flag repetition only at three or more real instances, and never propose a new abstraction without naming its consumers.
>
> **Do not flag:** generic engineering advice, or style the repo's formatter or linter owns.

## Noise sweep · cheapest tier

Mechanical pattern matching over the whole diff. Every check has one obviously correct answer, which is why it runs cheap and why the orchestrator can check its output directly.

> Scan the diff for these patterns and report each occurrence with file, line, pattern, and the offending text. Make no judgment calls; if a case is ambiguous, report it and say so.
>
> 1. **Comments that restate the code,** where the repo's agent files discourage them. Do not report a comment marking a genuine hack or edge case, a TODO with a ticket, a license header, or a doc comment on a public API.
> 2. **AI-attribution text** in the diff or commit messages (`Co-authored-by` an AI, `Generated with`, `Made with`), unless the repo's rules ask for it.
> 3. **Debug leftovers:** stray logging, commented-out code, focused or skipped tests (`.only`, `.skip`, `fit`, `xit`).
>
> No severity, no recommendation, no summary.

---

## Second-harness pass · optional

Not a lens. It has no recorded failure behind it, and it gets no special standing. It earns a slot because a model from a different family, reading the repo's agent files in place, misses different things. Run it only when another harness's CLI is installed, launched alongside the lenses because it is the slowest.

```bash
codex exec -C <absolute repo path> -s read-only -o <scratch>/second-pass.md - < <scratch>/second-pass-brief.md
```

Use `codex exec`, not `codex review`: `codex review`'s scope flags (`--base`, `--uncommitted`, `--commit`) cannot be combined with a custom prompt, and an unbriefed reviewer is exactly what this file warns against. Read only the `-o` file, never the transcript.

> Review a change in this repository. Obtain the diff yourself: `git diff <base>...<head>`. That diff is your scope; code it does not touch is out of scope, however wrong it looks.
>
> **The task:** `<id, title, acceptance criteria>`
>
> Read `./AGENTS.md` first and treat it as the authority on repo-local mechanics.
>
> Two questions, in order:
> 1. **Does the diff violate anything the agent files actually state?** Quote the line.
> 2. **Is there a defect in the changed lines?** Wrong logic, a broken caller and callee contract, an unhandled case the diff introduces.
>
> **Do not flag:** pre-existing code, style the formatter owns, missing tests in the abstract, a negative-control test, suggestions or refactors with no defect, or anything you would soften with "might" or "could". A finding you cannot anchor to a line in the diff or in the agent files is not a finding.
>
> `<finding contract>`
>
> Last line of your output, exactly: `AGENTS_MD_READ=yes` or `AGENTS_MD_READ=no`.

A `no` on that last line means the pass ran without reading the rules: report it as a skip, not a clean result. A failed or unavailable pass is a stated skip, never a blocker.
