import React from 'react';
import { LoadProfileConfig } from '@k6-platform/shared-types';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

interface VisualLoadCurveProps {
  loadProfile: LoadProfileConfig;
}

function parseSeconds(val?: string): number {
  if (!val) return 0;
  const num = parseInt(val, 10);
  if (val.endsWith('m')) return num * 60;
  if (val.endsWith('h')) return num * 3600;
  return num;
}

export const VisualLoadCurve: React.FC<VisualLoadCurveProps> = ({ loadProfile }) => {
  // Generate points for preview
  const data: Array<{ time: string; vus: number }> = [];

  const parseStages = () => {
    let currentSec = 0;
    data.push({ time: '0s', vus: 0 });

    if (loadProfile.strategy === 'constant-vus') {
      const targetVus = loadProfile.vus || 10;
      const rampUp = parseSeconds(loadProfile.rampUpDuration);
      const duration = parseSeconds(loadProfile.duration || '60s');
      const rampDown = parseSeconds(loadProfile.rampDownDuration);

      if (rampUp > 0) {
        currentSec += rampUp;
        data.push({ time: `${currentSec}s`, vus: targetVus });
      } else {
        data.push({ time: '0s', vus: targetVus });
      }

      currentSec += duration;
      data.push({ time: `${currentSec}s`, vus: targetVus });

      if (rampDown > 0) {
        currentSec += rampDown;
        data.push({ time: `${currentSec}s`, vus: 0 });
      }
    } else if (loadProfile.strategy === 'ramping-vus' && loadProfile.stages) {
      for (const st of loadProfile.stages) {
        const sec = parseSeconds(st.duration);
        currentSec += sec;
        data.push({ time: `${currentSec}s`, vus: st.target });
      }
    } else if (loadProfile.strategy === 'constant-arrival-rate') {
      const rate = loadProfile.rate || 50;
      const duration = parseSeconds(loadProfile.duration || '60s');
      data.push({ time: '0s', vus: rate });
      data.push({ time: `${duration}s`, vus: rate });
    } else {
      const targetVus = loadProfile.vus || 10;
      const duration = parseSeconds(loadProfile.duration || '60s');
      data.push({ time: '0s', vus: targetVus });
      data.push({ time: `${duration}s`, vus: targetVus });
    }
  };

  parseStages();

  const isArrivalRate = loadProfile.strategy.includes('arrival-rate');
  const metricLabel = isArrivalRate ? 'Target Rate (req/s)' : 'Virtual Users (VUs)';

  return (
    <div className="bg-[#0b101c] p-4 rounded-xl border border-slate-800">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-semibold text-slate-300">
          Load Curve Simulation Profile
        </span>
        <span className="text-[11px] font-mono text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/20">
          {metricLabel}
        </span>
      </div>

      <div className="h-44 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data}>
            <defs>
              <linearGradient id="loadCurveGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4} />
                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            <XAxis dataKey="time" stroke="#64748b" tick={{ fontSize: 11 }} />
            <YAxis stroke="#64748b" tick={{ fontSize: 11 }} />
            <Tooltip
              contentStyle={{
                backgroundColor: '#0f172a',
                borderColor: '#334155',
                borderRadius: '8px',
                fontSize: '12px',
              }}
            />
            <Area
              type="monotone"
              dataKey="vus"
              name={metricLabel}
              stroke="#3b82f6"
              strokeWidth={2}
              fillOpacity={1}
              fill="url(#loadCurveGrad)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
