interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  label?: string;
}

const sizeClasses = {
  sm: 'w-4 h-4 border-2',
  md: 'w-8 h-8 border-2',
  lg: 'w-12 h-12 border-[3px]',
};

export function LoadingSpinner({ size = 'md', label }: LoadingSpinnerProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-3">
      <div
        className={`
          ${sizeClasses[size]}
          rounded-full border-surface-700 border-t-brand-500
          animate-spin
        `}
        role="status"
        aria-label={label ?? 'Loading'}
      />
      {label && (
        <p className="text-sm text-slate-400 animate-pulse">{label}</p>
      )}
    </div>
  );
}
