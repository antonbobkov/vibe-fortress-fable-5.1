# T-736 — A repelled raid writes "We drove them off." once for every dwarf

**Closed:** 2026-11-25, in adadc279.

**Source:** playtest 2026-11-25 (mid game) ([report](../../../reports/data/2026-11-25-playtest-3.md), finding 3) · **Size:** S · **Needs:** — · **Status:** open

## Why

When the Gloam raid of Summer 12, Year 3 was driven off ("The Gloam raid was driven off: 7 raiders fled, 10 fell."), the log gave the next thirteen entries to "Alrik Hollowfell: "We drove them off."", "Vali Asheye: "We drove them off."", "Yngvar Craggate: …" and so on, one per living dwarf, between the deaths of that day (`37-d265-log.png`, `38-raid-lines.png`). In a fortress of 50 the line would come 50 times. `raid_repelled` and `hearth_lit` are given to everyone at once (`personality-and-thoughts.md`: "`RaidEnded` repelled or wiped (everyone)", "`HearthLit` (everyone)") and both are `announce: true`, so 15 emits a `ThoughtGained` per dwarf and the log writes `announce.thought` ("{dwarf}: "{thought}"") for each. The same-text merge (24 § Announcements and the log) does not fold them: each names another dwarf.

Reproduce: load `reports/data/2026-11-25-playtest-3/frostvault-y3-summer9.bin`, set the Hearth alert and every squad Active when the raid comes (about 3,650 ticks), and read the log at the raid's end; or any fortress that lights its hearth.

## What to do

Decisions:

- **`ThoughtGained` events of one `thoughtId` in the same tick make one line**: one dwarf reads as now; more read "13 dwarves: "We drove them off."", with the count of dwarves who gained it (`announce.thought_many`). Its focus is the first of them, its subject none.
- The rule is the announcer's, for every announced thought. Two dwarves are named, not counted ("Ketil Ironvein and Orm Ashbrow: "Had an argument.""), since an argument's pair is the point of its line; three or more are counted.

Spec: 24 § Announcements and the log (the merge), 15 § Registrations (`ThoughtGained`'s line).

## Done

- [x] Tests (`describe` with the task id, `test/unit/ui/t736-shared-thought.test.ts`): `raid_repelled` given to 13 dwarves in one tick makes one log line with the count, keyed `announce.thought_many`, the first dwarf's focus and no subject, keeping its place before a death of that tick; one dwarf makes the named line (`announce.thought`); an argument names both dwarves (`announce.thought_pair`); another thought or a later tick is a line of its own; `hearth_lit` in a fortress of 7 (a real hearth) makes one line.
- [x] `strings:check` passes. UI only: no world hash moves (`test/golden/world-hashes.test.ts` passes).
- [x] Spec: 15 § Registrations (`ThoughtGained`'s line), 24 § Announcements and the log (shared thoughts), `ui-keymap-and-screens.md` § Announcements (the keys).

Decisions taken while doing it:

- **The burst thoughts are `raid_repelled`, `hearth_lit` and `argued`.** The announced thoughts are those five and `made_masterwork` and `legendary`, which come to one dwarf; sulks are `SulkHappened` lines, not thoughts. The rule is the announcer's for every announced thought, so a thought later flagged `announce` that comes to many folds too.
- **A later event of the line returns no announcement** (as the bleeding-animal line does): the line changes in place, and its subject is cleared once it names two.
- **A first dwarf whose words merged into an identical earlier line of the day** (a second raid repelled that day in a fortress of one) leaves that line its own count less one, and the grown line is appended as a line of its own; otherwise the line keeps its place.
- **The new strings live in `src/ui/strings.ts`** beside `announce.thought`, not in the exported strings table.
