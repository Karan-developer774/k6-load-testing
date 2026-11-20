import React, { useEffect, useState } from 'react';
import { Search, Download, ArrowRight, RefreshCw } from 'lucide-react';
import { fetchExecutions } from '../services/api.js';

interface HistoryViewProps {
  onViewReport: (executionId: string) => void;
  onViewLive: (executionId: string) => void;
}

export const HistoryView: React.FC<HistoryViewProps> = ({ onViewReport, onViewLive }) => {
  const [executions, setExecutions] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [filterVerdict, setFilterVerdict] = useState<string>('ALL');
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    try {
      setLoading(true);
      const res = await fetchExecutions(100);
      if (res.data) setExecutions(res.data);
    } catch (err) {
      console.error('Failed to load history:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const filtered = executions.filter((e) => {
    const matchesSearch =
      e.testName.toLowerCase().includes(search.toLowerCase()) ||
      e.id.toLowerCase().includes(search.toLowerCase());
    const isSlaBreach = e.verdict === 'SLA_EXCEEDED' || (e.verdict === 'FAILED' && (e.errorRate || 0) < 5);
    const matchesVerdict =
      filterVerdict === 'ALL' ||
      e.verdict === filterVerdict ||
      (filterVerdict === 'SLA_EXCEEDED' && isSlaBreach) ||
      (filterVerdict === 'RUNNING' && e.status === 'RUNNING');
    return matchesSearch && matchesVerdict;
  });

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-800 pb-4">
        <div>
          <h1 className="text-lg font-semibold text-zinc-100">Execution History</h1>
          <p className="text-xs text-zinc-400 mt-0.5">
            Log of previously completed performance tests and persisted metrics.
          </p>
        </div>

        <button
          onClick={loadData}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-zinc-800 text-zinc-300 hover:text-white text-xs border border-zinc-700 transition"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Search and Filters */}
      <div className="flex items-center gap-2">
        <div className="flex-1 flex items-center gap-2 bg-[#111114] border border-zinc-800 rounded-md px-3 py-1.5">
          <Search className="h-3.5 w-3.5 text-zinc-500" />
          <input
            type="text"
            placeholder="Filter by test name or ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="bg-transparent text-xs text-zinc-200 focus:outline-none w-full"
          />
        </div>

        <div className="flex items-center gap-1 bg-[#111114] p-1 rounded-md border border-zinc-800 text-xs">
          {['ALL', 'PASSED', 'SLA_EXCEEDED', 'FAILED', 'RUNNING'].map((v) => (
            <button
              key={v}
              onClick={() => setFilterVerdict(v)}
              className={`px-2.5 py-1 rounded text-[11px] font-medium transition ${
                filterVerdict === v
                  ? 'bg-zinc-800 text-zinc-100'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              {v === 'SLA_EXCEEDED' ? 'SLA EXCEEDED' : v}
            </button>
          ))}
        </div>
      </div>

      {/* Executions Table */}
      <div className="bg-[#111114] rounded-lg border border-zinc-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#0c0c0e] text-zinc-400 font-medium border-b border-zinc-800">
              <tr>
                <th className="py-2.5 px-4 font-normal">Test Name</th>
                <th className="py-2.5 px-4 font-normal">Verdict</th>
                <th className="py-2.5 px-4 font-normal">Date</th>
                <th className="py-2.5 px-4 font-normal">Duration</th>
                <th className="py-2.5 px-4 font-normal">Requests</th>
                <th className="py-2.5 px-4 font-normal">Avg RPS</th>
                <th className="py-2.5 px-4 font-normal">P95 Latency</th>
                <th className="py-2.5 px-4 text-right font-normal">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60 font-mono text-[11px]">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-8 text-zinc-500 font-sans text-xs">
                    No matching runs found.
                  </td>
                </tr>
              ) : (
                filtered.map((e) => (
                  <tr key={e.id} className="hover:bg-zinc-800/20 transition">
                    <td className="py-2.5 px-4 font-sans font-medium text-zinc-200">
                      <div>{e.testName}</div>
                      <div className="text-[10px] text-zinc-500 font-mono">{e.id}</div>
                    </td>
                    <td className="py-2.5 px-4 font-sans">
                      <span
                        className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium ${
                          e.verdict === 'PASSED'
                            ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-800/60'
                            : e.verdict === 'SLA_EXCEEDED' || (e.verdict === 'FAILED' && (e.errorRate || 0) < 5)
                            ? 'bg-amber-950/60 text-amber-400 border border-amber-800/60'
                            : 'bg-rose-950/60 text-rose-400 border border-rose-800/60'
                        }`}
                      >
                        {e.verdict === 'PASSED'
                          ? 'Passed'
                          : e.verdict === 'SLA_EXCEEDED' || (e.verdict === 'FAILED' && (e.errorRate || 0) < 5)
                          ? 'SLA Exceeded'
                          : e.errorRate >= 100
                          ? 'Target Offline'
                          : `Failed (${e.errorRate}%)`}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 text-zinc-400">
                      {new Date(e.createdAt).toLocaleDateString()} {new Date(e.createdAt).toLocaleTimeString()}
                    </td>
                    <td className="py-2.5 px-4 text-zinc-300">{e.durationSeconds}s</td>
                    <td className="py-2.5 px-4 text-zinc-300">{e.totalRequests?.toLocaleString()}</td>
                    <td className="py-2.5 px-4 text-zinc-300">{e.avgRps?.toFixed(0)}</td>
                    <td className="py-2.5 px-4 text-zinc-300">{e.p95Latency?.toFixed(1)}ms</td>
                    <td className="py-2.5 px-4 text-right font-sans">
                      <div className="flex items-center justify-end gap-2">
                        <a
                          href={`/api/v1/reports/${e.id}/export.csv`}
                          download
                          title="Export CSV"
                          className="p-1 rounded text-zinc-400 hover:text-zinc-200 transition"
                        >
                          <Download className="h-3.5 w-3.5" />
                        </a>

                        {e.status === 'RUNNING' ? (
                          <button
                            onClick={() => onViewLive(e.id)}
                            className="text-blue-400 hover:text-blue-300 font-medium text-xs"
                          >
                            Live
                          </button>
                        ) : (
                          <button
                            onClick={() => onViewReport(e.id)}
                            className="inline-flex items-center gap-1 text-zinc-400 hover:text-zinc-200 text-xs transition"
                          >
                            Report
                            <ArrowRight className="h-3 w-3" />
                          </button>
                        )}
                      </div>
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
