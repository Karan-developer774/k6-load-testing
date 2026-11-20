import { ApiRequestDefinition, CheckAssertion } from '@k6-platform/shared-types';

export interface GeneratedRequestScript {
  code: string;
  envVars: Record<string, string>;
}

export function buildK6Request(request: ApiRequestDefinition): GeneratedRequestScript {
  const envVars: Record<string, string> = {};

  // Base URL and params
  envVars['TARGET_URL'] = request.url;

  // Headers map
  const headersMap: Record<string, string> = {};
  if (request.headers && Array.isArray(request.headers)) {
    for (const h of request.headers) {
      if (h.enabled && h.key) {
        headersMap[h.key] = h.value;
      }
    }
  }

  // Handle Authentication securely via ENV
  if (request.auth) {
    switch (request.auth.type) {
      case 'bearer':
        envVars['AUTH_BEARER_TOKEN'] = request.auth.token;
        break;
      case 'basic': {
        const creds = Buffer.from(`${request.auth.username}:${request.auth.password}`).toString('base64');
        envVars['AUTH_BASIC_CREDS'] = creds;
        break;
      }
      case 'apiKey':
        if (request.auth.in === 'header') {
          headersMap[request.auth.key] = request.auth.value;
        }
        break;
      case 'custom':
        headersMap[request.auth.headerName] = request.auth.headerValue;
        break;
      case 'oauth2':
        // OAuth2 client credentials can be pre-fetched or passed via token
        break;
    }
  }

  // Handle Query Parameters
  const queryParams: Record<string, string> = {};
  if (request.queryParams && Array.isArray(request.queryParams)) {
    for (const q of request.queryParams) {
      if (q.enabled && q.key) {
        queryParams[q.key] = q.value;
      }
    }
  }
  envVars['QUERY_PARAMS_JSON'] = JSON.stringify(queryParams);

  // Handle Request Body
  let hasBody = false;
  if (['POST', 'PUT', 'PATCH'].includes(request.method.toUpperCase())) {
    hasBody = true;
    if (request.bodyContent) {
      envVars['REQUEST_BODY'] = request.bodyContent;
    } else {
      envVars['REQUEST_BODY'] = '';
    }

    if (request.bodyType === 'json' && !headersMap['Content-Type']) {
      headersMap['Content-Type'] = 'application/json';
    } else if (request.bodyType === 'xml' && !headersMap['Content-Type']) {
      headersMap['Content-Type'] = 'application/xml';
    } else if (request.bodyType === 'urlencoded' && !headersMap['Content-Type']) {
      headersMap['Content-Type'] = 'application/x-www-form-urlencoded';
    }
  }

  envVars['REQUEST_HEADERS_JSON'] = JSON.stringify(headersMap);

  // Generate checks array
  const assertions = request.assertions && request.assertions.length > 0
    ? request.assertions
    : [
        {
          id: 'default_status',
          name: 'status is 200 or 2xx',
          type: 'statusCode',
          operator: 'lessThan',
          targetValue: 400,
        } as CheckAssertion,
      ];

  const checksLines: string[] = [];
  for (const a of assertions) {
    if (a.type === 'statusCode') {
      if (a.operator === 'equals') {
        checksLines.push(`    '${a.name || 'status is ' + a.targetValue}': (r) => r.status === ${Number(a.targetValue)},`);
      } else if (a.operator === 'lessThan') {
        checksLines.push(`    '${a.name || 'status < ' + a.targetValue}': (r) => r.status < ${Number(a.targetValue)},`);
      }
    } else if (a.type === 'responseTime') {
      checksLines.push(`    '${a.name || 'duration < ' + a.targetValue + 'ms'}': (r) => r.timings.duration < ${Number(a.targetValue)},`);
    } else if (a.type === 'bodyContains') {
      checksLines.push(`    '${a.name || 'body contains target'}': (r) => r.body && r.body.includes(${JSON.stringify(String(a.targetValue))}),`);
    }
  }

  const methodUpper = request.method.toUpperCase();
  const httpMethodCall =
    methodUpper === 'GET'
      ? 'http.get(url, params)'
      : methodUpper === 'POST'
      ? 'http.post(url, payload, params)'
      : methodUpper === 'PUT'
      ? 'http.put(url, payload, params)'
      : methodUpper === 'PATCH'
      ? 'http.patch(url, payload, params)'
      : methodUpper === 'DELETE'
      ? 'http.del(url, payload, params)'
      : `http.request('${methodUpper}', url, payload, params)`;

  const timeoutMs = request.timeoutMs || 30000;

  const code = `
  // Construct URL with query parameters
  let url = __ENV.TARGET_URL;
  const rawParams = __ENV.QUERY_PARAMS_JSON ? JSON.parse(__ENV.QUERY_PARAMS_JSON) : {};
  const queryParts = [];
  for (const k in rawParams) {
    queryParts.push(encodeURIComponent(k) + '=' + encodeURIComponent(rawParams[k]));
  }
  if (queryParts.length > 0) {
    url += (url.includes('?') ? '&' : '?') + queryParts.join('&');
  }

  // Construct Headers
  const headers = __ENV.REQUEST_HEADERS_JSON ? JSON.parse(__ENV.REQUEST_HEADERS_JSON) : {};
  if (__ENV.AUTH_BEARER_TOKEN) {
    headers['Authorization'] = 'Bearer ' + __ENV.AUTH_BEARER_TOKEN;
  } else if (__ENV.AUTH_BASIC_CREDS) {
    headers['Authorization'] = 'Basic ' + __ENV.AUTH_BASIC_CREDS;
  }

  const params = {
    headers: headers,
    timeout: '${timeoutMs}ms',
    tags: { name: '${request.name || 'API_Request'}' },
  };

  ${hasBody ? 'const payload = __ENV.REQUEST_BODY || "";' : 'const payload = null;'}

  const response = ${httpMethodCall};

  check(response, {
${checksLines.join('\n')}
  });
`;

  return {
    code,
    envVars,
  };
}
