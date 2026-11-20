import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { apiService } from '../services/api.service.js';
import { ApiRequestDefinition } from '@k6-platform/shared-types';
import { validateTargetUrl } from '../security/ssrf-validator.js';

export const apiRoutes: FastifyPluginAsync = async (server: FastifyInstance) => {
  // List APIs
  server.get('/', async (request, reply) => {
    const apis = await apiService.listApis();
    return reply.send({ success: true, count: apis.length, data: apis });
  });

  // Get API by ID
  server.get('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const api = await apiService.getApi(id);
    if (!api) {
      return reply.status(404).send({ error: 'API definition not found' });
    }
    return reply.send({ success: true, data: api });
  });

  // Validate Target URL endpoint
  server.post('/validate-target', async (request, reply) => {
    const { url } = request.body as { url: string };
    if (!url) {
      return reply.status(400).send({ error: 'URL is required' });
    }
    const result = await validateTargetUrl(url);
    return reply.send(result);
  });

  // Create API
  server.post('/', async (request, reply) => {
    const body = request.body as ApiRequestDefinition;
    if (!body.url || !body.name || !body.method) {
      return reply.status(400).send({ error: 'name, method, and url are required' });
    }

    const validation = await validateTargetUrl(body.url);
    if (!validation.isValid) {
      return reply.status(400).send({
        error: 'Target URL security validation failed',
        details: validation.reason,
      });
    }

    const created = await apiService.createApi(body);
    return reply.status(201).send({ success: true, data: created });
  });

  // Delete API
  server.delete('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    await apiService.deleteApi(id);
    return reply.send({ success: true, message: 'API definition deleted' });
  });
};
