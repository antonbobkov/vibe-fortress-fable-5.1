# T-170 — An ambush is hidden until it is sprung

Closed by `T-170: ambushes hide until the whole party is revealed`.

**Source:** T-115 and its report, [`../../../reports/audits/2026-10-08-bug-hunt.md`](../../../reports/audits/2026-10-08-bug-hunt.md) (bug 11) · **Size:** M · **Needs:** — · **Status:** open

## Why

Ambush parties are gloam warriors and archers. Neither species has the `stealth` flag, and only a stealthed member of an ambush party can emit `AmbushSprung`. So an ambush is announced at the edge like a raid, and `AmbushSprung`, a danger announcement of 18, can never happen. T-114 measured seven ambushes and no `AmbushSprung`.

## Reproduction

Read: `src/systems/threats/parties.ts:210` (`hasStealth`), `src/systems/threats/ai.ts:842`, `src/systems/threats/index.ts:460`, `src/content/partyCompositions.json` (ambush roles).

## What to do

**Decision.** Every member of an `ambush` party is stealthed on arrival, whatever its species, exactly as a member with role `thief` is. An ambush gives no `RaidArrived` announcement while all its members are stealthed; the first spotting emits `AmbushSprung` (danger, pause, centre) and unhides the whole party. Write this into 18 § Stealth and § Arrival and warning. This takes over the `AmbushSprung` item of T-157.

Tests, `describe('T-170 …')`: a scheduled ambush on a flat-test map is not targetable or drawn until a dwarf is within `SPOT_RADIUS`; then `AmbushSprung` is delivered once and the party is in `engage`.

## Done

- The tests pass. The three-year sweep's raid counts move; say so in the commit.
