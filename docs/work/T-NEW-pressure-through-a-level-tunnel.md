# T-NEW — Pressure stops at a level tunnel

**Source:** [T-663's report](../../reports/data/2026-11-20-t663-water-inside-the-gate.md) · **Size:** S · **Needs:** — · **Status:** open

## Why

04's hints tell the player that water rises to the level of its source, and `fl_pressure` shows it for a U-tube whose foot is fed by source tiles. T-663's cistern is fed differently: the brook's water falls down an open shaft onto the floor of a level tunnel, and the tunnel carries it sideways to the cistern. Left open to the brook (`bd_cistern_well`'s layout with the floodgate never shut, a local probe), the tunnel and the cistern settled within a day at about six a tile (56 units in the cistern's nine tiles, the well's own tile at 7) and stayed so for eight days, and nothing rose up the well's open column, though the brook stands eight levels higher. Spread hands a neighbour at `L − 1` a unit only by equalizing, whose budget a tile renews only by a real flow (04 § The four movement rules, rule 2), so the tunnel's tiles stop one short of full; pressure lifts only from a body of full tiles (rule 3), and the shaft's full column never joins the cistern through them.

So a player's cistern cannot flood the hall above it, open or shut, while a U-tube of source tiles fills to its source's level: two answers to one question, depending on how the water arrived.

The same rule limits how far a level tunnel carries water at all: on `flat-test`, 40 tiles of 1-wide tunnel fed by a full column settled within 2,000 ticks at levels falling from 7 to 1 by the 35th tile, and nothing beyond, unchanged at 40,000 ticks. The three-year fortress's halls lie 25 to 50 tiles of tunnel from its brook, so its script digs its well room by the brook instead (T-663's report).

## What to do

Decide whether a level tunnel should carry water on to its end and the shaft's pressure with it (the hint's promise: an open floodgate would then fill the cistern, lift the water up the well's column and flood the hall, the player's doing), or whether a body joined only through tiles at `L − 1` is meant to stop (then the hint says so). If the rule changes, it changes in 04 § The four movement rules with a fluid scenario of a shaft feeding a level tunnel to a second shaft, and `bd_cistern_well` keeps its floodgate shut as it does.

Spec: 04 § The four movement rules, § Player-facing behavior.

## Done

A fluid scenario of a fall-fed level tunnel and the decision, written into 04.
