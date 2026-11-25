# T-NEW — Shut in under the Hearth alert, the fortress goes to thirst 100 and the log calls it starving

**Source:** playtest 2026-11-25 (peril 4) ([report](../../reports/data/2026-11-25-playtest-4.md), finding 1) · **Size:** M · **Needs:** — · **Status:** open

## Why

Three of the four times the fortress sheltered from a raid at peril 4, the whole fortress went to thirst 100 within a day and stayed there until the player lowered the alert, while Stocks listed 150 drinks. The log said they were starving.

- **Raid, Autumn 20, Year 1** (`playtest-1125-p4`, 8 dwarves; `03-d76-raid-log.png`, `05-d76-mood.png`, `06-thirst-log.png`). A Gloam raid of 13 looted outside for two days under the Hearth alert. All 11 barrels of ale (156 drinks) stood at the still (38, 8, z31) and in Stockpile #2 (27, 10, z31), on the far side of the locked doors: the walker label there was 151, the shelter's 123, the two soldiers' at the gate 141. The food was inside and hunger was served. By the alert's second day every dwarf, the soldiers on duty too, was at thirst 100. The log said "! 8 dwarves are starving: Rolf, Bjarni, …" every day, and Mood said "-8 I am thirsty. x8". "The raid is gone: [m] [1] lowers the alert." came once, on Autumn 22; for three more days nothing else said what held them. Within 200 ticks of `[m] [1]` every dwarf had drunk (thirst 100 → 2).
- **Siege, Autumn 13 to 18, Year 2** (the save [`deepholm-p4-y2-siege.bin`](../../reports/data/2026-11-25-playtest-4/deepholm-p4-y2-siege.bin), 9 dwarves; `10-siege-warned-threats.png`, `11-siege-arrived-threats.png`, `12-siege-log.png`). 27 Gloam stood outside the locked gate for five days. All nine were at thirst 100 from the second day to the end, and the log said "9 dwarves are starving" each day.
- **Raid and ambush, Autumn 6 to 10, Year 1** (`playtest-1125-p4b`, 11 dwarves; `40-b-d64-log.png`). Same result: "11 dwarves are starving" for days. Nobody died, where the three-year script's sally lost 9.
- **Raid, Autumn 22, Year 1** (`playtest-1125-p4c`, 7 dwarves): this fortress kept its drink inside the shelter, and under the same alert its dwarves went on drinking. So where the drink stands decides it, and nothing tells the player that.

The rules do not cover this case. 10 § Behavior selection step 2 sends a sheltering civilian at critical thirst "wherever the … drink … is", but a locked door puts the drink out of reach. 19 § Hearth alert retreat says "a hall that holds no food or drink does not starve the dwarves it shelters for as long as the fortress stores any", which is untrue when the lock is between them. The day's line comes from `announceStarving` (`src/ui/announcements.ts`), which ignores the event's `need`, so thirst reads as starving. `hint_starving` covers hunger only. Nothing points a player to the fix the game offers: drink stored inside, or a well (T-663's cistern).

Reproduce: load the save (the siege arrives on its next tick), keep the Hearth alert, step 2,400 ticks, and read `readers.of('10').need(id, 'thirst')` for every dwarf and the log's Alerts tab each day.

## What to do

Decisions:

- **The day's Starving line names the need.** Thirst reads "Asa Forgehall is dying of thirst." and "3 dwarves are dying of thirst: Asa, Njal, Liv." (`announce.thirsting`, `announce.thirsting_many`). Hunger reads as now. A day with both makes two lines, one for each need, and a dwarf whose hunger and thirst are both maxed is named in the hunger line, as 10 names its event.
- **A shut-in alert, once per Hearth alert and per need.** The first time, under a `hearth` alert, a sheltering civilian's thirst reaches its critical threshold while no drink is reachable from its retreat tile and the fortress stores drink it cannot reach, an alert says so: "The drink is outside the locked doors: 8 dwarves are thirsty. [m] [1] opens them; drink kept inside the hall, or a well, keeps them drinking." Food gets its own line on the same rule ("The food is outside the locked doors: …"). The count is the sheltering civilians at critical need at that moment. The line comes again only after the alert is lowered and raised.
- **The Military panel says it while it lasts.** Under the Hearth alert, below the no-shelter line, in the alert colour: "Thirsty: 8 cannot reach drink behind the locked doors." The same goes for food. Neither line shows when nobody is cut off.
- The lock rule is unchanged: doors do not open for drink. Shutting the fortress in stays the player's choice, and a well inside is the reward for building one.

Spec: 10 § Needs (the `Starving` line and its need), 24 § Announcements and the log (the starving line, the new alert), 19 § Hearth alert retreat (replace the sentence about a hall without food with the locked case), `ui-screens/panels.md` § Military, `03-content/ui-keymap-and-screens.md` (strings).

## Done

- [ ] Tests (`describe` with the task id): a day of thirst `Starving` events reads "dying of thirst" for one dwarf and for three, a day of hunger events reads as now, and a day with both makes two lines. A headless fortress keeps its only drink stockpile outside a `lock_on_alert` door and raises the Hearth alert: when a sheltering dwarf reaches critical thirst, the shut-in line shows once and the Military panel shows the thirsty line. After the alert is lowered both are gone, and raising the alert again can bring the line back. With a barrel inside the hall, or under Calm, neither shows.
- [ ] UI only (the lines read 10's needs and 22's reachability): `test/golden/world-hashes.test.ts` passes with no golden moved, and no sweep is needed.
