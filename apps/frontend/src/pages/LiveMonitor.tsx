import React, { useEffect, useState, useRef } from 'react';
import { Square, ArrowRight, Terminal } from 'lucide-react';
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

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

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
    p50: 0,
    p95: 0,
    p99: 0,
    avgLatency: 0,
    errorRate: 0,
    totalRequests: 0,
    elapsedSeconds: 0,
  };

  const chartData = snapshots.map((s) => ({
    time: `${s.elapsedSeconds}s`,
    p50: s.p50,
    p95: s.p95,
    p99: s.p99,
    rps: s.rps,
    vus: s.activeVus,
    errorRate: s.errorRate,
  }));

  const isFinished = ['COMPLETED', 'ABORTED', 'ERROR'].includes(status);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#111114] p-4 rounded-lg border border-zinc-800">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-sm font-semibold text-zinc-100">Live Execution Monitor</h1>
            <span className="text-xs font-mono text-zinc-400 bg-zinc-900 px-2 py-0.5 rounded border border-zinc-800">
              {executionId}
            </span>
          </div>
          <div className="flex items-center gap-2 mt-1 text-xs text-zinc-400">
            <span>
              Status: <strong className="text-zinc-200">{status}</strong>
            </span>
            {verdict !== 'UNKNOWN' && (
              <span
                className={`px-2 py-0.5 rounded text-[11px] font-medium ${
                  verdict === 'PASSED'
                    ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-800/60'
                    : 'bg-rose-950/60 text-rose-400 border border-rose-800/60'
                }`}
              >
                {verdict}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {status === 'RUNNING' && (
            <button
              onClick={handleStop}
              disabled={isStopping}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-zinc-800 hover:bg-zinc-700 text-rose-400 border border-zinc-700 font-medium text-xs transition disabled:opacity-50"
            >
              <Square className="h-3 w-3 fill-rose-400" />
              {isStopping ? 'Stopping...' : 'Stop Test'}
            </button>
          )}

          {isFinished && (
            <button
              onClick={() => onViewReport(executionId)}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-md bg-zinc-100 hover:bg-white text-zinc-900 font-medium text-xs transition"
            >
              <span>View Report</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* KPI Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <MetricCard
          title="Virtual Users"
          value={latest.activeVus}
          subValue="Active concurrency"
        />
        <MetricCard
          title="Throughput"
          value={`${latest.rps} rps`}
          subValue="Requests per second"
        />
        <MetricCard
          title="P95 Latency"
          value={`${latest.p95} ms`}
          subValue={`P50: ${latest.p50} ms`}
        />
        <MetricCard
          title="Error Rate"
          value={`${latest.errorRate}%`}
          subValue="Failed requests"
          status={latest.errorRate > 1 ? 'error' : 'normal'}
        />
        <MetricCard
          title="Total Requests"
          value={latest.totalRequests.toLocaleString()}
          subValue={`Elapsed: ${latest.elapsedSeconds}s`}
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Latency Chart */}
        <div className="bg-[#111114] p-4 rounded-lg border border-zinc-800">
          <div className="flex items-center justify-between mb-3 text-xs">
            <span className="font-medium text-zinc-200">Latency (ms)</span>
            <div className="flex items-center gap-3 text-zinc-400 font-mono text-[11px]">
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-blue-500" /> P50 (Median)
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-amber-500" /> P95
              </span>
            </div>
          </div>

          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                <XAxis dataKey="time" stroke="#71717a" tick={{ fontSize: 11 }} />
                <YAxis stroke="#71717a" tick={{ fontSize: 11 }} unit="ms" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#18181b',
                    borderColor: '#27272a',
                    borderRadius: '6px',
                    fontSize: '12px',
                    color: '#fafafa',
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="p50"
                  stroke="#3b82f6"
                  dot={false}
                  strokeWidth={1.5}
                  name="P50 Latency"
                />
                <Line
                  type="monotone"
                  dataKey="p95"
                  stroke="#f59e0b"
                  dot={false}
                  strokeWidth={1.5}
                  name="P95 Latency"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Throughput Chart */}
        <div className="bg-[#111114] p-4 rounded-lg border border-zinc-800">
          <div className="flex items-center justify-between mb-3 text-xs">
            <span className="font-medium text-zinc-200">Throughput & Virtual Users</span>
            <div className="flex items-center gap-3 text-zinc-400 font-mono text-[11px]">
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-emerald-500" /> Requests/sec
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-zinc-400" /> Active VUs
              </span>
            </div>
          </div>

          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                <XAxis dataKey="time" stroke="#71717a" tick={{ fontSize: 11 }} />
                <YAxis stroke="#71717a" tick={{ fontSize: 11 }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#18181b',
                    borderColor: '#27272a',
                    borderRadius: '6px',
                    fontSize: '12px',
                    color: '#fafafa',
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="rps"
                  stroke="#10b981"
                  fill="#10b981"
                  fillOpacity={0.1}
                  strokeWidth={1.5}
                  name="RPS"
                />
                <Line
                  type="monotone"
                  dataKey="vus"
                  stroke="#71717a"
                  strokeDasharray="4 4"
                  dot={false}
                  strokeWidth={1.5}
                  name="Active VUs"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Console output */}
      <div className="bg-[#0c0c0e] rounded-lg border border-zinc-800 p-3">
        <div className="flex items-center gap-1.5 mb-2 pb-2 border-b border-zinc-800 text-xs text-zinc-400">
          <Terminal className="h-3.5 w-3.5" />
          <span>Execution Log</span>
        </div>

        <div className="h-36 overflow-y-auto font-mono text-xs text-zinc-300 space-y-0.5">
          {logs.length === 0 ? (
            <span className="text-zinc-600">// Waiting for worker output...</span>
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
