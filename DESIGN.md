---
name: One-Year Bible Journey
description: Each reading day is one page of a tear-off daily book.
colors:
  paper: "#f7f7f3"
  under: "#e7e7e0"
  binding: "#d3d3cb"
  ink: "#20201d"
  ink-2: "#5a5a54"
  ink-3: "#8a8a83"
  rule: "#d6d6ce"
  ruled: "#b3b3aa"
  field: "#ebebe5"
  printers-blue: "#2747a5"
  on-blue: "#ffffff"
  danger: "#c4342b"
  paper-dark: "#171715"
  under-dark: "#0d0d0c"
  binding-dark: "#2b2b27"
  ink-dark: "#ecebe5"
  ink-2-dark: "#b3b2ab"
  ink-3-dark: "#85847e"
  rule-dark: "#34342f"
  ruled-dark: "#4a4a45"
  field-dark: "#292926"
  printers-blue-dark: "#3f60c8"
  printers-blue-ink-dark: "#9cb1f3"
  danger-dark: "#ff6b5f"
typography:
  numeral:
    fontFamily: "Archivo, sans-serif"
    fontSize: "128px"
    fontWeight: 800
    lineHeight: 0.84
    letterSpacing: "-0.02em"
    fontVariation: "'wdth' 62"
  numeral-word:
    fontFamily: "Archivo, sans-serif"
    fontSize: "30px"
    fontWeight: 800
    lineHeight: 1
    fontVariation: "'wdth' 62"
  numeral-list:
    fontFamily: "Archivo, sans-serif"
    fontSize: "26px"
    fontWeight: 800
    lineHeight: 1
    letterSpacing: "-0.01em"
    fontVariation: "'wdth' 62"
  headline:
    fontFamily: "Source Serif 4, Georgia, serif"
    fontSize: "31px"
    fontWeight: 600
    lineHeight: 1.12
    letterSpacing: "-0.005em"
  display-serif:
    fontFamily: "Source Serif 4, Georgia, serif"
    fontSize: "30px"
    fontWeight: 600
    lineHeight: 1.15
    letterSpacing: "-0.005em"
  title:
    fontFamily: "Source Serif 4, Georgia, serif"
    fontSize: "22px"
    fontWeight: 600
    lineHeight: 1.2
  section:
    fontFamily: "Source Serif 4, Georgia, serif"
    fontSize: "15px"
    fontWeight: 600
    lineHeight: 1.3
  body-serif:
    fontFamily: "Source Serif 4, Georgia, serif"
    fontSize: "17px"
    fontWeight: 400
    lineHeight: 1.5
  note-writing:
    fontFamily: "Source Serif 4, Georgia, serif"
    fontSize: "18px"
    fontWeight: 400
    lineHeight: "32px"
  note-page:
    fontFamily: "Source Serif 4, Georgia, serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: "30px"
  verse:
    fontFamily: "Source Serif 4, Georgia, serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.45
  large-title:
    fontFamily: "-apple-system, SF Pro Display, system-ui, sans-serif"
    fontSize: "34px"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "0.01em"
  ui-body:
    fontFamily: "-apple-system, SF Pro Text, system-ui, sans-serif"
    fontSize: "17px"
    fontWeight: 400
    lineHeight: 1.4
  ui-button:
    fontFamily: "-apple-system, SF Pro Text, system-ui, sans-serif"
    fontSize: "17px"
    fontWeight: 600
  ui-button-android:
    fontFamily: "Roboto, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 500
    letterSpacing: "0.01em"
  label:
    fontFamily: "-apple-system, SF Pro Text, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.4
  fine:
    fontFamily: "-apple-system, SF Pro Text, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.45
rounded:
  binding: "3px"
  field-android: "4px"
  indicator-android: "8px"
  control: "10px"
  sheet: "12px"
  sheet-android: "28px"
  search-android: "24px"
spacing:
  pad-inset: "12px"
  page: "22px"
  screen: "20px"
  row: "48px"
  target-ios: "44px"
  target-android: "48px"
  section-gap: "24px"
components:
  button-primary:
    backgroundColor: "{colors.printers-blue}"
    textColor: "{colors.on-blue}"
    typography: "{typography.ui-button}"
    rounded: "{rounded.control}"
    height: "50px"
    width: "100%"
  button-primary-android:
    backgroundColor: "{colors.printers-blue}"
    textColor: "{colors.on-blue}"
    typography: "{typography.ui-button-android}"
    rounded: "{rounded.control}"
    height: "48px"
  button-ink:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    typography: "{typography.ui-button}"
    rounded: "{rounded.control}"
    height: "50px"
  button-text:
    textColor: "{colors.ink}"
    height: "44px"
  input-field:
    backgroundColor: "{colors.field}"
    textColor: "{colors.ink}"
    typography: "{typography.ui-body}"
    rounded: "{rounded.control}"
    padding: "0 14px"
    height: "48px"
  input-field-android:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink-2}"
    rounded: "{rounded.field-android}"
    padding: "0 16px"
    height: "56px"
  search-field:
    backgroundColor: "{colors.field}"
    textColor: "{colors.ink-2}"
    typography: "{typography.ui-body}"
    rounded: "{rounded.control}"
    padding: "0 10px"
    height: "36px"
  search-field-android:
    backgroundColor: "{colors.field}"
    textColor: "{colors.ink-2}"
    rounded: "{rounded.search-android}"
    padding: "0 16px"
    height: "48px"
  list-row:
    textColor: "{colors.ink}"
    typography: "{typography.ui-body}"
    height: "48px"
  list-row-danger:
    textColor: "{colors.danger}"
    height: "48px"
  page:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    padding: "22px 22px 0"
  sheet:
    backgroundColor: "{colors.paper}"
    rounded: "{rounded.sheet}"
    padding: "8px 22px 0"
  sheet-android:
    backgroundColor: "{colors.paper}"
    rounded: "{rounded.sheet-android}"
  tab-bar:
    textColor: "{colors.ink-2}"
    height: "84px"
  tab-bar-active:
    textColor: "{colors.ink}"
  tab-bar-android:
    backgroundColor: "{colors.paper}"
    height: "88px"
  tab-indicator-android:
    backgroundColor: "{colors.binding}"
    rounded: "{rounded.indicator-android}"
    width: "56px"
    height: "32px"
---

# Design System: One-Year Bible Journey

Recorded from the approved native mocks (`docs/reference/design/native/mocks.html`, rounds 1 and 2 owner-approved 2026-11-17, round 3 (notes) owner-approved 2026-11-19). The web app in `src/` has not been moved to this world yet; its sage and Literata styling is evidence, not this system.

## Overview

**Creative North Star: "Page-a-Day"**

Each reading day is one page of a tear-off daily book. The day number sits large at the head of the page, the reading under it in a book serif, a short note of context, and the week's verse at the foot. Under the page, fine edges show the days still to come; above it, torn stubs under the binding show the days already read. Marking a day read tears the page off and the next one is already waiting underneath.

The world is paper and ink: cool uncoated white, near-black ink, and one printer's blue kept for the current day and the screen's one primary action. Structure comes from pages, hairline rules and dotted perforations rather than cards, pills or boxes. The mood is calm and literate, in the company of Bear and Day One, with plenty of air and nothing that scores the reader.

One world runs on both platforms. iPhone follows iOS conventions (tab bar, sheets, SF Pro for controls, Dynamic Type); Android follows Material (navigation bar with an indicator, modal bottom sheets, outlined text field, Roboto for controls, 48 dp targets). Both keep the same pages, numeral and serif.

**Key Characteristics:**
- A tear-off pad: binding, torn stubs, a perforated page, page edges beneath.
- A condensed heavy calendar numeral for the day number.
- A book serif for readings, verses, headings and answers; the system face for every control.
- Ink on paper, with printer's blue rationed to the current day and one primary action.
- Hairlines and perforations divide content; no cards, pills or outlined boxes.
- Light and dark are the same paper and ink inverted, not a different palette.

## Colors

Paper, ink in three strengths, and a single printer's blue; dark mode is the same set re-inked for night.

### Primary
- **Printer's Blue** (`printers-blue`): the fill of the one primary action on a screen (Mark day read, Subscribe, Sign in, Reveal) and, as text or a mark, the current day: today's row in Plan, today's tick in the year grid, this week's verse in the Verses list. In dark mode the filled button uses `printers-blue-dark` and blue text uses the lighter `printers-blue-ink-dark` for contrast. On blue, text is `on-blue`.

### Neutral
- **Uncoated Paper** (`paper`): the page, sheets, navigation bars and the Android navigation bar.
- **Under-Page** (`under`): the ground beneath the pad and between pages; also the colour punched through the perforations.
- **Binding Board** (`binding`): the pad's head binding and the Android tab indicator.
- **Ink** (`ink`): text, read-day marks, the selected radio, the on switch, the send button.
- **Second Ink** (`ink-2`): secondary text, metadata, notes, inactive tabs.
- **Faded Ink** (`ink-3`): unread-day stubs, perforation dots, chevrons, radio rings, link underlines, later items.
- **Hairline** (`rule`): 0.5px row dividers, the page's bottom edge line, the tab bar's top edge.
- **Ruled Line** (`ruled`, `ruled-dark`): the 1px writing lines of a note (on the page, in the writing sheet, under the empty Notes state), darker than the hairline so the lines read at about 2:1 on paper. Writing lines only; hairlines stay `rule`.
- **Field** (`field`): filled text fields, the composer, the close-button disc, the ad slot.
- **Correction Red** (`danger`, `danger-dark`): destructive list rows (Delete account, Reset progress), Delete note… at the foot of the writing sheet, the wrong-code message and its field outline. Never a fill. The swipe-to-delete action in the Notes tab and the alert's Delete button use the system red, as platform parts.

### Named Rules
**The One Blue Rule.** Printer's blue marks the current day and the one primary action on a screen, nothing else. A second filled control on the same screen is an ink-outlined button.

**The Mark, Not Colour, Rule.** Read and unread days differ by mark, never by a second hue: in the year grid a full ink mark against a short faded stub, in Plan's day list an ink check against an empty faded ring.

**The Ruled-For-Writing Rule.** Ruled lines (`ruled`) appear only where the reader writes or has written; every other divider is a hairline or a dotted cut.

## Typography

**Numeral Font:** Archivo at 62% width, weight 800 (with sans-serif)
**Book Font:** Source Serif 4 (with Georgia, serif)
**Control Font:** SF Pro on iPhone, Roboto on Android (with system-ui)

**Character:** A condensed, heavy calendar numeral does the shouting; a warm book serif carries everything that is read; the platform's own face carries everything that is tapped.

### Hierarchy
- **Numeral** (800, 128px, 0.84, -0.02em, Archivo 62% width): the day number on the page, with "Day" beside it in the same face at 30px. At xxxLarge text it steps down to 112px so the reading keeps its room.
- **List numeral** (Archivo 800, 26px, 1, -0.01em, 62% width): the day number heading each note in the Notes tab.
- **Headline** (Source Serif 4 600, 31px, 1.12): the day's reading ("Deuteronomy 22–25").
- **Display serif** (Source Serif 4 600, 30px, 1.15): the paywall headline and the first-run lede; 26–28px for the verse reference and "Check your email".
- **Title** (Source Serif 4 600, 22–24px, 1.2): sheet titles (the writing sheet's title is the day's reading), the practice verse reference, the account email, "No notes yet".
- **Section** (Source Serif 4 600, 15px, 1.3): section headings in sentence case ("This week's verse", "Subscription", "Daily reminder"); week names in Plan run larger at 18px.
- **Body serif** (Source Serif 4 400, 17px, 1.5): the day's context and assistant answers (1.55); first-run body at 18px. Note excerpts in the Notes tab at 16px/1.45, three lines; the reading beside the list numeral at 600 17px.
- **Note writing** (Source Serif 4 400, 18px on 32px ruled lines): the writing sheet. On the page the note sits at 16px on 30px lines (21px on 36px at xxxLarge), two lines; the empty placeholder is italic in second ink.
- **Verse** (Source Serif 4 italic 16px, 1.45): the week's verse on Today and the Sunday deep-dive line; upright 17px on the Verses page.
- **Large title** (system 700, 34px): Plan, Verses and More screen titles, iOS large-title style.
- **UI body** (system 400, 17px, 1.4): rows, questions, buttons (600), field text.
- **Label** (system 400, 13–15px): metadata, notes under rows, the day's era line, field labels, "Your note", "Day 69 · your note" and "Saved", the weekday in the Notes list, the 13px "Note" label on a Plan day.
- **Fine** (system 400, 13px, 1.45): quota, paywall fine print, verse citation, small print.

### Named Rules
**The Read-It-In-Serif Rule.** Anything the reader reads as content is serif; anything she taps or scans as chrome is the system face.

**The Sentence-Case Rule.** Headings are sentence case at their own size. No uppercase tracked labels or eyebrows above headings.

## Layout

Phone portrait, drawn at 390 × 844 pt. On Today the pad fills the space between the status bar and the tab bar: the binding inset 10px, the page inset 12px from each side, 22px inner padding, and up to four or five page edges stacked 4px apart beneath it. Other tabs scroll on paper with 20px side padding under a large title; pushed screens (Account, Settings) use a 44pt navigation bar with a back label.

Rhythm is set by touch targets: list rows are 48px, plan day rows 44px, week rows 52px, links and text buttons at least 44pt (48dp on Android), including underlined text links. Sections are separated by 24px above a serif section heading, with a 14px note under a row group where one is needed.

A free reader's banner (320 × 50) sits in a 66px strip above the tab bar on Plan, Verses and More only. Never on Today, the assistant, the paywall or Notes; notes are free for everyone and never carry an ad.

On the day page the note area ("Your note" and two ruled lines, at least 44pt tall) sits between the two page rows and Mark day read; at default size the page still fits the first viewport with it.

At larger Dynamic Type sizes the page scrolls rather than squeezing: the numeral steps down, body grows (context 23px at xxxLarge), the row labels wrap, and the week's verse moves below the fold.

## Elevation & Depth

Depth is physical paper, not interface elevation. The page sits a hair above the pad with a hairline and a soft drop; sheets are torn pages laid over a scrim and carry no shadow of their own. The only lifted moment is the tear-off itself.

### Shadow Vocabulary
- **Page rest** (`box-shadow: 0 1px 0 var(--rule), 0 2px 6px -3px rgba(0,0,0,0.2)`): the page on the pad, and the week's verse page on Verses.
- **Page edge** (`box-shadow: 0 1px 0 var(--rule)`): each 2px page edge stacked beneath the page.
- **Tear lift** (`box-shadow: 0 18px 30px -12px rgba(0,0,0,0.35)`): the page mid-tear only.
- **Switch knob** (`box-shadow: 0 2px 4px rgba(0,0,0,0.2)`): the platform switch thumb.

Sheets sit over a scrim (`rgba(32,32,29,0.32)` light, `rgba(0,0,0,0.55)` dark). The iOS tab bar is translucent paper (`rgba(247,247,243,0.88)`, saturate 160% blur 20px); the Android bar is solid paper.

### Named Rules
**The Paper-Not-Plastic Rule.** Nothing floats except a page being torn. Hierarchy comes from paper layers and hairlines, not stacked shadows.

## Shapes

Pages are square-cornered sheets: the page, the verse page, the page edges and the binding's foot have no radius (the binding's top corners take 3px). Edges carry the world's marks: a perforated top edge of punched dots across every page and sheet, and dotted cut lines (3px tall, ink-3 dots every 7px) between sections, weeks and the "or" divider. Torn stubs under the binding have ragged clip-path edges. Ruled writing lines (1px `ruled`) are the paper's third mark, used only for notes; notes in the Notes tab are separated by the same dotted cut lines.

Controls are gently rounded rectangles at 10px: buttons, filled fields, the code field, the iPhone search field (the Android search bar is fully rounded at 24px, per Material). Sheets round their top corners (12px iOS, 28px Android, per platform). Circles are reserved for radios, the "I know it" check, the unread ring on a Plan day, the send button and the close disc. Marks are thin vertical strokes (2px ink bars) used as list bullets, the year grid's day marks and the synced line, never dots; the one icon mark is the ink check on a read Plan day.

## Components

### Buttons
Plain, full-width, confident; one blue per screen.
- **Shape:** gently rounded rectangle (10px), 50pt tall on iPhone, 48dp on Android.
- **Primary:** printer's blue fill, white text, system face 600 17px (Roboto 500 15px on Android).
- **Ink outline:** paper with a 1.5px ink border and ink text, for the second action beside or instead of a primary (Next verse, Email me a code).
- **Sign in with Apple:** black fill and white text (inverted in dark); **Google:** 1.5px faded-ink outline with Google's coloured mark. Android shows Google and email only.
- **Text button and link:** ink text, underlined in faded ink with a 3–4px offset, 44pt minimum hit area. Secondary text buttons such as Mark as unread are second ink.

### Inputs / Fields
- **Style (iPhone):** filled field-grey, 10px radius, 48pt tall, 14px padding, a 14px label above. The composer field is 44pt with a round ink send button.
- **Style (Android):** Material outlined field, 1px second-ink border, 4px radius, 56dp, floating label notched into the border.
- **Code entry:** 56pt tall, system 600 30px, tabular numerals, 0.32em tracking, centred.
- **Error:** a 1.5px inset correction-red outline and a 14px red line under the field.

### Lists and rows
- **Settings rows:** 48px, ink label left, second-ink value or chevron right, 0.5px hairline between rows, a serif section heading above and a second-ink note below.
- **Page rows:** on the day's page, Read on Bible Gateway and Ask about this reading are full-width 48px rows: a 20px ink line icon (an open book, a speech bubble), the label in ink in the system face at 17px 600, and at the end a faded arrow pointing up and right for Bible Gateway, which opens outside the app, or a chevron for Ask. A 0.5px hairline sits above the first, between them and below the last. No boxes, fills or blue.
- **Destructive rows:** correction-red text with a trailing ellipsis (Delete account…, Reset progress…, Delete note…), confirmed in a system alert. Reset progress keeps notes.
- **More hub rows:** label plus a second-ink description line.
- **Selection:** a trailing ink tick; toggles use the platform switch with ink as the on colour.

### Navigation
- **iPhone:** five-tab bar (Today, Plan, Verses, Notes, More), translucent paper, 26px line icons, 10px labels; active tab in ink at 700 with a heavier stroke, inactive in second ink.
- **Android:** Material navigation bar on solid paper with the same five destinations, 24dp icons, 12px Roboto labels, active indicator 56 × 32 in binding grey with an 8px radius.
- **Pushed screens:** a paper navigation bar with chevron and "More" back label, centred title.

### Sheets
- **Style:** a torn page laid over a scrim: paper, rounded top corners, grabber, a perforated line across the top, serif title with a Done or Cancel text action (a round close disc on the paywall and on Android).
- **Used for:** the study assistant, the paywall, sign in and the code step, and writing a note.

### The Page (signature)
The day's page on the pad: perforated top edge, dateline lockup (numeral, "Day", "of 312" in ink over the weekday and week in second ink), serif reading, era line, serif context, the page rows (Read on Bible Gateway, and Ask about this reading when the assistant is set up), the primary Mark day read, then a dotted cut and the week's verse in italic serif with its KJV citation. Status lines that belong to the day (Signed in. Your progress came with you.) sit on the page as a line with an ink bar, not as a toast.

Between the page rows and Mark day read sits the note area: "Your note" in second ink and two ruled lines, with the placeholder "Write a note on today's reading" in second-ink italic serif; once written, the lines show the note's first two lines. A day already read (opened from Plan or by swiping back) shows its note and, in place of the blue button, an ink-bar line "Read on Tuesday" with an underlined "Back to today" link, and under it an underlined "Mark as unread" text button in second ink, so blue stays with the current day. Mark as unread asks nothing first; marking the day again undoes it.

### Writing sheet
A sheet over Today: the day's reading as the serif title with Done (a close disc on Android), then "Day 69 · your note" left and "Saved" right in second ink, then ruled paper at 18/32 serif. It saves as she types; there is no save button, and an emptied note is removed. With the keyboard down, a long note scrolls and Delete note… in correction red sits at the foot, confirmed by a system alert. Plain text only.

### Notes tab
A large title "Notes", a search field ("Search your notes"; no match says so in the list), then every note newest first, separated by dotted cut lines: list numeral, serif reading, weekday in second ink right, three-line serif excerpt. Today's note takes the current day's blue on its numeral and weekday. Tapping a note opens the writing sheet for that day. Swipe left deletes on iPhone (a system-red Delete action); long-press on Android. Before the first note: "No notes yet", a serif line saying notes gather here, the signed-out sync line with an ink bar ("Notes are kept on this phone. Sign in to keep them on your other devices too."), and a few ghost ruled lines. Signed in, the tab has no sync line.

### Plan index
A 52-week year grid of thin marks (full ink for read days, a blue taller mark for today, faded stubs for unread), with four phase gaps; below it weeks as cut-separated rows that open to their six days, each led by its check and the weekday, and the Sunday deep dive in italic serif. The check is its own 44pt control (48dp on Android) that marks the day read or unread: a 2px ink check for a read day, an empty ring in faded ink for an unread one, the ring in printer's blue for today. The rest of the row opens the day. A day with a note carries a 13px second-ink "Note" label at the right. Tapping the rest of a day's row turns the pad to that day's page.

The year grid is one control, never 312 targets: its marks are about 1.5pt wide. Touch and slide along it (like the A to Z index in Contacts) and a 1px ink line marks the week under the finger while the summary line above the grid becomes the readout ("Week 24" in 17px serif 600, then the week's title in second ink), with a light haptic tick at each week. Letting go, or a plain tap, scrolls the list to that week and opens it; the large title tucks into a compact "Plan" bar. The week (52pt) and day (44pt) rows stay the everyday targets. VoiceOver and TalkBack read the grid as a summary and one adjustable control (swipe up or down to move a week).

### Paywall choice
Radio rows between hairlines: a 22px ring in faded ink, filled by a 7px ink border when chosen; plan name and second-ink detail, price in tabular numerals right.

## Do's and Don'ts

### Do:
- **Do** keep one printer's blue element per screen for the primary action, plus blue text or marks for the current day only.
- **Do** separate content with 0.5px hairlines and dotted cut lines; give every page and sheet its perforated top edge.
- **Do** set content in Source Serif 4 and controls in the platform face (SF Pro on iPhone, Roboto on Android).
- **Do** show read and unread by mark: full ink mark versus faded stub in the year grid, ink check versus faded ring in Plan's day list.
- **Do** keep every control at least 44pt on iPhone and 48dp on Android, underlined text links included.
- **Do** follow the platform for system parts: switches, alerts, keyboards, swipe actions, Material text fields and navigation.
- **Do** say "progress and notes" wherever sync, sign in, sign out or deletion is described.
- **Do** let the page scroll at large text sizes and step the numeral down rather than shrinking the reading.
- **Do** replace the tear-off with a crossfade when Reduce Motion is on.

### Don't:
- **Don't** wrap content in cards, pills, or rounded outlined boxes; the page is the only container.
- **Don't** use blue for anything that is not the current day or the one primary action, and don't add a second accent colour.
- **Don't** put uppercase tracked kickers or eyebrows above headings.
- **Don't** show streaks, progress rings, badges, scores or anything that grades the reader.
- **Don't** place a banner ad on Today, the study assistant, the paywall or Notes.
- **Don't** raise anything above the page except a page being torn; no floating toasts or stacked shadows.
- **Don't** use ruled lines as dividers, or hairlines as writing lines.

## Open items

- **Unresolved:** prices (shown as $X.XX), the store app name, and the icon. Decided 2026-11-18: Delete account also clears the reading progress on this phone. Decided 2026-11-19: Delete account clears notes on this phone too; Reset progress keeps notes; the same day's note edited on two devices follows last edit wins, like progress.
- **Not drawn:** accessibility text sizes AX1 to AX5, the "new code sent" state after Send a new code, and the reminder state when notifications are off. Not drawn: notes at accessibility sizes AX1 to AX5, an Android dark notes frame.
