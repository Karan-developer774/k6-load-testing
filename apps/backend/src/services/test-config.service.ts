import { prisma } from '../db/prisma.js';
import { TestConfiguration } from '@k6-platform/shared-types';

export class TestConfigService {
  public async createTestConfig(config: TestConfiguration, projectId?: string) {
    return prisma.testConfiguration.create({
      data: {
        projectId: projectId || null,
        apiDefinitionId: config.request?.id || null,
        name: config.name,
        description: config.description || null,
        strategy: config.loadProfile.strategy,
        loadProfileJson: JSON.stringify(config.loadProfile),
        thresholdsJson: JSON.stringify(config.thresholds || []),
        variablesJson: JSON.stringify(config.variables || {}),
      },
    });
  }

  public async listTestConfigs(projectId?: string) {
    const list = await prisma.testConfiguration.findMany({
      where: projectId ? { projectId } : undefined,
      include: { apiDefinition: true },
      orderBy: { updatedAt: 'desc' },
    });

    return list.map((item) => ({
      ...item,
      loadProfile: JSON.parse(item.loadProfileJson),
      thresholds: JSON.parse(item.thresholdsJson),
      variables: JSON.parse(item.variablesJson),
    }));
  }

  public async getTestConfig(id: string) {
    const item = await prisma.testConfiguration.findUnique({
      where: { id },
      include: { apiDefinition: true },
    });
    if (!item) return null;

    return {
      ...item,
      loadProfile: JSON.parse(item.loadProfileJson),
      thresholds: JSON.parse(item.thresholdsJson),
      variables: JSON.parse(item.variablesJson),
    };
  }

  public async deleteTestConfig(id: string) {
    return prisma.testConfiguration.delete({ where: { id } });
  }
}

export const testConfigService = new TestConfigService();
