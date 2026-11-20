import { buildApp } from './app.js';
import { config } from './config/env.js';
import { connectDatabase } from './db/prisma.js';

async function bootstrap() {
  try {
    console.log('⚡ Initializing Antigravity k6 Load Testing Platform (Fastify Backend)...');
    
    // Connect to database
    await connectDatabase();

    const app = await buildApp();

    await app.listen({
      port: config.port,
      host: config.host,
    });

    console.log(`🚀 Fastify Server listening on http://${config.host}:${config.port}`);
    console.log(`📖 Swagger API Docs available at http://${config.host}:${config.port}/docs`);
    console.log(`🎯 Mock target endpoints ready at http://${config.host}:${config.port}/api/v1/mock/users`);
  } catch (err) {
    console.error('Fatal bootstrap error:', err);
    process.exit(1);
  }
}

bootstrap();
