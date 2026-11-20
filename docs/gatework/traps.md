# Traps

Lessons with the failure attached. Review reads this file and intake skims it. Each entry says what to do, what went wrong when it was not done, and an anchor (a `file:line`, a PR, or command output) a reader can check. Add entries with `gatework trap add`; entries run newest last.

## 2026-11-13: Run typecheck and e2e from a clean checkout before claiming green

- Failure: tsc passed locally only because .next held generated route types, and a nav overflow showed only with Linux font metrics
- Anchor: PR 5, CI run 43373866777

## 2026-11-20: In a formSheet, react-native-screens sizes a ScrollView to the sheet minus its first sibling and ignores any footer; pad the content by the footer's measured height. The 'expects at most 2 subviews' warning is expected. Recheck after a react-native-screens upgrade.

- Failure: The ask sheet's answer ended under the composer in TestFlight build 5
- Anchor: react-native-screens 4.30.1 ios/RNSScreenContentWrapper.mm:174
