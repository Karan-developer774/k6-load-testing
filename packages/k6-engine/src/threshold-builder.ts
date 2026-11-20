import { PerformanceThreshold } from '@k6-platform/shared-types';

export function buildK6Thresholds(thresholds: PerformanceThreshold[] = []): Record<string, string[]> {
  const result: Record<string, string[]> = {};

  // If no thresholds configured, run in benchmark mode without failing arbitrary thresholds
  if (!thresholds || thresholds.length === 0) {
    return result;
  }

  for (const th of thresholds) {
    if (!th.metric) continue;

    const metric = th.metric;
    let expr = '';

    if (th.aggregation === 'rate') {
      expr = `rate${th.operator}${th.value}`;
    } else if (th.aggregation === 'count') {
      expr = `count${th.operator}${th.value}`;
    } else if (th.aggregation === 'avg') {
      expr = `avg${th.operator}${th.value}`;
    } else if (th.aggregation === 'min') {
      expr = `min${th.operator}${th.value}`;
    } else if (th.aggregation === 'max') {
      expr = `max${th.operator}${th.value}`;
    } else if (['p50', 'p90', 'p95', 'p99'].includes(th.aggregation)) {
      expr = `p(${th.aggregation.replace('p', '')})${th.operator}${th.value}`;
    } else {
      expr = `${th.aggregation}${th.operator}${th.value}`;
    }

    if (!result[metric]) {
      result[metric] = [];
    }
    result[metric].push(expr);
  }

  return result;
}
