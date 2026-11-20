import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { testConfigService } from '../services/test-config.service.js';
import { executionService } from '../services/execution.service.js';
import { generateK6Script } from '@k6-platform/k6-engine';
import { TestConfiguration } from '@k6-platform/shared-types';
import { validateTargetUrl } from '../security/ssrf-validator.js';

export const testRoutes: FastifyPluginAsync = async (server: FastifyInstance) => {
  // List test configurations
  server.get('/', async (request, reply) => {
    const tests = await testConfigService.listTestConfigs();
    return reply.send({ success: true, count: tests.length, data: tests });
  });

  // Get test configuration by ID
  server.get('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const test = await testConfigService.getTestConfig(id);
    if (!test) {
      return reply.status(404).send({ error: 'Test configuration not found' });
    }
    return reply.send({ success: true, data: test });
  });

  // Save new test configuration
  server.post('/', async (request, reply) => {
    const config = request.body as TestConfiguration;
    if (!config.name || !config.request?.url || !config.loadProfile?.strategy) {
      return reply.status(400).send({
        error: 'name, request.url, and loadProfile.strategy are required',
      });
    }

    const created = await testConfigService.createTestConfig(config);
    return reply.status(201).send({ success: true, data: created });
  });

  // Validate and preview generated script
  server.post('/validate-preview', async (request, reply) => {
    const config = request.body as TestConfiguration;
    if (!config.request?.url) {
      return reply.status(400).send({ error: 'request.url is required' });
    }

    const targetCheck = await validateTargetUrl(config.request.url);
    if (!targetCheck.isValid) {
      return reply.status(400).send({
        valid: false,
        error: targetCheck.reason,
      });
    }

    try {
      const artifact = generateK6Script(config);
      return reply.send({
        valid: true,
        generatedScript: artifact.scriptContent,
        targetCheck,
      });
    } catch (err) {
      return reply.status(400).send({
        valid: false,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  });

  // Execute test directly from configuration
  server.post('/run', async (request, reply) => {
    const config = request.body as TestConfiguration;
    if (!config.request?.url || !config.loadProfile?.strategy) {
      return reply.status(400).send({
        error: 'Invalid test configuration: request.url and loadProfile.strategy are required',
      });
    }

    try {
      const result = await executionService.startExecution(config);
      return reply.status(202).send({
        success: true,
        executionId: result.executionId,
        status: result.status,
      });
    } catch (err) {
      return reply.status(400).send({
        success: false,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  });

  // Delete test configuration
  server.delete('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    await testConfigService.deleteTestConfig(id);
    return reply.send({ success: true, message: 'Test configuration deleted' });
  });
};
