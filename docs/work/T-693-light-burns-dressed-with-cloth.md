# T-693 — A wildfire's light burns ask for a cloth each

**Source:** T-691 follow-up · **Size:** S · **Needs:** T-691 · **Status:** open

## Why

Since T-691 a light burn takes no infection and asks for no cleaning, but it is still dressed, one cloth a burn (17 § Patients and hospitals), because the dressing halves its pain. On the two timelines T-691 replayed (`three-years-p4-1` and `three-years-p2-1` at shift 0, on T-665's branch) a lightning-lit wildfire gave 141 and 59 light burns, and 34 and 28 `dress_burn` jobs stood blocked on cloth for weeks. Nobody died of it, but a fortress that had the cloth would spend its bandages on scorches the week before a raid's cuts need them.

## What to do

Decide whether a light burn's dressing waits behind the hospital's bandage stock (dress only while cloth is above what the hospital wants for `stop_bleeding`), is made from a cheaper stuff, or is not made at all once pain from the dwarf's light burns is below `PAIN_DISCHARGE`; measure the cloth a wildfire's dressings take and the bandages a raid soon after finds.

Spec: 17 § Patients and hospitals (`dress_burn`, cloth and water first).

## Decision

Both of the cheap rules, and no new material or constant (17 § Patients and hospitals, `dress_burn`):

- **Only when it hurts.** A dwarf's light burns want dressing only while their pains together (the wound table's 8 each, a dressed one's halved) are `PAIN_DISCHARGE` (30) or more. One to three scorches heal undressed in the same time (the dressing only halves pain); four or more are dressed one at a time until they hurt less. The raw table pains are summed, not Willpower-scaled pain, so the test is fixed by the wounds alone and cannot go stale between health ticks.
- **Only from spare cloth.** While every undressed burn of the dwarf is light and its pain is below `PAIN_UNCONSCIOUS`, its `dress_burn` is priority 4 (was 3) and is made only while the cloth to be had is more than the fortress's hospitals keep: the sum of their `cloth` supply settings (default 10), none without a hospital. Each light dressing waiting for its cloth counts one against the spare, and one not yet started is cancelled (`cloth_kept`) when the spare is gone. With no cloth to spare it takes a honey if there is one, else waits. The hospital's `cloth` setting is the player's handle: 0 lets scorches take everything.
- A serious or grievous burn, and a knocked-out dwarf's light burns, are dressed as before (priority 3, any cloth); the job dresses a serious burn before a light one. A waiting job whose kind changes (a serious burn taken, a dwarf knocked out, or the reverse) is made again (`need_changed`).
- Not taken: a cheaper material (a new item, recipe and stock for one job; bandages already exist and are unused, see the follow-up); a reserve constant (the hospital's own cloth setting already says what the player wants kept).

## Measurement

`t668_wound_probe` (on `origin/t665-flux-steel`), days 215 to 340, on a local merge of T-665's branch with master (before) and with this branch (after). Not committed or pushed. With T-691's bucket order the timelines part before the fire, and no fire reaches the dwarves (`three-years-p2-1`: 16 light bruises, no burns, no deaths). So both sides were replayed with the `make_bucket` order removed from the script locally, as T-691 measured its rule alone. The probe was patched locally to remember dwarf ids (it counted no deaths), and to count the burns newly dressed at each `dress_burn` (by severity, cloth or honey), the cloth to be had each day, and the `dress_burn` and `stop_bleeding` job-days by state.

| | `p4-1` before | `p4-1` after | `p2-1` before | `p2-1` after |
|---|---|---|---|---|
| light burns | 141 | 161 | 59 | 57 |
| cloth spent on light burns | 5 (the last 5, the fire's day) | 0 | 5 (7 cloth → 0 in two days) | 0 |
| `dress_burn` waiting on cloth, most at once / job-days | 34 / 179 | 0 / 0 | 28 / 145 | 0 / 0 |
| cloth the next raid finds | 0 (day 260) | 4 (day 260) | 0 (day 337) | 7 to 8 all along (no raid by 340) |
| that raid | 6 serious wounds, no bandage, 3 bled out | 6 serious and grievous, 2 bandaged, 1 bled out | 13 wounds, no cloth, 1 bled out | (no raid) |
| dwarf deaths, days 215 to 340 | bled out 5, killed 1 | bled out 8, burnt 1, killed 1 | bled out 6, killed 4 | bled out 5, killed 4 |

The timelines part at the fire (the scorched dwarves keep working instead of dressing each other), so after the first raid the figures are not like for like. `p4-1` after had a second fire wave the next day (4 serious burns, 1 dwarf burnt to death) and wolves on days 266 to 283 with 19 serious cuts, where 5 of the 8 bleed deaths fell. Those are the timeline's, not the rule's. The like-for-like window is the fire and the raid five days later: no cloth went to scorches, none waited, and the raid found the bandages.

## Done

- [x] Tests: a dwarf with light burns does not take the hospital's last bandage cloth from a bleeding patient (`test/unit/health/t693-light-burn-cloth.test.ts`; also: two light burns are not dressed, five are dressed until under `PAIN_DISCHARGE`, a waiting light dressing gives way when a hospital comes to keep the cloth, a serious burn is dressed first from the hospital's cloth). T-419's, T-555's and T-691's light-burn tests now give four burns, enough to want a dressing.
- [x] The cloth spent on light burns after a wildfire, before and after, on the two timelines (above): 5 and 5 → 0 and 0; waits 34 and 28 → 0 and 0.
- [x] Fun-features row "Scorched and back at work".
- [x] Follow-up: `T-NEW-bandages-unused-by-medics.md` (bandages are made and sold, and no treatment takes one).
