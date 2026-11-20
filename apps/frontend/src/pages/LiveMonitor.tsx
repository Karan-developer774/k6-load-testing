import React, { useEffect, useState, useRef } from 'react';
import {
  Activity,
  Square,
  CheckCircle2,
  XCircle,
  Clock,
  Zap,
  Terminal,
  ArrowRight,
  TrendingUp,
} from 'lucide-react';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from 'recharts';
import { MetricSnapshot, ExecutionStatus } from '@k6-platform/shared-types';
import { getSseUrl, stopExecution, fetchExecution } from '../services/api.js';
import { MetricCard } from '../components/MetricCard.js';

interface LiveMonitorProps {
  executionId: string;
  onViewReport: (executionId: string) => void;
}

export const LiveMonitor: React.FC<LiveMonitorProps> = ({
  executionId,
  onViewReport,
}) => {
  const [status, setStatus] = useState<ExecutionStatus>('RUNNING');
  const [verdict, setVerdict] = useState<string>('UNKNOWN');
  const [snapshots, setSnapshots] = useState<MetricSnapshot[]>([]);
  const [logs, setLogs] = useState<string[]>([]);
  const [isStopping, setIsStopping] = useState(false);

  const logsEndRef = useRef<HTMLDivElement | null>(null);

  // Auto-scroll logs
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  // Connect to SSE stream
  useEffect(() => {
    const sseUrl = getSseUrl(executionId);
    const eventSource = new EventSource(sseUrl);

    eventSource.addEventListener('status', (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data);
        setStatus(data.status);
      } catch {}
    });

    eventSource.addEventListener('metric', (e: MessageEvent) => {
      try {
        const payload = JSON.parse(e.data);
        const snapshot: MetricSnapshot = payload.data;
        setSnapshots((prev) => [...prev, snapshot]);
      } catch {}
    });

    eventSource.addEventListener('log', (e: MessageEvent) => {
      try {
        const payload = JSON.parse(e.data);
        setLogs((prev) => [...prev, payload.line]);
      } catch {}
    });

    eventSource.addEventListener('completed', (e: MessageEvent) => {
      try {
        const payload = JSON.parse(e.data);
        setStatus('COMPLETED');
        setVerdict(payload.verdict);
      } catch {}
    });

    eventSource.onerror = async () => {
      // Check current execution status from REST in case SSE closed on completion
      try {
        const res = await fetchExecution(executionId);
        if (res.data) {
          setStatus(res.data.status);
          setVerdict(res.data.verdict);
        }
      } catch {}
      eventSource.close();
    };

    return () => {
      eventSource.close();
    };
  }, [executionId]);

  // Handle Stop
  const handleStop = async () => {
    try {
      setIsStopping(true);
      await stopExecution(executionId);
      setStatus('STOPPING');
    } catch (err) {
      alert('Error stopping execution: ' + err);
    } finally {
      setIsStopping(false);
    }
  };

  const latest = snapshots[snapshots.length - 1] || {
    activeVus: 0,
    rps: 0,
    p95: 0,
    avgLatency: 0,
    errorRate: 0,
    totalRequests: 0,
    checksPassed: 0,
    elapsedSeconds: 0,
  };

  const chartData = snapshots.map((s) => ({
    time: `${s.elapsedSeconds}s`,
    p50: s.p50,
    p90: s.p90,
    p95: s.p95,
    p99: s.p99,
    rps: s.rps,
    vus: s.activeVus,
    errorRate: s.errorRate,
  }));

  const isFinished = ['COMPLETED', 'ABORTED', 'ERROR'].includes(status);

  return (
    <div className="space-y-6">
      {/* Top Status Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#0d1322] p-4 rounded-xl border border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <span
              className={`h-2.5 w-2.5 rounded-full ${
                status === 'RUNNING'
                  ? 'bg-emerald-500 animate-ping'
                  : status === 'STOPPING'
                  ? 'bg-amber-500 animate-pulse'
                  : 'bg-slate-500'
              }`}
            />
            <h2 className="text-base font-bold text-white">Live Load Test Monitor</h2>
            <span className="text-xs font-mono text-slate-400 bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
              {executionId}
            </span>
          </div>
          <div className="flex items-center gap-2 mt-1 text-xs text-slate-400">
            <span>Status: <strong className="text-white">{status}</strong></span>
            {verdict !== 'UNKNOWN' && (
              <span
                className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                  verdict === 'PASSED'
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                }`}
              >
                Verdict: {verdict}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3">
          {status === 'RUNNING' && (
            <button
              onClick={handleStop}
              disabled={isStopping}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs shadow-md shadow-rose-600/30 transition disabled:opacity-50"
            >
              <Square className="h-3.5 w-3.5 fill-white" />
              {isStopping ? 'Stopping...' : 'Stop Test'}
            </button>
          )}

          {isFinished && (
            <button
              onClick={() => onViewReport(executionId)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-md shadow-blue-600/30 transition"
            >
              View Full Report
              <ArrowRight className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Real-time KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <MetricCard
          title="Active Virtual Users"
          value={latest.activeVus}
          subValue="Concurrent threads"
          icon={<Activity className="h-4 w-4" />}
          accent="blue"
        />
        <MetricCard
          title="Current Throughput"
          value={`${latest.rps} rps`}
          subValue="Requests per second"
          icon={<Zap className="h-4 w-4" />}
          accent="purple"
        />
        <MetricCard
          title="P95 Latency"
          value={`${latest.p95} ms`}
          subValue="95th percentile"
          icon={<TrendingUp className="h-4 w-4" />}
          accent="amber"
        />
        <MetricCard
          title="Error Rate"
          value={`${latest.errorRate}%`}
          subValue="Failed HTTP requests"
          icon={<XCircle className="h-4 w-4" />}
          accent={latest.errorRate > 1 ? 'rose' : 'emerald'}
        />
        <MetricCard
          title="Total Requests"
          value={latest.totalRequests.toLocaleString()}
          subValue={`Elapsed: ${latest.elapsedSeconds}s`}
          icon={<Clock className="h-4 w-4" />}
          accent="emerald"
        />
      </div>

      {/* Real-time Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Chart 1: Latency Distribution */}
        <div className="bg-[#0d1322] p-4 rounded-xl border border-slate-800">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-white">Response Latency Distribution (ms)</span>
            <span className="text-[11px] font-mono text-purple-400">P50 / P90 / P95 / P99</span>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="time" stroke="#64748b" tick={{ fontSize: 10 }} />
                <YAxis stroke="#64748b" tick={{ fontSize: 10 }} unit="ms" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0f172a',
                    borderColor: '#334155',
                    fontSize: '11px',
                  }}
                />
                <Legend wrapperStyle={{ fontSize: '11px' }} />
                <Line type="monotone" dataKey="p50" stroke="#3b82f6" dot={false} strokeWidth={2} name="P50" />
                <Line type="monotone" dataKey="p90" stroke="#a855f7" dot={false} strokeWidth={2} name="P90" />
                <Line type="monotone" dataKey="p95" stroke="#f59e0b" dot={false} strokeWidth={2} name="P95" />
                <Line type="monotone" dataKey="p99" stroke="#ef4444" dot={false} strokeWidth={1.5} name="P99" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 2: Throughput (RPS) vs Active VUs */}
        <div className="bg-[#0d1322] p-4 rounded-xl border border-slate-800">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-white">Throughput (RPS) & Active VUs</span>
            <span className="text-[11px] font-mono text-blue-400">Dual Metric Stream</span>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="rpsGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="time" stroke="#64748b" tick={{ fontSize: 10 }} />
                <YAxis stroke="#64748b" tick={{ fontSize: 10 }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0f172a',
                    borderColor: '#334155',
                    fontSize: '11px',
                  }}
                />
                <Legend wrapperStyle={{ fontSize: '11px' }} />
                <Area type="monotone" dataKey="rps" stroke="#10b981" fill="url(#rpsGrad)" strokeWidth={2} name="Requests/sec" />
                <Line type="monotone" dataKey="vus" stroke="#6366f1" dot={false} strokeWidth={2} name="Active VUs" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Terminal Log Output Window */}
      <div className="bg-[#080c14] rounded-xl border border-slate-800 p-4">
        <div className="flex items-center gap-2 mb-2 pb-2 border-b border-slate-800 text-xs font-semibold text-slate-400">
          <Terminal className="h-4 w-4 text-emerald-400" />
          <span>k6 Worker Process Log Console</span>
        </div>

        <div className="h-44 overflow-y-auto font-mono text-[11px] text-slate-300 space-y-1">
          {logs.length === 0 ? (
            <span className="text-slate-600">// Waiting for execution output stream...</span>
          ) : (
            logs.map((log, i) => (
              <div key={i} className="leading-relaxed">
                {log}
              </div>
            ))
          )}
          <div ref={logsEndRef} />
        </div>
      </div>
    </div>
  );
};
