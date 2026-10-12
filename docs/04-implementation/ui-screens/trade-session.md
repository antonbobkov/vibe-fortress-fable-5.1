# Wireframe: Trade Session

**Owner:** `ui/screens/trade_session` · **Depends on:** [`../../02-systems/20-trade-and-caravans.md`](../../02-systems/20-trade-and-caravans.md), [`../../03-content/caravan-goods.md`](../../03-content/caravan-goods.md)

Modal over the fortress screen; the simulation is paused while open.

```
┌────────────────────────────────────────────────────────────────────────────────────────────┐
│ Trading with the Hillfolk · Broker: Solveig Deephand (Trading 4) · Reputation +4           │
├─────────────────────────────────────────────┬──────────────────────────────────────────────┤
│ Their goods                          price  │ Our goods at the depot                  value│
│ ▶ 10 easy meals                     144 ☼   │   30 stone figurines (fine)             270 ☼│
│   [-] 0 [+]                                 │   [-] 30 [+]                                 │
│   5 cheese                           36 ☼   │ ▶ 40 lavish meals (superior)          3,840 ☼│
│   [-] 5 [+]                        = 36     │   [-] 20 [+]                       = 1,536   │
│   10 wool cloth                     120 ☼   │   6 iron bars                            90 ☼│
│   [-] 10 [+]                       = 120    │   [-] 0 [+]                                  │
│   bag of 10 barley seeds             15 ☼   │   4 cut quartz                           48 ☼│
│   [-] 2 [+]                        = 30     │   [-] 4 [+]                        = 48      │
│   2 sheep                            72 ☼   │   3 oak chairs (common)                  27 ☼│
│   [-] 2 [+]                        = 72     │   [-] 0 [+]                                  │
│   …                                         │   …                                          │
├─────────────────────────────────────────────┴──────────────────────────────────────────────┤
│ We take 258 ☼ · We give 1,584 ☼ (their valuation) · They want at least 12% over: 289 ☼     │
│ "A fair offer." · Wood goods offered: none                                                  │
│ [Tab] switch side  [+]/[-] quantity  [Enter] Offer  [g] Gift  [Esc] Close                  │
└────────────────────────────────────────────────────────────────────────────────────────────┘
```

Rules of the display:

- The left column shows merchant goods grouped as stacks with their *price* (valuation × markup); the right column shows fortress items at the depot with the merchant's *valuation* (which can differ from the stocks panel's value: the header of the right column says "their valuation").
- The footer recomputes on every change: `We take` = Σ price × qty; `We give` = Σ valuation × qty; the requirement line shows the margin percent and the absolute minimum.
- The merchant's line: "Not enough. Add 31 ☼ of goods." when short; "A fair offer." when acceptable; "We do not care for wooden things." once when any wooden item is selected for the Wildwood.
- After `Offer` succeeds, the columns refresh; bought goods appear in the fortress column (they are now at the depot) and can be hauled away by removing them from the depot afterwards.
- `Gift` requires the left quantities to be all zero.
- `Offer`, `Gift` and `Close` are commands that are applied on a tick. The modal keeps the game paused and advances exactly one command tick for each trade action.
- Keyboard: arrows move within a column, `Tab` switches, `+`/`-` change by 1 (`Shift` by 10), `Home`/`End` set 0/max.
- Mouse: click a row to focus, click `[+]`/`[-]`, drag on the quantity to scrub.

At 80 columns each heading remains within its own goods column, with a blank cell before the next column. When the right heading's full label does not fit it says "their value"; an abbreviated or clipped heading registers a tooltip containing the full heading and "their valuation". Reduce spacing and then labels to preserve every number. A compact title reserves the trading skill and reputation at the right and clips the broker caption with a full-title tooltip; compact totals keep all three amounts and the margin visible, with the full valuation explanation in a tooltip. Wider screens retain the full labels where they fit.
