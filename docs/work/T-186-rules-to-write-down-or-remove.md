# T-186 — Eighteen rules to write down or remove

**Source:** T-115 and its report, [`../../reports/audits/2026-10-09-bug-hunt-spec-reading.md`](../../reports/audits/2026-10-09-bug-hunt-spec-reading.md) ("Rules to write down or remove", G1 to G18) · **Size:** M · **Needs:** — · **Status:** open

## Why

Reading 11, 12, 13, 16, 18, 19 and 22 rule by rule found eighteen places where the spec is silent about something the code does, or says something the code does not do. Six of them are the root of a bug and are decided in that bug's task. The other twelve are decided here. After this task the seven documents describe the game as it is.

## Reproduction

Read, with the file and line for each in the report. G12 is also measured ([`thief.probe.ts`](../../reports/data/2026-10-09-bug-hunt-thief.probe.ts.txt)).

## What to do

**Decided in another task; nothing to do here:** G1 (T-180), G5 (T-182), G12 and the thief half of G13 (T-185), G14 (T-181), G17 (T-183), G18 (T-184).

**Decisions.** For each, "spec" means the document changes and the code stays; "code" means the code changes and the document stays.

1. **G2, 11 § Blocking and retry: `workshop_suspended`.** Spec. Remove the row: `SuspendWorkshop` and `SetWorkshopWorker` cancel the workshop's job (12 says so after this task) and the order waits. Add `SetLabor` to the triggers of `unreachable`. Remove the reason from `RETRY_TRIGGERS` and from the jobs panel's reason strings only if `strings:check` then reports them unused; the orders panel keeps its own "suspended" text.
2. **G3, 11 § Hauling: priority of `haul_to_dump` and `strip_corpse`.** Code. Both are hauling and run at `HAUL_PRIORITY`. Say so in 11 and pass the priority in `src/systems/items/hauling.ts`.
3. **G4, 12 § Events consumed.** Spec. List what 12 subscribes to (`BuildingCompleted`, `BuildingRemoved`, `JobCancelled`, `JobCompleted`, `SkillLevelUp`); say in § Operation that magma power and stock are read each tick, and in § Quality that 15 gives `masterwork_lost` on 13's `ItemDestroyed`.
4. **G6, 12 § Work orders: "the least busy" workshop.** Spec. A global order goes to the first idle workshop of the type, in entity order. An idle workshop is the least busy one, and the order is deterministic.
5. **G7, 12: a dead assigned worker.** Code. On `CreatureDied` of a workshop's assigned worker the restriction is cleared (`assignedWorker` 0) and the workshop's job, if any, is cancelled as `SetWorkshopWorker { dwarfId: 0 }` would. Add the rule to 12 § Operation and `CreatureDied` to its events consumed. A workshop that silently makes nothing is the worse outcome.
6. **G8, 13 § Stock counts: `available`.** Code and spec. `available` is "not forbidden, not reserved, not owned, not carried by a creature, and for a cage not occupied". A `maintain` order for picks then counts the picks nobody holds, which is what a player who writes "keep 2 picks" means. The occupied cage is T-181's; the carried item is this task's (`isAvailable` in `src/systems/items/counts.ts` and `countAvailable` in `search.ts`).
7. **G9, 16 § Squads: `train` and "on duty".** Spec. Write down what the code does: a member of a squad in `train` or `active` mode is on duty; one in `off` mode is on duty only under a `watchful` or `hearth` alert. Being on duty means: no flight, the military title, no interruption by the hearth alert, and attacking a visible hostile within perception.
8. **G10, 16 § Melee resolution: the missing terms.** Spec. Add to the formula block, with a pointer to the owner of each number: Toughness (17), natural armor and the war-animal point (08), the buckler's block chance and the launcher as a club (`weapons-and-armor.md`), clothing as a `padding` layer of armor value 1.
9. **G11, 16: when an order ends, and the level limit.** Spec for the level limit (a target more than two levels away is out of perception). Code for the orders: a new `station`, `patrol` or `follow` order replaces the standing one of those three instead of queueing behind it; `kill` orders queue and are done in order. Rewrite the sentence "Orders are executed in order" to say this.
10. **G13, 18 § Party AI, the three that remain.** Spec: a member that fled and left the map counts toward `RETREAT_LOSS_PERCENT`; the restless dead attack fortress creatures. Code: an ambush targets the nearest *dwarf* outdoors (C16 of the report; an ambush that walks to a grazing cow is not an ambush).
11. **G15, 19 § War animals: line of sight for a chained animal.** Code. Use the same test as 18 § Stealth (`SPOT_RADIUS_DOG` and line of sight); the chain adds nothing to what a dog can see.
12. **G16, 19 § Trap kinds: `clean_trap` and corpses.** Code. The job leaves corpses alone and only unjams: a corpse on any tile is already hauled to a refuse stockpile or a coffin by 13 and 14. Rewrite the table cell to "`clean_trap` job (labor `cleaning`) unjams". Marking a dead dwarf for the dump was never intended.

Tests, `describe('T-186 …')`, one for each "code" decision (items 2, 5, 6, 9, 10, 11, 12). `interface:check` must pass after items 1 and 3.

## Done

- The seven documents are amended and the tests pass.
