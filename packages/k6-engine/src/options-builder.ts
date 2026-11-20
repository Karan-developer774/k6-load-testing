import { LoadProfileConfig } from '@k6-platform/shared-types';

export interface K6ScenarioConfig {
  executor: string;
  [key: string]: unknown;
}

export interface K6Options {
  scenarios: Record<string, K6ScenarioConfig>;
  thresholds?: Record<string, string[]>;
  insecureSkipTLSVerify?: boolean;
}

export function buildK6Scenarios(loadProfile: LoadProfileConfig): Record<string, K6ScenarioConfig> {
  const scenarioName = 'api_load_scenario';

  switch (loadProfile.strategy) {
    case 'constant-vus': {
      const vus = loadProfile.vus || 10;
      const duration = loadProfile.duration || '60s';
      const rampUp = loadProfile.rampUpDuration;
      const rampDown = loadProfile.rampDownDuration;

      // If ramp-up or ramp-down is specified, we can express this either as ramping-vus or constant-vus
      if (rampUp || rampDown) {
        const stages = [];
        if (rampUp) {
          stages.push({ duration: rampUp, target: vus });
        }
        stages.push({ duration: duration, target: vus });
        if (rampDown) {
          stages.push({ duration: rampDown, target: 0 });
        }

        return {
          [scenarioName]: {
            executor: 'ramping-vus',
            startVUs: 0,
            stages,
            gracefulRampDown: loadProfile.gracefulRampDown || '5s',
          },
        };
      }

      return {
        [scenarioName]: {
          executor: 'constant-vus',
          vus: vus,
          duration: duration,
          gracefulStop: loadProfile.gracefulStop || '5s',
        },
      };
    }

    case 'ramping-vus': {
      const stages = loadProfile.stages && loadProfile.stages.length > 0
        ? loadProfile.stages.map((s) => ({ duration: s.duration, target: s.target }))
        : [
            { duration: '30s', target: loadProfile.vus || 50 },
            { duration: '60s', target: loadProfile.vus || 50 },
            { duration: '30s', target: 0 },
          ];

      return {
        [scenarioName]: {
          executor: 'ramping-vus',
          startVUs: 0,
          stages,
          gracefulRampDown: loadProfile.gracefulRampDown || '10s',
        },
      };
    }

    case 'constant-arrival-rate': {
      const rate = loadProfile.rate || 50;
      const timeUnit = loadProfile.timeUnit || '1s';
      const duration = loadProfile.duration || '60s';
      const preAllocatedVUs = loadProfile.preAllocatedVUs || Math.max(10, Math.ceil(rate * 0.2));
      const maxVUs = loadProfile.maxVUs || Math.max(preAllocatedVUs * 2, rate * 2);

      return {
        [scenarioName]: {
          executor: 'constant-arrival-rate',
          rate,
          timeUnit,
          duration,
          preAllocatedVUs,
          maxVUs,
        },
      };
    }

    case 'ramping-arrival-rate': {
      const timeUnit = loadProfile.timeUnit || '1s';
      const stages = loadProfile.stages && loadProfile.stages.length > 0
        ? loadProfile.stages.map((s) => ({ duration: s.duration, target: s.target }))
        : [
            { duration: '30s', target: loadProfile.rate || 50 },
            { duration: '60s', target: (loadProfile.rate || 50) * 2 },
            { duration: '30s', target: 0 },
          ];

      const maxTarget = Math.max(...stages.map((s) => s.target));
      const preAllocatedVUs = loadProfile.preAllocatedVUs || Math.max(10, Math.ceil(maxTarget * 0.2));
      const maxVUs = loadProfile.maxVUs || Math.max(preAllocatedVUs * 2, maxTarget * 2);

      return {
        [scenarioName]: {
          executor: 'ramping-arrival-rate',
          startRate: 0,
          timeUnit,
          stages,
          preAllocatedVUs,
          maxVUs,
        },
      };
    }

    case 'shared-iterations': {
      const vus = loadProfile.vus || 10;
      const iterations = loadProfile.iterations || 1000;
      const maxDuration = loadProfile.duration || '10m';

      return {
        [scenarioName]: {
          executor: 'shared-iterations',
          vus,
          iterations,
          maxDuration,
        },
      };
    }

    case 'per-vu-iterations': {
      const vus = loadProfile.vus || 10;
      const iterations = loadProfile.iterations || 50;
      const maxDuration = loadProfile.duration || '10m';

      return {
        [scenarioName]: {
          executor: 'per-vu-iterations',
          vus,
          iterations,
          maxDuration,
        },
      };
    }

    default:
      return {
        [scenarioName]: {
          executor: 'constant-vus',
          vus: 10,
          duration: '30s',
        },
      };
  }
}
