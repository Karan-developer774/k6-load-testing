import { prisma } from '../db/prisma.js';
import { ApiRequestDefinition } from '@k6-platform/shared-types';
import { encryptSecret } from '../security/crypto-vault.js';

export class ApiDefinitionService {
  public async createApi(data: ApiRequestDefinition, projectId?: string) {
    let encryptedAuth: string | null = null;
    let authType = data.auth?.type || 'none';

    if (data.auth) {
      if (data.auth.type === 'bearer') {
        encryptedAuth = encryptSecret(data.auth.token);
      } else if (data.auth.type === 'basic') {
        encryptedAuth = encryptSecret(data.auth.password);
      }
    }

    return prisma.apiDefinition.create({
      data: {
        projectId: projectId || null,
        name: data.name,
        method: data.method,
        url: data.url,
        headersJson: JSON.stringify(data.headers || []),
        queryParamsJson: JSON.stringify(data.queryParams || []),
        authType,
        authConfigEncrypted: encryptedAuth,
        bodyType: data.bodyType || 'none',
        bodyContent: data.bodyContent || null,
        timeoutMs: data.timeoutMs || 30000,
        insecureSkipTlsVerify: data.insecureSkipTlsVerify ?? false,
        tagsJson: JSON.stringify(data.tags || {}),
        assertionsJson: JSON.stringify(data.assertions || []),
      },
    });
  }

  public async listApis(projectId?: string) {
    const records = await prisma.apiDefinition.findMany({
      where: projectId ? { projectId } : undefined,
      orderBy: { updatedAt: 'desc' },
    });

    return records.map((r) => ({
      ...r,
      headers: JSON.parse(r.headersJson),
      queryParams: JSON.parse(r.queryParamsJson),
      tags: JSON.parse(r.tagsJson),
      assertions: JSON.parse(r.assertionsJson),
      authConfigEncrypted: undefined, // Redact from list response
    }));
  }

  public async getApi(id: string) {
    const r = await prisma.apiDefinition.findUnique({ where: { id } });
    if (!r) return null;

    return {
      ...r,
      headers: JSON.parse(r.headersJson),
      queryParams: JSON.parse(r.queryParamsJson),
      tags: JSON.parse(r.tagsJson),
      assertions: JSON.parse(r.assertionsJson),
      authConfigEncrypted: undefined,
    };
  }

  public async deleteApi(id: string) {
    return prisma.apiDefinition.delete({ where: { id } });
  }
}

export const apiService = new ApiDefinitionService();
