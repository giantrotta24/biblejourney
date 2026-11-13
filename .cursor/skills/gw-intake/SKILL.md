---
name: gw-intake
description: Establish what a change is, why it matters, and whether the plan holds, before any brief or code. Use at the start of any task, or alone to scout an issue or investigate a bug with no intent to ship. Gathers silently, asks only what is left, then researches the code and is allowed to conclude the plan is wrong.
---

# gw-intake

Gather silently first, then ask only what is left. Then research. Read `.gatework/references/contracts.md` first.

Run alone, this skill is a scout: it ends at findings and a ruled-out list, and touches no code.

## Gather, do not ask

- **The task** from the tracker (`gatework config get tracker.kind`): title, body, acceptance criteria, comments, current state and holder. When the kind is `none`, take the task from the request itself and skip every tracker step, including the next one. A long comment thread goes to a subagent for a summary. Note whether the body is empty; often the title is the whole spec.
- **Is it free to take?** If the tracker shows it held by someone else, stop and report before reading anything more.
- **The brain:** `docs/gatework/context.md`, `docs/gatework/traps.md`, and any `docs/gatework/tasks/<id>.md` already open. A task doc that exists turns this from a new task into a resume.
- **Prior art:** grep the brain and recent history for the task id and its key terms. An earlier investigation may have ruled things out, or produced a confident wrong answer.
- **Collisions:** open PRs touching the same files (`gh pr list --state open --json number,title,headRefName,files`). Overlapping files become a do-not-edit list in the brief.
- **Agent files** in scope: `AGENTS.md`, `CLAUDE.md`, nested agent files. Record what exists and what does not. When a search finds nothing, record that; "none found" is an answer, and the next step should not pay for it twice.
- **The pinned ref** for the code in scope.

## Ask only what is left

1. **Why,** meaning user-visible impact and why now. Skip it when the task already carries a real answer; push for one when it only restates the title.
2. **Scope:** what is in, and what is explicitly out. Out of scope is the more valuable half. Name roughly 15% as discovered-scope buffer now, so an overrun is visible instead of absorbed.
3. **Is the cause known, or is the stated approach load-bearing?** If the task names a mechanism or a reference implementation, research must verify it applies here. Treat it as a hypothesis, never a target.
4. **One task or several?** Prefer independent tasks over a chain.
5. **What will count as proof?** A bug reproduced or a feature absent before; one session or several signed-in users; screenshots or a request transcript.

Then open the task doc: `gatework task open <id> --title "<title>"`. Use the tracker key as the id when there is one. Record the answers, the collision list, the agent-file inventory, and the pinned ref with `gatework task note <id> log "<...>"`. Report the collision check and the inventory before going on.

## Research

Skip only when the change is mechanical and names its own change site.

Dispatch one agent per `.gatework/references/agent-briefs.md` → *Research agent*, with the ruled-out block seeded per contracts → *The ruled-out block*. One agent holds it end to end: splitting a trace across modules produces two half-traces that do not join, and the join is the finding.

- Record every eliminated cause or option as it falls: `gatework task note <id> ruled-out "<what was checked, what it showed, why that rules it out>"`. A conclusion with no record of what was cleared reads later as an untested guess.
- **When research says the plan does not apply, or that no fix is warranted,** write the proof into the task doc, log it, report, and stop. That is a successful run. Do not manufacture an implementation to have something to ship.

Output: the research agent's deliverable, as its brief defines it.
