# T-413 — The medic cleans wounds that cannot be infected

**Closed:** 2026-10-21, in 8ab94f2.

**Source:** T-411, [a bandage keeps a wound clean](../../../reports/audits/2026-10-21-bandage-keeps-clean.md) · **Size:** S · **Needs:** — · **Status:** open

## Why

A wound that is bandaged or sutured is not rolled for infection (17 § Infection), but it still asks for `clean_wound` until it is `cleaned`. Each such cleaning fetches a bucket, fills it at a well and spends `TREAT_TICKS` of the medic's time, and prevents nothing. In the loaded ward of the T-411 measurement (one skill-5 medic, a serious cut every 400 ticks) the medic spends about half its time bandaging, and every cleaning of a bandaged wound comes after that wound's suture, days after the wound.

## To decide

Whether `clean_wound` is needed only for a wound that can still be infected (not bandaged, not sutured) or is infected, and what cleaning still gives a covered wound, if anything. Measure the loaded ward's medic time and the discharge and healing days before and after; the infection rule and its constants stay as they are.

## Done

- 17 § Patients and hospitals says which wounds ask for cleaning, pinned by a unit test.
- The loaded and the one-a-day wards (`reports/data/2026-10-21-wound-recovery.probe.ts.txt`) re-run with before and after rows in a new dated report; the annual wildlife instrument passes its guards.
