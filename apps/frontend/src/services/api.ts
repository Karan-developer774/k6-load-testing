import { TestConfiguration, ApiRequestDefinition } from '@k6-platform/shared-types';

const API_BASE = 'http://localhost:3001/api/v1';

export async function fetchApis() {
  const res = await fetch(`${API_BASE}/apis`);
  return res.json();
}

export async function createApi(apiDef: ApiRequestDefinition) {
  const res = await fetch(`${API_BASE}/apis`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(apiDef),
  });
  return res.json();
}

export async function fetchExecutions(limit = 50) {
  const res = await fetch(`${API_BASE}/executions?limit=${limit}`);
  return res.json();
}

export async function fetchExecution(id: string) {
  const res = await fetch(`${API_BASE}/executions/${id}`);
  return res.json();
}

export async function stopExecution(id: string) {
  const res = await fetch(`${API_BASE}/executions/${id}/stop`, {
    method: 'POST',
  });
  return res.json();
}

export async function runTest(config: TestConfiguration) {
  const res = await fetch(`${API_BASE}/tests/run`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config),
  });
  return res.json();
}

export async function validatePreview(config: TestConfiguration) {
  const res = await fetch(`${API_BASE}/tests/validate-preview`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config),
  });
  return res.json();
}

export async function fetchReport(id: string) {
  const res = await fetch(`${API_BASE}/reports/${id}`);
  return res.json();
}

export async function compareExecutions(idA: string, idB: string) {
  const res = await fetch(`${API_BASE}/reports/compare`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idA, idB }),
  });
  return res.json();
}

export function getSseUrl(id: string): string {
  return `${API_BASE}/executions/${id}/stream`;
}
