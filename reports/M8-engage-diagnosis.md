# T-M8-06 engage investigation

## Reproduction

The incident in `M8-mood-diagnosis.md` §15.4 is a code bug under
`16-combat.md` §Targeting, rather than a missing party timeout.

Replayed `runThreeYearsSeed('three-years-p2-1', 2)` with the pre-F-16 dwarf
brain and the pre-fix combat/party AI from `68b51f9`. This preserves the
ordinary fortress setup, simulation ticks and RNG streams. Diagnostic wrappers
only record calls and forward them unchanged. The original party #150995787,
Revna #16777277 at (36,0,32), and extinction on day 144 were reproduced.

The four warriors #16778097, #16778103, #16778111 and #16778119 alternate
between (26,6,32) and (27,6,32). At ticks 151015 and 151037, `memberThink`
clears their combat targets at (27,6,32) because LOS fails, although connectivity
says reachable and the target is nine tiles away, inside perception. The AI's
fallback walk toward the party goal sends them back to (26,6,32), where they
reacquire Revna. This replaces the combat path each cycle. The combat system's
target-loss routine is not what clears these targets. Party AI sees them again
each cycle and refreshes engage's `stateSince`.

## Controlled continuation

Saved the naturally reached encounter at tick 151200 through the normal save
container and resumed that same save for 3,200 ticks in two isolated Vite SSR
processes. Both retain the old civilian brain to exercise the original incident;
the second uses the corrected combat and party AI. No entity, map, RNG or
equipment mutation is made by the probe.

| Observation | Old combat/AI | Corrected combat/AI |
|---|---|---|
| Attacks against Revna through tick 154400 | 0 | 11 |
| First attack against Revna | None | 153399, archer |
| First melee by the four oscillating warriors | None | 153540, all four |
| Revna's death | None | 153672, bled out, killer #16778119 |
| Pursuit | Oscillation remains | Warriors close; Revna switches to the existing flee behavior and is eventually caught |

## Changes and regression coverage

Acquisition still requires visibility and, where required by F-13, reachability.
An acquired live fortress target remains valid behind a corner while inside
perception; combat owns its subsequent loss. Party fallback movement cannot
replace an active combat path while combat is evaluating unreachability. Each
member's actual movement class is used for reachability.

Small reproductions also exposed three failures of 16's stated attack rule:
an empty launcher suppressed pursuit, ranged fire took priority over adjacent
melee, and pending path retries reset the unreachable counter. Combat now applies
melee first, requires actual ammunition for ranged fire, checks perception before
either attack, and counts elapsed ticks since a failed path until a real movement
step or attack opportunity proves recovery. The failure start survives save/load.

`test/unit/combat/engage.test.ts`, tagged `T-M8-06 engage`, pins pursuit around
an occluding wall, empty-launcher melee pursuit, adjacent melee with ammunition,
perception loss with a loaded bow, and an actual large-creature path failure
through a walker-labelled door. The last case retains the target through 199
elapsed failure ticks and drops it on the 200th, with uninterrupted versus loaded
hash equality at every tick. No spec rule, constant, budget or engage timeout is
changed.
