# T-763: a busy first fortnight and its moods

**Task:** T-763 · **Date:** 2026-11-25 · **Code:** master `a2713f8d`; the rule change on branch `t763-first-week-misery` (`c9b55c27`) · **Source:** [the T-763 work file](../../docs/work/T-763-busy-first-week-misery.md), [the newcomer playtest](../data/2026-11-25-playtest-5.md) finding 6

## How

`test/perf/t763_first_week_probe.test.ts` plays the first 14 days of the default embark: the standard world of the seed, the embarkable region nearest its centre (where the world map's cursor starts), the Balanced preset. Before the first tick it gives a newcomer's orders: a stair shaft four levels down beside the wagon and a 5 × 5 room at its foot, a chop box on the twelve nearest trees, a carpenter's workshop with a global order for four beds, a 4 × 4 stockpile taking everything, and a 4 × 4 turnip plot where the ground allows one. The variant `meeting` also zones a 3 × 3 meeting area by the wagon. Each hour it records every dwarf's mood, tier, thoughts and social need, and the mood the same thoughts would give if `lonely` counted once (a negative, not need pressure). A miserable hour is *lonely-made* when that mood is 20 or more.

Seeds `deep-5589-1` (the playtest's world: the same site, Ulfar Ironfist among the party), `probe-2` … `probe-5`; each at shifts 0, 17, 331 and 613 ticks before the orders (four timelines a seed); both variants: 40 runs.

```
T763_PROBE=1 T763_SHIFTS=0,17,331,613 npx vitest run -c vitest.perf.config.ts test/perf/t763_first_week_probe.test.ts
```

## Found on master

| | busy (20 runs) | with a meeting area (20) |
|---|---|---|
| Runs with a dwarf Miserable by day 2 / 4 / 7 / 14 | 2 / 8 / 14 / 20 | 1 / 7 / 18 / 20 |
| Miserable share of dwarf-hours, days 1–4 | 0, 0.5, 1.1, 0.3% | 0, 0.5, 0.6, 0.3% |
| Miserable dwarf-hours, days 1–4 (lonely-made) | 65 (**49**) | 46 (**36**) |
| Miserable dwarf-hours, 14 days (lonely-made) | 876 (197) | 965 (330) |
| `lonely` held, share of dwarf-hours, days 1–4 | 30% | 28% |
| Talks a dwarf a day, days 1–4 | 1.3 | 1.4 |

The suspicion holds. In a busy fortress a dwarf with work takes no social errand (10 § Behavior selection, step 8), and with no hearth hall there is no hall errand, so talk comes only in passing. That is 1.3 talks a dwarf a day on average, about what social's rise needs, but unevenly: some dwarves reach social 80–100 by day 2. `lonely` then weighs −10 for a gregarious dwarf, −13 for a sensitive one, and counts twice. The first miserable dwarf of the first four days was lonely-made in 8 of the 40 timelines: Ulfar Ironfist (`deep-5589-1`, sensitive and gregarious, lonely −8.3, mood 18.9, 27.0 counted once), Dain Brighteye (`probe-4`, four timelines, lonely −10.4 to −13, as early as day 2, 15.3–19.2, 26.7–32.2 once), Oddvar Flintaxe, Yrsa Copperpick (twice) and Ketil Stonestone. A first run of `deep-5589-1` whose bed order was refused gave the playtest's line exactly: Ulfar Miserable on day 2 at mood 14.6 (27.6 counted once): lonely −13, slept outdoors −6, slept on the floor −2.4.

A meeting area zoned on day 1 does not help: a dwarf with work never goes to it. Three-quarters of the misery of days 1–4 is lonely-made, in both variants.

The other early misery is a dwarf whose thoughts have reached `NEGATIVE_CAP` (a restless, sensitive dwarf with nothing it may do: `restless` −10.4, `bored` −9.7, `uncomfortable` −5.2, `slept_outdoors` −6) sitting on the needs-met floor at 20, which gives way to any point of need pressure: an evening's tiredness (`probe-2`'s Ottar Darkpick, tired −7.8 on day 4 in five timelines) or thirst. From day 12 the embark's drink runs out (no still was ordered) and `thirsty` makes most of the misery (16.7% of dwarf-hours on day 14): neglect, as 15 means it.

## The decision

15 promises that only neglect takes a dwarf below 20, and that a fortress without chairs or a meeting area is gloomier, not miserable. A busy first week with no time to talk is not neglect: company is the dwarves' own errand, and the player cannot order it, only provide a place, which the measurement shows working dwarves do not use. Of the options in the work file, the smallest that keeps the promise is **`lonely` counts once**: a standing negative like `uncomfortable`, `restless` and `bored`, no longer need pressure. Talks in passing at work or the wagon as a meeting area would change behaviour and timing across the whole game, and a slower onset only delays the same line. 15 § Mood and § Interaction with 10 needs and `balance.md` § Mood floor now say so.

## After

The same 40 runs on the branch:

| | busy | with a meeting area |
|---|---|---|
| Runs with a dwarf Miserable by day 2 / 4 / 7 / 14 | 1 / 7 / 15 / 18 | 1 / 5 / 15 / 20 |
| Miserable dwarf-hours, days 1–4 (lonely-made) | 15 (2) | 9 (2) |
| Miserable dwarf-hours, 14 days (lonely-made) | 683 (21) | 623 (31) |
| Mean mood, days 1 / 4 / 7 / 14 | 52.7 / 43.7 / 38.3 / 30.5 (master 52.4 / 43.6 / 38.2 / 30.0) | 52.8 / 44.0 / 39.0 / 33.7 (52.5 / 43.8 / 38.8 / 33.3) |

Misery in the first four days falls from 111 dwarf-hours to 24, Ulfar is not Miserable in the first four days of any timeline, and mean moods barely move. A lonely dwarf is still gloomier: Dain Brighteye's −13 still counts among his negatives, and in four timelines an evening's tiredness on day 2 or 3 still takes him to 18–19.8 through the floor. That, and Ottar's and Knud's early lines, are the floor giving way to a point of ordinary need pressure, recorded as a follow-up rather than changed here (`docs/work/T-NEW-needs-met-floor-gives-way.md`).

## Seen in passing

`probe-5`'s default embark (alpine) loses most of its party in the first week: 144 light frost wounds on dwarves, then grievous cuts (amputations), and six to seven dwarves bleed out by day 7 in the busy runs; `probe-3`'s (alpine too) loses one. Recorded as `docs/work/T-NEW-alpine-embark-frostbite.md`.

The sweep of the rule change and its verdict are in the commit that closes T-763.
