import type { Civ, Edge, EntityId, TileIndex } from '@core/types';
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
  /** A merchant good priced at the scarcity price: its material the site lacks (20 § The scarcity price). */
  isScarce(itemId: EntityId): boolean;
  depotItems(): readonly EntityId[];
  merchantItems(): readonly EntityId[];
  requests(civ: Civ): readonly TradeRequest[];
  lastBrought(civ: Civ): readonly string[];
  /**
   * For each trading civilization, its edge and whether a walker from that edge reaches any of
   * `tiles` (a depot's footprint, built or about to be placed): 20 § Movement step 2.
   */
  caravanReach(tiles: readonly TileIndex[]): readonly { civ: Civ; edge: Edge; reaches: boolean }[];
  sessionOpen(): boolean;
  session(): TradeSession | null;
}
