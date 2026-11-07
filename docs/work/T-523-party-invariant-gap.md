# T-523 — The party invariant can sample a dead party between thinks

**Source:** T-510's sweep (run 42372046622, `p2-6` at shift 150) · **Size:** S · **Needs:** — · **Status:** open

## Why

The invariant `party.active-with-no-living-member` failed on a Gloam ambush whose members had all died. Parties update every 50 ticks, so a sample can land in the gap before the party's next think marks it gone. That fails a sweep seed for no fault in play.

## What to do

Confirm with a test; then either let the invariant allow one party-think interval of grace (like T-331's other timed checks), or have the party end at once when its last member dies. Prefer the game fix if it is small and changes nothing else.
