# T-NEW — The Wildwood blame the fortress when their own guards shoot their bearers, and the log lists every log offered

**Source:** playtest 2026-11-25 (mid game) ([report](../../reports/data/2026-11-25-playtest-3.md), finding 7) · **Size:** S · **Needs:** — · **Status:** open

## Why

On Autumn 12, Year 1 a Gloam ambush sprang on the Wildwood caravan at the depot. The elf guards shot back, and their own arrows killed a bearer and one of the two merchants (`CreatureDied` of `wildwood_bearer` 318767524 by guard 83886984, and of merchant 117440688 by guard 83887047, `reports/data/2026-11-25-playtest-3/events.txt`, d68); the Gloam killed two more bearers. The Civilizations panel charged the fortress `-3 caravan member killed` for each of the four deaths, the Gloam's and the guards' alike, on top of `-10 caravan lost` for the merchant; with ten `-2 offered wood` lines from the same visit the Wildwood stood at −36, and at +5 a year they will not be friendly for seven years (`19-civ-wildwood.png`, `35-y3-wildwood-rep.png`).

20 § Movement step 5 says a guard's arrow through a comrade "is not an attack and changes nothing", and T-517 made it so for the attack (`src/systems/trade/index.ts`: `if (members.includes(attacker)) return;`). The death is not covered: the `CreatureDied` case charges `REP_OTHER_KILL` to every killer that is not a fortress creature, the caravan's own guards included.

The log's ten `-2 offered wood (Y1 Au 10)` lines, one per wooden item, fill the panel's log so that the deaths and the year's drift are pushed below it.

## What to do

Decisions:

- **A caravan member killed by another member of the same caravan costs no reputation** (no `caravan_member_killed`); `caravan_lost` (−10, a merchant's death) stays "whoever killed the merchant", as `caravan-goods.md` § Reputation events says. The killer is the event's `killerId` (a projectile's shooter, 16).
- **The reputation log folds changes of one reason on one day into one line with the total and the count**: `-20 offered wood ×10 (Y1 Au 10)`, `-9 caravan member killed ×3 (Y1 Au 12)`. The saved history keeps every change; only the panel folds.

Spec: 20 § Movement step 5 (the death), `03-content/caravan-goods.md` § Reputation events (the −3 row: "by hostiles or animals", not by its own), `ui-screens/panels.md` § Civilizations (the log's fold).

## Done

- [ ] Tests (`describe` with the task id): a bearer killed by its caravan's guard changes no reputation; one killed by a gloam archer costs 3; a merchant killed by its own guard still costs the 10 of a lost caravan; ten wooden items offered on one day are one log line `-20 offered wood ×10`.
- [ ] World hashes: reputation is state; the commit says which scenario hashes moved (a Wildwood caravan attacked with friendly fire) and why.
