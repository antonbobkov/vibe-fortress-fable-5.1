# T-787 — A cavern monster fighting in the halls is a danger line, with the way to shelter

**Source:** playtest 7 ([report](../../reports/data/2026-11-26-playtest-7.md), finding 3) · **Size:** S · **Needs:** — · **Status:** open

## Why

Twenty days after I opened cavern 2, a blind stalker walked up the corridor into the halls on Summer 18, Year 4. The fight it started was one line: "! 17 dwarves and a cat are fighting a blind stalker." This was an alert, not a danger line, so it did not pause the game and gave no Hearth tail. The Combat tab shows how it went: the stalker hit fourteen dwarves in turn ("A blind stalker hits Kari: 13 edge. x2", "A blind stalker has slain a cat."), and Saga Frosttongue killed it with five piercing blows. The log under the engagement line was a run of "X is wounded and needs care." and "! X is bleeding and there is no bandage or cloth …". Kari and Sif bled to death that day, and Thurid, Gloin and the child Wulf the next. A raid of the same size, one attacker among a crowd, gets "!! A Gloam raid has come from the north! The alert is Calm: [m] [3] sends the civilians to shelter." (T-734).

`ui/announcements.ts` `engage` opens every fortress engagement as an `alert`. A raid's arrival is the danger line, and its engagement follows as an alert. A cavern monster or a Hollow-born that reaches the halls has no arrival line, only the engagement.

## What to do

Decisions taken here:

- **The first blow of an engagement whose foes include a cavern monster (`hostile:cavern`) or a creature of the Deep, struck inside the fortress (on a tile with no `outdoor` flag, at or above the hall's level band), opens the engagement line as a danger line.** It pauses the game as other danger lines do. Under Calm it carries the Hearth tail: "!! A blind stalker is in the halls! 3 dwarves are fighting it. The alert is Calm: [m] [3] sends the civilians to shelter." Later blows refresh the same line, as now.
- In the cavern itself (a tile in a cavern band, for instance a miner meeting a crawler), the line stays an alert: going below is the player's risk, and the pause would come too often.
- The civilians still fight a lone monster when the alert is Calm: the mob is how the stalker died, and it is a kept outcome (fun-features, "Seventeen and a cat").

## Done

- [ ] `engage` opens a danger line for a cavern or Deep foe inside the halls, with the Calm tail; a UI test for a stalker in the hall and a crawler in the cavern.
- [ ] 24 § Announcements and the log and 16 § Combat log describe the case.
