# T-638 — The Threats panel shows the coming raid, and the end of a raid says what happened

**Source:** [T-635's mid-game audit](../../reports/audits/2026-11-19-t635-midgame-ux.md), findings 9–12 · **Size:** M · **Needs:** — · **Status:** open

## Why

- **Before.** After "Gloam scouts have been seen at the northern edge. They will come tomorrow." the Threats panel still read "Active: 3 hostile creatures" (which three, where?) and listed nothing coming: the warning lived only in the log.
- **During.** A kill order leaves no trace in the Military panel: "Orders [S-k] kill [S-f] follow" reads the same before and after, so the player cannot tell what the squad is chasing, or that the order picked the fortress's own dog (fixed here for the pick, finding 6).
- **After.** "The raid has ended." gives no outcome, though `RaidEnded` carries one (`looted`); "! A thief has escaped with stolen goods! x14" names none of the fourteen things taken. The Hearth alert stays raised with no word that the raid is gone; civilians stood "Retreating" for days in the audit until the alert was lowered by hand.

## What to do

1. Threats lists a warned party until it arrives: "Coming: a horde of Gloam from the north, tomorrow." Its "Active" line names what the hostile creatures are ("3 cave crabs") and a click centres the first.
2. Military shows a squad's current order: "Orders kill: a gloam captain" (or "follow: Liv H."), with `[q] cancel orders`.
3. `RaidEnded` reads by its outcome: "The raid is over: 6 raiders fled with 14 goods, 3 fell." (`looted`), "The raid was driven off: …" (`repelled`), and so on, from the party's counts.
4. `ThiefEscaped` names what was taken ("A thief has escaped with an iron short sword."), grouped by the log's count as now ("… with 14 goods: iron bars ×6, …").
5. When the last hostile of a raid or siege leaves the map under the Hearth or Watchful alert, a note says "The raid is gone: [m] [1] lowers the alert."

Spec: 18 § Player-facing behavior and its panel, `ui-screens/panels.md` § Threats and § Military.

## Done

Tests for each line from synthetic events and a party.
