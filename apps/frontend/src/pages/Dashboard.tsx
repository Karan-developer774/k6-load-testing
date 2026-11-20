import React, { useEffect, useState } from 'react';
import { Activity, CheckCircle2, XCircle, Zap, Clock, ArrowRight, Play, RefreshCw, BarChart2 } from 'lucide-react';
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
  const passRate = totalRuns > 0 ? ((passedRuns / totalRuns) * 100).toFixed(1) : '0';

  const avgRpsAll =
    totalRuns > 0
      ? (executions.reduce((acc, curr) => acc + (curr.avgRps || 0), 0) / totalRuns).toFixed(0)
      : '0';

  // Quick 10-VU mock test runner
  const handleQuickMockRun = async () => {
    try {
      setQuickRunning(true);
      const res = await runTest({
        name: 'Quick Mock Users Load Test',
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
      alert('Failed to launch quick test: ' + err);
    } finally {
      setQuickRunning(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-blue-900/40 via-indigo-900/30 to-purple-900/20 border border-blue-500/20 p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-blue-400 bg-blue-500/10 px-2.5 py-1 rounded-full border border-blue-500/20">
              High-Performance API Load Testing
            </span>
            <h1 className="text-2xl md:text-3xl font-extrabold text-white mt-2">
              Performance Control Center
            </h1>
            <p className="text-sm text-slate-300 mt-1 max-w-xl">
              Dynamically load test any HTTP endpoint with custom virtual users, ramp-up schedules, and real-time SLA metrics.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleQuickMockRun}
              disabled={quickRunning}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs shadow-lg shadow-emerald-600/30 transition active:scale-95 disabled:opacity-50"
            >
              <Play className="h-4 w-4 fill-white" />
              {quickRunning ? 'Launching...' : 'Quick Run (10 VUs / 10s)'}
            </button>

            <button
              onClick={onCreateNew}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs shadow-lg shadow-blue-600/30 transition active:scale-95"
            >
              <Zap className="h-4 w-4" />
              Custom Load Test
            </button>
          </div>
        </div>
      </div>

      {/* Metrics Overview Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Total Test Runs"
          value={totalRuns}
          subValue="Completed executions"
          icon={<Activity className="h-4 w-4" />}
          accent="blue"
        />
        <MetricCard
          title="SLA Pass Rate"
          value={`${passRate}%`}
          subValue={`${passedRuns} passed · ${failedRuns} failed`}
          icon={<CheckCircle2 className="h-4 w-4" />}
          accent="emerald"
        />
        <MetricCard
          title="Average Throughput"
          value={`${avgRpsAll} req/s`}
          subValue="System-wide performance"
          icon={<Zap className="h-4 w-4" />}
          accent="amber"
        />
        <MetricCard
          title="Active Workers"
          value="1 / 2"
          subValue="Local k6 runner ready"
          icon={<Clock className="h-4 w-4" />}
          accent="purple"
        />
      </div>

      {/* Recent Executions Table */}
      <div className="rounded-xl border border-slate-800 bg-[#0d1322] overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <BarChart2 className="h-4 w-4 text-blue-400" />
            <h2 className="text-sm font-bold text-white">Recent Test Executions</h2>
          </div>
          <button
            onClick={loadData}
            className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white px-2.5 py-1 rounded bg-slate-800/60 hover:bg-slate-800 transition"
          >
            <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#090d16] text-slate-400 font-semibold uppercase tracking-wider border-b border-slate-800">
              <tr>
                <th className="py-3 px-4">Test Name</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Verdict</th>
                <th className="py-3 px-4">Duration</th>
                <th className="py-3 px-4">Total Requests</th>
                <th className="py-3 px-4">Avg RPS</th>
                <th className="py-3 px-4">P95 Latency</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {executions.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-8 text-slate-500">
                    No test executions found. Click "Custom Load Test" or "Quick Run" to start.
                  </td>
                </tr>
              ) : (
                executions.map((exec) => (
                  <tr key={exec.id} className="hover:bg-slate-800/30 transition">
                    <td className="py-3 px-4 font-medium text-slate-200">
                      <div>{exec.testName}</div>
                      <div className="text-[10px] text-slate-500 font-mono">{exec.id}</div>
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold ${
                          exec.status === 'RUNNING'
                            ? 'bg-blue-500/20 text-blue-400 animate-pulse'
                            : exec.status === 'COMPLETED'
                            ? 'bg-slate-800 text-slate-300'
                            : 'bg-rose-500/20 text-rose-400'
                        }`}
                      >
                        {exec.status}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold ${
                          exec.verdict === 'PASSED'
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                            : exec.verdict === 'FAILED'
                            ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                            : 'bg-slate-800 text-slate-400'
                        }`}
                      >
                        {exec.verdict === 'PASSED' && <CheckCircle2 className="h-3 w-3" />}
                        {exec.verdict === 'FAILED' && <XCircle className="h-3 w-3" />}
                        {exec.verdict}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-mono">{exec.durationSeconds}s</td>
                    <td className="py-3 px-4 font-mono font-semibold">{exec.totalRequests?.toLocaleString()}</td>
                    <td className="py-3 px-4 font-mono text-blue-400">{exec.avgRps?.toFixed(1)}</td>
                    <td className="py-3 px-4 font-mono text-purple-400">{exec.p95Latency?.toFixed(1)}ms</td>
                    <td className="py-3 px-4 text-right">
                      {exec.status === 'RUNNING' ? (
                        <button
                          onClick={() => onStartTest(exec.id)}
                          className="px-2.5 py-1 rounded bg-blue-600 text-white font-medium hover:bg-blue-500 text-xs"
                        >
                          View Live
                        </button>
                      ) : (
                        <button
                          onClick={() => onViewReport(exec.id)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 text-xs transition"
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
