# T-121 — Resolve retained UI decision/code mismatches

**Source:** [T-107 triage](../archive/tasks/T-107-triage-systems-20-24-and-content.md) · **Size:** M · **Needs:** — · **Status:** open

## Scope and proposed resolutions

The whole rows below remain in [the decision log](../05-plan/DECISIONS.md). Triage cannot choose between the standing decision and the code. Do not change simulation rules or silently discard a row.

**Resolved, orchestrator, 2026-10-07** (under the owner's standing instruction to use judgement): the four proposed resolutions and the Settings strings proposal below are accepted as written. For D-077 and D-245 the later UI behaviour is the rule and the old clause is superseded. For D-163 and D-201 the decision is the rule and the code is fixed: the announcement registry keeps every spec per event.

| Row | Mismatch and evidence | Proposed resolution |
|---|---|---|
| D-077 | Stocks melts metal items within a mixed-material type (`src/ui/panels/stocks.ts:213`), whereas the row allows melting only types whose items are all metal. Other clauses contain superseded panel precedence, preset cycling, profession tie-breaks and generic stockpile text. | Keep the later UI behavior: operate on eligible metal items in mixed types, toggling their marks consistently. Pin mixed-material and all-metal selections, fold current stock actions and surviving glyph/list rules, and archive the whole historical row with its superseded clauses after explicitly checking the later task decisions. |
| D-245 | The row says accelerator captions are never redrawn after rebinding, but the zone inspector and its Help rows now pass live `panelLetters` to `acceleratorLabel` (`src/ui/panels/zones.ts:281,292,381`; `src/ui/panels/help.ts:171`). Fixed captions elsewhere still use defaults. | Keep the closed stockpile/room editor's live captions. Pin rebinding in the inspector and Help, describe the distinction from fixed captions, and archive the superseded caption clause; fold the row's remaining key-precedence rules. |
| D-163 | Normal sulk notes are suppressed: `src/ui/announcements.ts:63,73` stores one spec per event, and the alert registration overwrites the note registered by `src/systems/morale/index.ts:77,78`. `announce` selects that single spec at `:193,206`. | Keep the row's note/alert split. Retain all registrations per event and select the matching kind before formatting; test day_off, argue and weep as notes with their resolved texts, and break as an alert. |
| D-201 | The row explicitly permits several announcement specs per event and each system's severity, but the same single-spec map loses registrations. Registry coverage tests inspect declarations without proving their runtime selection. | Keep multiple filtered specs and per-kind severity. Extend runtime registry tests to prove that registering another spec does not erase earlier valid specs and unmatched kinds produce no announcement. Audit the row's other event-surface and strings clauses, coordinate with the DwarfDied task, fold all surviving rules, and delete the whole row only when every clause holds. |

## Additional closed UI-rule gap

The strings rule also needs a follow-up in Settings: `src/ui/screens/settings.ts:71,74` writes failure text inline and displays raw binding context/action ids. This disagrees with the closed failures/name-display decision. Proposed resolution: registry strings for invalid-modifier and binding-conflict messages, using the binding's Help wording and a player-facing context name. Pin the conflict text and route it through the shared message vocabulary; change no binding-conflict rule.

## Spec edits and verification

Edit `24-ui-and-input.md` § Announcements, `ui-screens/panels.md` § Stocks, and any affected registration or schema text. Preserve default-No melt confirmations and the current panel keys. Tests carry T-121, with no skipped or weakened assertion. Run all workflow checks and browser verification for UI changes. If a render golden moves, regenerate only its named fixture and explain it in the commit body. Close by folding the chosen rules, deleting only these rows, moving this work file to the archive and removing the backlog row.
