---
name: gw-implement
description: Implement an approved brief test-first, through a dispatched agent or directly. Use after gate 1 under gw-build, or when the user hands over a brief and asks for the code.
---

# gw-implement

Read the brief in `docs/gatework/tasks/<id>.md`. Read `.gatework/references/contracts.md` → *Dispatching a coding agent*.

## Before dispatching

- **The branch exists and is checked out.** Under gw-build the orchestrator created it.
- **The tree is clean.** Never stash or branch over someone's uncommitted work.
- **A headless run can write here.** Contracts → *Dispatching a coding agent* says what a missing allow list looks like. If it is missing, stop and say so.

## Dispatch

Fill `.gatework/references/agent-briefs.md` → *Implementing agent* from the brief and dispatch it. With no subagent or headless CLI available, do the work yourself under that template's rules: they are the same whoever writes the code.

## After the report

- **Read the unverified list first.**
- Check the diff stat against the brief. Anything outside scope goes back, not forward.
- Log it: `gatework task note <id> evidence -` with the report's commands and output on stdin, and `gatework task note <id> log "implemented at <sha>"`.
