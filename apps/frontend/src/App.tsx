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
    <div className="min-h-screen flex flex-col bg-[#09090b] text-zinc-100">
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        activeExecutionId={currentExecutionId}
      />

      <main className="flex-1 max-w-6xl w-full mx-auto p-4 sm:p-6">
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

      <footer className="border-t border-zinc-900 bg-[#070709] py-3.5 text-center text-xs text-zinc-500">
        k6 Load Testing Platform · Fastify Core Engine
      </footer>
    </div>
  );
};
