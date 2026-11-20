import React, { useEffect, useState } from 'react';
import { Download, GitCompare } from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';
import { fetchReport, compareExecutions, fetchExecutions } from '../services/api.js';
import { MetricCard } from '../components/MetricCard.js';

interface ReportViewProps {
  executionId: string;
  onSelectRun: (id: string) => void;
}

export const ReportView: React.FC<ReportViewProps> = ({ executionId }) => {
  const [report, setReport] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [allExecutions, setAllExecutions] = useState<any[]>([]);

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
    return <div className="p-8 text-center text-xs text-zinc-500">Loading report...</div>;
  }

  if (!report) {
    return (
      <div className="p-8 text-center text-xs text-zinc-500 bg-[#111114] rounded-lg border border-zinc-800">
        No report found for: {executionId}
      </div>
    );
  }

  const { execution, configurationSnapshot, thresholdResults, metrics } = report;

  const chartData = (metrics || []).map((m: any) => ({
    time: `${m.elapsedSeconds}s`,
    rps: m.rps,
    p95: m.p95,
    vus: m.activeVus,
  }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-[#111114] p-4 rounded-lg border border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-sm font-semibold text-zinc-100">{execution.testName}</h1>
            <span
              className={`px-2 py-0.5 rounded text-[11px] font-medium ${
                execution.verdict === 'PASSED'
                  ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-800/60'
                  : 'bg-rose-950/60 text-rose-400 border border-rose-800/60'
              }`}
            >
              {execution.verdict}
            </span>
          </div>
          <p className="text-xs text-zinc-500 mt-0.5 font-mono">
            {execution.id} · {configurationSnapshot?.request?.url}
          </p>
        </div>

        <a
          href={`/api/v1/reports/${execution.id}/export.csv`}
          download
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-medium text-xs border border-zinc-700 transition"
        >
          <Download className="h-3.5 w-3.5" />
          Export CSV
        </a>
      </div>

      {/* SLA / Status Diagnostic Banner */}
      {execution.verdict === 'FAILED' && execution.errorRate >= 100 && (
        <div className="bg-rose-950/30 border border-rose-800/40 p-3.5 rounded-lg text-xs text-rose-300">
          <strong>Target Connection Failed:</strong> 100% of requests failed to connect. The server at <code className="text-zinc-200">{configurationSnapshot?.request?.url}</code> was offline, dropped connections, or timed out.
        </div>
      )}
      {execution.verdict === 'FAILED' && execution.errorRate < 100 && (
        <div className="bg-amber-950/30 border border-amber-800/40 p-3.5 rounded-lg text-xs text-amber-200">
          <strong>SLA Target Breached:</strong> The load test successfully sent {execution.totalRequests?.toLocaleString()} requests to the API, but the observed response latency (P95: {execution.p95Latency?.toFixed(1)}ms) exceeded your SLA target threshold.
        </div>
      )}
      {execution.verdict === 'PASSED' && (
        <div className="bg-emerald-950/30 border border-emerald-800/40 p-3.5 rounded-lg text-xs text-emerald-300">
          <strong>Test Successful:</strong> All {execution.totalRequests?.toLocaleString()} requests completed with an average throughput of {execution.avgRps?.toFixed(0)} req/s and passed all SLA criteria.
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <MetricCard
          title="Total Requests"
          value={execution.totalRequests?.toLocaleString()}
          subValue={`Failed: ${execution.failedRequests}`}
        />
        <MetricCard
          title="Average Throughput"
          value={`${execution.avgRps?.toFixed(0)} rps`}
          subValue={`Peak: ${execution.peakRps} rps`}
        />
        <MetricCard
          title="P95 Latency"
          value={`${execution.p95Latency?.toFixed(1)} ms`}
          subValue={`P50: ${execution.p50Latency?.toFixed(1)} ms`}
        />
        <MetricCard
          title="Test Duration"
          value={`${execution.durationSeconds}s`}
          subValue={`VUs: ${execution.peakVus}`}
        />
      </div>

      {/* Latency Percentiles & Thresholds */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 text-xs">
        <div className="bg-[#111114] p-4 rounded-lg border border-zinc-800">
          <div className="font-medium text-zinc-200 mb-3">Response Latency Breakdown</div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 font-mono">
            {[
              { label: 'Minimum', val: execution.minLatency },
              { label: 'P50 (Median)', val: execution.p50Latency },
              { label: 'Average', val: execution.avgLatency },
              { label: 'P90', val: execution.p90Latency },
              { label: 'P95', val: execution.p95Latency },
              { label: 'P99', val: execution.p99Latency },
              { label: 'Maximum', val: execution.maxLatency },
              { label: 'Pass Rate', val: `${(100 - (execution.errorRate || 0)).toFixed(1)}%` },
            ].map((item, idx) => (
              <div key={idx} className="bg-zinc-900/60 p-2 rounded border border-zinc-800">
                <div className="text-[10px] text-zinc-500 font-sans">{item.label}</div>
                <div className="text-sm font-semibold text-zinc-100 mt-0.5">
                  {typeof item.val === 'number' ? `${item.val.toFixed(1)}ms` : item.val}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-[#111114] p-4 rounded-lg border border-zinc-800">
          <div className="font-medium text-zinc-200 mb-3">Threshold Criteria</div>
          <div className="space-y-2 font-mono text-[11px]">
            {thresholdResults.length === 0 ? (
              <p className="text-zinc-500 font-sans">No thresholds defined.</p>
            ) : (
              thresholdResults.map((th: any, i: number) => (
                <div
                  key={i}
                  className="flex items-center justify-between p-2.5 rounded bg-zinc-900/60 border border-zinc-800"
                >
                  <span className="text-zinc-300">{th.threshold}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-zinc-500">Observed: {th.actualValue}</span>
                    <span
                      className={`px-1.5 py-0.5 rounded text-[10px] font-sans font-medium ${
                        th.passed ? 'text-emerald-400 bg-emerald-950/40' : 'text-rose-400 bg-rose-950/40'
                      }`}
                    >
                      {th.passed ? 'PASSED' : 'FAILED'}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Full timeline chart */}
      <div className="bg-[#111114] p-4 rounded-lg border border-zinc-800">
        <div className="flex items-center justify-between mb-3 text-xs">
          <span className="font-medium text-zinc-200">Execution Timeline</span>
          <span className="text-zinc-400 font-mono text-[11px]">Throughput (req/s)</span>
        </div>

        <div className="h-48 w-full">
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
                stroke="#3b82f6"
                fill="#3b82f6"
                fillOpacity={0.1}
                strokeWidth={1.5}
                name="Requests/sec"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Compare Tool */}
      <div className="bg-[#111114] p-4 rounded-lg border border-zinc-800 space-y-3 text-xs">
        <div className="flex items-center gap-1.5 font-medium text-zinc-200">
          <GitCompare className="h-3.5 w-3.5 text-zinc-400" />
          <span>Compare with Another Run</span>
        </div>

        <div className="flex items-center gap-2">
          <select
            value={compareId}
            onChange={(e) => setCompareId(e.target.value)}
            className="bg-zinc-900 border border-zinc-700 text-zinc-200 rounded p-1.5 text-xs flex-1 font-mono"
          >
            <option value="">Select test execution...</option>
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
            className="px-3 py-1.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 font-medium text-xs transition disabled:opacity-50"
          >
            {isComparing ? 'Comparing...' : 'Compare'}
          </button>
        </div>

        {comparisonResult && (
          <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-zinc-800 font-mono">
            <div className="bg-zinc-900/60 p-2.5 rounded border border-zinc-800">
              <span className="text-zinc-500 font-sans text-[11px] block">P95 Latency Delta</span>
              <div
                className={`text-base font-semibold mt-0.5 ${
                  comparisonResult.comparison.latencyImproved ? 'text-emerald-400' : 'text-rose-400'
                }`}
              >
                {comparisonResult.comparison.latencyDiffP95Ms > 0 ? '+' : ''}
                {comparisonResult.comparison.latencyDiffP95Ms} ms
              </div>
            </div>

            <div className="bg-zinc-900/60 p-2.5 rounded border border-zinc-800">
              <span className="text-zinc-500 font-sans text-[11px] block">Throughput Delta</span>
              <div className="text-base font-semibold text-zinc-200 mt-0.5">
                {comparisonResult.comparison.rpsDiff > 0 ? '+' : ''}
                {comparisonResult.comparison.rpsDiff} rps
              </div>
            </div>

            <div className="bg-zinc-900/60 p-2.5 rounded border border-zinc-800">
              <span className="text-zinc-500 font-sans text-[11px] block">Error Rate Delta</span>
              <div className="text-base font-semibold text-zinc-200 mt-0.5">
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
