import { prisma } from '../db/prisma.js';

export class ReportService {
  public async getExecutionReport(executionId: string) {
    const execution = await prisma.testExecution.findUnique({
      where: { id: executionId },
      include: {
        metrics: {
          orderBy: { elapsedSeconds: 'asc' },
        },
      },
    });

    if (!execution) return null;

    let configurationSnapshot = null;
    let thresholdResults = [];

    try {
      configurationSnapshot = JSON.parse(execution.configurationSnapshot);
    } catch {}

    try {
      if (execution.thresholdResultsJson) {
        thresholdResults = JSON.parse(execution.thresholdResultsJson);
      }
    } catch {}

    return {
      execution,
      configurationSnapshot,
      thresholdResults,
      metricsCount: execution.metrics.length,
      metrics: execution.metrics,
    };
  }

  public async compareExecutions(idA: string, idB: string) {
    const [execA, execB] = await Promise.all([
      prisma.testExecution.findUnique({ where: { id: idA } }),
      prisma.testExecution.findUnique({ where: { id: idB } }),
    ]);

    if (!execA || !execB) {
      throw new Error('One or both execution records could not be found');
    }

    const latencyDiffP95 = execB.p95Latency - execA.p95Latency;
    const rpsDiff = execB.avgRps - execA.avgRps;
    const errorRateDiff = execB.errorRate - execA.errorRate;

    return {
      runA: {
        id: execA.id,
        testName: execA.testName,
        status: execA.status,
        verdict: execA.verdict,
        startedAt: execA.startedAt,
        durationSeconds: execA.durationSeconds,
        totalRequests: execA.totalRequests,
        avgRps: execA.avgRps,
        p50Latency: execA.p50Latency,
        p95Latency: execA.p95Latency,
        p99Latency: execA.p99Latency,
        errorRate: execA.errorRate,
      },
      runB: {
        id: execB.id,
        testName: execB.testName,
        status: execB.status,
        verdict: execB.verdict,
        startedAt: execB.startedAt,
        durationSeconds: execB.durationSeconds,
        totalRequests: execB.totalRequests,
        avgRps: execB.avgRps,
        p50Latency: execB.p50Latency,
        p95Latency: execB.p95Latency,
        p99Latency: execB.p99Latency,
        errorRate: execB.errorRate,
      },
      comparison: {
        latencyDiffP95Ms: Number(latencyDiffP95.toFixed(2)),
        latencyImproved: latencyDiffP95 <= 0,
        rpsDiff: Number(rpsDiff.toFixed(2)),
        errorRateDiff: Number(errorRateDiff.toFixed(2)),
      },
    };
  }

  public async exportExecutionCsv(executionId: string): Promise<string> {
    const metrics = await prisma.executionMetric.findMany({
      where: { executionId },
      orderBy: { elapsedSeconds: 'asc' },
    });

    const headers = [
      'ElapsedSec',
      'ActiveVUs',
      'RPS',
      'P50_ms',
      'P90_ms',
      'P95_ms',
      'P99_ms',
      'AvgLatency_ms',
      'TotalRequests',
      'FailedRequests',
      'ErrorRatePercent',
    ];

    const rows = metrics.map((m) => [
      m.elapsedSeconds,
      m.activeVus,
      m.rps,
      m.p50,
      m.p90,
      m.p95,
      m.p99,
      m.avgLatency,
      m.totalRequests,
      m.failedRequests,
      m.errorRate,
    ]);

    return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
  }
}

export const reportService = new ReportService();
