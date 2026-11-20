import { EventEmitter } from 'events';
import { nanoid } from 'nanoid';
import {
  TestConfiguration,
  ExecutionStatus,
  MetricSnapshot,
  ExecutionSummaryReport,
} from '@k6-platform/shared-types';
import { generateK6Script } from '@k6-platform/k6-engine';
import { prisma } from '../db/prisma.js';
import { k6Runner } from './k6-runner.service.js';
import { MetricsAggregator } from './metrics-aggregator.js';
import { validateTargetUrl } from '../security/ssrf-validator.js';
import { decryptSecret } from '../security/crypto-vault.js';
import { config } from '../config/env.js';

export class ExecutionService extends EventEmitter {
  private sseEmitters: Map<string, EventEmitter> = new Map();

  public getSseEmitter(executionId: string): EventEmitter {
    if (!this.sseEmitters.has(executionId)) {
      this.sseEmitters.set(executionId, new EventEmitter());
    }
    return this.sseEmitters.get(executionId)!;
  }

  public async startExecution(
    testConfig: TestConfiguration,
    projectId?: string
  ): Promise<{ executionId: string; status: ExecutionStatus }> {
    // 1. SSRF and Domain Validation
    let allowlist: string[] | undefined;
    if (projectId) {
      const project = await prisma.project.findUnique({ where: { id: projectId } });
      if (project?.allowlistDomains) {
        allowlist = project.allowlistDomains.split(',').map((d) => d.trim());
      }
    }

    const validation = await validateTargetUrl(testConfig.request.url, allowlist);
    if (!validation.isValid) {
      throw new Error(`Target Security Validation Failed: ${validation.reason}`);
    }

    // 2. Validate Quotas
    const vus = testConfig.loadProfile.vus || 1;
    if (vus > config.maxVusCap) {
      throw new Error(
        `Requested VUs (${vus}) exceeds system safety limit (${config.maxVusCap}).`
      );
    }

    // Decrypt credentials if present
    if (testConfig.request.auth) {
      if (testConfig.request.auth.type === 'bearer' && testConfig.request.auth.token.startsWith('enc:')) {
        testConfig.request.auth.token = decryptSecret(testConfig.request.auth.token.replace('enc:', ''));
      } else if (testConfig.request.auth.type === 'basic' && testConfig.request.auth.password.startsWith('enc:')) {
        testConfig.request.auth.password = decryptSecret(testConfig.request.auth.password.replace('enc:', ''));
      }
    }

    const executionId = `exec_${Date.now()}_${nanoid(6)}`;

    // 3. Create Immutable Configuration Snapshot in DB
    await prisma.testExecution.create({
      data: {
        id: executionId,
        projectId: projectId || null,
        testConfigId: testConfig.id || null,
        testName: testConfig.name || 'API Load Test',
        status: 'QUEUED',
        verdict: 'UNKNOWN',
        configurationSnapshot: JSON.stringify(testConfig),
      },
    });

    // 4. Asynchronously launch execution
    this.runJob(executionId, testConfig).catch(async (err) => {
      console.error(`Execution ${executionId} fatal error:`, err);
      await prisma.testExecution.update({
        where: { id: executionId },
        data: {
          status: 'ERROR',
          verdict: 'FAILED',
          errorMessage: err instanceof Error ? err.message : String(err),
        },
      });
      const emitter = this.getSseEmitter(executionId);
      emitter.emit('event', {
        type: 'error',
        message: err instanceof Error ? err.message : String(err),
      });
    });

    return {
      executionId,
      status: 'QUEUED',
    };
  }

  private async runJob(executionId: string, testConfig: TestConfiguration) {
    const emitter = this.getSseEmitter(executionId);

    // Update status to RUNNING
    await prisma.testExecution.update({
      where: { id: executionId },
      data: {
        status: 'RUNNING',
        startedAt: new Date(),
      },
    });
    emitter.emit('event', { type: 'status', status: 'RUNNING' });

    // Generate k6 script
    const artifact = generateK6Script(testConfig);
    await prisma.testExecution.update({
      where: { id: executionId },
      data: { generatedScript: artifact.scriptContent },
    });

    const aggregator = new MetricsAggregator(executionId);

    // Stream real-time 1000ms snapshots to SSE listeners
    aggregator.on('snapshot', (snapshot: MetricSnapshot) => {
      emitter.emit('event', {
        type: 'metric',
        data: snapshot,
      });
    });

    // Log collector
    const logBuffer: string[] = [];
    const handleLog = (logLine: string) => {
      logBuffer.push(logLine);
      emitter.emit('event', {
        type: 'log',
        line: logLine,
      });
    };

    try {
      const result = await k6Runner.runK6Test(
        executionId,
        artifact.scriptContent,
        artifact.envVars,
        aggregator,
        handleLog
      );

      // Final summary calculation
      const finalSummary = aggregator.generateFinalSummary(testConfig);

      // Persist aggregated snapshot metrics to DB (in chunks if needed)
      const snapshots = aggregator.getSnapshots();
      if (snapshots.length > 0) {
        await prisma.executionMetric.createMany({
          data: snapshots.map((s) => ({
            executionId,
            timestamp: new Date(s.timestamp),
            elapsedSeconds: s.elapsedSeconds,
            activeVus: s.activeVus,
            rps: s.rps,
            p50: s.p50,
            p90: s.p90,
            p95: s.p95,
            p99: s.p99,
            avgLatency: s.avgLatency,
            minLatency: s.minLatency,
            maxLatency: s.maxLatency,
            totalRequests: s.totalRequests,
            failedRequests: s.failedRequests,
            errorRate: s.errorRate,
            dataReceived: s.dataReceivedBytes,
            dataSent: s.dataSentBytes,
            checksPassed: s.checksPassed,
            checksFailed: s.checksFailed,
          })),
        });
      }

      // Update test execution final record
      await prisma.testExecution.update({
        where: { id: executionId },
        data: {
          status: 'COMPLETED',
          verdict: finalSummary.verdict,
          finishedAt: new Date(),
          durationSeconds: finalSummary.durationSeconds,
          totalRequests: finalSummary.totalRequests,
          failedRequests: finalSummary.failedRequests,
          errorRate: finalSummary.errorRate,
          avgRps: finalSummary.avgRps,
          peakRps: finalSummary.peakRps,
          peakVus: finalSummary.peakVus,
          minLatency: finalSummary.latency.min,
          maxLatency: finalSummary.latency.max,
          avgLatency: finalSummary.latency.avg,
          p50Latency: finalSummary.latency.p50,
          p90Latency: finalSummary.latency.p90,
          p95Latency: finalSummary.latency.p95,
          p99Latency: finalSummary.latency.p99,
          dataReceivedBytes: finalSummary.dataReceivedBytes,
          dataSentBytes: finalSummary.dataSentBytes,
          checksPassed: finalSummary.checks.passed,
          checksFailed: finalSummary.checks.failed,
          thresholdResultsJson: JSON.stringify(finalSummary.thresholdResults),
        },
      });

      emitter.emit('event', {
        type: 'completed',
        verdict: finalSummary.verdict,
        summary: finalSummary,
      });
    } catch (err) {
      console.error(`Execution ${executionId} stopped with error:`, err);
      const isAborted = k6Runner.getActiveExecution(executionId)?.isAborted;
      const status: ExecutionStatus = isAborted ? 'ABORTED' : 'ERROR';

      await prisma.testExecution.update({
        where: { id: executionId },
        data: {
          status,
          verdict: 'FAILED',
          finishedAt: new Date(),
          errorMessage: err instanceof Error ? err.message : String(err),
        },
      });

      emitter.emit('event', {
        type: 'status',
        status,
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }

  public async stopExecution(executionId: string): Promise<boolean> {
    const stopped = await k6Runner.stopExecution(executionId);
    if (stopped) {
      await prisma.testExecution.update({
        where: { id: executionId },
        data: { status: 'STOPPING' },
      });
      const emitter = this.getSseEmitter(executionId);
      emitter.emit('event', { type: 'status', status: 'STOPPING' });
    }
    return stopped;
  }
}

export const executionService = new ExecutionService();
