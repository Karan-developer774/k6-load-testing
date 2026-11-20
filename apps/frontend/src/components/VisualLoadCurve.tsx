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
  const data: Array<{ time: string; vus: number }> = [];

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

  const isArrivalRate = loadProfile.strategy.includes('arrival-rate');
  const metricLabel = isArrivalRate ? 'Target (req/s)' : 'Target VUs';

  return (
    <div className="bg-[#111114] p-4 rounded-lg border border-zinc-800">
      <div className="flex items-center justify-between mb-3 text-xs text-zinc-400">
        <span className="font-medium text-zinc-300">Simulated Load Curve</span>
        <span className="font-mono text-zinc-400 text-[11px]">{metricLabel}</span>
      </div>

      <div className="h-40 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data}>
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
              dataKey="vus"
              name={metricLabel}
              stroke="#3b82f6"
              strokeWidth={1.5}
              fill="#3b82f6"
              fillOpacity={0.1}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
