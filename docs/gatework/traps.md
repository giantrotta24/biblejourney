# Traps

Lessons with the failure attached. Review reads this file and intake skims it. Each entry says what to do, what went wrong when it was not done, and an anchor (a `file:line`, a PR, or command output) a reader can check. Add entries with `gatework trap add`; entries run newest last.

## 2026-11-13: Run typecheck and e2e from a clean checkout before claiming green

- Failure: tsc passed locally only because .next held generated route types, and a nav overflow showed only with Linux font metrics
- Anchor: PR 5, CI run 43373866777
