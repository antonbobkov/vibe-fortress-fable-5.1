# T-623 — The caravan waits "for a trade depot" when the depot it cannot reach stands built

**Closed:** 2026-11-19, in 2d561d97.

**Source:** [T-618's first-year audit](../../../reports/audits/2026-11-18-t618-first-year-ux.md), findings 8–11 · **Size:** M · **Needs:** — · **Status:** open

## Why

At Mossrun a river cuts the map; the wagon and the fortress are on its east bank and the Hillfolk arrive from the west edge. The depot was built on Summer 1. When the caravan came on Summer 18 the log said "The Hillfolk caravan waits at the edge for a trade depot." The depot panel and `[S-t] trade` said only "The Hillfolk caravan has not reached the depot yet." Nothing said the caravan could not reach the depot, nor why (no walkable way from the west edge: water and a three-level channel). After `DEPOT_WAIT_DAYS` it would have left with −2 reputation. The audit bridged the channel with a constructed floor, which can be planned only one supported tile at a time (each drag places one tile and skips the rest), and the caravan then came on.

Once it was at the depot no line said so; the `$` field was the only sign. The depot panel lists every stack apart ("1 barley straw" eleven times), and the trade session names goods "3 leather bootss" (fixed by T-618), "40 dungs", "50 flours", "70 salts", and names as broker a dwarf who is not the Broker.

## What to do

1. **Name the reason.** When a depot exists and none is reachable from the caravan's edge, `CaravanWaiting` carries the depot and the edge, and the line says so: "The Hillfolk caravan cannot reach Trade depot #1 from the west edge: a wagon needs a way on foot, with no stairs and no deep water." Its focus is the depot. The depot panel says the same while the caravan waits.
2. **Say when it arrives.** `CaravanAtDepot` gets a note: "The Hillfolk caravan is at Trade depot #1: [c] or the depot to trade."
3. **A bridge in one plan.** A floor over open space may be planned beside another planned floor that will hold it (14 § Placement), so one drag plans a span that is built from its supported end.
4. **Group the depot's goods** by type, material and quality as the trade session's merchant column does.
5. **Mass nouns**: `plural` values in `items.md` for the items that do not take an s (dung, flour, salt, sand, ash, potash, lye, tallow, wax, honey and the like), so the trade session and stocks say "40 dung", "50 flour".
6. **The broker line**: "Broker: none (Torgeir Grimfoot trades, skill 0)" when no dwarf holds the title.

Spec: 20 § Caravan arrival and its announcements; `ui-screens/panels.md` § Depot; `ui-screens/trade-session.md`; 14 § Placement for the bridge; `items.md`.

## Done

A scenario with a depot across water from the caravan's edge pins the line and its focus; tests for the at-depot note, the bridge plan, the grouped depot rows and the plurals.
