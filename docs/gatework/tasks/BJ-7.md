---
id: BJ-7
title: Remove the Vercel deploy workflow now that Vercel deploys from Git
size: small
status: closed
opened: 2026-11-13
closed: 2026-11-13
---

# BJ-7: Remove the Vercel deploy workflow now that Vercel deploys from Git

## Brief

<!-- Gate 1. Small: what, why, done-when, and the test that should fail first. Full: see gw-brief. -->
Intent: Vercel's GitHub integration now builds every pull request and deploys main, so the repo's own deploy workflow is redundant. Delete .github/workflows/deploy.yml and update the README: the Deploy to Vercel section describes only the connected-repository path, the GitHub table drops VERCEL_TOKEN, VERCEL_ORG_ID and VERCEL_PROJECT_ID, and the first-deploy checklist's deploy item says to check Vercel's own preview and production deploys. Out of scope: ci.yml, reminders.yml, any app code. Acceptance: no remaining reference to deploy.yml or the three Vercel secrets anywhere in the repo outside docs/gatework task history; lint, typecheck, test and build pass.

## Ruled out

<!-- Dated. Each entry: what was checked, what it showed, and why that rules the candidate out. -->

## Evidence

<!-- Command output, captures, check names, and what was not verified. -->
Codex implemented this task (first under the alternating dev rule). rg for deploy.yml, VERCEL_TOKEN, VERCEL_ORG_ID, VERCEL_PROJECT_ID outside docs/gatework: no matches. Local lint, typecheck, test and build were not run in this worktree (no node_modules); CI runs them on the PR.

## Log

- 2026-11-13: opened
- 2026-11-13: closed. Deploy workflow removed in PR 11
