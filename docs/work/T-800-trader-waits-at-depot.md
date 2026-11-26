# T-800 — The trader waits at the depot while the caravan does

**Source:** playtest 8 ([report](../../reports/data/2026-11-26-playtest-8.md), finding 6) · **Size:** S · **Needs:** — · **Status:** done

## Why

The trade job ends when the trader reaches the depot. `completeJob` (`src/systems/trade/index.ts:250-268`) completes it and opens the session, and nothing keeps the trader there. Closing the trade screen (Esc, `TradeCancel`, `trade_session.ts:183`, `index.ts:372`) ends the session. The next [t] makes a new job and a new trip.

On that trip the trader's postponed needs win:
- Want-level needs wait only while a job is open, not once it is claimed (`dwarves/brain.ts:476`, `board.ts:971`).
- The 23:00 sleep start skips the urgency check (`brain.ts:532-535`).
- A dwarf in a need is never called back (`board.ts:1071-1105`).

In playtest 8 the status line cycled for two days: "Bjarni Marblehammer, the Broker, is asleep / is drinking / is taking a break / is eating: on the way after." The caravan waited five days at most, and less once attacked.

A player meets this naturally. The first session showed "Our goods at the depot" empty, so the player has to close it, send goods with Stocks [t], and press [t] again. (In playtest 8 the harness's own Esc presses made it worse, but the cause is above.)

Also seen in the trace: if the merchant or the trader is not on the depot footprint when the job completes, the job is dropped with no retry (`trade/index.ts:263-267`).

## What to do

Decisions taken here:

- **The trader stays.** While a caravan is at the depot and a session has opened this visit, the trader stays at the depot. Their trade job stays `working` until the caravan packs or the player closes the trade for the visit with [x] "done trading". Closing the screen with Esc only hides it. Critical needs still pull the trader away and bring them back; want-level needs and the sleep start wait.
- **Another trader goes.** If the Broker is asleep, or more than 200 ticks from the depot in a need, another dwarf with the trading labor takes the job. The status line names them, as the trade-wait line for a Broker with the trading labor off already does ("another dwarf with it trades instead").
- **The status line says when the trader has gone:** "Bjarni Marblehammer, the Broker, left the depot to sleep; back after."
- **A dropped job retries.** A trade job that completes with the merchant away re-queues once.

Decided in the work (ambiguity protocol):

- **How the trader is held.** The `trade` job's producer holds completion back (`canComplete`) while the session is open, so the job stays `working`; no new job state. The session opens at that hold, not at completion. `[x]` "done trading" is `TradeCancel`, which now also lets the held job complete on its next work tick (`doneJob` on the active caravan, saved), so `JobCompleted` comes as before; `Esc` only hides the screen (a UI flag, cleared by the next `TradeOpen`). The keys line is shortened to fit 80 columns: "[Tab] side [+]/[-] qty [a] all [Enter] Offer [g] Gift [x] Done [Esc] Hide".
- **A trader called away.** When the held job is interrupted (a critical need or a threat), the session ends; the job keeps `traded` (the dwarf who opened a session with it) and its assigned worker, the depot's line says "… left the depot to sleep; back after.", and the session opens again when they are back. A stay that ends then raises no `TradeMissed`.
- **Another trader goes** only when another dwarf with the trading labor is free of squad duty; otherwise the job waits for the Broker as before ("is asleep: on the way after."). "200 ticks from the depot" is `TRADER_AWAY_TICKS` = 200, read as straight-line tiles (the larger of the x and y distances, plus levels) × `STEP_COST` / the Broker's speed. A stand-in who has taken the job keeps it when the Broker wakes.
- **The retry** re-queues once (`retried` on the new job) when the job completes with its trader eligible but no merchant or trader on the depot's footprint.
- **Scripts.** A scripted player that steps past the moment the session opens now keeps its trader at the depot until it trades, where before the trader was free. `year_one` steps tick by tick while its trade request waits, as the screen pauses the game when the session opens, and trades then (it otherwise held the trader up to 600 ticks and two dwarves died of a badger's wounds on the changed timeline); `td_wood_penalty` has a second dwarf, without the trading labor, to carry the bar to the depot.
- The spring caravan meeting the spring raid is decided in T-798.

## Done

- [x] The trader held at the depot through closed and reopened sessions; a test that closes and reopens the screen with no new trip.
- [x] Another trader takes over from a sleeping Broker; a test.
- [x] The status line; the retry; tests.
- [x] 20 § The session and `panels.md` § Trade session updated (also § Depot's waiting line, `trade-session.md` and the keymap table).
