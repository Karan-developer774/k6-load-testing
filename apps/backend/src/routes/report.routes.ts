import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { reportService } from '../services/report.service.js';

export const reportRoutes: FastifyPluginAsync = async (server: FastifyInstance) => {
  // Get complete report
  server.get('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const report = await reportService.getExecutionReport(id);
    if (!report) {
      return reply.status(404).send({ error: 'Report not found for execution ID' });
    }
    return reply.send({ success: true, data: report });
  });

  // Export CSV
  server.get('/:id/export.csv', async (request, reply) => {
    const { id } = request.params as { id: string };
    const csvData = await reportService.exportExecutionCsv(id);
    reply.header('Content-Type', 'text/csv');
    reply.header('Content-Disposition', `attachment; filename="execution-${id}-metrics.csv"`);
    return reply.send(csvData);
  });

  // Compare two executions
  server.post('/compare', async (request, reply) => {
    const { idA, idB } = request.body as { idA: string; idB: string };
    if (!idA || !idB) {
      return reply.status(400).send({ error: 'idA and idB are required for comparison' });
    }

    try {
      const comparison = await reportService.compareExecutions(idA, idB);
      return reply.send({ success: true, data: comparison });
    } catch (err) {
      return reply.status(400).send({
        error: err instanceof Error ? err.message : String(err),
      });
    }
  });
};
