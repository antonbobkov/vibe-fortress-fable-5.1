import type { Civ, EntityId } from '@core/types';
import type { ReputationEntry, TradeRequest, TradeSession } from './state';

export interface TradeReader {
  activeCaravan(): { civ: Civ; state: string; daysRemaining: number } | null;
  schedule(): Readonly<Record<string, string>>;
  isBanned(civ: Civ): boolean;
  reputation(civ: Civ): number;
  reputationLog(civ: Civ): readonly ReputationEntry[];
  marginPercent(civ: Civ): number;
  valuation(civ: Civ, itemId: EntityId): number;
  price(civ: Civ, itemId: EntityId): number;
  depotItems(): readonly EntityId[];
  merchantItems(): readonly EntityId[];
  requests(civ: Civ): readonly TradeRequest[];
  lastBrought(civ: Civ): readonly string[];
  sessionOpen(): boolean;
  session(): TradeSession | null;
}
