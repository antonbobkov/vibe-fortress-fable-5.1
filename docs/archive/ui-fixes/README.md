# UI fixes (post-release, from the UI audit)

**Source:** [`reports/ui-audit.md`](../../../reports/audits/ui-audit.md), a hands-on audit of v1.0.0 (2026-10-04). **Owner instruction (2026-10-04):** "Proceed with the recommendations." The owner wants a clean, intuitive UI, repetitive tasks that are easy, and a clear message wherever something cannot be done. Every decision below was made by the parent under the owner's standing instruction to use judgement. Agents implement these decisions; they do not design.

The plan's ground rules ([`../build-plan/README.md`](../build-plan/README.md), [`../../process/agent-workflow.md`](../../process/agent-workflow.md)) apply, with one addition, as for [`../fixes/`](../fixes/README.md). A task below **may edit `docs/00-`…`docs/04-` exactly where its "Spec" line says**, to write the decided behaviour into the spec in the spec's own style. The edit must be minimal, must not touch unrelated text, and must be listed in the commit body.

Cite the audit's ids (Q1…, M1…, S1…, §4.x) in commits and tests. Tag tests `U-0n`. Render goldens will move: regenerate them in the same commit with a `golden:` paragraph naming the screens and why. Never loosen a test to make a commit green.

## Decisions

- **D-U1. Paused input takes effect at once (S2, M1).** While the host is paused, the host runs the command phase for the queued commands immediately. It is the same code as the start-of-tick command phase, stamped with the next tick's number, and nothing else of the tick runs. Determinism holds, because no system runs between "now" and the next tick's command phase. Designations, placements and zones then appear while paused, and rejections are reported at once.
- **D-U2. Panel hotkeys always win (S4, M3).** The global panel letters shown in the status bar and help (Designate, Build, Zones, Look, Units, Jobs, Stocks, Military, Labors, Orders and the rest of `ui-keymap-and-screens.md` § Panels) always open or close their panel, whatever panel is open. A panel's own accelerators may not use those letters. Colliding accelerators move to `Shift`+letter, shown as `[S-m]` in the panel. Every destructive single-key action asks for confirmation through the existing confirmation dialog, defaulting to **No**: melt, dump, slaughter, suspend, deconstruct/take apart, disband, remove. Pressing an open panel's own key still closes it.
- **D-U3. Embark opens with Balanced applied (S1, Q1).** If the party has no pick, or no food or no drink, `Enter` shows a confirmation: "Embark without a pick?" or "…without food or drink?", default **No**.
- **D-U4. Every failure says what and why (S7, S8, Q3–Q6, §4).**
  - Rejections go to the log as an `alert`, with the command's focus tile, as well as to the status row (shown for 4 s).
  - Every reject reason and job/workshop block reason has a player-facing string that names the thing. Block reasons name the missing item and the count, and say where to get it when one workshop makes it ("waiting: 1 door — order at a carpenter's workshop").
  - The 33 `precondition_failed` and the frequent `not_found` sites get specific strings where the site knows the cause.
  - UI-layer no-ops (§4.2) get a status message.
  - No raw content id, entity id, reason code or action id ever reaches the screen (§4.5, Q3). Use content names and ordinals ("Carpenter's workshop #1"), and the help wording for actions.
- **D-U5. Work orders have a quantity (S3, M2, Q2).**
  - **Adding an order** opens a picker with:
    - a type-ahead filter;
    - recipes grouped by output category, with "recent" first;
    - quantity (digits, `+`/`-` ±1, `Shift` ±10);
    - a mode toggle `once N` / `keep ≥ N`;
    - a material filter;
    - for a global order, the workshop.
  - **In the order list**, `+`/`-` change the selected order's count (`remaining`, or the threshold in keep mode), and `n` adds a new order. `[r]` repeats the selected or last finished order. Each order shows its status ("waiting for stone (0)", "no carpenter's workshop", "in progress", "done").
- **D-U6. Placing many buildings is one gesture (S9, M6).** For 1×1 buildings and constructions, a drag places one per valid tile in the rectangle, and the status bar shows the count. When the input is out of stock, the status bar says "0 doors in stock: N will wait · [o] order N", and `o` opens the order picker preset to that item and count.
- **D-U7. Truncation: tooltips, as the spec says (M8).** Hovering a truncated cell shows its full text. Build-list rows put the name first and the shortened inputs after it (§2 Workshop). The sidebar stays 36 columns.
- **D-U8. Hostile counter (S6, Q8).** `!n` counts hostiles on discovered tiles, plus those spotted, and matches the Threats panel's "Active".
- **D-U9. Confirmation defaults are always the safe option (S5).** `c_remove_stockpile_items` defaults to **No**.
- **D-U10. Colours never carry information alone (M12).**
  - The palette test checks a minimum perceptual distance (CIEDE2000 ΔE ≥ 15) between side-by-side state pairs, adding `hostile`/`dwarf_wounded` and `text_key`/`alert`, in both palettes.
  - Ghosts get brighter backgrounds and a glyph difference (OK `▒`, blocked `x`).
  - Recipe makeability uses a CP437 glyph (`•` makeable, `○` not).
  - Missing glyphs (●, ★, newline) get aliases.

## Tasks

| Id | Title | Audit items | Size | Needs |
|---|---|---|---|---|
| U-01 | Quick wins: embark default, honest messages, dead hints, small key fixes | D-U3, D-U4 (strings, log, no-ops), D-U8, D-U9, Q1, Q3–Q14 except Q2 | L | — |
| U-02 | Paused input takes effect at once | D-U1, M1, S2 | M | — |
| U-03 | Work orders with quantity; panel hotkeys always win | D-U5, D-U2, M2, M3, Q2, S3, S4 | M | U-01 |
| U-04 | Drag to place many; out-of-stock prompt | D-U6, M6, S9 | M | U-03 |
| U-05 | Building panel: door/hatch modes, lever links, plates, traps, cages, owners, coffins, priority | M4, §5.4 | M | U-01 |
| U-06 | Labor manager, unit and squad multi-select, titles and renames, barracks and leader | M5, M10, M11 | M | U-01 |
| U-07 | Stockpile editor with keyboard; room panel names missing requirements and owner | M7, M9 | M | U-01 |
| U-08 | Tooltips, palette distances, ghosts and glyphs | D-U7, D-U10, M8, M12 | M | U-01 |

U-02 touches the host and core command phase. The rest are in `src/ui`, `src/app` and strings.

When all eight are done, add a short `reports/ui-audit.md` follow-up table (audit item → task → commit). Then re-run the hands-on walkthrough of § 2 and record what changed.
