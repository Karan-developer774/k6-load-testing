import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { prisma } from '../db/prisma.js';
import { executionService } from '../services/execution.service.js';

export const executionRoutes: FastifyPluginAsync = async (server: FastifyInstance) => {
  // List all executions
  server.get('/', async (request, reply) => {
    const query = request.query as { limit?: string };
    const take = parseInt(query.limit || '50', 10);

    const executions = await prisma.testExecution.findMany({
      take,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        testName: true,
        status: true,
        verdict: true,
        startedAt: true,
        finishedAt: true,
        durationSeconds: true,
        totalRequests: true,
        failedRequests: true,
        errorRate: true,
        avgRps: true,
        peakRps: true,
        peakVus: true,
        p50Latency: true,
        p95Latency: true,
        p99Latency: true,
        createdAt: true,
      },
    });

    return reply.send({ success: true, count: executions.length, data: executions });
  });

  // Get execution details
  server.get('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const execution = await prisma.testExecution.findUnique({
      where: { id },
      include: {
        metrics: {
          orderBy: { elapsedSeconds: 'asc' },
        },
      },
    });

    if (!execution) {
      return reply.status(404).send({ error: 'Execution not found' });
    }

    let parsedSnapshot = null;
    try {
      parsedSnapshot = JSON.parse(execution.configurationSnapshot);
    } catch {}

    let parsedThresholds = [];
    try {
      if (execution.thresholdResultsJson) {
        parsedThresholds = JSON.parse(execution.thresholdResultsJson);
      }
    } catch {}

    return reply.send({
      success: true,
      data: {
        ...execution,
        configurationSnapshot: parsedSnapshot,
        thresholdResults: parsedThresholds,
      },
    });
  });

  // Stop running execution
  server.post('/:id/stop', async (request, reply) => {
    const { id } = request.params as { id: string };
    const stopped = await executionService.stopExecution(id);
    if (!stopped) {
      return reply.status(400).send({
        success: false,
        message: 'Execution is not currently running or cannot be stopped',
      });
    }

    return reply.send({
      success: true,
      message: 'Stop signal successfully sent to worker',
    });
  });

  // Server-Sent Events (SSE) Live Metrics Stream
  server.get('/:id/stream', async (request, reply) => {
    const { id } = request.params as { id: string };

    reply.raw.setHeader('Content-Type', 'text/event-stream');
    reply.raw.setHeader('Cache-Control', 'no-cache, no-transform');
    reply.raw.setHeader('Connection', 'keep-alive');
    reply.raw.setHeader('Access-Control-Allow-Origin', '*');
    reply.raw.flushHeaders();

    const emitter = executionService.getSseEmitter(id);

    // Initial connection ack
    reply.raw.write(`event: connected\ndata: ${JSON.stringify({ executionId: id, connectedAt: Date.now() })}\n\n`);

    const handleEvent = (eventData: { type: string; [key: string]: unknown }) => {
      try {
        reply.raw.write(`event: ${eventData.type}\ndata: ${JSON.stringify(eventData)}\n\n`);
      } catch (err) {
        // Stream write error
      }
    };

    emitter.on('event', handleEvent);

    // Heartbeat ping every 15 seconds to prevent proxy dropouts
    const heartbeat = setInterval(() => {
      try {
        reply.raw.write(': ping\n\n');
      } catch {}
    }, 15000);

    request.raw.on('close', () => {
      clearInterval(heartbeat);
      emitter.off('event', handleEvent);
    });
  });
};
