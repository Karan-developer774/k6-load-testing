import { EventEmitter } from 'events';
import { MetricSnapshot, ExecutionSummaryReport, TestConfiguration, TestResultVerdict } from '@k6-platform/shared-types';

interface SecondBucket {
  second: number;
  latencies: number[];
  requestsCount: number;
  failedCount: number;
  vus: number;
  dataReceived: number;
  dataSent: number;
  checksPassed: number;
  checksFailed: number;
}

export class MetricsAggregator extends EventEmitter {
  private startTime: number = 0;
  private currentSecond: number = 0;
  private currentBucket: SecondBucket;
  private intervalTimer: NodeJS.Timeout | null = null;

  // Cumulative metrics across entire test
  private cumulativeTotalRequests: number = 0;
  private cumulativeFailedRequests: number = 0;
  private cumulativeDataReceived: number = 0;
  private cumulativeDataSent: number = 0;
  private cumulativeChecksPassed: number = 0;
  private cumulativeChecksFailed: number = 0;
  private allLatencies: number[] = [];
  private peakRps: number = 0;
  private peakVus: number = 0;

  // Stored snapshots (1 per second)
  private snapshots: MetricSnapshot[] = [];

  constructor(private executionId: string) {
    super();
    this.currentBucket = this.createEmptyBucket(0);
  }

  public start() {
    this.startTime = Date.now();
    this.currentSecond = 0;
    this.currentBucket = this.createEmptyBucket(0);

    // Emit aggregated snapshot every 1000ms
    this.intervalTimer = setInterval(() => {
      this.flushCurrentBucket();
    }, 1000);
  }

  public stop() {
    if (this.intervalTimer) {
      clearInterval(this.intervalTimer);
      this.intervalTimer = null;
    }
    this.flushCurrentBucket();
  }

  public ingestMetric(metricName: string, value: number, tags?: Record<string, string>) {
    if (!this.startTime) return;

    const now = Date.now();
    const elapsedSec = Math.max(0, Math.floor((now - this.startTime) / 1000));

    if (elapsedSec > this.currentSecond) {
      this.flushCurrentBucket();
      this.currentSecond = elapsedSec;
      this.currentBucket = this.createEmptyBucket(elapsedSec);
    }

    switch (metricName) {
      case 'http_req_duration':
        this.currentBucket.latencies.push(value);
        this.allLatencies.push(value);
        break;

      case 'http_reqs':
        this.currentBucket.requestsCount += value;
        this.cumulativeTotalRequests += value;
        break;

      case 'http_req_failed':
        if (value > 0) {
          this.currentBucket.failedCount += 1;
          this.cumulativeFailedRequests += 1;
        }
        break;

      case 'vus':
      case 'vus_active':
        this.currentBucket.vus = Math.max(this.currentBucket.vus, value);
        this.peakVus = Math.max(this.peakVus, value);
        break;

      case 'data_received':
        this.currentBucket.dataReceived += value;
        this.cumulativeDataReceived += value;
        break;

      case 'data_sent':
        this.currentBucket.dataSent += value;
        this.cumulativeDataSent += value;
        break;

      case 'checks':
        if (value === 1) {
          this.currentBucket.checksPassed += 1;
          this.cumulativeChecksPassed += 1;
        } else {
          this.currentBucket.checksFailed += 1;
          this.cumulativeChecksFailed += 1;
        }
        break;
    }
  }

  private createEmptyBucket(second: number): SecondBucket {
    return {
      second,
      latencies: [],
      requestsCount: 0,
      failedCount: 0,
      vus: this.peakVus || 0,
      dataReceived: 0,
      dataSent: 0,
      checksPassed: 0,
      checksFailed: 0,
    };
  }

  private flushCurrentBucket() {
    const bucket = this.currentBucket;
    const latencies = bucket.latencies;
    latencies.sort((a, b) => a - b);

    const rps = bucket.requestsCount;
    this.peakRps = Math.max(this.peakRps, rps);

    const p50 = this.getPercentile(latencies, 50);
    const p90 = this.getPercentile(latencies, 90);
    const p95 = this.getPercentile(latencies, 95);
    const p99 = this.getPercentile(latencies, 99);
    const avgLatency = latencies.length > 0 ? latencies.reduce((a, b) => a + b, 0) / latencies.length : 0;
    const minLatency = latencies.length > 0 ? latencies[0] : 0;
    const maxLatency = latencies.length > 0 ? latencies[latencies.length - 1] : 0;

    const errorRate = this.cumulativeTotalRequests > 0
      ? this.cumulativeFailedRequests / this.cumulativeTotalRequests
      : 0;

    const snapshot: MetricSnapshot = {
      timestamp: Date.now(),
      elapsedSeconds: bucket.second,
      activeVus: bucket.vus,
      rps,
      p50: Number(p50.toFixed(2)),
      p90: Number(p90.toFixed(2)),
      p95: Number(p95.toFixed(2)),
      p99: Number(p99.toFixed(2)),
      avgLatency: Number(avgLatency.toFixed(2)),
      minLatency: Number(minLatency.toFixed(2)),
      maxLatency: Number(maxLatency.toFixed(2)),
      totalRequests: this.cumulativeTotalRequests,
      failedRequests: this.cumulativeFailedRequests,
      errorRate: Number((errorRate * 100).toFixed(2)), // in %
      dataReceivedBytes: this.cumulativeDataReceived,
      dataSentBytes: this.cumulativeDataSent,
      checksPassed: this.cumulativeChecksPassed,
      checksFailed: this.cumulativeChecksFailed,
    };

    this.snapshots.push(snapshot);
    this.emit('snapshot', snapshot);

    // Advance to next bucket
    this.currentSecond += 1;
    this.currentBucket = this.createEmptyBucket(this.currentSecond);
  }

  private getPercentile(sorted: number[], p: number): number {
    if (sorted.length === 0) return 0;
    const index = (p / 100) * (sorted.length - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    const weight = index - lower;
    if (upper >= sorted.length) return sorted[lower];
    return sorted[lower] * (1 - weight) + sorted[upper] * weight;
  }

  public getSnapshots(): MetricSnapshot[] {
    return this.snapshots;
  }

  public generateFinalSummary(
    configSnapshot: TestConfiguration,
    verdict: TestResultVerdict = 'PASSED',
    errorMessage?: string
  ): ExecutionSummaryReport {
    this.allLatencies.sort((a, b) => a - b);
    const totalDurationSec = Math.max(1, Math.round((Date.now() - this.startTime) / 1000));
    const avgRps = totalDurationSec > 0 ? this.cumulativeTotalRequests / totalDurationSec : 0;
    const errorRate = this.cumulativeTotalRequests > 0
      ? (this.cumulativeFailedRequests / this.cumulativeTotalRequests) * 100
      : 0;

    const avgLat = this.allLatencies.length > 0
      ? this.allLatencies.reduce((a, b) => a + b, 0) / this.allLatencies.length
      : 0;

    const totalChecks = this.cumulativeChecksPassed + this.cumulativeChecksFailed;
    const passRate = totalChecks > 0 ? (this.cumulativeChecksPassed / totalChecks) * 100 : 100;

    // Evaluate Thresholds
    const thresholdResults = (configSnapshot.thresholds || []).map((th) => {
      let actualVal = 0;
      if (th.metric === 'http_req_failed' && th.aggregation === 'rate') {
        actualVal = errorRate / 100;
      } else if (th.metric === 'http_req_duration') {
        if (th.aggregation === 'p95') actualVal = this.getPercentile(this.allLatencies, 95);
        else if (th.aggregation === 'p99') actualVal = this.getPercentile(this.allLatencies, 99);
        else if (th.aggregation === 'p50') actualVal = this.getPercentile(this.allLatencies, 50);
        else if (th.aggregation === 'avg') actualVal = avgLat;
      } else if (th.metric === 'checks' && th.aggregation === 'rate') {
        actualVal = passRate / 100;
      }

      let passed = true;
      if (th.operator === '<') passed = actualVal < th.value;
      else if (th.operator === '<=') passed = actualVal <= th.value;
      else if (th.operator === '>') passed = actualVal > th.value;
      else if (th.operator === '>=') passed = actualVal >= th.value;

      return {
        threshold: `${th.metric} ${th.aggregation}${th.operator}${th.value}`,
        actualValue: Number(actualVal.toFixed(3)),
        passed,
      };
    });

    const anyFailedThreshold = thresholdResults.some((t) => !t.passed);
    let finalVerdict: TestResultVerdict = 'PASSED';

    if (this.cumulativeTotalRequests === 0 || errorRate >= 50 || verdict === 'FAILED') {
      finalVerdict = 'FAILED';
    } else if (anyFailedThreshold) {
      finalVerdict = errorRate > 5 ? 'FAILED' : 'SLA_EXCEEDED';
    } else {
      finalVerdict = 'PASSED';
    }

    return {
      executionId: this.executionId,
      testId: configSnapshot.id,
      testName: configSnapshot.name,
      status: finalVerdict === 'FAILED' ? 'COMPLETED' : 'COMPLETED',
      verdict: finalVerdict,
      startedAt: new Date(this.startTime).toISOString(),
      finishedAt: new Date().toISOString(),
      durationSeconds: totalDurationSec,
      totalRequests: this.cumulativeTotalRequests,
      failedRequests: this.cumulativeFailedRequests,
      errorRate: Number(errorRate.toFixed(2)),
      avgRps: Number(avgRps.toFixed(2)),
      peakRps: this.peakRps,
      peakVus: this.peakVus,
      latency: {
        min: Number((this.allLatencies[0] || 0).toFixed(2)),
        max: Number((this.allLatencies[this.allLatencies.length - 1] || 0).toFixed(2)),
        avg: Number(avgLat.toFixed(2)),
        p50: Number(this.getPercentile(this.allLatencies, 50).toFixed(2)),
        p90: Number(this.getPercentile(this.allLatencies, 90).toFixed(2)),
        p95: Number(this.getPercentile(this.allLatencies, 95).toFixed(2)),
        p99: Number(this.getPercentile(this.allLatencies, 99).toFixed(2)),
      },
      dataReceivedBytes: this.cumulativeDataReceived,
      dataSentBytes: this.cumulativeDataSent,
      checks: {
        total: totalChecks,
        passed: this.cumulativeChecksPassed,
        failed: this.cumulativeChecksFailed,
        passRate: Number(passRate.toFixed(2)),
      },
      thresholdResults,
      configurationSnapshot: configSnapshot,
      errorMessage,
    };
  }
}
