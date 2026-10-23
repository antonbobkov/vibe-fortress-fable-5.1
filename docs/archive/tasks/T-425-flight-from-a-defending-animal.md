# T-425 — Flight from a defending animal: the patient's trap and the run past the animal

**Closed:** 2026-10-23, in aa8de5c and 6d4c6d2.

**Source:** T-421, [boars maul p0-2](../../../reports/audits/2026-10-22-boars-maul-p0-2.md) · **Size:** M · **Needs:** — · **Status:** open

## Why

Journals of `three-years-p0-2` in year 3 show two faults in 10 § Behavior selection when a civilian meets a territorial animal that defends its ground (08: `attack` with a defended tile):

1. **The patient's trap.** A wounded civilian with a critical need (thirst 88 to 94) flees; on its next selection step 1's exception for a critical need skips `flee`, and step 3 rests the patient where it stands, waiting for a bandage beside the boar. Step 1 then flees again, and so on. One victim alternated six times in a quarter of a day on the same tiles and took eight hits. Step 3 comes before step 4, so a patient never serves the need the exception was for.
2. **The run past the animal.** The civilian runs for the hearth hall even when the way to it passes the animal. 08 lets the civilian go once it is out of `TERRITORY_RADIUS` of the tile where the attack began, a few steps away.

The measured rules are in [`2026-10-22-t421-flight-rules.patch.txt`](../../../reports/data/2026-10-22-t421-flight-rules.patch.txt). With the patch:

- **P:** a fleeing conscious patient keeps fleeing.
- **F:** the civilian flees to the nearest tile out of the animal's ground.

Neither saves p0-2 when started on day 238 on master's timeline. The boars still kill every dwarf (F with P: five dwarves by day 247, the rest by day 306). From day 0, F with a patient-bed rule ends p0-2 with 15 dwarves. It changes the hash of 18 of the 20 seeds: dwarf deaths 123 → 159 and living 907 → 816 in one sample, and two T-156 witnesses fail on gate walls burnt by wildfire. The annual instrument read 13/4/8/143/9/0/0 against 13/4/8/142/8/0/0; the forest-1 dwarf killed by a badger lives.

## What to do

Take P first: it is a plain fault with a unit test (a critically thirsty patient with no drink, an attacking boar beside it: it never rests within `THREAT_RADIUS` of the boar). Then decide F on the instrument and on a second sample of the twenty seeds, since one sample cannot tell its effect from the reroute.

## Done

- 10 says each rule taken, with a unit test.
- The instrument by the T-308 rule and `three_years_seeds` across three years, with before and after rows in a dated report.

## As done

Step 1 (the orchestrator's decision 1): a dwarf under attack, that is, one whose held hostile within `THREAT_RADIUS` holds it as its combat target, flees or fights whatever its needs, so a patient never rests within that hostile's reach. Instrument 13/4/8/142/8/0/0 → 13/8/10/150/8/0/0; twenty seeds 20 of 20, deaths 123 → 122, living 907 → 919 ([report](../../../reports/audits/2026-10-23-flee-under-attack.md)).

Step 2 (decision 2), measured on top of step 1 and not taken: the run out of a territorial animal's ground makes the sweep worse (deaths 122 → 145, living 919 → 865, p0-2 fails its "a dining hall" witness), though the instrument gains one dwarf (13/8/10/151/9/0/0). 10 keeps the run to the hall.
