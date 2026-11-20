import React, { useState } from 'react';
import { Play, Code, Plus, Trash2, AlertCircle } from 'lucide-react';
import {
  TestConfiguration,
  HttpMethod,
  LoadStrategy,
  AuthType,
  BodyType,
} from '@k6-platform/shared-types';
import { runTest, validatePreview } from '../services/api.js';
import { VisualLoadCurve } from '../components/VisualLoadCurve.js';

interface TestBuilderProps {
  onStartExecution: (executionId: string) => void;
}

export const TestBuilder: React.FC<TestBuilderProps> = ({ onStartExecution }) => {
  const [testName, setTestName] = useState('API Load Test');
  const [description, setDescription] = useState('Benchmark API under concurrent load');

  const [url, setUrl] = useState('https://fakestoreapi.com/products');
  const [method, setMethod] = useState<HttpMethod>('GET');
  const [timeoutMs, setTimeoutMs] = useState(30000);

  const [headers, setHeaders] = useState<Array<{ key: string; value: string; enabled: boolean }>>([
    { key: 'Accept', value: 'application/json', enabled: true },
  ]);
  const [queryParams, setQueryParams] = useState<Array<{ key: string; value: string; enabled: boolean }>>([]);

  const [authType, setAuthType] = useState<AuthType>('none');
  const [bearerToken, setBearerToken] = useState('');
  const [basicUsername, setBasicUsername] = useState('');
  const [basicPassword, setBasicPassword] = useState('');
  const [apiKeyName, setApiKeyName] = useState('X-API-Key');
  const [apiKeyValue, setApiKeyValue] = useState('');

  const [bodyType, setBodyType] = useState<BodyType>('none');
  const [bodyContent, setBodyContent] = useState('{\n  "name": "Test Item"\n}');

  const [strategy, setStrategy] = useState<LoadStrategy>('constant-vus');
  const [vus, setVus] = useState<number>(100);
  const [duration, setDuration] = useState('60s');
  const [rampUpDuration, setRampUpDuration] = useState('10s');
  const [rampDownDuration, setRampDownDuration] = useState('10s');
  const [arrivalRate, setArrivalRate] = useState<number>(100);

  const [stages, setStages] = useState<Array<{ duration: string; target: number }>>([
    { duration: '15s', target: 50 },
    { duration: '30s', target: 200 },
    { duration: '15s', target: 0 },
  ]);

  const [thresholdP95, setThresholdP95] = useState(500);
  const [thresholdErrorRate, setThresholdErrorRate] = useState(0.01);

  const [activeTab, setActiveTab] = useState<'request' | 'load' | 'thresholds' | 'preview'>('request');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [generatedScriptPreview, setGeneratedScriptPreview] = useState<string | null>(null);

  const buildCurrentConfig = (): TestConfiguration => {
    let authConfig: any = { type: 'none' };
    if (authType === 'bearer') authConfig = { type: 'bearer', token: bearerToken };
    else if (authType === 'basic') authConfig = { type: 'basic', username: basicUsername, password: basicPassword };
    else if (authType === 'apiKey') authConfig = { type: 'apiKey', key: apiKeyName, value: apiKeyValue, in: 'header' };

    return {
      name: testName,
      description,
      request: {
        name: testName,
        url,
        method,
        headers,
        queryParams,
        auth: authConfig,
        bodyType,
        bodyContent: bodyType !== 'none' ? bodyContent : undefined,
        timeoutMs,
        insecureSkipTlsVerify: false,
      },
      loadProfile: {
        strategy,
        vus: ['constant-vus', 'shared-iterations', 'per-vu-iterations'].includes(strategy) ? vus : undefined,
        duration,
        rampUpDuration: strategy === 'constant-vus' ? rampUpDuration : undefined,
        rampDownDuration: strategy === 'constant-vus' ? rampDownDuration : undefined,
        stages: ['ramping-vus', 'ramping-arrival-rate'].includes(strategy) ? stages : undefined,
        rate: strategy.includes('arrival-rate') ? arrivalRate : undefined,
        preAllocatedVUs: Math.max(10, Math.ceil(vus * 0.2)),
        maxVUs: vus * 2,
      },
      thresholds: [
        { metric: 'http_req_failed', aggregation: 'rate', operator: '<', value: thresholdErrorRate },
        { metric: 'http_req_duration', aggregation: 'p95', operator: '<', value: thresholdP95 },
      ],
    };
  };

  const handlePreviewScript = async () => {
    try {
      setValidationError(null);
      const config = buildCurrentConfig();
      const res = await validatePreview(config);
      if (res.valid) {
        setGeneratedScriptPreview(res.generatedScript);
        setActiveTab('preview');
      } else {
        setValidationError(res.error || 'Validation failed');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('Failed to fetch')) {
        setValidationError('Cannot connect to the Fastify backend API (port 3001). Please make sure the backend server is running via "npm run dev" or "npm run dev:backend".');
      } else {
        setValidationError('Failed to generate script preview: ' + msg);
      }
    }
  };

  const handleStartTest = async () => {
    try {
      setIsSubmitting(true);
      setValidationError(null);
      const config = buildCurrentConfig();
      const res = await runTest(config);

      if (res.success && res.executionId) {
        onStartExecution(res.executionId);
      } else {
        setValidationError(res.error || 'Failed to start execution');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('Failed to fetch')) {
        setValidationError('Cannot connect to the Fastify backend API (port 3001). Please make sure the backend server is running via "npm run dev" or "npm run dev:backend".');
      } else {
        setValidationError(msg);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-800 pb-4">
        <div>
          <h1 className="text-lg font-semibold text-zinc-100">Configure Load Test</h1>
          <p className="text-xs text-zinc-400 mt-0.5">
            Define target request parameters, load pattern, and performance thresholds.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handlePreviewScript}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-medium border border-zinc-700 transition"
          >
            <Code className="h-3.5 w-3.5" />
            Preview Script
          </button>

          <button
            onClick={handleStartTest}
            disabled={isSubmitting}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-md bg-zinc-100 hover:bg-white text-zinc-900 text-xs font-semibold transition disabled:opacity-50"
          >
            <Play className="h-3 w-3 fill-zinc-900" />
            {isSubmitting ? 'Starting...' : 'Start Test'}
          </button>
        </div>
      </div>

      {/* Validation Error Alert */}
      {validationError && (
        <div className="rounded-lg border border-rose-900/60 bg-rose-950/30 p-3.5 text-xs text-rose-300 flex items-start gap-2.5">
          <AlertCircle className="h-4 w-4 text-rose-400 flex-shrink-0 mt-0.5" />
          <div className="leading-relaxed">{validationError}</div>
        </div>
      )}

      {/* Clean Tabs */}
      <div className="flex items-center gap-1 border-b border-zinc-800 text-xs">
        {[
          { id: 'request', label: '1. Request' },
          { id: 'load', label: '2. Load Profile' },
          { id: 'thresholds', label: '3. Thresholds' },
          { id: 'preview', label: '4. Script Preview' },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id as any)}
            className={`px-3 py-2 border-b-2 font-medium transition ${
              activeTab === t.id
                ? 'border-zinc-200 text-zinc-100'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* TAB 1: REQUEST */}
      {activeTab === 'request' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            {/* Target URL */}
            <div className="bg-[#111114] p-4 rounded-lg border border-zinc-800 space-y-2.5">
              <label className="text-xs font-medium text-zinc-300">Target Endpoint</label>
              <div className="flex items-center gap-2">
                <select
                  value={method}
                  onChange={(e) => setMethod(e.target.value as HttpMethod)}
                  className="bg-zinc-900 border border-zinc-700 text-zinc-200 rounded px-2.5 py-1.5 text-xs font-mono focus:outline-none focus:border-zinc-500"
                >
                  <option value="GET">GET</option>
                  <option value="POST">POST</option>
                  <option value="PUT">PUT</option>
                  <option value="PATCH">PATCH</option>
                  <option value="DELETE">DELETE</option>
                  <option value="HEAD">HEAD</option>
                </select>

                <input
                  type="text"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://api.example.com/endpoint"
                  className="flex-1 bg-zinc-900 border border-zinc-700 text-zinc-100 rounded px-3 py-1.5 text-xs font-mono focus:outline-none focus:border-zinc-500"
                />
              </div>
            </div>

            {/* Headers */}
            <div className="bg-[#111114] p-4 rounded-lg border border-zinc-800 space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-zinc-300">Headers</span>
                <button
                  onClick={() => setHeaders([...headers, { key: '', value: '', enabled: true }])}
                  className="text-xs text-zinc-400 hover:text-zinc-200 transition"
                >
                  + Add header
                </button>
              </div>

              <div className="space-y-2">
                {headers.map((h, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={h.enabled}
                      onChange={(e) => {
                        const next = [...headers];
                        next[i].enabled = e.target.checked;
                        setHeaders(next);
                      }}
                      className="rounded bg-zinc-900 border-zinc-700"
                    />
                    <input
                      type="text"
                      placeholder="Header Name"
                      value={h.key}
                      onChange={(e) => {
                        const next = [...headers];
                        next[i].key = e.target.value;
                        setHeaders(next);
                      }}
                      className="flex-1 bg-zinc-900 border border-zinc-700 text-zinc-200 rounded px-2.5 py-1 text-xs font-mono"
                    />
                    <input
                      type="text"
                      placeholder="Value"
                      value={h.value}
                      onChange={(e) => {
                        const next = [...headers];
                        next[i].value = e.target.value;
                        setHeaders(next);
                      }}
                      className="flex-1 bg-zinc-900 border border-zinc-700 text-zinc-200 rounded px-2.5 py-1 text-xs font-mono"
                    />
                    <button
                      onClick={() => setHeaders(headers.filter((_, idx) => idx !== i))}
                      className="text-zinc-500 hover:text-zinc-300 p-1"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Request Body */}
            {['POST', 'PUT', 'PATCH'].includes(method) && (
              <div className="bg-[#111114] p-4 rounded-lg border border-zinc-800 space-y-2.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-zinc-300">Request Body</span>
                  <div className="flex items-center gap-1">
                    {(['none', 'json', 'text'] as BodyType[]).map((b) => (
                      <button
                        key={b}
                        onClick={() => setBodyType(b)}
                        className={`px-2 py-0.5 rounded text-[11px] capitalize ${
                          bodyType === b ? 'bg-zinc-800 text-zinc-100 font-medium' : 'text-zinc-400'
                        }`}
                      >
                        {b}
                      </button>
                    ))}
                  </div>
                </div>

                {bodyType !== 'none' && (
                  <textarea
                    rows={5}
                    value={bodyContent}
                    onChange={(e) => setBodyContent(e.target.value)}
                    className="w-full bg-[#0c0c0e] border border-zinc-700 rounded p-2.5 text-xs font-mono text-zinc-200 focus:outline-none focus:border-zinc-500"
                  />
                )}
              </div>
            )}
          </div>

          {/* Right Column: Auth & Test Info */}
          <div className="space-y-4">
            <div className="bg-[#111114] p-4 rounded-lg border border-zinc-800 space-y-3">
              <label className="text-xs font-medium text-zinc-300 block">Authentication</label>
              <select
                value={authType}
                onChange={(e) => setAuthType(e.target.value as AuthType)}
                className="w-full bg-zinc-900 border border-zinc-700 text-zinc-200 rounded p-2 text-xs focus:outline-none focus:border-zinc-500"
              >
                <option value="none">No Authentication</option>
                <option value="bearer">Bearer Token</option>
                <option value="basic">Basic Auth</option>
                <option value="apiKey">API Key</option>
              </select>

              {authType === 'bearer' && (
                <div>
                  <input
                    type="password"
                    value={bearerToken}
                    onChange={(e) => setBearerToken(e.target.value)}
                    placeholder="Token string"
                    className="w-full bg-zinc-900 border border-zinc-700 text-zinc-200 rounded px-2.5 py-1.5 text-xs font-mono"
                  />
                </div>
              )}

              {authType === 'basic' && (
                <div className="space-y-2">
                  <input
                    type="text"
                    placeholder="Username"
                    value={basicUsername}
                    onChange={(e) => setBasicUsername(e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-700 text-zinc-200 rounded px-2.5 py-1 text-xs"
                  />
                  <input
                    type="password"
                    placeholder="Password"
                    value={basicPassword}
                    onChange={(e) => setBasicPassword(e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-700 text-zinc-200 rounded px-2.5 py-1 text-xs"
                  />
                </div>
              )}
            </div>

            <div className="bg-[#111114] p-4 rounded-lg border border-zinc-800 space-y-3">
              <label className="text-xs font-medium text-zinc-300 block">Test Information</label>
              <div>
                <label className="text-[11px] text-zinc-400">Name</label>
                <input
                  type="text"
                  value={testName}
                  onChange={(e) => setTestName(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-700 text-zinc-100 rounded px-2.5 py-1 text-xs mt-1"
                />
              </div>
              <div>
                <label className="text-[11px] text-zinc-400">Description</label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-700 text-zinc-300 rounded px-2.5 py-1 text-xs mt-1"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: LOAD PROFILE */}
      {activeTab === 'load' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <div className="bg-[#111114] p-4 rounded-lg border border-zinc-800 space-y-3">
              <label className="text-xs font-medium text-zinc-300 block">Strategy</label>
              <select
                value={strategy}
                onChange={(e) => setStrategy(e.target.value as LoadStrategy)}
                className="w-full bg-zinc-900 border border-zinc-700 text-zinc-200 rounded p-2 text-xs focus:outline-none focus:border-zinc-500 font-mono"
              >
                <option value="constant-vus">Constant Virtual Users (constant-vus)</option>
                <option value="ramping-vus">Ramping Virtual Users (ramping-vus)</option>
                <option value="constant-arrival-rate">Constant Arrival Rate (constant-arrival-rate)</option>
                <option value="ramping-arrival-rate">Ramping Arrival Rate (ramping-arrival-rate)</option>
                <option value="shared-iterations">Shared Iterations (shared-iterations)</option>
                <option value="per-vu-iterations">Per-VU Iterations (per-vu-iterations)</option>
              </select>
            </div>

            <div className="bg-[#111114] p-4 rounded-lg border border-zinc-800 space-y-4">
              {strategy === 'constant-vus' && (
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between text-xs font-medium mb-1.5">
                      <span className="text-zinc-300">Concurrent Virtual Users</span>
                      <span className="font-mono text-zinc-100 font-semibold">{vus} VUs</span>
                    </div>
                    <input
                      type="range"
                      min={1}
                      max={1000}
                      value={vus}
                      onChange={(e) => setVus(Number(e.target.value))}
                      className="w-full accent-zinc-200 cursor-pointer"
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-3 text-xs">
                    <div>
                      <label className="text-zinc-400 text-[11px]">Ramp-Up</label>
                      <input
                        type="text"
                        value={rampUpDuration}
                        onChange={(e) => setRampUpDuration(e.target.value)}
                        className="w-full bg-zinc-900 border border-zinc-700 text-zinc-100 rounded p-1.5 font-mono mt-1"
                      />
                    </div>
                    <div>
                      <label className="text-zinc-400 text-[11px]">Duration</label>
                      <input
                        type="text"
                        value={duration}
                        onChange={(e) => setDuration(e.target.value)}
                        className="w-full bg-zinc-900 border border-zinc-700 text-zinc-100 rounded p-1.5 font-mono mt-1"
                      />
                    </div>
                    <div>
                      <label className="text-zinc-400 text-[11px]">Ramp-Down</label>
                      <input
                        type="text"
                        value={rampDownDuration}
                        onChange={(e) => setRampDownDuration(e.target.value)}
                        className="w-full bg-zinc-900 border border-zinc-700 text-zinc-100 rounded p-1.5 font-mono mt-1"
                      />
                    </div>
                  </div>
                </div>
              )}

              {strategy === 'ramping-vus' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-zinc-300">Stages</span>
                    <button
                      onClick={() => setStages([...stages, { duration: '30s', target: 100 }])}
                      className="text-zinc-400 hover:text-zinc-200 transition"
                    >
                      + Add Stage
                    </button>
                  </div>

                  <div className="space-y-2">
                    {stages.map((st, i) => (
                      <div key={i} className="flex items-center gap-2 bg-zinc-900/60 p-2 rounded border border-zinc-800 text-xs">
                        <span className="text-zinc-400 font-mono w-14">Stage {i + 1}</span>
                        <input
                          type="text"
                          value={st.duration}
                          onChange={(e) => {
                            const next = [...stages];
                            next[i].duration = e.target.value;
                            setStages(next);
                          }}
                          placeholder="Duration"
                          className="w-20 bg-zinc-900 border border-zinc-700 text-zinc-100 rounded px-2 py-1 font-mono"
                        />
                        <input
                          type="number"
                          value={st.target}
                          onChange={(e) => {
                            const next = [...stages];
                            next[i].target = Number(e.target.value);
                            setStages(next);
                          }}
                          placeholder="Target VUs"
                          className="w-24 bg-zinc-900 border border-zinc-700 text-zinc-100 rounded px-2 py-1 font-mono"
                        />
                        <button
                          onClick={() => setStages(stages.filter((_, idx) => idx !== i))}
                          className="text-zinc-500 hover:text-zinc-300 p-1"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {strategy === 'constant-arrival-rate' && (
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="text-zinc-400 text-[11px]">Target Requests / Sec</label>
                    <input
                      type="number"
                      value={arrivalRate}
                      onChange={(e) => setArrivalRate(Number(e.target.value))}
                      className="w-full bg-zinc-900 border border-zinc-700 text-zinc-100 rounded p-1.5 font-mono mt-1"
                    />
                  </div>
                  <div>
                    <label className="text-zinc-400 text-[11px]">Duration</label>
                    <input
                      type="text"
                      value={duration}
                      onChange={(e) => setDuration(e.target.value)}
                      className="w-full bg-zinc-900 border border-zinc-700 text-zinc-100 rounded p-1.5 font-mono mt-1"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-4">
            <VisualLoadCurve loadProfile={buildCurrentConfig().loadProfile} />
          </div>
        </div>
      )}

      {/* TAB 3: THRESHOLDS */}
      {activeTab === 'thresholds' && (
        <div className="max-w-xl bg-[#111114] p-5 rounded-lg border border-zinc-800 space-y-4 text-xs">
          <div>
            <h3 className="font-semibold text-zinc-200">SLA Thresholds</h3>
            <p className="text-zinc-400 text-[11px] mt-0.5">
              Tests will evaluate to FAILED if any criteria are exceeded.
            </p>
          </div>

          <div className="space-y-3">
            <div>
              <label className="text-zinc-300 font-medium">Max Allowed Error Rate (0.01 = 1%)</label>
              <input
                type="number"
                step="0.005"
                value={thresholdErrorRate}
                onChange={(e) => setThresholdErrorRate(Number(e.target.value))}
                className="w-full bg-zinc-900 border border-zinc-700 text-zinc-100 rounded p-2 font-mono mt-1"
              />
            </div>

            <div>
              <label className="text-zinc-300 font-medium">P95 Latency Cap (ms)</label>
              <input
                type="number"
                step="50"
                value={thresholdP95}
                onChange={(e) => setThresholdP95(Number(e.target.value))}
                className="w-full bg-zinc-900 border border-zinc-700 text-zinc-100 rounded p-2 font-mono mt-1"
              />
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: PREVIEW */}
      {activeTab === 'preview' && (
        <div className="bg-[#111114] p-4 rounded-lg border border-zinc-800 space-y-3">
          <div className="flex items-center justify-between text-xs text-zinc-300">
            <span className="font-medium">Generated k6 ES6 Script</span>
            <button
              onClick={handlePreviewScript}
              className="text-zinc-400 hover:text-zinc-200 transition"
            >
              Regenerate
            </button>
          </div>

          <pre className="p-3 bg-[#0c0c0e] border border-zinc-800 rounded text-xs font-mono text-zinc-300 overflow-x-auto max-h-[450px]">
            {generatedScriptPreview || '// Click "Preview Script" to view code.'}
          </pre>
        </div>
      )}
    </div>
  );
};
