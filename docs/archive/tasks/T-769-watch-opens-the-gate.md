# T-769 — Hearth to Watch opens every Lock on alert door, and nothing says so

**Closed:** 2026-11-25, in fe17aff0, 71f394d9.

**Source:** playtest 2026-11-25 (military) ([report](../../../reports/data/2026-11-25-playtest-6.md), finding 2) · **Size:** S · **Needs:** — · **Status:** open

## Why

Day 20 of Autumn, Year 1, `playtest-1125-p3m` (peril 3, 13 dwarves), the eve of a Gloam raid of 11, with the alert at Hearth and the gate's four `lock_on_alert` doors locked. I wanted the Gate Guard out at a station north of the gate, which it could not reach (finding 3). The Military panel offers three alerts: "Calm: everyone works.", "Watch: squads stand to; civilians work." and "Hearth: civilians stop work and shelter in the hall or behind a door; Lock on alert doors shut." Watch reads as "the squad goes, the rest stays as it is". I pressed `[2]`.

Every `lock_on_alert` door opened at once (`alertLocked` false on all six). The civilians went back to work, and the soldiers went to eat and drink first (they had been shut in the gatehouse, finding 3). The raid arrived 650 ticks later and walked down the open stair: at the moment I raised Hearth again, one raider stood in the hall and six were in the stair shaft (`09-raid-in-gate-under-watch.png`). The civilians then "sheltered" in the hall among them. All 13 dwarves were dead 2,100 ticks later, and the legend opened (`08-fall-legend.png`).

The rule that did it is 14's door mode, "`lock_on_alert` (locks while the alert is `hearth`…)", and `onAlertChanged` in `src/systems/buildings/build.ts` clears the lock whenever the alert leaves `hearth`. 19 § Hearth alert retreat says something else: "When the alert returns to `calm`, the alert lock clears". Neither the Watch line, the alert keys nor the log says that Watch opens the gate.

Reproduce: load the d76 save (in the report), press `[m]` `[2]` and read the doors' `settings.alertLocked` (all false), then step 1,250 ticks and list the hostiles on z 26 to 32.

## What to do

Decisions (the orchestrator's brief reversed the first one before the work began: the spec's rule wins over the code's):

- **The lock holds through Watch and clears only at Calm**, as 19 § Hearth alert retreat already said. Hearth → Watch keeps every door the alert has locked shut, takes no new lock and starts no grace; Watch → Hearth keeps them shut (raising the alert never opens the gate, not for a tick); only Calm opens them. Watch reads as "stand to, doors shut", Calm as "all clear". 14 § Doors and 16 § Alerts now say the same; `FortressShutOut`'s line says to set the alert back to Calm only.
- **The alert lines say what the doors do**, only while the fortress has a built `lock_on_alert` door (without one they read as before): "Calm: everyone works; Lock on alert doors stay open." (the squad list comes before the clause), "Watch: squads stand to; civilians work; Lock on alert doors stay open.", and while the lock holds under Watch "Watch: squads stand to; civilians work; Lock on alert doors stay locked until Calm [1].". The Hearth line reads "…; Lock on alert doors shut until Calm." The door panel's locked line reads "Locked now: it opens when the alert is Calm.", and the mode's help adds "until the alert is Calm".
- **The log says both changes**, as notes: 14 emits `AlertLocksHeld` when Hearth → Watch keeps some door locked ("The Lock on alert doors stay locked under Watch: [m] [1] Calm opens them.") and `AlertLocksCleared` when Calm opens some ("The Lock on alert doors are open: the alert is Calm.").
- **No confirmation here.** With Watch no longer opening the gate, the only lowering that opens it is to Calm, and the confirmation on lowering the alert with a party on the map is T-768's.
- **Follow-up, not done here:** T-745's shut-in line and the Military panel's Thirsty/Hungry lines count sheltering civilians under Hearth only; under Watch with the lock held, civilians at work behind the doors can be cut off from drink without that line ([T-780-shut-in-under-watch](T-780-shut-in-under-watch.md)).

Spec: 14 § Doors and hatches, § Interfaces, § Registrations; 19 § Hearth alert retreat; 16 § Alerts; `ui-screens/panels.md` § Military and § Building (door); `event-catalog.md`.

## Done

- [x] Tests (`test/unit/ui/t769-watch-keeps-the-gate.test.ts`): Hearth → Watch keeps the door locked and impassable, logs the held note once and the Watch line says "stay locked until Calm [1]"; Watch → Calm opens it and logs the cleared note; Watch → Hearth keeps it locked on every tick; Calm → Watch locks nothing and says nothing; a door still in its grace when the alert drops to Watch stays open, with no note; without a `lock_on_alert` door the lines read as before.
- [x] The simulation changes only where an alert goes from Hearth to Watch, or Hearth is raised again over a held lock: no golden world hash moved; the sweep and the defence seeds were run on GitHub (the commit says the verdicts).
