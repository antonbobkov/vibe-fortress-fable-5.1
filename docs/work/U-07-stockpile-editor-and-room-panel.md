# U-07 — Stockpile editor with keyboard; room panel

**Source:** [`../../reports/audits/ui-audit.md`](../../reports/audits/ui-audit.md) M7, M9, § 3 "Configure a stockpile" and "Designate several rooms", § 4.4 · **Size:** M · **Needs:** — (U-01, which it needed, is done) · **Status:** open

Split out of [`../archive/ui-fixes/README.md`](../archive/ui-fixes/README.md), which holds the full list of UI decisions and the closed tasks. Its task row reads: "Stockpile editor with keyboard; room panel names missing requirements and owner". The decisions below are copied from it word for word and are final: implement them, do not redesign them.

## Decisions

No decision was written for this task alone: the audit's M7 and M9 define it. These standing decisions bind every panel, so they bind this one:

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
| M7 | Stockpile editor with keyboard: preset dropdown, tree navigation, editable containers, priority, quality and materials | `panels/zones.ts`; `13` § Player-facing behavior | M |
| M9 | Room panel: say which requirement is missing, highlight open border tiles, `[o] owner` | `panels/zones.ts:257-277`; `14` § Rooms | S–M |

From the audit's § 3, word for word:

| Task | Today: inputs and screens | What happens | Recommended interaction | Spec / file it touches |
|---|---|---|---|---|
| **Designate several rooms** | `z` `b`, one drag per room (the tool stays active) | Good. But you cannot assign owners, and a rejected drag is silent | Keep the drag. Add `[o] owner` (cycle or pick list) to the room panel, and a status line when 0 tiles qualify | `panels.md` § Zones; `14` `AssignRoom` |
| **Configure a stockpile** | Click `Preset [ ]` up to 12 times. Tree clicks only. Material, quality, containers and priority are display-only | Mouse-only and slow | A real dropdown (`p` opens it, letters jump), arrow keys plus `Space` in the tree, editable container and priority fields | `panels.md` § Zones (stockpile); `zones.ts` |

From the audit's § 4.4, word for word:

| State | Today | Should say |
|---|---|---|
| Room requirements | `Requirements not met` | "Needs a bed" / "needs a table with a chair" |
| Not enclosed | `Not enclosed` | "Not enclosed: 3 open border tiles" (and highlight them) |
| Stockpile full | log note `A stockpile is full.` | "Stockpile #2 (Wood) is full" with focus on it |

Commands this task gives a UI: `SetStockpileContainers` and `AssignRoom` (both are on the audit's § 5.4 list of commands the UI never emits). The accelerator letters must respect D-U2. The audit suggests `p` for the preset dropdown and `o` for the owner, but `p` is the Population panel and `o` is the Orders panel, so neither may be used bare: use `Shift`+letter, shown as `[S-p]` and `[S-o]`.

## Spec to edit

`02-systems/13-items-and-storage.md` § Player-facing behavior, `02-systems/14-buildings-and-rooms.md` § Rooms and quality and § Player-facing behavior, `04-implementation/ui-screens/panels.md` § Zones, and `03-content/ui-keymap-and-screens.md` for the keys. Write the behaviour as plain spec text, in each document's own style.

## Rules for every UI task

- Cite the audit's ids (M7, M9, § 4.4) in commits and tests. Tag tests `U-07`.
- Render goldens will move. Regenerate them in the same commit, with a `golden:` paragraph that names the screens and why.
- Never loosen a test to make a commit green.

## Done

- A stockpile can be configured from the keyboard alone: preset, tree, containers, priority, quality and materials.
- The room panel names the missing requirement, counts and highlights open border tiles, and sets the owner.
- The verification commands of [`../process/agent-workflow.md`](../process/agent-workflow.md) are green, with `npm run test:e2e`.
- Closed as the workflow says: the spec edits are in the commit body, this file moves to `docs/archive/tasks/`, and the row leaves [`../backlog.md`](../backlog.md).
