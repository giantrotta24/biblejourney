---
id: BJ-9
title: Redesign: simple and clean, sage
size: full
status: open
opened: 2026-11-13
---

# BJ-9: Redesign: simple and clean, sage

## Brief

<!-- Gate 1. Small: what, why, done-when, and the test that should fail first. Full: see gw-brief. -->
Intent: the owner said the first version "basically looks like a Claude artifact". He rejected concept-led directions as too busy and chose a simple, clean look in the company of Bear and Day One, in the sage colourway. Restyle every screen to that look without changing what the app does.

Design contract (the approved mock is docs/reference/design/today-mock.html with data-palette="c"; a capture is docs/reference/design/today-mock-sage.png; product truth is PRODUCT.md):
- No cards, boxes, outlined containers, pills, segmented toggles, badges or chips anywhere. Structure comes from whitespace, type size and weight, and a few hairline dividers.
- One accent colour, used sparingly: the primary action, the current day, the read part of the year line, links, the current navigation item. No per-phase colours anywhere (strip, plan, timeline, verses).
- Light palette: ground #f4f6f1, ink #1f2a24, secondary text #646e67, hairline #dfe4dc, accent #2f6b4f, track #a7b0a8. Dark palette (derive and verify AA): ground #141a16, ink #e6ebe6, secondary #a3ada6, hairline #2a332d, accent #7fc3a0, track #4a554d, with dark ink text on the accent.
- Type: Literata for titles, headings, readings and verses; the system sans stack for navigation, metadata, buttons and small labels. Marcellus and the digit-swapping helper go away.
- Buttons: plain rectangles with about 6px radius, solid accent for the one primary action per view, text links (with an arrow where they leave the page) for everything secondary. At least 44px tall.
- Navigation: five plain text items in one row, the current one marked by weight and a short accent underline; Account and Settings as quiet icons at the top right.
- The year: one thin line of 52 small marks, read weeks in the accent, the current week distinguishable by shape as well as colour, with one quiet line of text beneath. It keeps its keyboard behaviour, links to the plan and accessible names.
- Lists: plain rows with hairline dividers; read days show a check and lighter ink, today is marked by weight and the accent, no strikethrough.
- Every other screen (Plan, Timeline, Verses, Who's who, Account, Settings, the Sunday view, the finished state, the study assistant, the reset dialog, all not-set-up and error states) follows the same rules.

Out of scope: behaviour, copy, data, sync, the assistant's logic, reminders, the service worker, migrations, dependencies other than removing ones the redesign makes unused.

Acceptance: lint, typecheck, unit tests, build and the Playwright suite pass with no environment variables; the axe scan stays at zero serious or critical violations in both themes; no horizontal scroll at 360px; tests that asserted the old visuals are updated to assert the new ones, not deleted.

## Ruled out

<!-- Dated. Each entry: what was checked, what it showed, and why that rules the candidate out. -->

## Evidence

<!-- Command output, captures, check names, and what was not verified. -->
Codex restyled 32 files to the sage contract. Run by the orchestrator from a clean .next with no environment variables: typecheck and lint exit 0; vitest 24 files, 236 tests; build ok; Playwright 71 passed including the axe scan in both themes. Two e2e assertions were corrected by the orchestrator: the timeline last-stop pattern now allows the decorative arrow in the link text, and the reduced-motion transition check uses a button that exists on the Sunday view. Phone-size captures of Today, Plan, Verses, Timeline, Who's who, Settings and Account in light, and Today, Plan and Settings in dark, were checked by eye for Today and Plan only.

## Log

- 2026-11-13: opened
