import React, { useEffect, useState } from 'react';
import {
  BarChart3,
  CheckCircle2,
  XCircle,
  Download,
  GitCompare,
  TrendingUp,
  Clock,
  Layers,
  Zap,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from 'recharts';
import { fetchReport, compareExecutions, fetchExecutions } from '../services/api.js';
import { MetricCard } from '../components/MetricCard.js';

interface ReportViewProps {
  executionId: string;
  onSelectRun: (id: string) => void;
}

export const ReportView: React.FC<ReportViewProps> = ({ executionId, onSelectRun }) => {
  const [report, setReport] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [allExecutions, setAllExecutions] = useState<any[]>([]);

  // Comparison state
  const [compareId, setCompareId] = useState<string>('');
  const [comparisonResult, setComparisonResult] = useState<any>(null);
  const [isComparing, setIsComparing] = useState(false);

  useEffect(() => {
    loadReport();
    fetchExecutions(20).then((res) => {
      if (res.data) setAllExecutions(res.data);
    });
  }, [executionId]);

  const loadReport = async () => {
    try {
      setLoading(true);
      const res = await fetchReport(executionId);
      if (res.data) {
        setReport(res.data);
      }
    } catch (err) {
      console.error('Failed to load report:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCompare = async () => {
    if (!compareId) return;
    try {
      setIsComparing(true);
      const res = await compareExecutions(executionId, compareId);
      if (res.data) {
        setComparisonResult(res.data);
      }
    } catch (err) {
      alert('Comparison failed: ' + err);
    } finally {
      setIsComparing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12 text-slate-400 text-xs">
        Loading performance report...
      </div>
    );
  }

  if (!report) {
    return (
      <div className="p-8 text-center text-slate-400 text-xs bg-[#0d1322] rounded-xl border border-slate-800">
        Report not found for execution ID: {executionId}
      </div>
    );
  }

  const { execution, configurationSnapshot, thresholdResults, metrics } = report;

  const chartData = (metrics || []).map((m: any) => ({
    time: `${m.elapsedSeconds}s`,
    rps: m.rps,
    p95: m.p95,
    vus: m.activeVus,
    avg: m.avgLatency,
  }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-[#0d1322] p-6 rounded-xl border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-white">{execution.testName}</h1>
            <span
              className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold ${
                execution.verdict === 'PASSED'
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
              }`}
            >
              {execution.verdict === 'PASSED' ? <CheckCircle2 className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />}
              {execution.verdict}
            </span>
          </div>

          <p className="text-xs text-slate-400 mt-1 font-mono">
            Execution ID: {execution.id} · Target: {configurationSnapshot?.request?.url}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <a
            href={`/api/v1/reports/${execution.id}/export.csv`}
            download
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs border border-slate-700 transition"
          >
            <Download className="h-4 w-4" />
            Download CSV Metrics
          </a>
        </div>
      </div>

      {/* Primary KPI Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <MetricCard
          title="Total Requests"
          value={execution.totalRequests?.toLocaleString()}
          subValue={`Failed: ${execution.failedRequests}`}
          icon={<Layers className="h-4 w-4" />}
          accent="blue"
        />
        <MetricCard
          title="Average Throughput"
          value={`${execution.avgRps?.toFixed(1)} rps`}
          subValue={`Peak: ${execution.peakRps} rps`}
          icon={<Zap className="h-4 w-4" />}
          accent="purple"
        />
        <MetricCard
          title="P95 Latency"
          value={`${execution.p95Latency?.toFixed(1)} ms`}
          subValue={`P99: ${execution.p99Latency?.toFixed(1)} ms`}
          icon={<TrendingUp className="h-4 w-4" />}
          accent="amber"
        />
        <MetricCard
          title="Total Duration"
          value={`${execution.durationSeconds}s`}
          subValue={`Peak VUs: ${execution.peakVus}`}
          icon={<Clock className="h-4 w-4" />}
          accent="emerald"
        />
      </div>

      {/* Latency Percentiles & Threshold Results */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Latency Percentiles Table */}
        <div className="bg-[#0d1322] p-5 rounded-xl border border-slate-800">
          <span className="text-xs font-bold text-white uppercase tracking-wider">
            Detailed Latency Distribution
          </span>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-4">
            {[
              { label: 'Minimum', val: execution.minLatency },
              { label: 'P50 (Median)', val: execution.p50Latency },
              { label: 'Average', val: execution.avgLatency },
              { label: 'P90', val: execution.p90Latency },
              { label: 'P95', val: execution.p95Latency },
              { label: 'P99', val: execution.p99Latency },
              { label: 'Maximum', val: execution.maxLatency },
              { label: 'Checks Passed', val: execution.checksPassed },
            ].map((item, idx) => (
              <div key={idx} className="bg-slate-900/80 p-2.5 rounded-lg border border-slate-800">
                <div className="text-[10px] text-slate-400 font-medium">{item.label}</div>
                <div className="text-base font-bold font-mono text-white mt-0.5">
                  {typeof item.val === 'number' ? `${item.val.toFixed(1)}ms` : item.val}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Threshold SLA Results */}
        <div className="bg-[#0d1322] p-5 rounded-xl border border-slate-800">
          <span className="text-xs font-bold text-white uppercase tracking-wider">
            Threshold SLA Evaluation
          </span>
          <div className="mt-4 space-y-2">
            {thresholdResults.length === 0 ? (
              <p className="text-xs text-slate-500">No thresholds configured for this run.</p>
            ) : (
              thresholdResults.map((th: any, i: number) => (
                <div
                  key={i}
                  className="flex items-center justify-between p-3 rounded-lg border bg-slate-900 border-slate-800 text-xs font-mono"
                >
                  <div className="flex items-center gap-2">
                    {th.passed ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                    ) : (
                      <XCircle className="h-4 w-4 text-rose-400" />
                    )}
                    <span className="text-slate-200">{th.threshold}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-slate-400">Observed: {th.actualValue}</span>
                    <span
                      className={`font-bold px-2 py-0.5 rounded text-[10px] ${
                        th.passed ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'
                      }`}
                    >
                      {th.passed ? 'PASSED' : 'BREACHED'}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Full Run Throughput & Latency Chart */}
      <div className="bg-[#0d1322] p-5 rounded-xl border border-slate-800">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-bold text-white">Execution Timeline Chart</span>
          <span className="text-xs font-mono text-slate-400">RPS & P95 Latency</span>
        </div>

        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="time" stroke="#64748b" tick={{ fontSize: 10 }} />
              <YAxis yAxisId="left" stroke="#64748b" tick={{ fontSize: 10 }} />
              <YAxis yAxisId="right" orientation="right" stroke="#64748b" tick={{ fontSize: 10 }} unit="ms" />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#0f172a',
                  borderColor: '#334155',
                  fontSize: '11px',
                }}
              />
              <Legend wrapperStyle={{ fontSize: '11px' }} />
              <Area yAxisId="left" type="monotone" dataKey="rps" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.15} name="Requests/sec" />
              <Area yAxisId="right" type="monotone" dataKey="p95" stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.1} name="P95 Latency (ms)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Compare Run Tool */}
      <div className="bg-[#0d1322] p-5 rounded-xl border border-slate-800 space-y-4">
        <div className="flex items-center gap-2">
          <GitCompare className="h-4 w-4 text-blue-400" />
          <span className="text-xs font-bold text-white">Compare with Another Execution</span>
        </div>

        <div className="flex items-center gap-3">
          <select
            value={compareId}
            onChange={(e) => setCompareId(e.target.value)}
            className="bg-slate-900 border border-slate-700 text-white rounded-lg p-2 text-xs flex-1"
          >
            <option value="">Select an execution to compare...</option>
            {allExecutions
              .filter((e) => e.id !== executionId)
              .map((e) => (
                <option key={e.id} value={e.id}>
                  {e.testName} ({e.id}) - {e.durationSeconds}s · {e.verdict}
                </option>
              ))}
          </select>

          <button
            onClick={handleCompare}
            disabled={!compareId || isComparing}
            className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs transition disabled:opacity-50"
          >
            {isComparing ? 'Comparing...' : 'Compare Runs'}
          </button>
        </div>

        {/* Comparison Result Cards */}
        {comparisonResult && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 p-4 rounded-xl bg-slate-900/80 border border-slate-800 text-xs">
            <div className="p-3 bg-slate-800/60 rounded-lg">
              <span className="text-slate-400">P95 Latency Delta</span>
              <div
                className={`text-lg font-bold font-mono mt-1 ${
                  comparisonResult.comparison.latencyImproved ? 'text-emerald-400' : 'text-rose-400'
                }`}
              >
                {comparisonResult.comparison.latencyDiffP95Ms > 0 ? '+' : ''}
                {comparisonResult.comparison.latencyDiffP95Ms} ms
              </div>
              <p className="text-[10px] text-slate-500 mt-0.5">
                {comparisonResult.comparison.latencyImproved
                  ? '✓ Latency improved in Run B'
                  : '⚠ Latency degraded in Run B'}
              </p>
            </div>

            <div className="p-3 bg-slate-800/60 rounded-lg">
              <span className="text-slate-400">Throughput (Avg RPS) Delta</span>
              <div className="text-lg font-bold font-mono text-blue-400 mt-1">
                {comparisonResult.comparison.rpsDiff > 0 ? '+' : ''}
                {comparisonResult.comparison.rpsDiff} req/s
              </div>
            </div>

            <div className="p-3 bg-slate-800/60 rounded-lg">
              <span className="text-slate-400">Error Rate Delta</span>
              <div className="text-lg font-bold font-mono text-purple-400 mt-1">
                {comparisonResult.comparison.errorRateDiff > 0 ? '+' : ''}
                {comparisonResult.comparison.errorRateDiff}%
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
