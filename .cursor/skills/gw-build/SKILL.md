---
name: gw-build
description: Run a change through the gatework pipeline from request to an open PR, with two human gates. Use when the user names a task, issue, or change in this repo and is ready to build it. Chains gw-intake, gw-brief, gw-implement, gw-verify, and gw-review, then writes the hand-off. Never merges.
---

# gw-build

Intake → brief **approved** → implement → verify → review → PR body **approved** → PR open.

**Done means a PR is open with its body approved and, when `gatework config get tracker.done_state` is set, the task sits at that state: the furthest the pipeline may move it. Nothing further.** Never merge. Never move the task past that state, even when the work looks finished and even when the user says it looks good.

Read `.gatework/references/contracts.md` before the first step. It holds the brief and report contracts, the ruled-out block, ref pinning, shared-surface writes, and the blocker rule every step below assumes.

## Two gates, and only this skill holds them

| Gate | After | What it holds |
|---|---|---|
| **Gate 1** | gw-brief | The brief, before any code exists. Approving it also approves its size |
| **Gate 2** | gw-review | The PR body, every escalated review finding, and the tracker move, before anything posts |

The step skills can run alone, and alone they stop at nothing. This skill is the only place a run waits for a person. Between the gates, run without interrupting: no permission stops for ordinary edits, tests, commits, or branch pushes. A write to a shared surface is never ordinary: each one rides on a yes the user already gives (scope confirmation, gate 1, gate 2) and is shown in it.

**Feed independent tasks rather than dependency chains.** Several tasks can run side by side, one branch and one working tree each. A chain only moves as fast as the person merging it.

## The steps

Write each step's result to the task doc before starting the next; the doc is the state, not this conversation.

1. **gw-intake.** It ends either with confirmed scope or with proof the plan does not apply. The second is a successful run: stop and report.
2. **Claim,** only after the user confirms scope, so a task intake kills is never left claimed. When `gatework config get tracker.claim` is set, show the claim in that same scope confirmation, so one yes covers both; skip it when empty or when `tracker.kind` is `none`. Before any tracker write, use the skill `gatework config get tracker.write_skill` names, if any.
3. **gw-brief · Gate 1.** Do not start step 4 on an unapproved brief.
4. **Branch.** You own the branch and the remote; the implementing agent only commits. Create `gatework config get project.branch_pattern` (with `{id}` filled) off a freshly fetched `origin/<default branch>`.
5. **gw-implement.** Then, before pushing: check the diff stat against the brief, check the commits follow the repo's rules, then push the branch. Pushing after reading the report makes those checks a real gate instead of a self-report. Do not open a PR.
6. **gw-verify.** If it cannot produce a meaningful before state, that is a blocker.
7. **gw-review.** If review applies a change that touches rendered behavior or request output, the verify evidence is stale: re-run gw-verify. Do not continue with unresolved escalations.
8. **Hand-off · Gate 2.** Below.

## Hand-off

1. **Draft the PR body.** Follow `gatework config get pr.template` when set (follow the repo's template rather than inventing a shape); otherwise: Why (impact, not a restatement of the title), What (mechanism level, no file-by-file walk), Evidence (captures or the request transcript), Not verified. Keep it short; a person reads it.
2. **Name the checks.** Report each required check by name (`gatework config get pr.required_checks`), never "CI passed". If that list is empty, find out which checks gate a merge and say how you found out. A 404 on a protection endpoint you lack rights to is not proof there is none. Some checks only run once a PR is open; name those as pending, not passed.
3. **A stacked PR targets its parent branch,** not the default branch, and the body lists the merge order.
4. **Screenshots are uploaded, never committed.** On GitHub, upload each to `uploads.github.com/user-attachments/assets` and reference the returned URL. A local path renders as a broken image.
5. **Mark what only a person can do.** For each item in `gatework config get pr.human_artifacts` (a recorded demo, a regression run, an approving review), put a line in the body naming it as pending, such as `Demo: pending`. Never invent a link or claim the checklist is complete.
6. **Show the full body, the escalated findings, and the tracker move to the done state together, and wait for an explicit yes.** Then open the PR and, if a done state is set, move the task there.
7. **Hand back** the pending human items with the PR link.
8. **Close the task and teach the brain.** `gatework task close <id> --summary "<one line: what shipped, the PR>"`. Propose the traps this run taught; add the ones the user approves with `gatework trap add "<lesson>" --failure "<what went wrong>" --anchor "<file:line, PR, or output>"`. In committed mode (`gatework config get mode`), commit the brain changes to the same branch and push, so they are reviewed in the same PR. In local mode the brain stays out of git.

Then stop. Do not merge. Do not ask whether to merge.

**Write the closing entry the day the task closes.** A week later the reasoning is gone and only a link remains.

## Parallel work

- Run in one round trip what shares no state: at intake, the tracker fetch, the open-PR collision check, and the brain read.
- Review lenses run in parallel, each with only its diff slice.

## Resuming

Re-invoking mid-run is normal. Read `docs/gatework/tasks/<id>.md` and take the **last** log entry as the current step. Confirm the task's live tracker state rather than trusting the doc; the doc records what was decided, not what is true now. Re-run the collision check, since other branches move. Never restart research the doc already records as done.

## Blockers

`.gatework/references/contracts.md` → *Blockers*.
