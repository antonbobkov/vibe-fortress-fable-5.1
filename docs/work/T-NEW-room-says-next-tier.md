# T-NEW — The room inspector says what the next tier needs

**Source:** playtest 9 ([report](../../reports/data/2026-11-26-playtest-9.md), finding 4) · **Size:** S · **Needs:** — · **Status:** open

## Why

The room inspector is the builder's main tool, and it is good: the score, its parts, the open border tiles marked on the map, and the requirements ([01-hearth-hall-room-inspector.png](../../reports/data/2026-11-26-playtest-9/01-hearth-hall-room-inspector.png)). Three things a builder needs are missing:

- **The next tier and its score.** The hall read "Room: Fine (score 184) · tiles 100 walls 50 furn. 4 · size 30 · Not enclosed: 2 open border tiles". Nothing says that Grand starts at 400 (14 § Rooms and quality), or that Royal starts at 1000.
- **The enclosure multiplier.** Two doors on the open tiles took it to "Fine (score 276) … Enclosed" ([02-hall-enclosed.png](../../reports/data/2026-11-26-playtest-9/02-hall-enclosed.png)). The parts still read "tiles 100 walls 50 furn. 4 size 30", which sum to 184. The ×1.5 (`ENCLOSED_PERCENT`) is shown nowhere, so the parts do not add up to the score, and an open room never says it is losing a third.
- **What the parts are worth.** A statue added 4 to "furn." (+7 to the score, [06-hall-with-statue.png](../../reports/data/2026-11-26-playtest-9/06-hall-with-statue.png)). Three statues took the hall from 276 to 297, against the 400 Grand needs. The player cannot tell whether statues, engraving or a bigger hall would close the gap. Engraving a floor tile is worth 3 + its quality against 3 smoothed. A statue is its value ÷ 10 × 2. Size counts to 40 tiles (`ROOM_SIZE_CAP`).

In playtests 7, 8 and 9, every hearth hall ended at Fine (169 to 191, unenclosed, in the scripted fortresses). `balance.md` § Wealth curve expects "a royal hearth hall" by Year 5.

## What to do

Decisions taken here:

- **A next-tier line:** "Grand at 400: 104 to go" (in the alert colour when the room is not enclosed: "Grand at 400: enclose it for ×1.5").
- **The multiplier on the parts line:** "tiles 100 walls 50 furn. 4 size 30 · ×1.5 enclosed".
- **One "Raises it" line,** naming the cheapest next step the inspector can see: unengraved smoothed tiles ("engrave 24 tiles: +up to 96"), unsmoothed natural tiles ("smooth 12 tiles"), size under the cap ("4 more tiles count"), or "statues and fine furniture". It names counts, not exact scores, where quality is unknown.

## Done

- [ ] The next-tier line, the multiplier and the "Raises it" line in the room inspector; a UI test on an open and an enclosed room.
- [ ] `panels.md` § Zones (room inspector) and 14 § Player-facing behavior updated.
