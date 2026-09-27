/** `20-trade-and-caravans.md` tuning constants. */
export const CARAVAN_DAY_MIN = 5;
export const CARAVAN_DAY_MAX = 18;
export const CARAVAN_BAN_REP = -50;
export const CARAVAN_BAN_YEARS = 2;
export const WEATHER_SKIP_PERMILLE = 150;
export const MERCHANTS_MIN = 2;
export const MERCHANTS_MAX = 3;
export const GUARDS_BASE = 2;
export const GUARDS_PER_PERIL = 1;
export const PACK_VALUE = 800;
export const CARAVAN_VALUE_BASE = 2500;
export const CARAVAN_VALUE_PER_RENOWN = 150;
export const CARAVAN_VALUE_PER_REP = 20;
export const REQUEST_SHARE = 30;
export const REQUEST_MAX = 8;
export const DEPOT_WAIT_DAYS = 3;
export const CARAVAN_STAY_DAYS = 5;
export const DEPOT_HAUL_PRIORITY = 3;
export const MERCHANT_MARKUP = 120;
export const MARGIN_BASE = 15;
export const MARGIN_MIN = 3;
export const MARGIN_PER_SKILL = 0.5;
export const MARGIN_REP_DIVISOR = 20;
export const TRADE_XP = 15;
export const REP_DRIFT_PER_YEAR = 5;

/** `creature-brains.md` § Caravan AI: party decisions every 50 ticks. */
export const CARAVAN_THINK_TICKS = 50;

/** `caravan-goods.md` § Reputation events. */
export const REP_NO_DEPOT = -2;
export const REP_FORTRESS_KILL = -50;
export const REP_OTHER_KILL = -3;
export const REP_CARAVAN_LOST = -10;

/** Unit multipliers in `caravan-goods.md`'s three lists. */
export const CARAVAN_BUNDLE_UNITS: Readonly<Record<string, number>> = {
  easy_meal: 10, fine_meal: 10, raw_meat: 10, cheese: 5, flour: 10,
  seed: 10, plant_food: 20, drink: 20, arrow: 25, brightleaf: 5,
  bandage: 4, splint: 4, chicken: 4,
};
