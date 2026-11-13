# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

One primary reader: an adult newcomer to the Bible who wants to understand it and talk about it with others. She reads about 20 minutes a day from a paper Bible, with the phone beside it as the guide and tracker. The app has to answer "what am I reading today, and what's the context?" in one glance, then get out of the way while she reads. The owner built it for his wife; other people may sign up later.

## Product Purpose

Bible Journey takes one reader through the whole Bible in a year, in the order events happened: 52 weeks, 312 reading days, 1,189 chapters. Alongside the reading it builds real understanding of the history, geography and people, and helps her memorize 52 verses. Success is the reader finishing the plan and understanding what she read.

## Positioning

The plan is chronological and the current day is always the first unread day, never a calendar date. Missing days is never treated as failure: there are no streaks and no scores, only "pick up where you left off".

## Operating Context

- A phone lying next to an open paper Bible, checked before and after reading. Installed to the home screen; works offline.
- The daily loop: see today's reading and its context, read (in her own Bible, or through a link to Bible Gateway), optionally ask the study assistant about history, places or people, mark the day read, spend a minute or two on the week's memory verse.
- Each week ends with a Sunday deep dive, a catch-up list and a verse review instead of a reading.

## Capabilities and Constraints

- Screens: Today, Plan (all 52 weeks), Timeline (11 eras), Verses, Who's who (peoples and prophets), Account, Settings.
- A full-year progress overview of 52 weeks in four phases.
- Plan content is fixed and ships with the app (`content/bible-journey-seed.json`). Only KJV text from that file is shown; no text from copyrighted translations is embedded.
- The app works with no account. Sync across devices, the study assistant and daily reminders are optional and switch on when configured.
- Terms: reading day, week, phase, deep dive, memory verse, era.

## Brand Commitments

- Name: One-Year Bible Journey.
- Voice: encouraging and plain. "Pick up where you left off", never "You missed 3 days".
- A study companion, calm and literate. Not a gamified habit app: no streaks, rings, badges or anything that scores the reader.
- The owner does not want it to look like a generic AI-built app (rounded cards on a pale ground, pill buttons, safe and anonymous).
- Nothing in the current look is fixed. A full-year progress element, the palette and the typefaces may stay only where they fit the new direction.
- Standing preference (owner, 2026-11-13): simple and clean, in the company of Bear and Day One. A calm writing-and-reading feel, one good typeface, soft colour, lots of air. Concept-driven or diagram-heavy directions were shown and rejected as too busy.
- What the owner disliked in the first version: its colours (pale blue-grey with dark blue and four phase colours) and its boxes and pills (rounded outlined cards, pill buttons, segmented toggles). The serif typefaces and the amount of content on Today were not the problem.

## Evidence on Hand

- The full plan, weekly deep-dive prompts, 52 KJV memory verses, 11 eras, 12 peoples and 12 prophets, in `content/bible-journey-seed.json`.
- The product brief and the original prototype, in `docs/reference/`.
- No photography, illustration, maps or logo exist. Do not invent testimonials, user counts or endorsements.

## Product Principles

1. Today in one glance: the reading and its context come before everything else.
2. The first unread day is the current day; a gap is never framed as failure.
3. Understanding over completion: history, geography and people sit beside the reading.
4. The app is a companion to a paper Bible, not a replacement for it.
5. Quiet by default; the reader's progress through the year is the one thing shown boldly.

## Accessibility & Inclusion

WCAG AA contrast in light and dark themes, full keyboard use, visible focus, labeled controls, 44px minimum tap targets, reduced motion respected, no horizontal scroll at 360px.
