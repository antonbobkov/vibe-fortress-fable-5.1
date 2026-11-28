# T-814 — Master's deaths drifted from 108.5 to 121.75 across T-795 and T-798, each just inside the bar

**Source:** the master sweeps after [T-796](../archive/tasks/T-796-threat-needs-a-path.md) and [T-798](../archive/tasks/T-798-glowcap-has-a-source.md) · **Size:** M · **Needs:** — · **Status:** open

## Why

Each rule change is adopted when its own paired sweep stays within about 8 deaths of its base. Two changes merged in a row each came in just under that:

| Master commit | What it adds | Sweep run | Living | Deaths |
|---|---|---|---|---|
| `9a13599a` | T-796/T-797/T-801 | 45911220303 | 1139.75 | 108.5 |
| `7f37335f` | T-795 tomb keeps coffins ready (paired +7.75 deaths, −16.5 living) | — | — | — |
| `1ebabe1d` | T-798..T-800 (own sweep +7 deaths on an older base) | 45959693912 | 1093.75 | 121.75 |

So master is now about 13 deaths and 46 living worse than two merges ago, still inside the bounds (≥ 1046.63, ≤ 132.5) but drifting toward them. Shift 0 is 997 living. The p2-4 shift 150 job failure in that run is the dig invariant fixed in T-811 (test only).

## What to do

1. Sweep `7f37335f` (T-795 merged, before T-798) on a temporary branch, so each step is paired: 9a13599a → 7f37335f → 1ebabe1d.
2. For the step that costs most, split it by rule. T-798..T-800's rules: the glowcap request roll, the caravan stay pausing during raids, the Broker's stand-in trader, the re-queued trade job. T-795: the tomb's coffins-ready order. Sweep each rule off, paired with its base, using local seed runs first to narrow it.
3. Back out the rule or rules that carry the deaths, keeping their UI. Record the figures here and in the rule's archived work file.

Target: master back within about 8 deaths of 108.5, or a recorded reason why the cost is worth it.

## Decided while doing it

- **The paired steps: T-795 cost nothing, T-798..T-800 carry the +12.25, as timelines parting.** `7f37335f` swept on `t814-tmp-7f37` (run 46103268570): living 1157.25, deaths 109.5. Paired by seed and shift, with the noise of the pooled difference (the standard deviation of the 80 seed-shift differences × √80 / 4):

  | Step | Timelines moved | Deaths up / down / equal | Pooled deaths | Pooled living |
  |---|---|---|---|---|
  | `9a13599a` → `7f37335f` (T-795) | 34 of 80 | 13 / 11 / 56 | +1.0 (± 5.6) | +17.5 (± 9.1) |
  | `7f37335f` → `1ebabe1d` (T-798..T-800) | 80 of 80 | 23 / 19 / 38 | +12.25 (± 9.3) | −63.5 (± 24.2) |

  T-798..T-800 moves every timeline (a stand-in trader goes whenever a Broker sleeps through a caravan, at peril 0 too), and its seed-shifts rise and fall almost evenly: the pooled +12.25 is a few large swings at peril 4 (+8.5 of it; peril 2 +4.25, peril 0 −0.5), 1.3 times its noise.
- **The glowcap roll and the retry are not in the scripted worlds.** The scripts request no extra good, and their requests (seed: dimcap, pale_bell, sweetroot; bar: iron) find the same entries as before, so their draws are unchanged. The retry never fired in the 12 local runs that had it on and logged it. That leaves the raid pause and the stand-in trader.
- **Local narrowing, on `1ebabe1d` with each rule switched by an environment flag (not committed).** With all four rules off the runs reproduced `9a13599a` exactly (p4-3 at shift 100: 6 deaths, 35 living, the same meals), and with all on `1ebabe1d` (21, 25). Of the eight seed-shifts that rose most (by +8 to +15), the pause off took back 3 to 12 deaths in five, added 3 in one (p4-2 at 50) and left two unchanged to the tick (p2-1 and p4-1 at shift 150, which kept their rise); each rule alone also moved them (p4-3 at 100: coffins alone 12, pause alone 8, stand-in alone 7, against 6 and 21). Seeds picked for having risen most fall back under any change that moves their timeline, so this named suspects and decided nothing.
- **What the dead were doing.** A probe (`t814-tmp-probe`, test code only, never merged; its runs reproduce the unprobed ones) notes, for each dwarf killed, what it was doing when first hit that day, and where the caravan stood. In p4-3 at shift 100 the rule's 15 deaths of day 191 came 7.2 to 7.7 days into an 11.3-day stay that a siege had paused for 6.3 days; in the base the same siege met the same caravan, which left on day 189 with one dwarf dead. But the 15 died to an ambush of 7 in the halls (the base had none), hit while fleeing, eating or at their posts; none was trading, hauling to the depot or near the caravan. Over the whole sweep of the current master with the probe (465 dwarf deaths), none was doing trade, depot or coffin work when first hit; 50 were hit while a caravan stood at the depot, 8 of them after the fifth day of its stay.
- **Each rule off, swept on the current master `ddbff0d0` and paired with it** (the base swept with the probe, `t814-tmp-probe`, run 46111413549: living 1143.5, deaths 117.25):

  | Configuration | Run | Living | Deaths | Paired deaths | Paired living |
  |---|---|---|---|---|---|
  | No raid pause (`t814-tmp-nopause`) | 46112657410 | 1157 | 119.5 | +2.25 (± 8.9) | +13.5 (± 16.4) |
  | No stand-in trader (`t814-tmp-nostandin`) | 46117162437 | 1113.5 | 134.5 | +17.25 (± 10.8) | −30 (± 18.9) |

  Neither rule carries the deaths. The pause off leaves them where they are; the stand-in off moves 79 of the 80 timelines and its deaths rise (in 31 seed-shifts, fall in 22), over the bound, a swing of the size T-798..T-800's own +12.25 was but the other way. So no rule is backed out. Master is at 117.25, 8.75 over 108.5 and 15.25 inside the bound (≤ 132.5); its living (1143.5) is 3.75 above `9a13599a`'s.
- **Why the drift is kept.** No rule has a cost that a paired sweep can see, and the trace finds no death that the rules' work puts in danger, as T-795's trace found. The eight-death allowance for a merge is below the noise of one paired sweep when every timeline moves (± 9 to 11 deaths), so changes that each move every timeline can drift master in either direction without any of them costing; the verdict's bound from the best figures (deaths ≤ best + 30) is what holds master. A follow-up proposes judging a merge by its paired seed-shifts and watching master's drift against a fixed reference: `docs/work/T-NEW-sweep-drift-check.md`.

## Done

- [x] The paired steps measured: T-795 +1.0, T-798..T-800 +12.25, a timeline effect with no costly rule.
- [x] The cost justified: the raid pause and the stand-in each swept off on master and paired; neither takes deaths back, so both stay; master re-swept (117.25 deaths, 1143.5 living).
