# T-596: an ambush that springs in the halls is hunted by the squad

Since T-580 every sweep's seed job `three-years-p2-3` at shift 50 failed its T-176 invariant `party.active-over-10d`: an ambush that arrived on day 321 was still in `engage` on day 332 and killed about 20 dwarves meanwhile. The fix is the three-year script's (`test/scenarios/three_years_fortress.ts`); no game rule changed.

## What happened

`test/perf/t596_ambush_probe.test.ts` (`T596_PROBE=1`) plays the seed with the sweep's loop and prints, from day 320, each ambush's state, morale and members against the gate stair, the alert, the squad, and the dwarves near each member. On master `82b6b436`:

- The ambush of six arrived hidden on the west edge on day 321 and, with nobody outdoors, made for the hearth (18 § Party AI). Its leader walked ahead of the others, down the gate stair, and sprang on the dwarves at work by the hearth hall, six levels below the gate.
- The script raised the hearth alert on the spring. The gate locked behind the leader: its five others stood outside the gate for the rest of the run (in `engage`, as their leader was), never inside.
- The script counted the ambush as six (all its members alive) against five armed soldiers, so it stood the squad down (T-575): every soldier went in with the civilians.
- Every civilian sheltered in the hearth hall, where the leader stood. 10 § Behavior selection has a sheltering civilian whose shelter a party member entered fight it back bare-handed instead of fleeing, and those who left for a critical need came back to it. The leader alone killed 28 dwarves, one at a time, from day 321 to day 330 (19 bled out, 9 killed outright). Each kill gave the party `MORALE_FOE_FELLED`: it went from 75 to 100 by day 322 and stayed there. It struck a blow every few ticks, so it never stalled; its losses were none, so it never broke.

So the party did what 18 says: it is in a fight it is winning, and nothing in 18 § Morale or § Party AI ends such a fight. What fed it is the script's answer: an ambush outside the gate is sheltered from, but this one was inside the shelter.

## The script's answer

A player who sees an enemy in the hearth hall sends the squad. An ambush member that has sprung indoors (a tile that is not outdoor) and can walk to a dwarf within `WILD_NEAR` of it is now hunted like a hostile indoors: the squad is not stood down, gets a kill order for each such member, nearest first, and is posted below (behind the second line, or in the hall) instead of at the gate stair. The ambush's members outside are sheltered from as before; once none is indoors the soldiers are stood down again if the ambush outnumbers them. The script still sees an ambush only once it has sprung.

On the fixed script the seed's timeline changes before day 321 (an earlier ambush is answered differently), and the probe's run to day 338 has the day-321 ambush spring on the surface by the gate, kill three, loiter and withdraw on day 323.

Test: `test/unit/t575-ambush-answer.test.ts`, T-596: an ambush of six with its leader in the hearth hall keeps the squad up, orders the leader killed and posts the squad below; with the leader dead the squad stands down for the five outside. It fails on master (the squad is stood down).
