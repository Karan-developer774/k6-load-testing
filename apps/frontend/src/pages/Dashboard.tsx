import React, { useEffect, useState } from 'react';
import { ArrowRight, Play, Plus, RefreshCw } from 'lucide-react';
import { fetchExecutions, runTest } from '../services/api.js';
import { MetricCard } from '../components/MetricCard.js';

interface DashboardProps {
  onStartTest: (executionId: string) => void;
  onViewReport: (executionId: string) => void;
  onCreateNew: () => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
  onStartTest,
  onViewReport,
  onCreateNew,
}) => {
  const [executions, setExecutions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [quickRunning, setQuickRunning] = useState(false);

  const loadData = async () => {
    try {
      setLoading(true);
      const res = await fetchExecutions(20);
      if (res.data) {
        setExecutions(res.data);
      }
    } catch (err) {
      console.error('Failed to load executions:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const totalRuns = executions.length;
  const passedRuns = executions.filter((e) => e.verdict === 'PASSED').length;
  const failedRuns = executions.filter((e) => e.verdict === 'FAILED').length;
  const passRate = totalRuns > 0 ? ((passedRuns / totalRuns) * 100).toFixed(0) : '0';

  const avgRpsAll =
    totalRuns > 0
      ? (executions.reduce((acc, curr) => acc + (curr.avgRps || 0), 0) / totalRuns).toFixed(0)
      : '0';

  const handleQuickMockRun = async () => {
    try {
      setQuickRunning(true);
      const res = await runTest({
        name: 'Quick Mock Users Test',
        request: {
          name: 'Get Mock Users',
          url: 'http://localhost:3001/api/v1/mock/users',
          method: 'GET',
          headers: [],
          queryParams: [],
          auth: { type: 'none' },
          bodyType: 'none',
        },
        loadProfile: {
          strategy: 'constant-vus',
          vus: 10,
          duration: '10s',
        },
        thresholds: [
          { metric: 'http_req_failed', aggregation: 'rate', operator: '<', value: 0.01 },
          { metric: 'http_req_duration', aggregation: 'p95', operator: '<', value: 300 },
        ],
      });

      if (res.executionId) {
        onStartTest(res.executionId);
      }
    } catch (err) {
      alert('Failed to launch test: ' + err);
    } finally {
      setQuickRunning(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800 pb-5">
        <div>
          <h1 className="text-lg font-semibold text-zinc-100">Load Test Dashboard</h1>
          <p className="text-xs text-zinc-400 mt-0.5">
            Configure, execute, and monitor API performance tests powered by k6.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleQuickMockRun}
            disabled={quickRunning}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium border border-zinc-700 transition disabled:opacity-50"
          >
            <Play className="h-3 w-3" />
            {quickRunning ? 'Launching...' : 'Quick Run (10s)'}
          </button>

          <button
            onClick={onCreateNew}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-md bg-zinc-100 hover:bg-white text-zinc-900 text-xs font-medium transition"
          >
            <Plus className="h-3.5 w-3.5" />
            New Test
          </button>
        </div>
      </div>

      {/* Overview Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <MetricCard
          title="Total Executions"
          value={totalRuns}
          subValue="Completed runs"
        />
        <MetricCard
          title="SLA Pass Rate"
          value={`${passRate}%`}
          subValue={`${passedRuns} passed · ${failedRuns} failed`}
          status={Number(passRate) >= 90 ? 'normal' : 'error'}
        />
        <MetricCard
          title="Avg Throughput"
          value={`${avgRpsAll} rps`}
          subValue="Across all tests"
        />
        <MetricCard
          title="Engine Status"
          value="Ready"
          subValue="k6 process worker"
          status="success"
        />
      </div>

      {/* Recent Executions Table */}
      <div className="bg-[#111114] rounded-lg border border-zinc-800">
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800 text-xs">
          <span className="font-medium text-zinc-200">Recent Executions</span>
          <button
            onClick={loadData}
            className="flex items-center gap-1 text-zinc-400 hover:text-zinc-200 transition"
          >
            <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#0c0c0e] text-zinc-400 font-medium border-b border-zinc-800">
              <tr>
                <th className="py-2.5 px-4 font-normal">Test Name</th>
                <th className="py-2.5 px-4 font-normal">Status</th>
                <th className="py-2.5 px-4 font-normal">Verdict</th>
                <th className="py-2.5 px-4 font-normal">Duration</th>
                <th className="py-2.5 px-4 font-normal">Requests</th>
                <th className="py-2.5 px-4 font-normal">Avg RPS</th>
                <th className="py-2.5 px-4 font-normal">P95 Latency</th>
                <th className="py-2.5 px-4 text-right font-normal">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60 font-mono text-[11px]">
              {executions.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-8 text-zinc-500 font-sans text-xs">
                    No test runs found. Click "New Test" to begin.
                  </td>
                </tr>
              ) : (
                executions.map((exec) => (
                  <tr key={exec.id} className="hover:bg-zinc-800/20 transition">
                    <td className="py-2.5 px-4 font-sans font-medium text-zinc-200">
                      <div>{exec.testName}</div>
                      <div className="text-[10px] text-zinc-500 font-mono">{exec.id}</div>
                    </td>
                    <td className="py-2.5 px-4 font-sans">
                      <span className="text-zinc-300 font-medium">
                        {exec.status}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 font-sans">
                      <span
                        className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium ${
                          exec.verdict === 'PASSED'
                            ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-800/60'
                            : exec.errorRate >= 100
                            ? 'bg-rose-950/60 text-rose-400 border border-rose-800/60'
                            : exec.errorRate > 0
                            ? 'bg-rose-950/60 text-rose-400 border border-rose-800/60'
                            : 'bg-amber-950/60 text-amber-400 border border-amber-800/60'
                        }`}
                      >
                        {exec.verdict === 'PASSED'
                          ? 'Passed'
                          : exec.errorRate >= 100
                          ? 'Target Offline'
                          : exec.errorRate > 0
                          ? `Errors (${exec.errorRate}%)`
                          : 'SLA Exceeded'}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 text-zinc-300">{exec.durationSeconds}s</td>
                    <td className="py-2.5 px-4 text-zinc-300">{exec.totalRequests?.toLocaleString()}</td>
                    <td className="py-2.5 px-4 text-zinc-300">{exec.avgRps?.toFixed(0)}</td>
                    <td className="py-2.5 px-4 text-zinc-300">{exec.p95Latency?.toFixed(1)}ms</td>
                    <td className="py-2.5 px-4 text-right font-sans">
                      {exec.status === 'RUNNING' ? (
                        <button
                          onClick={() => onStartTest(exec.id)}
                          className="text-blue-400 hover:text-blue-300 text-xs font-medium"
                        >
                          View Live
                        </button>
                      ) : (
                        <button
                          onClick={() => onViewReport(exec.id)}
                          className="inline-flex items-center gap-1 text-zinc-400 hover:text-zinc-200 text-xs transition"
                        >
                          Report
                          <ArrowRight className="h-3 w-3" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
