import React, { useEffect, useState } from 'react';
import { History, Search, Download, ArrowRight, CheckCircle2, XCircle, RefreshCw } from 'lucide-react';
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
    const matchesVerdict =
      filterVerdict === 'ALL' || e.verdict === filterVerdict || (filterVerdict === 'RUNNING' && e.status === 'RUNNING');
    return matchesSearch && matchesVerdict;
  });

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <History className="h-5 w-5 text-blue-500" />
            Execution Run History
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Full audit log of previous performance test executions and persisted metric archives.
          </p>
        </div>

        <button
          onClick={loadData}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 hover:text-white text-xs border border-slate-700 transition"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Filter Toolbar */}
      <div className="flex flex-col sm:flex-row items-center gap-3 bg-[#0d1322] p-3 rounded-xl border border-slate-800">
        <div className="flex-1 flex items-center gap-2 bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 w-full">
          <Search className="h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by test name or execution ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="bg-transparent text-xs text-slate-200 focus:outline-none w-full"
          />
        </div>

        <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-lg border border-slate-800 text-xs">
          {['ALL', 'PASSED', 'FAILED', 'RUNNING'].map((v) => (
            <button
              key={v}
              onClick={() => setFilterVerdict(v)}
              className={`px-3 py-1 rounded-md text-[11px] font-semibold transition ${
                filterVerdict === v
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      {/* Executions Table */}
      <div className="bg-[#0d1322] rounded-xl border border-slate-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#090d16] text-slate-400 font-semibold uppercase tracking-wider border-b border-slate-800">
              <tr>
                <th className="py-3 px-4">Test Name & Execution ID</th>
                <th className="py-3 px-4">Verdict</th>
                <th className="py-3 px-4">Date / Time</th>
                <th className="py-3 px-4">Duration</th>
                <th className="py-3 px-4">Total Requests</th>
                <th className="py-3 px-4">Avg RPS</th>
                <th className="py-3 px-4">P95 Latency</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-8 text-slate-500">
                    No matching test executions found.
                  </td>
                </tr>
              ) : (
                filtered.map((e) => (
                  <tr key={e.id} className="hover:bg-slate-800/30 transition">
                    <td className="py-3 px-4 font-medium text-slate-200">
                      <div>{e.testName}</div>
                      <div className="text-[10px] text-slate-500 font-mono">{e.id}</div>
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold ${
                          e.verdict === 'PASSED'
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                            : e.verdict === 'FAILED'
                            ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                            : 'bg-slate-800 text-slate-400'
                        }`}
                      >
                        {e.verdict === 'PASSED' && <CheckCircle2 className="h-3 w-3" />}
                        {e.verdict === 'FAILED' && <XCircle className="h-3 w-3" />}
                        {e.verdict}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-400 font-mono">
                      {new Date(e.createdAt).toLocaleString()}
                    </td>
                    <td className="py-3 px-4 font-mono">{e.durationSeconds}s</td>
                    <td className="py-3 px-4 font-mono font-semibold">{e.totalRequests?.toLocaleString()}</td>
                    <td className="py-3 px-4 font-mono text-blue-400">{e.avgRps?.toFixed(1)}</td>
                    <td className="py-3 px-4 font-mono text-purple-400">{e.p95Latency?.toFixed(1)}ms</td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <a
                          href={`http://localhost:3001/api/v1/reports/${e.id}/export.csv`}
                          download
                          title="Download CSV"
                          className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition"
                        >
                          <Download className="h-3.5 w-3.5" />
                        </a>

                        {e.status === 'RUNNING' ? (
                          <button
                            onClick={() => onViewLive(e.id)}
                            className="px-2.5 py-1 rounded bg-blue-600 text-white font-medium hover:bg-blue-500 text-xs"
                          >
                            Live
                          </button>
                        ) : (
                          <button
                            onClick={() => onViewReport(e.id)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 text-xs transition"
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
