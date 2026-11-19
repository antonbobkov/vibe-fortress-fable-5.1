# T-NEW — The Threats panel's party line in words

**Source:** T-638 (the raid aftermath and the Threats panel), seen while naming the hostiles in view · **Size:** S · **Needs:** — · **Status:** open

## Why

A party in view reads "Active: raid (10, approach)": the purpose and the AI state are code words ("approach", "engage", "loiter", "retreat"), the civilization is not named, and the count is the party's size at arrival, members dead or fled included. T-638 named the hostiles of the Active line when no party is in view ("Active: 3 cave crabs") and made a party's line centre on its leader, but left the party line's text as it was.

## What to do

1. A party's line names it as the log does and says what it is doing in words, with the members still on the map: "Active: Gloam raid, 7 of 10, attacking", "Active: bandit raid, 4, looting", "Active: Gloam siege, 18 of 22, leaving".
2. The words for the states: approach "coming", engage "attacking", loiter "waiting" (or "looting" while a member holds loot), retreat "leaving".

Spec: `ui-screens/panels.md` § Threats, 18 § Player-facing behavior.

## Done

A test draws the panel with a party in each state and reads the line.
