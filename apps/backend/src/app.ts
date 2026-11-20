import Fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';

import { apiRoutes } from './routes/api.routes.js';
import { testRoutes } from './routes/test.routes.js';
import { executionRoutes } from './routes/execution.routes.js';
import { reportRoutes } from './routes/report.routes.js';
import { mockRoutes } from './routes/mock.routes.js';

export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: process.env.NODE_ENV === 'test' ? false : { level: 'info' },
  });

  // Security headers via Helmet (configured to allow Swagger UI and SSE)
  await app.register(helmet, {
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: false,
  });

  // CORS for frontend dashboard
  await app.register(cors, {
    origin: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    credentials: true,
  });

  // Global rate limiter (exempt mock routes so load tests against mock APIs are not throttled)
  await app.register(rateLimit, {
    max: 1000,
    timeWindow: '1 minute',
    allowList: (req) => req.url.startsWith('/api/v1/mock'),
  });

  // OpenAPI Swagger Documentation
  await app.register(swagger, {
    openapi: {
      info: {
        title: 'Antigravity Dynamic k6 Load Testing Platform API',
        description: 'Production-Grade Dynamic API Load Testing Platform using Fastify and Grafana k6',
        version: '1.0.0',
      },
      servers: [{ url: 'http://localhost:3001' }],
    },
  });

  await app.register(swaggerUi, {
    routePrefix: '/docs',
  });

  // Healthcheck endpoint
  app.get('/health', async () => {
    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    };
  });

  // Register API Routes
  await app.register(apiRoutes, { prefix: '/api/v1/apis' });
  await app.register(testRoutes, { prefix: '/api/v1/tests' });
  await app.register(executionRoutes, { prefix: '/api/v1/executions' });
  await app.register(reportRoutes, { prefix: '/api/v1/reports' });
  await app.register(mockRoutes, { prefix: '/api/v1/mock' });

  return app;
}
