# T-592 — A selection box shows over unexplored rock

**Source:** the owner's playtest, 2026-11-17 · **Size:** S · **Needs:** — · **Status:** open

"When I do selection underground I don't see the selection box." The selection and drag boxes invert their cells (`Surface.invert` swaps `fg` and `bg`); unexplored rock is drawn in one colour on itself, so swapping changes nothing and the box is invisible there. A cell whose colours are nearly alike now takes the text colour as its background instead (23 § Step 10).
