import React, { useState } from 'react';
import {
  Zap,
  Play,
  Code,
  Shield,
  Layers,
  Sliders,
  CheckCircle,
  Plus,
  Trash2,
  AlertTriangle,
  Eye,
  FileCheck,
} from 'lucide-react';
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
  // Test Name & Description
  const [testName, setTestName] = useState('Production API Load Test');
  const [description, setDescription] = useState('Evaluating latency and throughput under peak load');

  // Request Definition
  const [url, setUrl] = useState('http://localhost:3001/api/v1/mock/users');
  const [method, setMethod] = useState<HttpMethod>('GET');
  const [timeoutMs, setTimeoutMs] = useState(30000);

  // Headers & Params
  const [headers, setHeaders] = useState<Array<{ key: string; value: string; enabled: boolean }>>([
    { key: 'Accept', value: 'application/json', enabled: true },
  ]);
  const [queryParams, setQueryParams] = useState<Array<{ key: string; value: string; enabled: boolean }>>([
    { key: 'limit', value: '50', enabled: true },
  ]);

  // Auth
  const [authType, setAuthType] = useState<AuthType>('none');
  const [bearerToken, setBearerToken] = useState('');
  const [basicUsername, setBasicUsername] = useState('');
  const [basicPassword, setBasicPassword] = useState('');
  const [apiKeyName, setApiKeyName] = useState('X-API-Key');
  const [apiKeyValue, setApiKeyValue] = useState('');

  // Body
  const [bodyType, setBodyType] = useState<BodyType>('none');
  const [bodyContent, setBodyContent] = useState('{\n  "name": "Load Test Entity",\n  "active": true\n}');

  // Load Profile
  const [strategy, setStrategy] = useState<LoadStrategy>('constant-vus');
  const [vus, setVus] = useState<number>(100);
  const [duration, setDuration] = useState('60s');
  const [rampUpDuration, setRampUpDuration] = useState('10s');
  const [rampDownDuration, setRampDownDuration] = useState('10s');
  const [arrivalRate, setArrivalRate] = useState<number>(100);

  // Stages for ramping profiles
  const [stages, setStages] = useState<Array<{ duration: string; target: number }>>([
    { duration: '15s', target: 50 },
    { duration: '30s', target: 200 },
    { duration: '30s', target: 500 },
    { duration: '15s', target: 0 },
  ]);

  // Thresholds
  const [thresholdP95, setThresholdP95] = useState(500);
  const [thresholdErrorRate, setThresholdErrorRate] = useState(0.01);

  // UI state
  const [activeTab, setActiveTab] = useState<'request' | 'load' | 'thresholds' | 'preview'>('request');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [generatedScriptPreview, setGeneratedScriptPreview] = useState<string | null>(null);

  // Build current TestConfiguration object
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

  // Pre-fill Mock Users API Example
  const loadMockExample = () => {
    setTestName('Mock Users API Stress Test');
    setUrl('http://localhost:3001/api/v1/mock/users');
    setMethod('GET');
    setStrategy('constant-vus');
    setVus(500);
    setDuration('120s');
    setRampUpDuration('10s');
    setRampDownDuration('10s');
    setThresholdP95(400);
    setThresholdErrorRate(0.01);
  };

  // Preview generated k6 script
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
    } catch (err) {
      setValidationError('Failed to generate script preview: ' + err);
    }
  };

  // Launch Test
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
    } catch (err) {
      setValidationError(String(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <Zap className="h-5 w-5 text-blue-500" />
            Dynamic API Load Test Builder
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Configure request parameters, select load strategies, and execute tests without manual code edits.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadMockExample}
            className="px-3 py-1.5 rounded-lg border border-slate-700 hover:border-slate-600 bg-slate-800/80 text-slate-300 text-xs font-semibold hover:text-white transition"
          >
            Pre-fill 500 VUs Example
          </button>

          <button
            onClick={handlePreviewScript}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-indigo-500/40 bg-indigo-500/10 text-indigo-400 text-xs font-semibold hover:bg-indigo-500/20 transition"
          >
            <Code className="h-4 w-4" />
            Preview k6 Script
          </button>

          <button
            onClick={handleStartTest}
            disabled={isSubmitting}
            className="flex items-center gap-2 px-5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-lg shadow-blue-600/30 transition active:scale-95 disabled:opacity-50"
          >
            <Play className="h-4 w-4 fill-white" />
            {isSubmitting ? 'Validating...' : 'Start Load Test'}
          </button>
        </div>
      </div>

      {/* Validation Error Alert */}
      {validationError && (
        <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-4 text-xs text-rose-300 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-rose-400 flex-shrink-0" />
          <div>
            <div className="font-bold text-rose-200">Validation / Security Alert</div>
            <div>{validationError}</div>
          </div>
        </div>
      )}

      {/* Tabs Switcher */}
      <div className="flex items-center gap-2 border-b border-slate-800">
        <button
          onClick={() => setActiveTab('request')}
          className={`flex items-center gap-2 pb-2.5 px-3 text-xs font-semibold border-b-2 transition ${
            activeTab === 'request'
              ? 'border-blue-500 text-blue-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Layers className="h-4 w-4" />
          1. Request & Authentication
        </button>

        <button
          onClick={() => setActiveTab('load')}
          className={`flex items-center gap-2 pb-2.5 px-3 text-xs font-semibold border-b-2 transition ${
            activeTab === 'load'
              ? 'border-blue-500 text-blue-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Sliders className="h-4 w-4" />
          2. Load Profile & Stages
        </button>

        <button
          onClick={() => setActiveTab('thresholds')}
          className={`flex items-center gap-2 pb-2.5 px-3 text-xs font-semibold border-b-2 transition ${
            activeTab === 'thresholds'
              ? 'border-blue-500 text-blue-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <CheckCircle className="h-4 w-4" />
          3. Performance Thresholds
        </button>

        <button
          onClick={() => setActiveTab('preview')}
          className={`flex items-center gap-2 pb-2.5 px-3 text-xs font-semibold border-b-2 transition ${
            activeTab === 'preview'
              ? 'border-blue-500 text-blue-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Eye className="h-4 w-4" />
          4. Generated Script Preview
        </button>
      </div>

      {/* TAB 1: REQUEST & AUTH */}
      {activeTab === 'request' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            {/* Target URL & Method */}
            <div className="bg-[#0d1322] p-4 rounded-xl border border-slate-800 space-y-3">
              <label className="text-xs font-semibold text-slate-300">Target API Endpoint</label>
              <div className="flex items-center gap-2">
                <select
                  value={method}
                  onChange={(e) => setMethod(e.target.value as HttpMethod)}
                  className="bg-slate-900 border border-slate-700 text-white rounded-lg px-3 py-2 text-xs font-bold focus:outline-none focus:border-blue-500"
                >
                  <option value="GET">GET</option>
                  <option value="POST">POST</option>
                  <option value="PUT">PUT</option>
                  <option value="PATCH">PATCH</option>
                  <option value="DELETE">DELETE</option>
                  <option value="HEAD">HEAD</option>
                  <option value="OPTIONS">OPTIONS</option>
                </select>

                <input
                  type="text"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://api.example.com/v1/resource"
                  className="flex-1 bg-slate-900 border border-slate-700 text-slate-100 rounded-lg px-3 py-2 text-xs font-mono focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="flex items-center justify-between text-[11px] text-slate-500">
                <span>SSRF Protection enforces domain authorization and private CIDR restrictions.</span>
                <span className="text-blue-400">Timeout: {timeoutMs}ms</span>
              </div>
            </div>

            {/* Headers Editor */}
            <div className="bg-[#0d1322] p-4 rounded-xl border border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-300">HTTP Headers</span>
                <button
                  onClick={() => setHeaders([...headers, { key: '', value: '', enabled: true }])}
                  className="flex items-center gap-1 text-[11px] text-blue-400 hover:text-blue-300"
                >
                  <Plus className="h-3 w-3" />
                  Add Header
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
                      className="rounded bg-slate-900 border-slate-700 text-blue-600"
                    />
                    <input
                      type="text"
                      placeholder="Header Name (e.g. Content-Type)"
                      value={h.key}
                      onChange={(e) => {
                        const next = [...headers];
                        next[i].key = e.target.value;
                        setHeaders(next);
                      }}
                      className="flex-1 bg-slate-900 border border-slate-700 text-slate-200 rounded px-2.5 py-1.5 text-xs font-mono"
                    />
                    <input
                      type="text"
                      placeholder="Header Value"
                      value={h.value}
                      onChange={(e) => {
                        const next = [...headers];
                        next[i].value = e.target.value;
                        setHeaders(next);
                      }}
                      className="flex-1 bg-slate-900 border border-slate-700 text-slate-200 rounded px-2.5 py-1.5 text-xs font-mono"
                    />
                    <button
                      onClick={() => setHeaders(headers.filter((_, idx) => idx !== i))}
                      className="text-slate-500 hover:text-rose-400 p-1"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Request Body Editor */}
            {['POST', 'PUT', 'PATCH'].includes(method) && (
              <div className="bg-[#0d1322] p-4 rounded-xl border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-300">Request Body Payload</span>
                  <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-md text-[11px]">
                    {(['none', 'json', 'xml', 'urlencoded', 'text'] as BodyType[]).map((b) => (
                      <button
                        key={b}
                        onClick={() => setBodyType(b)}
                        className={`px-2 py-0.5 rounded capitalize ${
                          bodyType === b ? 'bg-blue-600 text-white font-bold' : 'text-slate-400'
                        }`}
                      >
                        {b}
                      </button>
                    ))}
                  </div>
                </div>

                {bodyType !== 'none' && (
                  <textarea
                    rows={6}
                    value={bodyContent}
                    onChange={(e) => setBodyContent(e.target.value)}
                    className="w-full bg-[#090d16] border border-slate-700 rounded-lg p-3 text-xs font-mono text-emerald-400 focus:outline-none focus:border-blue-500"
                    placeholder="Enter payload data..."
                  />
                )}
              </div>
            )}
          </div>

          {/* Right sidebar: Auth & Test Meta */}
          <div className="space-y-4">
            <div className="bg-[#0d1322] p-4 rounded-xl border border-slate-800 space-y-3">
              <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <Shield className="h-4 w-4 text-emerald-400" />
                Authentication Protocol
              </span>

              <select
                value={authType}
                onChange={(e) => setAuthType(e.target.value as AuthType)}
                className="w-full bg-slate-900 border border-slate-700 text-white rounded-lg p-2 text-xs focus:outline-none focus:border-blue-500"
              >
                <option value="none">No Authentication</option>
                <option value="bearer">Bearer Token</option>
                <option value="basic">Basic Auth (Username / Password)</option>
                <option value="apiKey">API Key (Header / Query)</option>
              </select>

              {authType === 'bearer' && (
                <div className="space-y-1">
                  <label className="text-[11px] text-slate-400">Bearer Token</label>
                  <input
                    type="password"
                    value={bearerToken}
                    onChange={(e) => setBearerToken(e.target.value)}
                    placeholder="eyJhbGciOi..."
                    className="w-full bg-slate-900 border border-slate-700 text-slate-200 rounded px-2.5 py-1.5 text-xs font-mono"
                  />
                  <p className="text-[10px] text-slate-500">Encrypted at rest using AES-256-GCM.</p>
                </div>
              )}

              {authType === 'basic' && (
                <div className="space-y-2">
                  <div>
                    <label className="text-[11px] text-slate-400">Username</label>
                    <input
                      type="text"
                      value={basicUsername}
                      onChange={(e) => setBasicUsername(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 text-slate-200 rounded px-2.5 py-1.5 text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-400">Password</label>
                    <input
                      type="password"
                      value={basicPassword}
                      onChange={(e) => setBasicPassword(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 text-slate-200 rounded px-2.5 py-1.5 text-xs"
                    />
                  </div>
                </div>
              )}

              {authType === 'apiKey' && (
                <div className="space-y-2">
                  <input
                    type="text"
                    placeholder="Key Name (e.g. X-API-KEY)"
                    value={apiKeyName}
                    onChange={(e) => setApiKeyName(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 text-slate-200 rounded px-2.5 py-1.5 text-xs font-mono"
                  />
                  <input
                    type="password"
                    placeholder="API Key Value"
                    value={apiKeyValue}
                    onChange={(e) => setApiKeyValue(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 text-slate-200 rounded px-2.5 py-1.5 text-xs font-mono"
                  />
                </div>
              )}
            </div>

            <div className="bg-[#0d1322] p-4 rounded-xl border border-slate-800 space-y-3">
              <span className="text-xs font-semibold text-slate-300">Test Metadata</span>
              <div>
                <label className="text-[11px] text-slate-400">Test Name</label>
                <input
                  type="text"
                  value={testName}
                  onChange={(e) => setTestName(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 text-white rounded px-2.5 py-1.5 text-xs mt-1"
                />
              </div>
              <div>
                <label className="text-[11px] text-slate-400">Description</label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 text-slate-300 rounded px-2.5 py-1.5 text-xs mt-1"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: LOAD CONFIGURATION & PROFILE */}
      {activeTab === 'load' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-5">
            {/* Strategy Selector */}
            <div className="bg-[#0d1322] p-5 rounded-xl border border-slate-800 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
                  Load Execution Strategy
                </span>
                <span className="text-xs font-mono text-blue-400">k6 Executor: {strategy}</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[
                  {
                    id: 'constant-vus',
                    name: 'Constant Virtual Users',
                    desc: 'Maintains fixed concurrent users for a specified duration',
                  },
                  {
                    id: 'ramping-vus',
                    name: 'Ramping Virtual Users',
                    desc: 'Gradually scales users up and down in configured stages',
                  },
                  {
                    id: 'constant-arrival-rate',
                    name: 'Constant Arrival Rate',
                    desc: 'Enforces fixed iterations/sec independent of response latency',
                  },
                  {
                    id: 'ramping-arrival-rate',
                    name: 'Ramping Arrival Rate',
                    desc: 'Scales target iterations per second over time stages',
                  },
                  {
                    id: 'shared-iterations',
                    name: 'Shared Iterations',
                    desc: 'Fixed total iterations shared across a pool of VUs',
                  },
                  {
                    id: 'per-vu-iterations',
                    name: 'Per-VU Iterations',
                    desc: 'Each virtual user executes a fixed number of iterations',
                  },
                ].map((s) => (
                  <div
                    key={s.id}
                    onClick={() => setStrategy(s.id as LoadStrategy)}
                    className={`p-3 rounded-xl border cursor-pointer transition ${
                      strategy === s.id
                        ? 'border-blue-500 bg-blue-500/10 text-white shadow-sm'
                        : 'border-slate-800 bg-slate-900/60 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <div className="text-xs font-bold text-slate-200">{s.name}</div>
                    <div className="text-[11px] text-slate-400 mt-1">{s.desc}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Inputs based on strategy */}
            <div className="bg-[#0d1322] p-5 rounded-xl border border-slate-800 space-y-4">
              {strategy === 'constant-vus' && (
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between text-xs font-semibold mb-2">
                      <span className="text-slate-300">Virtual Users (Concurrency)</span>
                      <span className="text-blue-400 font-mono font-bold">{vus} VUs</span>
                    </div>
                    <input
                      type="range"
                      min={1}
                      max={1000}
                      value={vus}
                      onChange={(e) => setVus(Number(e.target.value))}
                      className="w-full accent-blue-500 cursor-pointer"
                    />
                    <div className="flex justify-between text-[10px] text-slate-500 mt-1 font-mono">
                      <span>1 VU</span>
                      <span>250 VUs</span>
                      <span>500 VUs</span>
                      <span>1,000 VUs</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="text-[11px] text-slate-400">Ramp-Up Duration</label>
                      <input
                        type="text"
                        value={rampUpDuration}
                        onChange={(e) => setRampUpDuration(e.target.value)}
                        placeholder="10s"
                        className="w-full bg-slate-900 border border-slate-700 text-white rounded p-2 text-xs font-mono mt-1"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-slate-400">Plateau Duration</label>
                      <input
                        type="text"
                        value={duration}
                        onChange={(e) => setDuration(e.target.value)}
                        placeholder="60s"
                        className="w-full bg-slate-900 border border-slate-700 text-white rounded p-2 text-xs font-mono mt-1"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-slate-400">Ramp-Down Duration</label>
                      <input
                        type="text"
                        value={rampDownDuration}
                        onChange={(e) => setRampDownDuration(e.target.value)}
                        placeholder="10s"
                        className="w-full bg-slate-900 border border-slate-700 text-white rounded p-2 text-xs font-mono mt-1"
                      />
                    </div>
                  </div>
                </div>
              )}

              {strategy === 'ramping-vus' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-300">Execution Stages</span>
                    <button
                      onClick={() => setStages([...stages, { duration: '30s', target: 100 }])}
                      className="flex items-center gap-1 text-[11px] text-blue-400 hover:text-blue-300"
                    >
                      <Plus className="h-3 w-3" />
                      Add Stage
                    </button>
                  </div>

                  <div className="space-y-2">
                    {stages.map((st, i) => (
                      <div key={i} className="flex items-center gap-3 bg-slate-900 p-2.5 rounded-lg border border-slate-800">
                        <span className="text-xs font-mono text-slate-400 w-14">Stage {i + 1}</span>
                        <div className="flex-1 flex items-center gap-2">
                          <span className="text-[11px] text-slate-500">Duration:</span>
                          <input
                            type="text"
                            value={st.duration}
                            onChange={(e) => {
                              const next = [...stages];
                              next[i].duration = e.target.value;
                              setStages(next);
                            }}
                            className="w-20 bg-slate-800 border border-slate-700 text-white rounded px-2 py-1 text-xs font-mono"
                          />
                        </div>
                        <div className="flex-1 flex items-center gap-2">
                          <span className="text-[11px] text-slate-500">Target VUs:</span>
                          <input
                            type="number"
                            value={st.target}
                            onChange={(e) => {
                              const next = [...stages];
                              next[i].target = Number(e.target.value);
                              setStages(next);
                            }}
                            className="w-24 bg-slate-800 border border-slate-700 text-white rounded px-2 py-1 text-xs font-mono"
                          />
                        </div>
                        <button
                          onClick={() => setStages(stages.filter((_, idx) => idx !== i))}
                          className="text-slate-500 hover:text-rose-400 p-1"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {strategy === 'constant-arrival-rate' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-[11px] text-slate-400">Iterations / Requests Per Second</label>
                    <input
                      type="number"
                      value={arrivalRate}
                      onChange={(e) => setArrivalRate(Number(e.target.value))}
                      className="w-full bg-slate-900 border border-slate-700 text-white rounded p-2 text-xs font-mono mt-1"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-400">Duration</label>
                    <input
                      type="text"
                      value={duration}
                      onChange={(e) => setDuration(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 text-white rounded p-2 text-xs font-mono mt-1"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Visual Load Profile Preview */}
          <div className="space-y-4">
            <VisualLoadCurve loadProfile={buildCurrentConfig().loadProfile} />

            <div className="bg-[#0d1322] p-4 rounded-xl border border-slate-800 space-y-2 text-xs text-slate-400">
              <span className="font-bold text-slate-200">Execution Capacity Note:</span>
              <p>
                In k6, Virtual Users (VUs) execute code concurrently. A test of 500 VUs maintains 500 active threads, not a static 500 RPS. Throughput scales inversely with response latency.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: THRESHOLDS */}
      {activeTab === 'thresholds' && (
        <div className="max-w-2xl bg-[#0d1322] p-6 rounded-xl border border-slate-800 space-y-6">
          <div>
            <h3 className="text-sm font-bold text-white">Performance SLA Thresholds</h3>
            <p className="text-xs text-slate-400 mt-1">
              Tests will be marked as <span className="text-rose-400 font-bold">FAILED</span> if any of these conditions are breached during execution.
            </p>
          </div>

          <div className="space-y-4">
            <div className="p-4 rounded-lg border border-slate-800 bg-slate-900/60 space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold">
                <span className="text-slate-200">HTTP Failure Rate Threshold</span>
                <span className="text-blue-400 font-mono">http_req_failed rate &lt; {(thresholdErrorRate * 100).toFixed(1)}%</span>
              </div>
              <input
                type="number"
                step="0.005"
                min="0"
                max="1"
                value={thresholdErrorRate}
                onChange={(e) => setThresholdErrorRate(Number(e.target.value))}
                className="w-full bg-slate-800 border border-slate-700 text-white rounded p-2 text-xs font-mono"
              />
              <span className="text-[11px] text-slate-500">Standard SLA: Below 0.01 (1% failure tolerance).</span>
            </div>

            <div className="p-4 rounded-lg border border-slate-800 bg-slate-900/60 space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold">
                <span className="text-slate-200">P95 Response Latency Cap</span>
                <span className="text-purple-400 font-mono">http_req_duration p(95) &lt; {thresholdP95}ms</span>
              </div>
              <input
                type="number"
                step="50"
                min="10"
                max="10000"
                value={thresholdP95}
                onChange={(e) => setThresholdP95(Number(e.target.value))}
                className="w-full bg-slate-800 border border-slate-700 text-white rounded p-2 text-xs font-mono"
              />
              <span className="text-[11px] text-slate-500">95% of all requests must finish faster than this duration.</span>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: SCRIPT PREVIEW */}
      {activeTab === 'preview' && (
        <div className="bg-[#0d1322] p-5 rounded-xl border border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileCheck className="h-4 w-4 text-emerald-400" />
              <span className="text-xs font-bold text-white">Dynamic k6 ES6 Script Generated</span>
            </div>
            <button
              onClick={handlePreviewScript}
              className="text-xs text-blue-400 hover:text-blue-300 font-semibold"
            >
              Re-generate
            </button>
          </div>

          <pre className="p-4 rounded-xl bg-[#080c14] border border-slate-800 text-xs font-mono text-slate-300 overflow-x-auto max-h-[500px]">
            {generatedScriptPreview || '// Click "Preview k6 Script" above to generate the full code.'}
          </pre>
        </div>
      )}
    </div>
  );
};
