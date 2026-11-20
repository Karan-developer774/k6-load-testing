import React from 'react';
import { Activity, Plus, BarChart2, History, ExternalLink } from 'lucide-react';

export type TabType = 'dashboard' | 'create' | 'live' | 'report' | 'history';

interface NavbarProps {
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;
  activeExecutionId?: string | null;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  activeExecutionId,
}) => {
  return (
    <header className="border-b border-zinc-800 bg-[#0c0c0e] px-6 py-2.5">
      <div className="max-w-6xl mx-auto flex items-center justify-between">
        {/* Brand */}
        <div
          className="flex items-center gap-2.5 cursor-pointer"
          onClick={() => setActiveTab('dashboard')}
        >
          <div className="h-7 w-7 rounded-md bg-zinc-800 border border-zinc-700 flex items-center justify-center">
            <Activity className="h-4 w-4 text-zinc-200" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="font-semibold text-sm tracking-tight text-zinc-100">
              k6 Load Tester
            </span>
            <span className="text-[11px] text-zinc-500 font-mono">Fastify engine</span>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav className="flex items-center gap-1">
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition ${
              activeTab === 'dashboard'
                ? 'bg-zinc-800 text-zinc-100 font-semibold'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
            }`}
          >
            Dashboard
          </button>

          <button
            onClick={() => setActiveTab('create')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition ${
              activeTab === 'create'
                ? 'bg-zinc-800 text-zinc-100 font-semibold'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
            }`}
          >
            <Plus className="h-3.5 w-3.5" />
            New Test
          </button>

          {activeExecutionId && (
            <button
              onClick={() => setActiveTab('live')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition ${
                activeTab === 'live'
                  ? 'bg-emerald-950/60 border border-emerald-800/60 text-emerald-300 font-semibold'
                  : 'text-emerald-400 hover:bg-zinc-900'
              }`}
            >
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              Live Monitor
            </button>
          )}

          <button
            onClick={() => setActiveTab('report')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition ${
              activeTab === 'report'
                ? 'bg-zinc-800 text-zinc-100 font-semibold'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
            }`}
          >
            <BarChart2 className="h-3.5 w-3.5" />
            Reports
          </button>

          <button
            onClick={() => setActiveTab('history')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition ${
              activeTab === 'history'
                ? 'bg-zinc-800 text-zinc-100 font-semibold'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
            }`}
          >
            <History className="h-3.5 w-3.5" />
            History
          </button>
        </nav>

        {/* Right tools */}
        <div className="flex items-center gap-3">
          <a
            href="http://localhost:3001/docs"
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1 text-xs text-zinc-400 hover:text-zinc-200 transition"
          >
            <span>API Docs</span>
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      </div>
    </header>
  );
};
