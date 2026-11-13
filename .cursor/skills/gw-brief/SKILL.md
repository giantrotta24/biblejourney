---
name: gw-brief
description: Write the implementation brief a person approves before any code is written (gate 1 under gw-build). Use after gw-intake, or when the user asks for a brief, plan, or task prompt for a change in this repo.
---

# gw-brief

The brief is the artifact people most reliably skip writing and skip reading, which is exactly why it is a gate. Read `.gatework/references/contracts.md` → *Every brief carries* first.

## Size

Propose a size. The person confirms it when they approve the brief, so a change cannot quietly classify itself as small.

**Small,** four lines:

- **What:** the change.
- **Why:** the impact.
- **Done when:** the observable result.
- **Fails first:** the test that should go red before the change, and why it fails.

**Full:**

- Intent, in the requester's terms.
- The plan, with every file at a `file:line` anchor at the pinned ref.
- Tests: each acceptance criterion with the test that proves it; for each existing test the change rewrites, the assertions that must survive. A presentational change stays inside the loose-layout rule in `.gatework/references/agent-briefs.md`; do not turn every criterion into an exact assertion.
- Library facts research read that the implementer cannot easily read itself.
- The ruled-out block, dated, with the falsification licence.
- Out of scope, and the do-not-edit collision list.
- Acceptance in the repo's own commands: `gatework config get project.test`, `typecheck`, and `lint`, each only where set. If `test` is empty, say how the change will be tested instead.
- The before-state definition for verification.
- The report contract.

Keep it model-agnostic, and do not restate what the repo's agent files already say; point at them.

## Steps

1. Draft the brief.
2. **Resolve every file path in it against the pinned ref, and report the count:** "13 of 13 resolve". A brief with a wrong path sends an agent to build in the wrong place.
3. Show it. Under gw-build this is gate 1: wait for an explicit yes, and revise until approved.
4. Write only the approved brief to the task, so the doc never holds a superseded draft: `gatework task note <id> brief -` with the brief on stdin.
5. Record the size and the approval: `gatework task size <id> <small|full>` and `gatework task note <id> log "brief approved (<small|full>)"`.
