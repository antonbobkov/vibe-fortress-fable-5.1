/** `12` §§ Operation, Work orders; `economy.md` § Workshop operation. */
import { C, type Building, type WorkOrder, type Workshop } from '@core/components';
import { FluidType } from '@core/map3d';
import type { Registry } from '@core/registry';
import type { GameEvent } from '@core/events';
import type { InitContext, JobProducer, TickContext } from '@core/system';
import type { EntityId, TileIndex } from '@core/types';
import type { Job, JobSink, ItemFilter } from '@systems/jobs';
import type { ItemsReader } from '@systems/items';
import { MAGMA_POWER_LEVEL, recipeActive } from './constants';
import { rollQuality } from './quality';
import { grantXp } from '@systems/dwarves/skills';
import { jobXp } from '@systems/dwarves/rules/skills';

export interface RecipeRow {
  readonly id: string;
  readonly name: string;
  readonly workshop: string;
  readonly skill: string;
  readonly inputs: readonly { readonly match: string; readonly count: number; readonly material?: string; readonly distinct?: boolean }[];
  readonly outputs: readonly { readonly item: string; readonly count: number; readonly permille?: number; readonly material: { readonly from: 'input'; readonly index: number } | { readonly fixed: string } | { readonly alloy: string } | { readonly plantDrink: true } }[];
  readonly baseTicks: number;
  readonly fuel: boolean;
  readonly quality: boolean;
  readonly container?: 'barrel' | 'bag';
  readonly xp: number;
}

interface BuildingRow { readonly id: string; readonly category: string; readonly magmaVariantOf?: string; readonly workTile?: number; readonly outputTile?: number }
interface MaterialRow { readonly id: string; readonly class: string; readonly tags?: readonly string[] }
interface ItemRow { readonly id: string; readonly tags?: readonly string[] }
interface PlantRow { readonly id: string; readonly brew?: string }

export function recipeInputFilter(registry: Registry, input: RecipeRow['inputs'][number], order: WorkOrder): ItemFilter {
  const items = registry.table<ItemRow>('items');
  const materials = registry.table<MaterialRow>('materials');
  const materialClass = materials.where(`class:${input.match}`, (row) => row.class === input.match).length > 0;
  const alternatives = input.match.split('|');
  const filter: ItemFilter = alternatives.length > 1 && alternatives.every((id) => items.has(id))
    ? { types: alternatives.map((id) => items.index(id)) }
    : items.has(input.match) ? { type: items.index(input.match) }
    : materialClass ? { materialClass: input.match } : { tag: input.match };
  if (input.material === 'flux') filter.materialIds = materials.where('tag:flux', (row) => row.tags?.includes('flux') === true)
    .map((row) => materials.index(row.id));
  const material = input.material !== undefined && input.material !== 'any' && input.material !== 'flux' && input.material !== 'fuel'
    ? input.material : order.materialFilter;
  if (typeof material === 'number') filter.materialId = material;
  else if (typeof material === 'string' && materials.has(material)) filter.materialId = materials.index(material);
  else if (typeof material === 'string') filter.materialClass = material;
  return filter;
}

export function outputFilter(registry: Registry, recipe: RecipeRow, order: WorkOrder): ItemFilter {
  const first = recipe.outputs[0];
  if (first === undefined) return {};
  const items = registry.table<ItemRow>('items');
  const filter: ItemFilter = items.has(first.item) ? { type: items.index(first.item) } : { tag: first.item };
  const material = typeof order.materialFilter === 'string' && 'plantDrink' in first.material
    ? registry.table<PlantRow>('plants').byId(order.materialFilter)?.brew ?? order.materialFilter
    : order.materialFilter;
  const materials = registry.table<MaterialRow>('materials');
  if (typeof material === 'number') filter.materialId = material;
  else if (typeof material === 'string' && materials.has(material)) filter.materialId = materials.index(material);
  else if (typeof material === 'string') filter.materialClass = material;
  return filter;
}

/** `economy.md` § resolveMaterial; material indices of delivered inputs, in recipe order. */
export function resolveMaterial(registry: Registry, rule: RecipeRow['outputs'][number]['material'], inputMaterials: readonly number[]): number {
  const mats = registry.table<MaterialRow>('materials');
  if ('fixed' in rule) return mats.index(rule.fixed);
  if ('alloy' in rule) return mats.index(rule.alloy);
  const material = inputMaterials['from' in rule ? rule.index : 0] ?? 0;
  if ('plantDrink' in rule) {
    const plant = mats.byIndex(material)?.id ?? '';
    const brew = registry.table<PlantRow>('plants').byId(plant)?.brew;
    return brew === undefined ? material : mats.index(brew);
  }
  return material;
}

/** The textile chain names a new material at each stage (`materials.md` § Cloth and fiber). */
export function resolveOutputMaterial(registry: Registry, output: RecipeRow['outputs'][number], inputMaterials: readonly number[]): number {
  const source = resolveMaterial(registry, output.material, inputMaterials);
  if (output.item !== 'thread' && output.item !== 'cloth') return source;
  const materials = registry.table<MaterialRow>('materials');
  const sourceId = materials.byIndex(source)?.id ?? '';
  const stem = sourceId.replace(/_(fiber|thread|cloth)$/, '');
  const next = `${stem}_${output.item}`;
  return materials.has(next) ? materials.index(next) : source;
}

export class WorkshopOperator {
  readonly ctx: InitContext;
  readonly recipes = new Map<string, RecipeRow>();
  readonly recipeNumbers = new Map<string, number>();
  readonly numberRecipes = new Map<number, RecipeRow>();
  readonly byWorkshop = new Map<string, RecipeRow[]>();
  readonly globalOrders: WorkOrder[] = [];
  readonly professionCache = new Map<EntityId, string>();
  private registered = false;

  constructor(ctx: InitContext) {
    this.ctx = ctx;
    const table = ctx.registry.table<RecipeRow>('recipes');
    for (const id of table.ids()) this.addRecipe(table.byId(id) as RecipeRow, table.index(id));
  }

  private addRecipe(row: RecipeRow, index: number): void {
    if (this.recipes.has(row.id)) throw new Error(`duplicate recipe ${row.id}`);
    this.recipes.set(row.id, row);
    this.recipeNumbers.set(row.id, index);
    this.numberRecipes.set(index, row);
    const list = this.byWorkshop.get(row.workshop) ?? [];
    list.push(row);
    this.byWorkshop.set(row.workshop, list);
  }

  mergeRegistered(): void {
    if (this.registered) return;
    this.registered = true;
    const sets = (this.ctx.register as { recipeSets?: readonly { recipes: readonly unknown[] }[] }).recipeSets ?? [];
    let index = this.ctx.registry.table<RecipeRow>('recipes').size + 1;
    for (const set of sets) for (const raw of set.recipes) this.addRecipe(raw as RecipeRow, index++);
  }

  get items(): ItemsReader { return this.ctx.readers.of<ItemsReader>('13'); }

  recipe(id: string | number): RecipeRow | undefined {
    if (typeof id === 'number') return this.numberRecipes.get(id);
    return this.recipes.get(id);
  }

  recipeIndex(id: string): number { return this.recipeNumbers.get(id) ?? 0; }

  row(b: Building): BuildingRow { return this.ctx.registry.table<BuildingRow>('buildings').byIndex(b.type) as BuildingRow; }

  workshop(id: EntityId): Workshop | undefined { return this.ctx.world.entities.get(id, C.Workshop); }

  save(id: EntityId, w: Workshop): void { this.ctx.world.entities.add(id, C.Workshop, w); }

  ensure(id: EntityId): void {
    const b = this.ctx.world.entities.get(id, C.Building);
    if (b === undefined || b.state !== 'built' || this.row(b).category !== 'workshop' || this.workshop(id) !== undefined) return;
    this.save(id, { orders: [], currentJobId: 0, suspended: false, assignedWorker: 0, magmaPowered: false, lastBlockedReason: null });
  }

  isMagmaPowered(id: EntityId): boolean {
    const b = this.ctx.world.entities.get(id, C.Building);
    if (b === undefined || !this.row(b).magmaVariantOf) return false;
    const map = this.ctx.world.map;
    return b.footprint.some((t) => {
      const below = map.below(t);
      return below >= 0 && map.fluidTypeAt(below) === FluidType.Magma && map.fluidLevelAt(below) >= MAGMA_POWER_LEVEL;
    });
  }

  typeOf(id: EntityId): string {
    const b = this.ctx.world.entities.get(id, C.Building);
    if (b === undefined) return '';
    const row = this.row(b);
    return row.magmaVariantOf ?? row.id;
  }

  /** Null when runnable; otherwise the panel's waiting reason. */
  problem(order: WorkOrder, id: EntityId): string | null {
    const ws = this.workshop(id);
    const recipe = this.recipe(order.recipe);
    if (ws === undefined || recipe === undefined || !recipeActive(recipe) || recipe.workshop !== this.typeOf(id)) return 'not_found';
    if (ws.suspended) return 'workshop_suspended';
    if (order.mode === 'once' && order.remaining <= 0) return 'complete';
    if (order.mode === 'maintain' && this.items.countAvailable(outputFilter(this.ctx.registry, recipe, order)) >= order.threshold) return 'stocked';
    if (ws.assignedWorker !== 0 && !this.ctx.world.entities.alive(ws.assignedWorker)) return 'no_worker';
    if (this.row(this.ctx.world.entities.get(id, C.Building) as Building).magmaVariantOf && !this.isMagmaPowered(id)) return 'no_magma';
    for (const input of recipe.inputs) {
      const filter = this.inputFilter(recipe, input, order);
      if (filter === null || this.items.countAvailable(filter) < input.count) return `waiting for ${input.match}`;
      if (input.distinct === true) {
        const b = this.ctx.world.entities.get(id, C.Building) as Building;
        const tile = this.workTile(b);
        if (this.items.findItems(filter, input.count, tile, 'walker', { reservable: true }).length < input.count) return `waiting for ${input.match}`;
      }
    }
    if (recipe.fuel && !this.isMagmaPowered(id)) {
      const fuel = this.fuelFilter();
      const reactionFuel = recipe.inputs.reduce((count, input) => count + (input.material === 'fuel' ? input.count : 0), 0);
      if (fuel === null || this.items.countAvailable(fuel) < reactionFuel + 1) return 'missing_input';
    }
    if (recipe.container && this.items.countAvailable({ emptyContainer: recipe.container }) < 1) return `waiting for ${recipe.container}`;
    return null;
  }

  fuelFilter(): ItemFilter | null {
    const items = this.ctx.registry.table('items');
    const filter = { types: ['coal_bar', 'charcoal_bar'].filter((type) => items.has(type)).map((type) => items.index(type)) };
    return filter.types.length > 0 && this.items.countAvailable(filter) > 0 ? filter : null;
  }

  /** Alternatives and same-species inputs specified in the content text beyond RecipeDef. */
  inputFilter(recipe: RecipeRow, input: RecipeRow['inputs'][number], order: WorkOrder): ItemFilter | null {
    const registry = this.ctx.registry;
    const filter = recipeInputFilter(registry, input, order);
    const output = recipe.outputs[0];
    const items = registry.table<ItemRow>('items');
    if (output?.item === 'thread' && input.match === 'fiber' && items.has('wool_raw')) {
      filter.types = [items.index('fiber'), items.index('wool_raw')];
      delete filter.type;
    }
    const brewable = output !== undefined && 'plantDrink' in output.material && input.match === 'plant_food';
    const flourCrop = output?.item === 'flour' && input.match === 'plant_food';
    const sameThread = output?.item === 'cloth' && input.match === 'thread';
    if (!brewable && !flourCrop && !sameThread) return filter;
    const materials = registry.table<MaterialRow>('materials');
    const plants = registry.table<PlantRow & { readonly secondary?: { readonly item: string } }>('plants');
    const candidates = sameThread ? materials.ids() : plants.ids().filter((id) => {
      const plant = plants.byId(id);
      return brewable ? plant?.brew !== undefined : plant?.secondary?.item === 'flour';
    });
    for (const candidate of candidates) {
      if (!materials.has(candidate)) continue;
      const materialId = materials.index(candidate);
      if (filter.materialId !== undefined && filter.materialId !== materialId) continue;
      if (filter.materialClass !== undefined && materials.byIndex(materialId)?.class !== filter.materialClass) continue;
      const choice = { ...filter, materialId };
      if (this.items.countAvailable(choice) >= input.count) return choice;
    }
    return null;
  }

  workTile(b: Building): TileIndex {
    return b.footprint[this.row(b).workTile ?? 4] ?? b.origin;
  }

  outputTile(b: Building): TileIndex {
    return b.footprint[this.row(b).outputTile ?? 7] ?? b.origin;
  }

  /** 11 polls this producer after 12 has registered it. */
  producer(): JobProducer {
    return {
      id: 'workshops',
      produce: (ctx, raw) => this.produce(ctx, raw as JobSink),
      onComplete: (raw, ctx) => this.complete(raw as Job, ctx),
      onJobEvent: (event) => this.onJobEvent(event),
      workCentiTicks: (raw) => this.recipe((raw as Job).data['recipe'] as string)?.baseTicks ?
        (this.recipe((raw as Job).data['recipe'] as string) as RecipeRow).baseTicks * 100 : undefined,
      canComplete: (raw) => {
        const job = raw as Job;
        const recipe = this.recipe(job.data['recipe'] as string);
        return recipe === undefined || !recipe.container || this.items.room(job.inputs[job.inputs.length - 1]?.delivered[0] ?? 0) >= (recipe.outputs[0]?.count ?? 0);
      },
    };
  }

  produce(ctx: TickContext, sink: JobSink): void {
    this.mergeRegistered();
    const entities = ctx.world.entities;
    for (const id of entities.with(C.Building)) {
      this.ensure(id);
      const b = entities.get(id, C.Building);
      const ws = this.workshop(id);
      if (b === undefined || ws === undefined || b.state !== 'built' || ws.suspended || ws.currentJobId !== 0 ||
        (this.typeOf(id) !== 'smelter' && !this.byWorkshop.get(this.typeOf(id))?.some(recipeActive))) continue;
      const powered = this.isMagmaPowered(id);
      if (powered !== ws.magmaPowered) this.save(id, { ...ws, magmaPowered: powered });
      const choices = [...ws.orders.map((o, index) => ({ order: o, index, global: false })),
        ...this.globalOrders.map((o, index) => ({ order: o, index, global: true }))];
      let started = false;
      let reason: string | null = null;
      for (const choice of choices) {
        const recipe = this.recipe(choice.order.recipe);
        if (recipe === undefined || !recipeActive(recipe) || recipe.workshop !== this.typeOf(id)) continue;
        if (choice.global && sink.exists(`craft:global:${choice.index}`)) continue;
        const problem = this.problem(choice.order, id);
        if (problem !== null) { if (reason === null && problem !== 'stocked' && problem !== 'complete') reason = problem.startsWith('waiting for ') ? 'missing_input' : problem; continue; }
        const inputs = recipe.inputs.map((input) => ({ filter: this.inputFilter(recipe, input, choice.order) as ItemFilter, count: input.count }));
        if (recipe.fuel && !powered) inputs.push({ filter: this.fuelFilter() as ItemFilter, count: 1 });
        if (recipe.container) inputs.push({ filter: { emptyContainer: recipe.container }, count: 1 });
        const key = choice.global ? `craft:global:${choice.index}` : `craft:${id}:${choice.index}`;
        const jobId = sink.create(key, { type: 'craft', target: { kind: 'building', ref: id }, workTile: this.workTile(b),
          priority: choice.order.priority, inputs, data: { recipe: recipe.id, orderIndex: choice.index, globalOrder: choice.global,
            labor: ctx.registry.table<{ id: string; labor: string | null }>('skills').byId(recipe.skill)?.labor ?? 'crafts',
            skill: recipe.skill, assignedWorker: ws.assignedWorker, workshopWorker: ws.assignedWorker, inputUnits: true,
            anchorTile: this.workTile(b) } });
        this.save(id, { ...this.workshop(id) as Workshop, currentJobId: jobId, lastBlockedReason: null });
        started = true;
        break;
      }
      if (!started) {
        if (reason !== null && reason !== ws.lastBlockedReason) ctx.emit({ type: 'WorkshopBlocked', workshopId: id, reason });
        if (reason === null && ws.lastBlockedReason !== null) ctx.emit({ type: 'WorkshopIdle', workshopId: id });
        if (reason !== ws.lastBlockedReason) this.save(id, { ...ws, lastBlockedReason: reason });
      }
    }
  }

  private onJobEvent(event: GameEvent): void {
    if (event.type !== 'JobCancelled' && event.type !== 'JobCompleted') return;
    const id = event['target'] as EntityId;
    const ws = this.workshop(id);
    if (ws !== undefined && ws.currentJobId === event['jobId']) this.save(id, { ...ws, currentJobId: 0 });
  }

  private materialOf(out: RecipeRow['outputs'][number], job: Job): number {
    const inputs = job.inputs.slice(0, this.recipe(job.data['recipe'] as string)?.inputs.length ?? 0)
      .map((input) => this.items.get(input.delivered[0] ?? 0)?.material ?? 0);
    return resolveOutputMaterial(this.ctx.registry, out, inputs);
  }

  private complete(job: Job, ctx: TickContext): void {
    const id = job.target.ref;
    const b = ctx.world.entities.get(id, C.Building);
    const ws = this.workshop(id);
    const recipe = this.recipe(job.data['recipe'] as string);
    if (b === undefined || ws === undefined || recipe === undefined) return;
    const materials = recipe.outputs.map((out) => this.materialOf(out, job));
    const container = recipe.container ? (job.inputs[job.inputs.length - 1]?.delivered[0] ?? 0) : 0;
    const fuelIndex = recipe.fuel && !this.isMagmaPowered(id) ? recipe.inputs.length : -1;
    const itemsApi = ctx.world.services.items;
    for (let k = 0; k < job.inputs.length; k += 1) {
      if (recipe.container && k === job.inputs.length - 1) continue;
      if (k === fuelIndex || k < recipe.inputs.length) {
        let remaining = k === fuelIndex ? 1 : (recipe.inputs[k]?.count ?? 0);
        for (const item of job.inputs[k]?.delivered ?? []) {
          if (remaining <= 0) break;
          const take = Math.min(remaining, this.items.get(item)?.count ?? 0);
          if (take > 0) itemsApi?.consume(item, take);
          remaining -= take;
        }
      }
    }
    const skills = ctx.world.entities.get(job.workerId, C.Skills);
    const skill = skills?.level[ctx.registry.table('skills').index(recipe.skill)] ?? 0;
    const quality = recipe.quality ? rollQuality(skill, this.ctx.rng) : 1;
    const outAt = this.outputTile(b);
    const itemTable = ctx.registry.table<ItemRow>('items');
    for (let k = 0; k < recipe.outputs.length; k += 1) {
      const out = recipe.outputs[k] as RecipeRow['outputs'][number];
      if (out.permille !== undefined && !this.ctx.rng.chance(out.permille)) continue;
      const options = itemTable.where(`tag:${out.item}`, (row) => row.tags?.includes(out.item) === true);
      const type = itemTable.has(out.item) ? out.item : options.length > 0 ? options[this.ctx.rng.int(0, options.length - 1)]?.id : undefined;
      if (type === undefined) continue;
      const itemId = ctx.spawn.item(itemTable.index(type), materials[k] as number, container === 0 ? outAt : { containerId: container }, out.count, quality);
      itemsApi?.setCrafter?.(itemId, job.workerId);
      ctx.emit({ type: 'ItemCrafted', itemId, quality, crafterId: job.workerId, workshopId: id, recipeId: recipe.id });
      if (quality === 5) ctx.emit({ type: 'MasterworkCreated', itemId, crafterId: job.workerId });
    }
    const attrs = ctx.world.entities.get(job.workerId, C.Attributes);
    grantXp(ctx.world.entities, ctx.registry, job.workerId, recipe.skill, jobXp(recipe.xp, attrs?.wit ?? 0), (e) => ctx.emit(e));
    const index = job.data['orderIndex'] as number;
    const global = job.data['globalOrder'] === true;
    const orders = global ? this.globalOrders : ws.orders;
    const order = orders[index];
    if (order !== undefined && order.recipe === this.recipeIndex(recipe.id) && order.mode === 'once') {
      const next = { ...order, remaining: order.remaining - 1 };
      if (next.remaining <= 0) {
        orders.splice(index, 1);
        ctx.emit({ type: 'WorkOrderCompleted', workshopId: id, recipeId: recipe.id });
      } else orders[index] = next;
    }
    this.save(id, { ...ws, orders: ws.orders.slice(), currentJobId: 0 });
  }
}
