# T-765 — An alpine default embark loses its party to frostbite in the first week

**Source:** T-763 ([report](../../reports/audits/2026-11-25-t763-first-week-misery.md), § Seen in passing) · **Size:** M · **Needs:** — · **Status:** open

## Why

T-763's probe of the default embark (the region nearest the world's centre, Balanced preset) on seed `probe-5` (alpine, region 2080), with a newcomer's day-1 orders (a stair shaft and a room, a carpenter's workshop, a stockpile), lost six or seven of its seven dwarves by day 7 in the busy runs: 144 light frost wounds on dwarves over the first five days, then grievous cuts, and every death `bled_out`. `probe-3` (alpine too) lost one. The party sleeps outdoors until the room is dug, and nothing in the first hour warns that the site will kill them.

## What to do

Reproduce with `T763_PROBE=1 T763_DAMAGE=1 T763_SEEDS=probe-5 T763_VARIANTS=busy T763_DAYS=8` (the probe prints every wound and death). Find which rule makes the frost wounds and the grievous cuts (05 temperature, 17), and whether an alpine site's spring is meant to wound a dwarf outdoors this fast. Then decide: a warning on the embark summary and a first-hour hint, slower frostbite, or a warmer arrival (the wagon as shelter). Check on more seeds how often the site nearest the centre is alpine.

## Decisions

The cause chain is in the [report](../../reports/audits/2026-11-25-t765-alpine-frostbite.md). Each decision is written into the spec section named.

1. **Bug: frostbite severed limbs.** 17 said a heat or cold wound is `light`, but the code dealt a flat 5 to a random limb and let it stack: seven of them destroy a dwarf's 36-hp limb, and a destroyed limb leaves a grievous cut that bleeds 6 a health tick; on a cat or a dog the same 5 was a serious or grievous frost wound, which bleeds 1. Now the wound is light on any creature and, as a fall, never takes a limb below 1 hp (17 § Wound creation, *Frostbite never severs a limb*; `TEMPERATURE_INJURY_DAMAGE` named). Losing a limb to frostbite without a bleeding stump was weighed and not taken: a party that sleeps outside on such a site would lose a limb each in a week.
2. **Gap: nobody sheltered.** With no hearth hall a dwarf idled at the wagon and slept on the floor there (10's rules), outdoors, though a room was dug four levels below. Now, while the wagon's tile is outdoor and colder than `COLD_SHELTER_C` (−15 °C, ten degrees above frostbite so a dwarf lying down at dusk is not frostbitten by dawn), the idle goal and the floor-sleep fallback is the first covered floor a walker reaches from the wagon (10 § Behavior selection, *Out of the cold*; § Bed search). A hearth hall still wins when there is one.
3. **Legitimate harsh site, now said.** An alpine site of the frozen band (mean −20 °C) has spring nights of −30 °C on snow: frostbite outdoors is the climate, not a bug. The region panel says so in the alert colour among the missing essentials when the arrival's season has frostbite, with the night's temperature and the workaround; a later season's frostbite is a note in the Climate row (02 § Site summary). The season's first frostbitten dwarf raises the `Frostbitten` alert naming the shelter (17 § Player-facing behavior).
4. **Not changed:** `COLD_INJURY_C` and the hourly chance (the climate is meant to bite), the `frost` rows of the wound table (rune frost bolts still make grievous frost wounds that bleed), the hearth's warmth.
5. **Follow-ups** (work files): the first bed order eats the embark's linen (`T-NEW-bed-order-eats-the-linen.md`); the world map often starts a newcomer on a site that freezes from the first night (`T-NEW-default-site-frostbite.md`).

## Done

- [x] A dated audit report with the reproduction, the cause and the decision.
- [x] The change with tests, or a note in the report that the design stands, with the reason.
