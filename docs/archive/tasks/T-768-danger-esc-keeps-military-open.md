# T-768 — After a danger line, "Esc, then a letter" lands in the Military panel and drops the alert

**Closed:** 2026-11-25, in bc06feca,b5ecf88e.

**Source:** playtest 2026-11-25 (military) ([report](../../../reports/data/2026-11-25-playtest-6.md), finding 1) · **Size:** S · **Needs:** — · **Status:** open

## Why

Three times in one session a key meant for another panel changed the alert or a squad's mode in the middle of a fight:

- **Siege, Spring 6, Year 3** (`playtest-1125-p3m`, 38 dwarves, peril 3). The Military panel was open with the alert at Hearth. The siege of 30 arrived ("!! A Gloam siege has come from the north!"). I pressed `Esc` `a` `1` to read the log's All tab. The Military panel stayed open, the status row said "Gate Guard is full (6 members).", and the alert was **Calm** with 30 Gloam at the gate (`14-calm-mid-siege.png`).
- **Ambush, Spring 18, Year 3.** Military open on Calm; the ambush sprang. `Esc` `a` `2` set the alert to **Watch**. A minute later `Esc` `t` (meaning Threats) set the Gate Guard to **Train** (`17-esc-eaten-by-danger.png`).

The cause is a rule doing what it says. 24 § Announcements: a `danger` line is pinned to the strip "until dismissed by any key", and `Esc` and `Space` "only dismiss". So the first `Esc` dismisses the line and the panel stays open. The next letter is the open panel's own (24: "The open panel's own letters come first"). In the Military panel `a` is add, `t` is Train, `o` Off, `v` Active, and `1`–`3` set the alert. The pinned line does not look modal: it is one red row among the log strip's rows. The game's own hint, "Inside a panel its own letters come first. Esc, then a letter, opens another panel.", came the same minute and teaches exactly the sequence that failed.

A danger line comes exactly when the Military panel is most likely to be open, and its keys are the ones that hurt most when pressed by mistake.

Reproduce: load the report's save (`stormvault-y1-raid-eve.bin`), press `m`, step to tick 91,210 (the raid arrives: "!! A Gloam raid has come from the north!"), then press `Esc` `t` (meaning Threats): the Military panel is still open and the Gate Guard's mode is Train. With a full squad, where `a` only says "Gate Guard is full", `Esc` `a` `1` sets Calm, as it did at the siege.

## What to do

Decisions:

- **`Esc` on a pinned danger line dismisses it and also does what `Esc` does, when a tool is armed or a panel is open**: it cancels the tool or closes the panel. With nothing open it only dismisses (no game menu), as now. `Space` keeps its rule (it only dismisses, so reading the line does not unpause).
- **Lowering the alert from Hearth while a hostile party is on the map or announced as coming (18's `threats.coming()`)** asks first, on the status row, default No: "Lower the alert with a Gloam siege of 30 at the gate? [y] yes [n] no". The same applies to Watch → Calm with a party on the map. Raising the alert never asks. The question names the party as the Threats panel's Active line names it.
- Nothing else changes in the Military panel's keys.

Spec: 24 § Announcements and the log (the `danger` paragraph), `03-content/ui-keymap-and-screens.md` § Fixed keys (the "Any key" row) and the Military context, `ui-screens/panels.md` § Military (the confirmation).

## Done

- [x] Tests (`describe` with the task id): with the Military panel open and a danger line pinned, `Esc` closes the panel and the line, and a following `a` opens the Log. With nothing open, `Esc` on a pinned line opens no game menu. Under Hearth with a raid on the map, `1` in the Military panel asks, `n` leaves Hearth, `y` lowers it; with no party, `1` lowers at once.
- [x] UI only: no world hash moves.

## As built

- The question is the game's modal `confirm` dialog (`c_lower_alert`, `c_lower_alert_coming`, default No; `y` lowers, `n`, `Esc` or `Enter` keep the alert), not a status-row prompt: every other destructive action already asks through it, it takes every key while open, so a stray `Esc` or letter can never answer Yes, and it needed no new key-capture mode in the fortress screen. The text leads with the Threats panel's own line: "Active: Gloam siege, 30, looting. Lower the alert to Calm?", "Coming: a Gloam siege from the north, in 2 days. Lower the alert to Watchful?". A click on a level in the panel asks the same.
- A party "on the map" is one the Threats panel's Active line shows (`visibleThreatParties`): an unspotted ambush or thief does not make the question appear and so does not give it away.
- Help gains two notes: the global one says what `Space` and `Esc` do on a pinned danger line; the Military one says when lowering the alert asks.
- Checked on the playtest's `stormvault-y1-raid-eve.bin`: with the Military panel open at the raid's arrival (tick 91,202), `Esc` `t` opened Threats and left every squad's mode; under Hearth `1` asked "Active: Gloam raid, 1, coming. Lower the alert to Calm?" and `n` kept Hearth.
