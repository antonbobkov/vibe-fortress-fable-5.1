# T-683 — Unpastured animals after the hall: grazers go out to graze, cats prowl

**Closed:** 2026-11-22, in 0ca6a1e8,d08ac245,3b764205,0271947a,6c996987,24f40f51.

**Source:** T-675 (the owner's feedback of 2026-11-21, "Shouldn't they be grazing/exploring?") · **Size:** S · **Needs:** — · **Status:** open

## Why

T-675 gave the wagon's animals an amble about the wagon until there is a hearth hall (08 § Tame behavior, *Before the hall*). Once the hall stands, every tame animal with no pasture goes back to standing on its tile in or beside the hall (T-463, T-482, T-510). Two things follow that the owner may not want:

- A grazer with no pasture stands in the hall, usually underground, where no grass lies within the 6 tiles a hungry grazer looks; it grows hungry and, with no pasture drawn, starves after `ANIMAL_STARVE_DAYS`. 08 § Pastures and feeding still says unassigned grazers "eat any grass they find", which from the hall they cannot.
- Cats only heap in the cats' corner; the owner suggested cats may roam the fortress (there are no vermin to hunt yet).

## What to do

Decide, and spec in 08, whether a hungry grazer with no pasture walks out to the nearest grass it can reach (or to the wagon's ground, ambling as before the hall) and comes back, and whether a cat now and then leaves its corner to prowl the fortress's rooms and comes back to heap. Keep the pets' heap and the cats' corner (fun features), and keep the hall tests of T-463, T-482 and T-510.

## Done

- [x] A test for each rule taken: `test/unit/animals/t683-after-the-hall.test.ts` (a grazer with no pasture grazes about the wagon by day and is in the hall at night; under an alert it comes in, and it stays in while a hostile stands near the wagon; shut out of the hall under an alert it ambles by the wagon; a cat prowls the hall and the room beside it by day, never outdoors, and heaps in its corner at night) and `test/unit/buildings/t683-gate-waits-for-dwarves.test.ts`. Spec: 08 § Tame behavior, *After the hall*; 19 § Hearth alert retreat (the gate waits for dwarves, not animals). Fun features: the herd's commute, the cats' night heap.
- [x] The sweep's verdict: run `45027251322` on `890fdca0`, all 80 seeds green, Pooled 20 | 7 | 0 | 1097.25 | 122.5 | 0.5 | 0.5, **Verdict: pass**, worth tracing: none (master after T-677: 1151.75 living, 98.25 deaths). Traced on the way: the grazers out by the wagon held the `lock_on_alert` gate open (any fortress creature outside kept it open to the grace's end), and raiders came in behind the dwarves: `three-years-p4-4` at shift 150 had 24 deaths, 19 indoors, against 9 and 2 with master's animals; with the gate waiting for dwarves only, 12 and 3 (the sweep before the next fix: 105.75 deaths). Two script fragilities the new timelines showed were fixed in the script: the forge's iron goods ordered while the forge was being moved below (p2-2 at shift 100, a rejected command), and the dining hall's last digs left at ROUTINE behind nearer digs and the miners' picks for a whole run (p2-4 at shift 0, no dining hall). The remaining rise is within T-662's noise (one sweep's deaths spread 18; master's own sweeps of 2026-11-22 ran 97.75 to 120.25): p2-4 at shift 0 loses five dwarves to a wolf pack in days 37 to 44 on master too (T-681's sweep: 6 alive at year 1), and goes extinct on day 136 here. Tame deaths over the 80 runs: 507 on master, 527 here; the logs do not give their causes, so tame starvation is not counted (the grazers no longer stand in the hall with no grass).

## Decision (orchestrator, 2026-11-21)

A grazer with no pasture goes out to graze on grass near the gate by day and comes back to the hall at night or under an alert (the same shelter rule as the rest of the fortress); it does not starve indoors. Cats roam the fortress halls freely. Spec both in 08.
