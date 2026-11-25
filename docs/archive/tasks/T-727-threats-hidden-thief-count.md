# T-727 — The Threats panel counts a thief the map still hides

**Closed:** 2026-11-25, in d9d3776f,220077cf.

**Source:** T-713 ([work file](T-713-hostile-view-sections.md)) · **Size:** S · **Needs:** — · **Status:** open

## Why

At `twilight_pass` thieves come in pairs, one party of two (18 § Schedule). Once one is spotted the party is in view (`visibleThreatParties`), and the Threats panel's line counts every member still on the map: `Active: thief, 2, coming`, which tells the player a second, hidden thief is about. 18 § Stealth says a stealthed creature is not drawn, not inspectable and not targeted until spotted. T-713's `Party` row in a hostile's view counts only the members the map does not hide (`partyCountWords` with a filter, `src/ui/raid-lines.ts`), so the two now disagree.

## What to do

- `partyActiveText` counts as Look's row does: a member stealthed and not spotted is left out of both numbers, so a spotted thief's line reads `Active: thief, 1, coming` until its partner is spotted.
- The click on the line centres on the leader only when the map shows it, else on the first member it shows.
- Update `ui-screens/panels.md` § Threats and 18 § Player-facing behavior (the count is of the members in view).

## Done

- [x] Tests (`describe` with the task id): a pair of thieves with one spotted reads `1`; both spotted `2`; a revealed ambush is unchanged (`test/unit/ui/t727-threats-hidden-count.test.ts`, with the click on a hidden leader going to the spotted member, and a hidden member gone from the map in neither number).
- [x] UI only: world hashes unchanged (only `src/ui` changed).
