# T-NEW — The locked doors cut a squad off from its station and its drink, and the Military panel says nothing

**Source:** playtest 2026-11-25 (military) ([report](../../reports/data/2026-11-25-playtest-6.md), finding 3) · **Size:** M · **Needs:** — · **Status:** open

## Why

`playtest-1125-p3m`, Day 20 of Autumn, Year 1, peril 3: the Gate Guard (5 members, mode Off) stood in the gatehouse, on the stair at (30, 9, z32) between the two outer `lock_on_alert` doors, with the four inner doors around the stair's foot at z 26. Under Hearth all six locked, which is what 19 says they do: no civilian was outside them for 20 ticks. (The three-year script had posted the squad there with a `station` order; a player's squad with no post stands wherever the alert finds it, which can be the same place.)

- **Shut in.** The five soldiers stayed in the gatehouse for the whole raid and three days after it. From the first day the log said "! 4 dwarves are dying of thirst: Gudrun, Kari, Fundin, Asa.", then the five of them, every day (`05-thirst-log-raid-over.png`). Asa's view: thirst 100, "-13 I am thirsty. Helps: drink they can reach; see Stocks [s]", Activity "Sleeping" (`04-soldier-shut-in-thirst.png`). Stocks held 240 drinks. Nothing named the locked doors. T-745's shut-in line and the Military panel's "Thirsty: N cannot reach drink behind the locked doors." count sheltering civilians only, not soldiers on duty (24 § Announcements, Shut in: "a sheltering civilian (not on duty …)").
- **Unreachable station.** I cleared the squad's orders (`[q]`), set its station at (30, 6, z32), three tiles outside the north door, and its mode to Active. The panel read "Station (30,6,z32)" and "Mode: active". The soldiers stayed on the stair, "On duty", for as long as the alert held (`06-station-beyond-locked-door.png`): a locked door blocks everyone (14 § Doors), so the post cannot be reached. Nothing in the panel, the squad's members or the log says so.
- **Mode off reads as off.** Under Hearth "every squad is treated as `active`" (16 § Squads), but the squad row and the Mode line still say "off" (`02-d76-military.png`).

A player who builds the airlock 19 describes and gives the squad a station at the gate, as the hint advises ("Make a squad and give it a station at the gate"), meets all three.

Reproduce: load the d76 save (in the report). Step 2,400 ticks and read the soldiers' thirst and the log. For the station, press `[m]` `[q]`, set it at (30, 6, z32), Active, then step 1,000: all five members are still at (30, 9, z32) or the stair below it.

## What to do

Decisions:

- **The Station row says when the station is out of reach.** While the squad is on duty and its station (or its `station` order's point) is not reachable by walker from where most members stand, a line under the Station row in the alert colour: "Out of reach behind the locked doors: the squad waits where it is." (when the alert locks explain it, i.e. the station is reachable with the alert locks ignored), else "Out of reach: no path from the squad." The check runs when the panel draws, from the connectivity labels, not every tick.
- **Soldiers count in the shut-in rule.** 24's Shut in counts a soldier on duty whose thirst or hunger is critical, while some door stands locked and the fortress stores drink (or food) it cannot reach, the same as a sheltering civilian. The alert and the Military panel's Thirsty and Hungry lines count them together ("Thirsty: 5 cannot reach drink behind the locked doors."). The panel adds a second line when soldiers are among them: "3 of them are soldiers of Gate Guard."
- **The Mode shows what the alert makes it.** Under Watch or Hearth, a squad whose mode is `off` or `train` reads "off (active under Hearth)" in the squad row's Mode column and on the Mode line ("Mode: off · active while the alert is Hearth").
- No rule of the simulation changes: doors still lock on everyone.

Spec: `ui-screens/panels.md` § Military (Station row, squad rows, Thirsty lines), 24 § Announcements and the log (Shut in), 19 § Player-facing behavior.

## Done

- [ ] Tests (`describe` with the task id): a squad stationed outside a locked `lock_on_alert` door shows the out-of-reach line under Hearth and not under Calm. A soldier on duty shut between two locked doors at critical thirst is counted in the shut-in alert and the Thirsty line. A squad with mode `off` reads "off (active under Hearth)" under Hearth.
- [ ] UI only: no world hash moves.
