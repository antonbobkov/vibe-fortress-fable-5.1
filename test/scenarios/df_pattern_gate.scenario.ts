/** T-M6-13 gate pattern: the bridge seals a scripted raid and restores access when lowered. */
import bridge from './bd_bridge.scenario';
import type { Scenario } from './runner';

const scenario: Scenario = { ...bridge, id: 'df_pattern_gate', seed: 'df-pattern-gate' };
export default scenario;
