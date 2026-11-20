import React from 'react';

interface MetricCardProps {
  title: string;
  value: string | number;
  subValue?: string;
  icon?: React.ReactNode;
  status?: 'normal' | 'error' | 'success';
}

export const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  subValue,
  status = 'normal',
}) => {
  const valueColor =
    status === 'error'
      ? 'text-rose-400'
      : status === 'success'
      ? 'text-emerald-400'
      : 'text-zinc-100';

  return (
    <div className="bg-[#111114] border border-zinc-800 rounded-lg p-4 flex flex-col justify-between">
      <div className="text-xs text-zinc-400 font-medium">{title}</div>
      <div className="mt-2">
        <div className={`text-2xl font-semibold tracking-tight font-mono ${valueColor}`}>
          {value}
        </div>
        {subValue && (
          <div className="text-xs text-zinc-500 mt-1">{subValue}</div>
        )}
      </div>
    </div>
  );
};
