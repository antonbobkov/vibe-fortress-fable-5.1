# T-766 — Lonely counts once: confirm the sweep's deaths and adopt

**Source:** T-763 ([report](../../reports/audits/2026-11-25-t763-first-week-misery.md), § The sweep, and the decision) · **Size:** S · **Needs:** — · **Status:** open, not adopted after three sweeps (see § Measured)

## Why

T-763 measured that 15's promise ("only neglect takes a dwarf below 20"; "a fortress without chairs or a meeting area is gloomier, not miserable") is broken in a busy first week: a dwarf at work takes no social errand, a meeting area does not change that, and `lonely` (−10 for a gregarious dwarf, −13 if also sensitive) counts twice. Three-quarters of the miserable dwarf-hours of days 1–4 were lonely-made, and the playtest's Ulfar Ironfist line on Spring 2 reproduces. Counting `lonely` once cut the misery of days 1–4 from 111 dwarf-hours to 24 over 40 timelines and left mean moods where they were.

Its sweep (45717560405, commit `c9b55c27`) passed its bounds at 1161.75 living, but pooled 129 deaths against master's latest of about 110 (shifts 104, 156, 114, 142), above T-763's bar of about 118, so it was not merged.

## What to do

Decision, made: `lonely` counts once, as a standing negative, and is not need pressure. The change is the `src`, `docs` and `test/unit` part of `c9b55c27` on branch `t763-first-week-misery`: `NEED_PRESSURE_THOUGHTS` without `lonely` (`src/systems/morale/standing.ts`), 15 § Mood and § Interaction with 10 needs, `balance.md` § Mood floor, `morale.test.ts`'s expectation, and `test/unit/morale/t763-lonely-once.test.ts`.

1. Cherry-pick it onto master and run the sweep twice more. Adopt it if the three sweeps pool at living ≥ about 1140 and deaths ≤ about 118.
2. If the deaths stay high, compare its sweep's per-seed deaths with master's at the same shifts before blaming the rule: no rule in it touches fighting. If a cause is found, record it here; otherwise close with a note that the design stands.

## Measured (2026-11-25), and the decision

`c9b55c27` cherry-picked onto master `c73c3946` as `950a7094` (branch `t766-lonely-once`). Sweeps, living at year 3 / dwarf deaths, by shift 0, 50, 100, 150 and pooled:

| Run | Commit | Living | Deaths | Pooled |
|---|---|---|---|---|
| 45717560405 | `c9b55c27`, lonely once | 1193, 1149, 1153, 1152 | 104, 156, 114, 142 | 1161.75 / 129 |
| 45742223715 | `950a7094`, lonely once | the same | the same | 1161.75 / 129 |
| 45742236096 | `950a7094`, lonely once | the same | the same | 1161.75 / 129 |
| 45762710729 | `c73c3946`, master (the base) | 1175, 1159, 1169, 1174 | 108, 126, 110, 97 | 1169.25 / 110.25 |

Every verdict passes (bounds ≥ 1046.63 living, ≤ 132.5 deaths), every seed job is green, and the lonely-once runs flag dwarf deaths as worth tracing. The three lonely-once sweeps are identical seed for seed: the simulation is deterministic, so a sweep of the same commit repeats exactly and a second one is not a second sample. Their mean is 1161.75 living, 129 deaths. The base sweep was run to compare at the same shifts: it matches master's reference (45669441569, `b675279e`) exactly, so nothing on master since then moved the sweep, and the change alone moves deaths from 110.25 to 129.

By seed (deaths summed over the four shifts, lonely once minus master): peril 0 +1; peril 2 +6 (p2-3 +11); peril 4 +68, of which p4-3 is +40 (+31 at shift 50: 39 dead against 8, 38 of them to raiders; 21 raids against 24, the first four alike) and p4-2 +11. Single timelines swing −14 to +31 both ways. No rule in the change touches fighting: shifting moods shifts sulks, work and timing, and raids then land differently. So the rise may be the shuffle of a perturbation rather than a cost of the rule, but it is measured on paired code, and it is over the bar.

Defence check 45742248307 on `950a7094`: **pass**, raids turned back 7.13 of 8 (rule ≥ 5), a soldier killed 6.25 (≥ 4), dwarves killed by raids 0.63 a cadence.

The T-763 probe (`T763_PROBE=1 T763_SHIFTS=0,17,331,613`, 40 timelines) on `950a7094` repeats T-763's figures for `c9b55c27` exactly: miserable dwarf-hours of days 1–4 busy 15 (lonely-made 2), with a meeting area 9 (2), against master's 65 and 46; runs with a dwarf Miserable by day 4: 7 and 5 (master 8 and 7).

**Decision: not adopted.** The task's rule was to adopt if the three sweeps pooled deaths ≤ about 118 and living ≥ about 1140; living passes, deaths (129) do not. The rule change is taken back out; `lonely` stays need pressure, and 15 § Mood records the known first-week gap. T-766 stays open with these figures. Next step, if it is taken up again: re-sweep the change on a later master (a different timeline sample, since repeats of one commit are identical), or trace p4-3 at shift 50's raids before and after.

## Done

- [x] Sweeps with their run ids and pooled rows in the commit body.
- [x] The change merged with its spec edits and tests, or a note that the design stands, with the reason. (The design stands for now; reason above.)

**Note from T-767 (2026-11-25):** hunger, thirst and rest now lower the needs-met floor only past halfway to critical; `lonely` still lowers it in full, and after T-767 the restless, sensitive dwarves' remaining first-week Miserable hours are mostly a point or two of `lonely` (social about 58). A smaller step than counting `lonely` once is a margin for it too, from social 75 (T-767's probe rule `half+social`: 154 and 220 of master's 687 and 914 Miserable hours kept at 20, against 94 and 105 for the adopted rule; [report](../../reports/audits/2026-11-25-t767-needs-met-floor.md)). Any re-sweep of this task should be paired on a base that includes T-767.
