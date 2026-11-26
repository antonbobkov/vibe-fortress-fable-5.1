# T-800 — The trader waits at the depot while the caravan does

**Source:** playtest 8 ([report](../../reports/data/2026-11-26-playtest-8.md), finding 6) · **Size:** S · **Needs:** — · **Status:** open

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

## Done

- [ ] The trader held at the depot through closed and reopened sessions; a test that closes and reopens the screen with no new trip.
- [ ] Another trader takes over from a sleeping Broker; a test.
- [ ] The status line; the retry; tests.
- [ ] 20 § The session and `panels.md` § Trade session updated.
