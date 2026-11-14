import { BONE_PER_SIZE, FAT_PER_SIZE, HIDE_MIN_SIZE, LARGE_HIDE_SIZE, MEAT_PER_SIZE, SKULL_MIN_SIZE } from './constants';

export interface ButcherYields {
  readonly meat: number;
  readonly hide: number;
  readonly bone: number;
  readonly fat: number;
  readonly skull: number;
  readonly shell: number;
}

/** One butcher part (`creatures.md` § Butcher parts): `count` items of `item`, made of `material`. */
export interface ButcherPart {
  readonly item: string;
  readonly material: string;
  readonly count: number;
}

/** 09 § Butchery's yields with the species' butcher parts (`foraging.butcherYields(species)`). */
export interface ButcherYieldsWithParts extends ButcherYields {
  readonly parts: readonly ButcherPart[];
}

/**
 * 09 § Butchery: divisions count whole items. A species with no meat (its row's `meat` is 0) gives
 * no meat and no fat; one with no hide gives no hide.
 */
export function butcherYields(
  size: number,
  shelled = false,
  juvenile = false,
  rotten = false,
  hasMeat = true,
  hasHide = true,
): ButcherYields {
  const hide = size < HIDE_MIN_SIZE ? 0 : size >= LARGE_HIDE_SIZE ? 2 : 1;
  return {
    meat: rotten || !hasMeat ? 0 : juvenile ? Math.max(1, Math.floor(Math.max(1, Math.floor(size / MEAT_PER_SIZE)) / 2)) : Math.max(1, Math.floor(size / MEAT_PER_SIZE)),
    hide: rotten || shelled || !hasHide ? 0 : hide,
    bone: Math.floor(size / BONE_PER_SIZE),
    fat: rotten || !hasMeat ? 0 : Math.floor(size / FAT_PER_SIZE),
    skull: rotten || size < SKULL_MIN_SIZE ? 0 : 1,
    shell: rotten || !shelled ? 0 : Math.max(1, hide),
  };
}

/**
 * 09 § Butchery: the species' butcher parts, given whole (a field butchering does not scale them);
 * a rotten corpse gives none of them.
 */
export function butcherParts(parts: readonly ButcherPart[] | undefined, rotten = false): readonly ButcherPart[] {
  if (rotten || parts === undefined) return [];
  return parts.filter((p) => p.count > 0).map((p) => ({ item: p.item, material: p.material, count: p.count }));
}
