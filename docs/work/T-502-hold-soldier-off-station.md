# T-502 — A soldier on `hold` who is off its station with a target stays where it is

**Source:** T-493 (`test/unit/runecraft/t493-hexer-dread.test.ts`, the dread test with a `hold` squad) · **Size:** S · **Needs:** — · **Status:** open

## What was found

A soldier on duty with stance `hold` that holds a target it cannot reach or strike does not walk back to its station: 16's squad step skips a member that holds a target ("If already has an active target, keep engaging"), and the `hold` stance never approaches. Before T-493 this showed only when a hold soldier picked up a target on its way to the station. With dread hexers it shows more often: a soldier put to flight runs 12 tiles, and when the effect ends it sees the hexer again, takes it as its target and stands where its flight ended until the target dies or leaves its sight. In the test, a hold soldier stood 12 tiles from its post for the 400 ticks measured; a `pursue` soldier walks back to the fight.

## What to do

Decide in 16 § Squads whether a `hold` soldier off its station by more than a tile, with a target it cannot strike from where it stands, walks back to its station while keeping the target. Pin it with a test.

## Done

- The decision is in 16 § Squads, with a test.
