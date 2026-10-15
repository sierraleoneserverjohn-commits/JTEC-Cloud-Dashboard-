import React from 'react';

interface StorageMeterProps {
  usedBytes: number | null;
  quotaBytes: number | null;
  usedFormatted: string | null;
  status?: 'connected' | 'not_configured' | 'error' | 'untested';
  error?: string | null;
}

export const StorageMeter: React.FC<StorageMeterProps> = ({
  usedBytes,
  quotaBytes,
  usedFormatted,
  status = 'connected',
  error,
}) => {
  const isAvailable = usedBytes !== null && status === 'connected';
  const hasQuota = isAvailable && quotaBytes !== null && quotaBytes > 0;
  const percent = hasQuota ? Math.min(100, (usedBytes! / quotaBytes!) * 100) : null;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="text-neutral-400">Audio Storage Used</span>
        <span className="font-mono tabular-nums text-neutral-200">
          {isAvailable ? (
            <>
              {usedFormatted}
              {hasQuota && ` / ${(quotaBytes! / (1024 * 1024 * 1024)).toFixed(1)} GB`}
            </>
          ) : status === 'not_configured' ? (
            <span className="text-neutral-500 font-sans text-[11px]">Unconfigured</span>
          ) : (
            <span className="text-rose-400 font-sans text-[11px]">Unavailable (Error)</span>
          )}
        </span>
      </div>

      <div className="h-1.5 w-full overflow-hidden rounded-full bg-neutral-900 border border-neutral-800">
        {hasQuota ? (
          <div
            className={`h-full transition-all duration-500 rounded-full ${
              (percent ?? 0) > 90
                ? 'bg-rose-500'
                : (percent ?? 0) > 75
                ? 'bg-amber-400'
                : 'bg-neutral-200'
            }`}
            style={{ width: `${Math.max(1, percent ?? 0)}%` }}
          />
        ) : isAvailable ? (
          <div
            className="h-full bg-neutral-700/60 rounded-full"
            style={{ width: usedBytes! > 0 ? '15%' : '0%' }}
            title="Quota limit not configured"
          />
        ) : status === 'error' ? (
          <div className="h-full bg-rose-900/60 rounded-full w-full" />
        ) : (
          <div className="h-full bg-neutral-800/40 rounded-full w-full" />
        )}
      </div>

      <div className="flex items-center justify-between text-[11px] text-neutral-500">
        <span>
          {hasQuota
            ? `${percent?.toFixed(1)}% of quota`
            : isAvailable
            ? 'Quota limit: Not specified'
            : status === 'not_configured'
            ? 'Credentials required'
            : 'Bucket read failed'}
        </span>
        {hasQuota ? (
          <span className="font-mono tabular-nums">
            {Math.max(0, (quotaBytes! - usedBytes!) / (1024 * 1024)).toFixed(0)} MB remaining
          </span>
        ) : isAvailable ? (
          <span className="italic text-neutral-600">Plan limit unavailable</span>
        ) : status === 'error' ? (
          <span className="text-rose-400/80">Check diagnostics</span>
        ) : (
          <span className="text-neutral-600">Slot ready</span>
        )}
      </div>
    </div>
  );
};
