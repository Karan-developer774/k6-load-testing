import React, { useState } from 'react';
import { Navbar, TabType } from './components/Navbar.js';
import { Dashboard } from './pages/Dashboard.js';
import { TestBuilder } from './pages/TestBuilder.js';
import { LiveMonitor } from './pages/LiveMonitor.js';
import { ReportView } from './pages/ReportView.js';
import { HistoryView } from './pages/HistoryView.js';

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabType>('dashboard');
  const [currentExecutionId, setCurrentExecutionId] = useState<string | null>(null);
  const [reportExecutionId, setReportExecutionId] = useState<string | null>(null);

  const handleStartExecution = (id: string) => {
    setCurrentExecutionId(id);
    setActiveTab('live');
  };

  const handleViewReport = (id: string) => {
    setReportExecutionId(id);
    setActiveTab('report');
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#090d16] text-slate-100">
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        activeExecutionId={currentExecutionId}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8">
        {activeTab === 'dashboard' && (
          <Dashboard
            onStartTest={handleStartExecution}
            onViewReport={handleViewReport}
            onCreateNew={() => setActiveTab('create')}
          />
        )}

        {activeTab === 'create' && (
          <TestBuilder onStartExecution={handleStartExecution} />
        )}

        {activeTab === 'live' && currentExecutionId && (
          <LiveMonitor
            executionId={currentExecutionId}
            onViewReport={handleViewReport}
          />
        )}

        {activeTab === 'report' && (
          <ReportView
            executionId={reportExecutionId || currentExecutionId || ''}
            onSelectRun={(id) => setReportExecutionId(id)}
          />
        )}

        {activeTab === 'history' && (
          <HistoryView
            onViewReport={handleViewReport}
            onViewLive={handleStartExecution}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 bg-[#070b13] py-4 text-center text-xs text-slate-500">
        <p>
          Antigravity Load Testing Platform · High-Throughput Fastify Engine · Powered by Grafana k6
        </p>
      </footer>
    </div>
  );
};
