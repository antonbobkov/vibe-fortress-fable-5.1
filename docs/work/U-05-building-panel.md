# U-05 — Building panel

**Source:** [`../../reports/audits/ui-audit.md`](../../reports/audits/ui-audit.md) issue 5, M4, § 5.4 · **Size:** M · **Needs:** — (U-01, which it needed, is done) · **Status:** in progress on branch `ui-0405`

Split out of [`../archive/ui-fixes/README.md`](../archive/ui-fixes/README.md), which holds the full list of UI decisions and the closed tasks. Its task row reads: "Building panel: door/hatch modes, lever links, plates, traps, cages, owners, coffins, priority". The decisions below are copied from it word for word and are final: implement them, do not redesign them.

## Why

Many commands have no UI at all, yet the hints tell the player to use them: there is no way to set door modes (`hint_alert`), link levers (`hint_gate`), assign a bed or a coffin, or set a building's priority. `14` § Player-facing behavior already says that clicking a building opens its panel.

## Decisions

No decision was written for this task alone: the audit's M4 and § 5.4 define it. These standing decisions bind every panel, so they bind this one:

- **D-U2. Panel hotkeys always win (S4, M3).** The global panel letters shown in the status bar and help (Designate, Build, Zones, Look, Units, Jobs, Stocks, Military, Labors, Orders and the rest of `ui-keymap-and-screens.md` § Panels) always open or close their panel, whatever panel is open. A panel's own accelerators may not use those letters. Colliding accelerators move to `Shift`+letter, shown as `[S-m]` in the panel. Every destructive single-key action asks for confirmation through the existing confirmation dialog, defaulting to **No**: melt, dump, slaughter, suspend, deconstruct/take apart, disband, remove. Pressing an open panel's own key still closes it.
- **D-U4. Every failure says what and why (S7, S8, Q3–Q6, §4).**
  - Rejections go to the log as an `alert`, with the command's focus tile, as well as to the status row (shown for 4 s).
  - Every reject reason and job/workshop block reason has a player-facing string that names the thing. Block reasons name the missing item and the count, and say where to get it when one workshop makes it ("waiting: 1 door — order at a carpenter's workshop").
  - The 33 `precondition_failed` and the frequent `not_found` sites get specific strings where the site knows the cause.
  - UI-layer no-ops (§4.2) get a status message.
  - No raw content id, entity id, reason code or action id ever reaches the screen (§4.5, Q3). Use content names and ordinals ("Carpenter's workshop #1"), and the help wording for actions.
- **D-U7. Truncation: tooltips, as the spec says (M8).** Hovering a truncated cell shows its full text. Build-list rows put the name first and the shortened inputs after it (§2 Workshop). The sidebar stays 36 columns.
- **D-U9. Confirmation defaults are always the safe option (S5).** `c_remove_stockpile_items` defaults to **No**.

## Audit items

From the audit's § 6, word for word:

| # | Change | File / spec | Size |
|---|---|---|---|
| M4 | **Building panel**: door/hatch modes, lever link (pick a target on the map), plate trigger, trap mode, cage release, bed and room owner, coffin assignment, build priority | new `panels/building.ts`; `14` § Player-facing behavior ("Clicking a building opens its panel…") | M |

From the audit's § 5.4, word for word:

> Never emitted by the UI: `AssignRoom`, `AssignCoffin`, `AssignTitle`, `LinkMechanism`, `UnlinkMechanism` (code only), `SetDoorMode`, `SetHatchMode`, `SetPlateTrigger`, `SetTrapMode`, `ReleaseCage`/`ReleaseCaged`, `TameCaged`, `TrainAnimal`, `SetLaborPriority`, `SetBuildingPriority`, `SetDesignationPriority`, `SetSquadLeader`, `SetSchedule`, `RenameSquad`, `RenameFortress`, `SetStockpileContainers`, `DesignateHarvest`, plus `SetZoneSetting` (barracks squad). (Grep of `src/ui`, `src/app` against `command-catalog.md`.)
>
> The Look panel's lever section lists linked targets and `[Pull lever]`, but you cannot create a link.

Of that list, M4 names the commands a building panel issues: `SetDoorMode`, `SetHatchMode`, `LinkMechanism`, `UnlinkMechanism`, `SetPlateTrigger`, `SetTrapMode`, `ReleaseCage`/`ReleaseCaged`, `AssignCoffin`, `SetBuildingPriority`, and `AssignRoom` for the owner of a bed or room. U-06 (done) took the labor, squad, title and rename commands. U-07 takes `SetStockpileContainers`, and offers `AssignRoom` from the room panel as well.

## Spec to edit

`02-systems/14-buildings-and-rooms.md` § Player-facing behavior, `02-systems/19-defense-and-traps.md` § Player-facing behavior where it describes levers, plates, traps and cages, `04-implementation/ui-screens/panels.md` (a wireframe for the building panel), and `03-content/ui-keymap-and-screens.md` for the panel's keys. Write the behaviour as plain spec text, in each document's own style.

## Rules for every UI task

- Cite the audit's ids (M4, § 5.4) in commits and tests. Tag tests `U-05`.
- Render goldens will move. Regenerate them in the same commit, with a `golden:` paragraph that names the screens and why.
- Never loosen a test to make a commit green.

## Done

- Each command listed above can be issued from the building panel, with a test per command.
- The verification commands of [`../process/agent-workflow.md`](../process/agent-workflow.md) are green, with `npm run test:e2e`.
- Closed as the workflow says: the spec edits are in the commit body, this file moves to `docs/archive/tasks/`, and the row leaves [`../backlog.md`](../backlog.md). The branch was cut before `docs/05-plan/PROGRESS.md` was archived, so its tick there is replaced by these two steps when it merges.
