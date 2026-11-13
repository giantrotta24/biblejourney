---
name: gw-review
description: Review a diff, branch, or PR through briefed lenses, adversarially verify every finding, apply only the mechanically unambiguous ones, and escalate the rest. Use after gw-verify under gw-build, or alone on any PR in this repo, including someone else's.
---

# gw-review

Verify a change against lenses this repo has already paid for. Apply only what is mechanically unambiguous; everything else goes back to the person. Read `.gatework/references/contracts.md` first.

## Entry modes

- **Gate mode,** under gw-build, after verification and before the PR exists. Findings are cheapest here: nothing has reached anyone else yet.
- **Standalone,** on an open PR or branch. Applying a finding means new commits on an open PR, so the staleness rule matters more. **On someone else's PR, apply nothing.** Report, and let the author decide.

## Scope the diff per lens

Six reviewers each handed the full diff is six copies of the diff. Pin the base and head refs, take `git diff <base>...<head>` (three dots, from the merge base; two dots shows everything that landed on the base since as a reversal), and give each lens only what it needs:

| Lens | Gets | Tier |
|---|---|---|
| Scope and intent | The whole diff, the brief, scope in and out | mid |
| Test validity | Test files plus the source they cover | mid |
| Silent failure | Source on or near the primary user paths | mid |
| Evidence versus narrative | **No diff:** PR body draft, commit subjects, the task doc's Evidence, the diff stat | mid |
| Traps and conventions | The whole diff plus `docs/gatework/traps.md` | mid |
| Noise sweep | The whole diff | cheapest |

Briefs: `.gatework/references/reviewer-briefs.md`, handed over by path. When sourcing the stated scope from the task doc, read its whole log per contracts → *The ruled-out block*.

**Skips are stated, with the reason** ("no test files changed and none were required"). Silent skips are how coverage rots. If a lens must be dropped, drop the noise sweep first and never silent failure or test validity.

If another harness's CLI is installed, launch the second-harness pass from the same file alongside the lenses.

When `docs/gatework/traps.md` grows past about 40 KB, give it an index: one table row per hazard with a grep anchor into the file, so the traps lens reads the index and greps only the hazards in play. Anchors, not line numbers, because the file is appended to constantly.

## Verify every finding

Dedupe first: the same issue from three lenses is one finding with three witnesses. On a conflict between test validity and scope (a test added purely as a negative control), test validity wins. A second-harness finding that matches a lens finding is a witness and keeps the lens's severity; agreement between models does not raise severity or make anything auto-appliable.

Then challenge each survivor: try to refute it, and default to refuted if uncertain. One challenge per finding; three independent challenges only for findings that would auto-apply, since those are the ones where being wrong costs something.

**Attack the conclusion, not the most checkable premise.** A finding usually has a premise that is cheap to confirm and a conclusion that is not. Checking the cheap half feels like verification and proves nothing. State the conclusion as a falsifiable prediction and name the observation that would disprove it. If that observation was never made, the finding is unconfirmed however solid its premises.

A finding that survives with no concrete evidence is downgraded to a suggestion or dropped.

## Adjudicate

**Auto-apply only when all five hold:**

1. Exactly one obviously correct edit.
2. It does not change rendered behavior or request output, so the verify evidence stays valid.
3. It is not a scope or product-intent question.
4. It stays local and reversible: no rebase, amend, force-push, or other rewrite of pushed history, and no change to the PR or the tracker.
5. It is the requester's own branch.

**Auto-appliable checks are a closed set:** deleting a comment that restates the code where the repo's rules discourage such comments; switching a new test's selector to a stable test id the target already carries. Everything else escalates, including findings whose detection is mechanical but whose fix needs the author's intent. A readiness check narrowed from a namespace to a method escalates too: it changes when code runs, so it can leave the verify evidence stale. Nothing from the second-harness pass auto-applies on its own authority.

| Severity | Example | Default |
|---|---|---|
| Blocker | Test passes without the change, scope beyond the task, missing failure boundary on a primary path, caption with no screenshot, edit to a collision-list file | Surface; auto-apply only the closed set |
| Correctness | A real defect | Escalate unless it is in the closed set |
| Convention | A stated rule broken, no behavior change | Auto-apply only the closed set |
| Suggestion | No defect | Report only |

Present escalations as a ranked list, each with the evidence and a recommendation. Do not bundle unrelated decisions into one yes or no.

## Re-verify what was applied

Any applied change re-runs the repo's checks unfiltered, with real output, naming each check. If an applied change touched rendered behavior despite the guard, the evidence is stale: in gate mode, re-run gw-verify; standalone, say so and do not call the review done.

## Report

Confirmed findings by severity, what was applied, what was escalated, which lenses were skipped and why, the pinned refs, and the re-verification output. If the second-harness pass ran, its `AGENTS_MD_READ` answer, how many of its findings survived, and how many no lens had found. That last number is the only evidence the pass earns its slot.

Under gw-build, log it: `gatework task note <id> log "review: <n> confirmed, <m> applied, <k> escalated"`. **A clean pass is information;** say that review found nothing rather than padding. Gate mode hands back to gw-build. Do not open the PR yourself, and never merge.

## Blockers

If the diff cannot be obtained, the branch does not exist, or the base cannot be fetched, that is a blocker, not something to approximate. A failed second-harness pass is not a blocker; state the skip and carry on.
