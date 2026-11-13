---
id: BJ-8
title: Ignore major TypeScript and @types/node bumps in Dependabot
size: small
status: closed
opened: 2026-11-13
closed: 2026-11-13
---

# BJ-8: Ignore major TypeScript and @types/node bumps in Dependabot

## Brief

<!-- Gate 1. Small: what, why, done-when, and the test that should fail first. Full: see gw-brief. -->
Intent: stop Dependabot reopening two major bumps the project cannot take: @types/node must track the Node version the app runs on (24 in CI), and typescript-eslint 8 supports TypeScript below 6.1. Change: two ignore rules in .github/dependabot.yml for semver-major updates of those packages. Out of scope: any dependency change. Acceptance: the YAML parses and the rules sit under the npm ecosystem entry.

## Ruled out

<!-- Dated. Each entry: what was checked, what it showed, and why that rules the candidate out. -->

## Evidence

<!-- Command output, captures, check names, and what was not verified. -->
ruby YAML.load_file parses the file and shows both ignore rules under the npm entry.

## Log

- 2026-11-13: opened
- 2026-11-13: closed. Dependabot ignore rules shipped in PR 13
