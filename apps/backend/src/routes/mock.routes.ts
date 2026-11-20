import { FastifyInstance, FastifyPluginAsync } from 'fastify';

export const mockRoutes: FastifyPluginAsync = async (server: FastifyInstance) => {
  // Mock users list with optional delay and error rate
  server.get('/users', async (request, reply) => {
    const query = request.query as { delay?: string; failRate?: string };
    const delayMs = parseInt(query.delay || '0', 10);
    const failRate = parseFloat(query.failRate || '0');

    if (failRate > 0 && Math.random() < failRate) {
      return reply.status(500).send({
        error: 'Simulated Internal Server Error',
        timestamp: new Date().toISOString(),
      });
    }

    if (delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }

    return reply.send({
      status: 'success',
      total: 5,
      data: [
        { id: 1, name: 'Alice Smith', email: 'alice@example.com', role: 'admin' },
        { id: 2, name: 'Bob Jones', email: 'bob@example.com', role: 'engineer' },
        { id: 3, name: 'Carol White', email: 'carol@example.com', role: 'viewer' },
        { id: 4, name: 'Dave Brown', email: 'dave@example.com', role: 'qa' },
        { id: 5, name: 'Eve Davis', email: 'eve@example.com', role: 'manager' },
      ],
      timestamp: Date.now(),
    });
  });

  // Mock POST user
  server.post('/users', async (request, reply) => {
    const body = request.body as Record<string, unknown>;
    return reply.status(201).send({
      status: 'created',
      id: Math.floor(Math.random() * 10000),
      received: body,
      createdAt: new Date().toISOString(),
    });
  });

  // Mock slow endpoint
  server.get('/slow', async (request, reply) => {
    const query = request.query as { ms?: string };
    const ms = parseInt(query.ms || '300', 10);
    await new Promise((resolve) => setTimeout(resolve, ms));
    return reply.send({ status: 'delayed', delayMs: ms });
  });

  // Mock error endpoint
  server.get('/error', async (request, reply) => {
    return reply.status(500).send({ error: 'Always fails with HTTP 500' });
  });
};
