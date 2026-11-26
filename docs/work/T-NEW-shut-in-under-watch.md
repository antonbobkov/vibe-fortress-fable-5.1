# T-NEW — Under Watch with the Hearth lock still held, civilians cut off from drink get no shut-in line

**Source:** [T-769](T-769-watch-opens-the-gate.md) (the Hearth lock now holds through Watch) · **Size:** S · **Needs:** T-769 · **Status:** open

## Why

Since T-769 a `lock_on_alert` door the Hearth alert has locked stays locked when the alert is lowered to Watch, and opens only at Calm (19 § Hearth alert retreat). Under Watch the civilians work, on whichever side of the doors they stand. When the fortress's drink (or food) is on the other side, they reach critical thirst with nothing to serve it, as the sheltering dwarves of T-745 did.

T-745's shut-in rule (24 § Announcements and the log, Shut in; `src/ui/shut-in.ts`) counts only a sheltering civilian under a `hearth` alert that is still retreating. Under Watch nobody retreats, so neither the once-per-alert line ("The drink is outside the locked doors: … [m] [1] opens them; …") nor the Military panel's "Thirsty: N cannot reach drink behind the locked doors." shows. The day's "dying of thirst" line does, and the Watch line says the doors "stay locked until Calm [1]", but nothing joins the two.

## What to do

Decisions:

- **The shut-in rule also holds under a `watchful` alert while some door is alert-locked.** A civilian (not on duty, not unsheltered) at its critical thirst or hunger counts when the fortress stores some of it and none is on the dwarf's walker label, as now; under Watch the test of "still retreating" is replaced by "its brain found nothing to serve the need" (the same two-checks-in-a-row rule keeps a dwarf on its way to a well inside from counting). The line and the panel lines read as now; the line comes once per need per Watch (or Hearth) alert.
- No rule of the simulation changes.

Spec: 24 § Announcements and the log (Shut in), `ui-screens/panels.md` § Military (the Thirsty and Hungry lines), 19 § Hearth alert retreat.

## Done

- [ ] Tests (`describe` with the task id): the T-745 fortress with its drink outside the door, locked under Hearth and lowered to Watch, a civilian at critical thirst: the line shows once and the panel line shows; at Calm both go. With the lock not held (Calm → Watch) neither shows.
- [ ] UI only: no world hash moves.
