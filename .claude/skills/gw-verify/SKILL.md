---
name: gw-verify
description: Prove a change works, independently of whoever implemented it, with checks named and before and after evidence. Use after gw-implement, or when the user asks to verify, test, or demo a branch.
---

# gw-verify

An implementer grading its own work is how a green suite ends up proving nothing. This step reproduces the claim from the outside. Read `.gatework/references/contracts.md` first.

## Decide what "before" means

Before dispatching, write down the before state exactly. It is one of two things, and confusing them produces two identical captures that prove nothing:

- **A bug reproduced** on `origin/<default branch>`: before is broken, after is fixed.
- **A feature absent:** before is the world without the feature, meaning the flag off or the entry point missing.

## Dispatch

Fill `.gatework/references/agent-briefs.md` → *Verifying agent* with the branch, the SHA that was pushed, the before state, the flow, and the visible difference. The template carries the proof rules: unfiltered named checks, revert-run-restore, identical-flow captures or a request matrix, mock comparison, device claims, and credentials.

If the change touches a mobile surface, flag the real-device pass for a person in the hand-off; the agent cannot do it.

## After the report

- **No meaningful before state is a blocker.** Stop and report; do not continue to review.
- Write the evidence: `gatework task note <id> evidence -` with check names, results, capture paths, and the unverified list on stdin. Captures stay on disk; only the final pair goes into the PR.
- If anything changes the code after this step, this evidence is stale and the step runs again.
