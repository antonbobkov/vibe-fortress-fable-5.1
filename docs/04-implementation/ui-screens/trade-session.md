# Wireframe: Trade Session

**Owner:** `ui/screens/trade_session` · **Depends on:** [`../../02-systems/20-trade-and-caravans.md`](../../02-systems/20-trade-and-caravans.md), [`../../03-content/caravan-goods.md`](../../03-content/caravan-goods.md)

Modal over the fortress screen; the simulation is paused while it is shown. `Esc` hides it and the game runs on: the session stays open and the trader waits at the depot, and `[t]` in the depot panel shows the screen again. `[x]` is "done trading": the session ends for this visit and the trader goes back to work (20 § The session).

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
│ [Tab] side [+]/[-] qty [a] all [Enter] Offer [g] Gift [x] Done [Esc] Hide                    │
└────────────────────────────────────────────────────────────────────────────────────────────┘
```

Rules of the display:

- The title names the Broker, the dwarf who holds the title, and the trading skill of the dwarf who trades. When someone else trades (no dwarf holds the title, or the Broker's `trading` labor is off), it names both: "Broker: none (Torgeir Grimfoot trades, skill 0)"; the compact title says "Broker: none (Torgeir Grimfoot trades)" and keeps the skill and reputation at the right.
- Goods are named as the stocks name them, with the plural of `items.md` § Plurals: "40 dung", "50 flour", "70 salt".

- 
The 
left 
column 
shows 
merchant 
goods 
grouped 
as 
stacks 
with 
their 
*price* 
(valuation 
× 
markup, 
× 
`SCARCITY_MARKUP` 
for 
a 
good 
the 
site 
lacks); 
such 
a 
row 
says 
"scarce 
here" 
(`ui.trade.scarce`) 
in 
the 
alert 
color 
after 
its 
quantity 
controls, 
where 
the 
column 
has 
room 
(20 
§ 
The 
scarcity 
price); 
a 
cloth 
or 
bandage 
row 
says 
"the 
hospital 
wants" 
(`ui.trade.hospital_wants`; 
"scarce 
here 
· 
the 
hospital 
wants" 
when 
both) 
while 
the 
hospitals 
hold 
fewer 
dressings 
than 
they 
want 
(17 
§ 
Player-facing 
behavior); 
the 
right 
column 
shows 
fortress 
items 
at 
the 
depot 
with 
the 
merchant's 
*valuation* 
(which 
can 
differ 
from 
the 
stocks 
panel's 
value: 
the 
header 
of 
the 
right 
column 
says 
"their 
valuation").
- 
Both 
columns 
merge 
like 
stacks, 
as 
Stocks 
does: 
the 
item 
entities 
with 
the 
same 
item 
type, 
material, 
quality 
and 
state 
(rot 
stage, 
wear, 
enchantment, 
cellar 
age) 
are 
one 
row, 
in 
the 
place 
of 
the 
first, 
summing 
their 
counts 
and 
full 
prices 
or 
valuations 
(five 
stacks 
of 
"8 
turnip 
lavish 
meals" 
read 
"40 
turnip 
lavish 
meals"). 
Their 
names 
use 
the 
plural 
for 
more 
than 
one. 
Quantity 
controls 
operate 
on 
the 
whole 
displayed 
row, 
clamped 
to 
its 
count; 
selection 
allocates 
across 
its 
real 
item 
ids 
in 
reader 
order, 
taking 
up 
to 
each 
entity's 
count. 
Offers 
send 
those 
ids 
and 
quantities, 
one 
trade 
line 
per 
stack; 
totals 
use 
their 
individual 
prices, 
including 
a 
partially 
selected 
entity. 
Other 
materials, 
qualities 
or 
states 
remain 
separate 
rows.
- The footer recomputes on every change: `We take` = Σ price × qty; `We give` = Σ valuation × qty; the requirement line shows the margin percent, rounded to a whole number, and the absolute minimum.
- The merchant's line: "Not enough. Add 31 ☼ of goods." when short; "A fair offer." when acceptable; "We do not care for wooden things." once when any wooden item is selected for the Wildwood. "Where did you get this?" (`ui.trade.star_steel`), once a session, after the first offer that holds star steel, for any civilization; it stands in place of the verdict until the next change.
- The right column is read at each draw: the session opens with the goods at the depot so far, and goods that the haulers bring while it is open join the column. While the depot's `haul_to_depot` jobs remain (`trade.depotHauls`), a line under the column, in the dim colour, says how many: "12 more on the way" (`ui.trade.more_on_way`); the column keeps a row for it.
- After `Offer` succeeds, the columns refresh; bought goods appear in the fortress column (they are now at the depot) and can be hauled away by removing them from the depot afterwards.
- `Gift` requires the left quantities to be all zero.
- `Offer`, `Gift` and `Close` are commands that are applied on a tick. The modal keeps the game paused and advances exactly one command tick for each trade action.
- Keyboard: arrows move within a column, `Tab` switches, `+`/`-` change by 1 (`Shift` by 10), `Home`/`End` set 0/max, `[a]` sets all of the row, or none when all of it is chosen.
- Mouse: click a row to focus, click `[+]`/`[-]`, drag on the quantity to scrub.

At 80 columns each heading remains within its own goods column, with a blank cell before the next column. When the right heading's full label does not fit it says "their value"; an abbreviated or clipped heading registers a tooltip containing the full heading and "their valuation". Reduce spacing and then labels to preserve every number. A compact title reserves the trading skill and reputation at the right and clips the broker caption with a full-title tooltip; compact totals keep all three amounts and the margin visible, with the full valuation explanation in a tooltip. Wider screens retain the full labels where they fit.
