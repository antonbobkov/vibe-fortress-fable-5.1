import { BONE_PER_SIZE, FAT_PER_SIZE, HIDE_MIN_SIZE, LARGE_HIDE_SIZE, MEAT_PER_SIZE, SKULL_MIN_SIZE } from './constants';

export interface ButcherYields {
  readonly meat: number;
  readonly hide: number;
  readonly bone: number;
  readonly fat: number;
  readonly skull: number;
  readonly shell: number;
}

/** 09 § Butchery: divisions count whole items. */
export function butcherYields(size: number, shelled = false, juvenile = false, rotten = false): ButcherYields {
  const hide = size < HIDE_MIN_SIZE ? 0 : size >= LARGE_HIDE_SIZE ? 2 : 1;
  return {
    meat: rotten ? 0 : juvenile ? Math.max(1, Math.floor(Math.max(1, Math.floor(size / MEAT_PER_SIZE)) / 2)) : Math.max(1, Math.floor(size / MEAT_PER_SIZE)),
    hide: rotten || shelled ? 0 : hide,
    bone: Math.floor(size / BONE_PER_SIZE),
    fat: rotten ? 0 : Math.floor(size / FAT_PER_SIZE),
    skull: rotten || size < SKULL_MIN_SIZE ? 0 : 1,
    shell: rotten || !shelled ? 0 : Math.max(1, hide),
  };
}
