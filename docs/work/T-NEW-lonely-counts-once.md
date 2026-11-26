# T-NEW — Lonely counts once: confirm the sweep's deaths and adopt

**Source:** T-763 ([report](../../reports/audits/2026-11-25-t763-first-week-misery.md), § The sweep, and the decision) · **Size:** S · **Needs:** — · **Status:** open

## Why

T-763 measured that 15's promise ("only neglect takes a dwarf below 20"; "a fortress without chairs or a meeting area is gloomier, not miserable") is broken in a busy first week: a dwarf at work takes no social errand, a meeting area does not change that, and `lonely` (−10 for a gregarious dwarf, −13 if also sensitive) counts twice. Three-quarters of the miserable dwarf-hours of days 1–4 were lonely-made, and the playtest's Ulfar Ironfist line on Spring 2 reproduces. Counting `lonely` once cut the misery of days 1–4 from 111 dwarf-hours to 24 over 40 timelines and left mean moods where they were.

Its sweep (45717560405, commit `c9b55c27`) passed its bounds at 1161.75 living, but pooled 129 deaths against master's latest of about 110 (shifts 104, 156, 114, 142), above T-763's bar of about 118, so it was not merged.

## What to do

Decision, made: `lonely` counts once, as a standing negative, and is not need pressure. The change is the `src`, `docs` and `test/unit` part of `c9b55c27` on branch `t763-first-week-misery`: `NEED_PRESSURE_THOUGHTS` without `lonely` (`src/systems/morale/standing.ts`), 15 § Mood and § Interaction with 10 needs, `balance.md` § Mood floor, `morale.test.ts`'s expectation, and `test/unit/morale/t763-lonely-once.test.ts`.

1. Cherry-pick it onto master and run the sweep twice more. Adopt it if the three sweeps pool at living ≥ about 1140 and deaths ≤ about 118.
2. If the deaths stay high, compare its sweep's per-seed deaths with master's at the same shifts before blaming the rule: no rule in it touches fighting. If a cause is found, record it here; otherwise close with a note that the design stands.

## Done

- [ ] Sweeps with their run ids and pooled rows in the commit body.
- [ ] The change merged with its spec edits and tests, or a note that the design stands, with the reason.
