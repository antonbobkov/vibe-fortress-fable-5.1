/** The paused, two-column exchange of ui-screens/trade-session.md (T-M7-03). */
import { C } from '@core/components';
import type { Command } from '@core/commands';
import type { ReaderSet } from '@core/readers';
import type { Registry } from '@core/registry';
import type { Civ, EntityId } from '@core/types';
import type { KeyPress } from '@platform/input';
import type { ItemsReader } from '@systems/items';
import type { DwarvesReader } from '@systems/dwarves';
import { requiredValue, type TradeReader } from '@systems/trade';
import { clickHit, type CellPointer, type Screen } from '../screen';
import type { Surface } from '../surface';
import { clampList, label, type ListState } from '../widgets';

export interface TradeSessionHost {
  readonly readers: ReaderSet;
  readonly registry: Registry;
  submit(command: Command): void;
  /** Apply a queued command while the modal keeps the game paused. */
  commandTick(): void;
  back(): void;
}

export interface TradeTotals {
  take: number;
  give: number;
  required: number;
  shortfall: number;
}

/** Values from the merchant reader are for whole stacks; quantities scale them proportionally. */
export function tradeTotals(
  merchant: readonly { id: EntityId; count: number; price: number }[],
  fortress: readonly { id: EntityId; count: number; value: number }[],
  take: ReadonlyMap<EntityId, number>,
  give: ReadonlyMap<EntityId, number>,
  margin: number,
): TradeTotals {
  const takeValue = merchant.reduce((sum, row) => sum + row.price * (take.get(row.id) ?? 0) / row.count, 0);
  const giveValue = fortress.reduce((sum, row) => sum + row.value * (give.get(row.id) ?? 0) / row.count, 0);
  const required = requiredValue(takeValue, margin);
  return { take: takeValue, give: giveValue, required, shortfall: Math.max(0, Math.ceil(required - giveValue)) };
}

interface GoodsRow { id: EntityId; count: number; value: number; name: string }

const CIV_NAMES: Readonly<Record<Civ, string>> = {
  mountainhome: 'Mountainhome', hillfolk: 'Hillfolk', wildwood: 'Wildwood', gloam: 'Gloam',
};

export class TradeSessionScreen implements Screen {
  readonly id = 'trade_session' as const;
  readonly take = new Map<EntityId, number>();
  readonly give = new Map<EntityId, number>();
  readonly left: ListState = { selected: 0, scroll: 0 };
  readonly right: ListState = { selected: 0, scroll: 0 };
  side: 'merchant' | 'fortress' = 'merchant';
  private last: Surface | null = null;
  private scrub: { id: EntityId; side: 'merchant' | 'fortress'; col: number; quantity: number } | null = null;

  constructor(private readonly host: TradeSessionHost) {}

  private trade(): TradeReader { return this.host.readers.of<TradeReader>('20'); }
  private items(): ItemsReader { return this.host.readers.of<ItemsReader>('13'); }
  private civ(): Civ { return this.trade().activeCaravan()?.civ ?? 'hillfolk'; }

  private goods(side: 'merchant' | 'fortress'): GoodsRow[] {
    const trade = this.trade();
    const items = this.items();
    const civ = this.civ();
    const ids = side === 'merchant' ? trade.merchantItems() : trade.depotItems();
    return ids.flatMap((id) => {
      const rec = items.get(id);
      if (!rec || rec.count <= 0) return [];
      const def = items.def(rec.type);
      const material = this.host.registry.table<{ id: string; name: string }>('materials').byIndex(rec.material)?.name ?? '';
      return [{ id, count: rec.count, value: side === 'merchant' ? trade.price(civ, id) : trade.valuation(civ, id), name: `${material} ${def?.name ?? 'goods'}`.trim() }];
    });
  }

  totals(): TradeTotals {
    const merchant = this.goods('merchant');
    const fortress = this.goods('fortress');
    return tradeTotals(merchant.map((r) => ({ ...r, price: r.value })), fortress, this.take, this.give, this.trade().marginPercent(this.civ()));
  }

  private selected(): GoodsRow | undefined {
    const side = this.side;
    const state = side === 'merchant' ? this.left : this.right;
    return this.goods(side)[state.selected];
  }

  quantity(side: 'merchant' | 'fortress', id: EntityId): number {
    return (side === 'merchant' ? this.take : this.give).get(id) ?? 0;
  }

  setQuantity(side: 'merchant' | 'fortress', id: EntityId, value: number): void {
    const row = this.goods(side).find((r) => r.id === id);
    if (!row) return;
    const quantity = Math.max(0, Math.min(row.count, Math.round(value)));
    const chosen = side === 'merchant' ? this.take : this.give;
    if (quantity === 0) chosen.delete(id);
    else chosen.set(id, quantity);
  }

  private change(delta: number): void {
    const row = this.selected();
    if (row) this.setQuantity(this.side, row.id, this.quantity(this.side, row.id) + delta);
  }

  private offer(gift: boolean): void {
    if (gift && this.take.size > 0) return;
    const give = this.goods('fortress').flatMap((row) => {
      const count = this.give.get(row.id) ?? 0;
      return count > 0 ? [{ itemId: row.id, count }] : [];
    });
    if (give.length === 0) return;
    const take = gift ? [] : this.goods('merchant').flatMap((row) => {
      const count = this.take.get(row.id) ?? 0;
      return count > 0 ? [{ itemId: row.id, count }] : [];
    });
    this.host.submit({ type: 'TradeOffer', give, take });
    this.host.commandTick();
    const session = this.trade().session();
    if (session !== null && session.give.length === 0 && session.take.length === 0) {
      this.take.clear();
      this.give.clear();
    }
  }

  private close(): void {
    this.host.submit({ type: 'TradeCancel' });
    this.host.commandTick();
    this.host.back();
  }

  key(press: KeyPress): boolean {
    const k = press.key;
    if (k === 'Esc' || k === 'Escape') { this.close(); return true; }
    if (k === 'Tab') { this.side = this.side === 'merchant' ? 'fortress' : 'merchant'; return true; }
    const state = this.side === 'merchant' ? this.left : this.right;
    const rows = this.goods(this.side);
    if (k === 'ArrowUp' || k === '↑') { state.selected = Math.max(0, state.selected - 1); return true; }
    if (k === 'ArrowDown' || k === '↓') { state.selected = Math.min(rows.length - 1, state.selected + 1); return true; }
    if (k === '+' || k === '=') { this.change(press.shift ? 10 : 1); return true; }
    if (k === '-') { this.change(press.shift ? -10 : -1); return true; }
    if (k === 'Home') { const row = this.selected(); if (row) this.setQuantity(this.side, row.id, 0); return true; }
    if (k === 'End') { const row = this.selected(); if (row) this.setQuantity(this.side, row.id, row.count); return true; }
    if (k === 'Enter') { this.offer(false); return true; }
    if (k.toLowerCase() === 'g') { this.offer(true); return true; }
    return false;
  }

  draw(surface: Surface): void {
    this.last = surface;
    const t = surface.theme;
    const trade = this.trade();
    const civ = this.civ();
    const width = Math.max(16, Math.floor((surface.cols - 5) / 2));
    const right = width + 4;
    const footer = Math.max(5, surface.rows - 5);
    const visible = Math.max(1, Math.floor((footer - 4) / 2));
    const traderId = trade.session()?.traderId ?? 0;
    const broker = traderId ? this.host.readers.entities.get(traderId, C.Creature)?.name ?? 'a trader' : 'a trader';
    const skill = traderId && this.host.readers.has('10') ? this.host.readers.of<DwarvesReader>('10').skill(traderId, 'trading') : 0;
    surface.text(2, 1, `Trading with the ${CIV_NAMES[civ]} · Broker: ${broker} (Trading ${skill}) · Reputation ${trade.reputation(civ) >= 0 ? '+' : ''}${trade.reputation(civ)}`, t.key);
    surface.text(2, 3, 'Their goods                         price', t.key);
    surface.text(right, 3, 'Our goods at the depot      their valuation', t.key);
    const sides = ['merchant', 'fortress'] as const;
    for (const side of sides) {
      const rows = this.goods(side);
      const state = side === 'merchant' ? this.left : this.right;
      const col = side === 'merchant' ? 2 : right;
      clampList(state, rows.length, visible);
      for (let i = state.scroll; i < Math.min(rows.length, state.scroll + visible); i += 1) {
        const row = rows[i] as GoodsRow;
        const y = 4 + (i - state.scroll) * 2;
        const selected = state.selected === i && this.side === side;
        label(surface, col, y, `${selected ? '▶' : ' '} ${row.count} ${row.name}`, { fg: selected ? t.key : t.text, width: width - 10 });
        label(surface, col + width - 9, y, String(Math.round(row.value)), { fg: t.value, width: 9 });
        surface.hit({ col, row: y, cols: width, rows: 1 }, () => { this.side = side; state.selected = i; });
        const q = this.quantity(side, row.id);
        label(surface, col + 2, y + 1, `[-] ${q} [+]`, { fg: t.text, width: width - 2 });
        surface.hit({ col: col + 2, row: y + 1, cols: 3, rows: 1 }, () => this.setQuantity(side, row.id, q - 1));
        surface.hit({ col: col + 7 + String(q).length, row: y + 1, cols: 3, rows: 1 }, () => this.setQuantity(side, row.id, q + 1));
        surface.hit({ col: col + 6, row: y + 1, cols: Math.max(1, String(q).length), rows: 1 }, () => {
          this.side = side; state.selected = i; this.scrub = { id: row.id, side, col: col + 6, quantity: q };
        });
      }
    }
    const totals = this.totals();
    surface.text(2, footer, `We take ${Math.round(totals.take)} ☼ · We give ${Math.round(totals.give)} ☼ (their valuation) · They want at least ${trade.marginPercent(civ)}% over: ${totals.required} ☼`, t.value);
    const wood = trade.session()?.woodWarning ?? false;
    surface.text(2, footer + 1, wood ? 'We do not care for wooden things.' : totals.shortfall > 0 ? `Not enough. Add ${totals.shortfall} ☼ of goods.` : 'A fair offer.', totals.shortfall > 0 ? t.bad : t.good);
    surface.text(2, footer + 2, '[Tab] switch side  [+]/[-] quantity  [Enter] Offer  [g] Gift  [Esc] Close', t.dim);
  }

  pointerDown(p: CellPointer): void { clickHit(this.last, p); }
  pointerMove(p: CellPointer): void {
    const scrub = this.scrub;
    if (scrub) this.setQuantity(scrub.side, scrub.id, scrub.quantity + p.col - scrub.col);
  }
  pointerUp(): void { this.scrub = null; }
}
