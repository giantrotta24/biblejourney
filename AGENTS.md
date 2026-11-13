<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

<!-- gatework:start -->
## How work happens in this repo (gatework)

Project context lives in `docs/gatework/`. Read `context.md` and `traps.md` before changing code.

- Changes run through the `gw-build` skill: intake, brief, implement, verify, review, hand-off. Two human gates: a person approves the brief before code is written, and approves the PR body before it posts. Small fixes keep both gates; their brief is four lines.
- Research may conclude the plan is wrong. Say so, with the proof.
- A test counts only after you have watched it fail for the reason the change addresses.
- Claim green only from a full, unfiltered run. Name the checks that passed; never write "CI passed".
- Attach evidence instead of narrating it: command output, before and after captures, and a list of what was not verified.
- Pin the ref you read. Every claim about code carries a `file:line` at that ref.
- A missing permission or an empty search result is not proof that something is absent.
- Write to the brain only through the `gatework` CLI (`gatework log`, `gatework task`, `gatework trap add`), so every update lands in the PR and is reviewed there.
<!-- gatework:end -->
