import { buildApp } from '../../apps/backend/src/app.js';
import { connectDatabase, prisma } from '../../apps/backend/src/db/prisma.js';
import { executionService } from '../../apps/backend/src/services/execution.service.js';
import { TestConfiguration } from '@k6-platform/shared-types';

async function runIntegrationVerification() {
  console.log('🧪 Starting End-to-End k6 Integration Test...');

  // 1. Connect DB
  await connectDatabase();

  // 2. Start Fastify Server on test port 3009
  const app = await buildApp();
  await app.listen({ port: 3009, host: '127.0.0.1' });
  console.log('✓ Fastify test server running on http://127.0.0.1:3009');

  // 3. Define test configuration targeting the mock endpoint
  const testConfig: TestConfiguration = {
    name: 'E2E Mock User Load Test',
    description: 'Integration test verifying k6 process execution, metric streaming and summary',
    request: {
      name: 'Fetch Mock Users',
      url: 'http://127.0.0.1:3009/api/v1/mock/users',
      method: 'GET',
      headers: [
        { key: 'Accept', value: 'application/json', enabled: true },
        { key: 'X-Test-Runner', value: 'Antigravity-k6', enabled: true },
      ],
      queryParams: [
        { key: 'limit', value: '10', enabled: true },
      ],
      auth: { type: 'none' },
      bodyType: 'none',
      timeoutMs: 5000,
      assertions: [
        {
          id: 'status_200',
          name: 'status is 200',
          type: 'statusCode',
          operator: 'equals',
          targetValue: 200,
        },
      ],
    },
    loadProfile: {
      strategy: 'constant-vus',
      vus: 5,
      duration: '5s',
    },
    thresholds: [
      {
        metric: 'http_req_failed',
        aggregation: 'rate',
        operator: '<',
        value: 0.05,
      },
      {
        metric: 'http_req_duration',
        aggregation: 'p95',
        operator: '<',
        value: 500,
      },
    ],
  };

  console.log('🚀 Triggering executionService.startExecution()...');
  const { executionId, status } = await executionService.startExecution(testConfig);
  console.log(`✓ Execution initiated: ${executionId} (Status: ${status})`);

  // Subscribe to SSE events
  const emitter = executionService.getSseEmitter(executionId);
  emitter.on('event', (evt) => {
    if (evt.type === 'metric') {
      console.log(`  [Telemetry] Elapsed: ${evt.data.elapsedSeconds}s | Active VUs: ${evt.data.activeVus} | RPS: ${evt.data.rps} | P95: ${evt.data.p95}ms | Requests: ${evt.data.totalRequests}`);
    } else if (evt.type === 'status') {
      console.log(`  [Status Update] -> ${evt.status}`);
    } else if (evt.type === 'completed') {
      console.log(`  [Verdict] Completed with verdict: ${evt.verdict}`);
    }
  });

  // Wait for execution to finish
  let attempts = 0;
  while (attempts < 30) {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    attempts++;
    const record = await prisma.testExecution.findUnique({
      where: { id: executionId },
      include: { metrics: true },
    });

    if (record?.status === 'COMPLETED' || record?.status === 'ERROR') {
      console.log('\n📊 Test Execution Record Summary in DB:');
      console.log(`   Status: ${record.status}`);
      console.log(`   Verdict: ${record.verdict}`);
      console.log(`   Duration: ${record.durationSeconds}s`);
      console.log(`   Total Requests: ${record.totalRequests}`);
      console.log(`   Avg RPS: ${record.avgRps}`);
      console.log(`   P50 Latency: ${record.p50Latency}ms`);
      console.log(`   P95 Latency: ${record.p95Latency}ms`);
      console.log(`   Error Rate: ${record.errorRate}%`);
      console.log(`   Checks Passed: ${record.checksPassed}`);
      console.log(`   Snapshots Saved: ${record.metrics.length}`);

      if (record.status === 'COMPLETED' && record.totalRequests > 0) {
        console.log('\n✅ INTEGRATION TEST PASSED! Real k6 execution, telemetry streaming, and database persistence are fully operational.');
      } else {
        console.error('\n❌ Test completed but totalRequests was 0 or status was not COMPLETED');
      }

      await app.close();
      await prisma.$disconnect();
      process.exit(record.status === 'COMPLETED' ? 0 : 1);
    }
  }

  console.error('❌ Test timed out waiting for execution completion');
  await app.close();
  await prisma.$disconnect();
  process.exit(1);
}

runIntegrationVerification().catch((err) => {
  console.error('Test execution error:', err);
  process.exit(1);
});
