# T-765 — An alpine default embark loses its party to frostbite in the first week

**Source:** T-763 ([report](../../reports/audits/2026-11-25-t763-first-week-misery.md), § Seen in passing) · **Size:** M · **Needs:** — · **Status:** open

## Why

T-763's probe of the default embark (the region nearest the world's centre, Balanced preset) on seed `probe-5` (alpine, region 2080), with a newcomer's day-1 orders (a stair shaft and a room, a carpenter's workshop, a stockpile), lost six or seven of its seven dwarves by day 7 in the busy runs: 144 light frost wounds on dwarves over the first five days, then grievous cuts, and every death `bled_out`. `probe-3` (alpine too) lost one. The party sleeps outdoors until the room is dug, and nothing in the first hour warns that the site will kill them.

## What to do

Reproduce with `T763_PROBE=1 T763_DAMAGE=1 T763_SEEDS=probe-5 T763_VARIANTS=busy T763_DAYS=8` (the probe prints every wound and death). Find which rule makes the frost wounds and the grievous cuts (05 temperature, 17), and whether an alpine site's spring is meant to wound a dwarf outdoors this fast. Then decide: a warning on the embark summary and a first-hour hint, slower frostbite, or a warmer arrival (the wagon as shelter). Check on more seeds how often the site nearest the centre is alpine.

## Done

- [ ] A dated audit report with the reproduction, the cause and the decision.
- [ ] The change with tests, or a note in the report that the design stands, with the reason.
