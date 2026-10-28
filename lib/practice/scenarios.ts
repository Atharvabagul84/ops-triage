import { IMAGE_SCENARIO } from './image-scenario';
import { OOM_SCENARIO } from './oom-scenario';
import { SERVICE_SCENARIO } from './service-scenario';
import type { PracticeScenario } from '../../types/practice';
import { OOM_VARIANT, SERVICE_VARIANT, IMAGE_VARIANT } from './scenarios/original-variants';
import { STARTUP_SCENARIO, STARTUP_VARIANT } from './scenarios/startup-cases';
import { SCHEDULING_SCENARIO, SCHEDULING_VARIANT } from './scenarios/scheduling-cases';
import { PROBE_SCENARIO, PROBE_VARIANT } from './scenarios/probe-cases';
import { DNS_SCENARIO, DNS_VARIANT } from './scenarios/dns-cases';
import { CONFIG_SCENARIO, CONFIG_VARIANT } from './scenarios/config-cases';
import { STORAGE_SCENARIO, STORAGE_VARIANT } from './scenarios/storage-cases';
import { ROLLOUT_SCENARIO, ROLLOUT_VARIANT } from './scenarios/rollout-cases';

export const PRACTICE_SCENARIOS: PracticeScenario[] = [
  OOM_SCENARIO, SERVICE_SCENARIO, IMAGE_SCENARIO,
  STARTUP_SCENARIO, SCHEDULING_SCENARIO, PROBE_SCENARIO, DNS_SCENARIO,
  CONFIG_SCENARIO, STORAGE_SCENARIO, ROLLOUT_SCENARIO,
  OOM_VARIANT, SERVICE_VARIANT, IMAGE_VARIANT,
  STARTUP_VARIANT, SCHEDULING_VARIANT, PROBE_VARIANT, DNS_VARIANT,
  CONFIG_VARIANT, STORAGE_VARIANT, ROLLOUT_VARIANT,
];

export const BASE_PRACTICE_SCENARIOS = PRACTICE_SCENARIOS.filter((scenario) => !scenario.variantOf);
