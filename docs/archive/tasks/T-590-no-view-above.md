# T-590 — A level shows nothing above it

**Closed:** 2026-11-17, in 998becbe.

**Source:** the owner's playtest, 2026-11-17 · **Size:** S · **Needs:** — · **Status:** open

"On a given z-level I shouldn't see anything above. Below is fine with a shading change as it is currently." The compositor's higher-ground drawing (23 § Step 2, T-436) drew a natural wall on a level with open sky as the surface up to `HILL_LEVELS_ABOVE` (3) levels above it, on a tinted background, and showed undiscovered walls under open ground so. Remove it: a wall draws as a wall, an undiscovered tile stays undiscovered; levels below stay as they are.
