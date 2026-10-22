# T-NEW — A discharged dwarf's care jobs outlive their need

**Source:** T-413, [the medic cleans only wounds that can be infected](../../reports/audits/2026-10-21-clean-exposed-wounds.md) · **Size:** S · **Needs:** — · **Status:** open

## Why

The health producer manages a dwarf's treatment jobs only while it is admitted, or while it has a saved failed request (17 § Patients and hospitals). A job made during admission and still open at discharge is not looked at again, and the medic works it whether or not a wound still needs it.

The clearest case is a light cut. In the T-413 one-a-day ward (skill-5 medic), each light cut clots 150 ticks after the wound (`CLOT_TICKS`), its dwarf is discharged at tick 152, and the `stop_bleeding` job made at admission is done anyway at a median 286 ticks. It consumes a unit of cloth and bandages nothing, because no wound bleeds any more. That is 18% of the medic's time in that ward. `diagnose` is also done after discharge. T-413 ends `clean_wound` jobs this way when no wound asks for cleaning; the other kinds are untouched.

## To decide

Whether every treatment job (`stop_bleeding`, `set_bone`, `suture`, `clean_wound`, `dress_burn`) ends when no wound of its dwarf still needs it, admitted or not, and whether `diagnose` and `give_crutch` should outlive discharge. Keep 17's rule that a failed treatment remains a request after discharge while its wound still needs it.

## Done

- 17 § Patients and hospitals says when a treatment job made during admission ends, pinned by a unit test (a light cut that clots before its bandage uses no cloth).
- The one-a-day and loaded wards (`reports/data/2026-10-21-wound-recovery.probe.ts.txt`) re-run with before and after rows of deaths, cloth used and medic time in a new dated report; the annual wildlife instrument passes its guards.
