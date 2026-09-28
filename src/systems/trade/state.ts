import type { Civ, EntityId } from '@core/types';
import type { RngState } from '@core/rng';
import type { CaravanSchedule } from './schedule';

export interface TradeRequest { itemType: string; material?: string; priority: 1 | 2 | 3 }
export interface OfferLine { itemId: EntityId; count: number }
export interface TradeSession {
  depotId: EntityId;
  traderId: EntityId;
  merchantId: EntityId;
  give: OfferLine[];
  take: OfferLine[];
  woodOffered: EntityId[];
  woodWarning: boolean;
}
export interface ReputationEntry { tick: number; civ: Civ; delta: number; reason: string }

export interface ActiveCaravan {
  partyId: EntityId;
  civ: Civ;
  state: 'toDepot' | 'waiting' | 'unload' | 'atDepot' | 'pack' | 'leave';
  depotId: EntityId;
  edgeTile: number;
  arrivedTick: number;
  stateSince: number;
  merchants: EntityId[];
  guards: EntityId[];
  animals: EntityId[];
  destinations: Record<number, number>;
  goods: EntityId[];
  dead: EntityId[];
  boughtValue: number;
  soldValue: number;
  attacked: boolean;
  lost: boolean;
  giftedThisCaravan?: number;
}

export interface TradeStateV1 {
  stateVersion: 1;
  schedule: Record<string, CaravanSchedule>;
  activeCaravan: ActiveCaravan | null;
  requests: Record<string, TradeRequest[]>;
  lastBrought: Record<string, string[]>;
  session?: TradeSession | null;
  reputationLog?: ReputationEntry[];
  rng: RngState;
}
