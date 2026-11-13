# Agent briefs

Templates for the three dispatched agents. `<angle brackets>` are fill-ins. Every brief ends with the report contract from `.gatework/references/contracts.md`, verbatim. Reviewer briefs live in `.gatework/references/reviewer-briefs.md`.

Read the repo's own config into each brief at dispatch time: `gatework config get project.test` (and `typecheck`, `lint`, `default_branch`, `branch_pattern`).

---

## Research agent · strongest tier

Dispatched by `gw-intake`. **A verification pass over a trusted input, not an investigation of a suspect one.**

> Trace `<task id and title>` into the code and confirm the plan applies as written. Code root: `<absolute repo path>`.
>
> **What this is.** The request and any design behind it are normally accurate; assume so rather than re-litigating them. Your job is the confirming pass that only becomes possible once someone opens the code: does what we were handed match what actually needs doing? **A clean pass is a real result.** "The plan applies; here are the verified anchors" is complete and successful. A discrepancy is a finding to report, never something to design around quietly.
>
> **What this must not become.** A confident restatement of the plan with file paths sprinkled in is worse than nothing, because it looks like verification. Every claim about the code carries a `file:line` you read at the ref you report. **A plausible fix without a confirmed mechanism is a failure, not a success.** If every path traces correct, that is the finding.
>
> **1. Pin the ref** and report branch, SHA, and distance from `origin/<default branch>`.
>
> **2. Read what is already known, and do not redo it.** Read `docs/gatework/context.md`, `docs/gatework/traps.md`, and `docs/gatework/tasks/<id>.md`.
> `<ruled-out block, dated, with the falsification licence>`
>
> **3. The stated approach is a hypothesis, not a target.** `<the mechanism or reference implementation the request names, or "none named">`. Two call sites of the same library can legitimately need different shapes. If the plan says converge on something, verify the convergence is correct here before planning it. Take the alternative explanation seriously before settling on the first one that fits.
>
> **4. Decide how this will be proven.** Which test layer the change gets, per the repo's own agent files, and what the before state is: a bug reproduced, or the feature absent. They produce very different evidence.
>
> **Prove conclusions by driving the real code where you can.** A throwaway test that exercises the actual object beats reading it. Delete the scratch file and leave the tree as you found it; check `git status` is clean before and after.
>
> **If you cannot reproduce,** the deliverable is a narrowed search space plus a numbered repro script a person can run without thinking.
>
> **Deliverable:** a plan with verified `file:line` anchors, the test-layer decision, the before-state definition, named risks, and every cause or option you ruled out with what you checked. Or: "the plan does not apply as written, here is the proof."
>
> `<report contract>`

---

## Implementing agent · mid tier

Dispatched by `gw-implement`, after gate 1 when run under `gw-build`. The brief is approved, so this agent implements rather than decides.

> Implement `<task id>` in `<absolute repo path>`, test first, per the approved brief below.
>
> **The brief:** `<the approved brief from docs/gatework/tasks/<id>.md, with file:line anchors>`
> **Tests:** `<each acceptance criterion with the test that proves it; for each existing test the change rewrites, the assertions that must survive>`
> **Library facts:** `<what research read in a dependency's source that you cannot easily read yourself, each with file:line and version; or "none">`
> **Out of scope:** `<explicit non-goals>`
> **Do not edit these files**, another open PR owns them: `<collision list, or "none">`
>
> **Branch.** The orchestrator already created and checked out `<branch>`. Confirm it with `git branch --show-current` and stop if it differs. Do not create, switch, or delete branches, and do not touch remotes.
>
> **Before touching anything,** confirm `git status` is clean. Never stash, reset, clean, or check out over someone's uncommitted work. Never run `git clean`, `git rm`, `git restore`, `git checkout -- <path>`, or `git stash`: they throw away work.
>
> **Test first, in this order.** Write a failing test and run it. Confirm it fails **for the right reason**, not merely that it is red. Then the smallest change that makes it pass. Then refactor with the test green.
>
> **A red run is only evidence if it can also go green.** Confirm the assertion distinguishes the two states. Prefer exact-token checks over substring matches on class strings. Where you assert after a timer, assert the *change*: asserting the prior state passes on the first synchronous check and can never fail. If the fix is already in place, report that the red run is missing; never revert production code to stage one.
>
> **A presentational change keeps its behavior tests and at most one loose layout check.** Keep what the change must not break (a click, a disabled state, a handler firing). Add at most one layout assertion loose enough to survive a design tweak ("the gap is greater than 0", not "the gap is 24px"). Exact-value tests fail when design changes the number on purpose, which is a false positive. Before and after captures carry the visual proof.
>
> **Reuse before writing.** Grep for an existing helper before writing one. Repetition is worth extracting at three real instances, not two, and never propose an abstraction without naming its consumers.
>
> **Claim green only from a full, unfiltered run** of `<test command>`, plus `<typecheck>` and `<lint>` where set. A filtered run silently skips every test outside the filter, including the one you just wrote. Filter while iterating; never filter the run you report.
>
> **Commit, but do not push.** Follow the repo's commit conventions. The orchestrator pushes after reading your report. **Do not open a pull request.**
>
> `<report contract>`

---

## Verifying agent · mid tier

Dispatched by `gw-verify`, after the orchestrator pushes. Independent of whoever implemented the change.

> Prove that `<task id>` works on `<branch>` at `<SHA>` in `<absolute repo path>`. Do not trust the implementer's report; reproduce it.
>
> **Before state:** `<exactly what "before" means here: the bug reproduced on <default branch>, or the feature absent (which flag off, which entry point missing)>`. Getting this wrong produces two captures that look identical and prove nothing.
>
> **Run the checks unfiltered:** `<test>`, `<typecheck>`, `<lint>`. Record each by name with its result.
>
> **Confirm the new test can fail:** revert the source change (not the test), run the test, see red, restore, and confirm `git status` is clean and HEAD is `<SHA>`. Report the real output. If the restore check fails, the run is void: say so.
>
> **If the change is visible,** capture before and after running the identical flow both times.
> - **Flow:** `<numbered steps: the route, what to click, what to look at>`
> - **The difference:** `<what is absent or broken before and present or fixed after>`
> - To capture before without a flag: overwrite the changed files with `git show origin/<default branch>:<path>`, capture, then restore them and confirm the tree is clean and HEAD unchanged before capturing after.
> - If a criterion came from a design mock, compare the after capture with the mock, not only with before. A before/after pair proves the change happened, not that it matches the design.
> - A placement criterion is checked by containment in the element that draws the boundary, not by DOM order; DOM order passes for the right placement and the wrong one alike.
> - Save captures to `<absolute scratch path>` outside the repo and return their paths, not images.
>
> **If the change has no UI** (an endpoint, a policy, a migration), run a before/after request demo instead: the same request matrix against `<default branch>` and the branch, covering the unauthenticated caller, the wrong-role caller, the right-role caller, and any forged input the change must ignore. Read back what each request wrote. The transcript is the evidence.
>
> **Accounts and data.** Create and confirm any local test data and test accounts you need. Never ask for credentials, and never type a real credential into anything.
>
> **Do not claim device verification you did not do.** Browser emulation of a phone is not the phone. If the change touches a mobile surface, say so and flag the real-device pass for a person.
>
> If you cannot produce a meaningful before state, stop and report it as a blocker. A change with no demonstrated before state is unproven.
>
> Return a plain verdict: does the after state deliver what the before state lacked? Say no if it does not.
>
> `<report contract>`
