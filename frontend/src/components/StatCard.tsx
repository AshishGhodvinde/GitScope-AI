import type { LucideIcon } from 'lucide-react';

interface StatCardProps {
  icon: LucideIcon;
  label: string;
  value: string | number;
  subtext?: string;
  color?: 'brand' | 'emerald' | 'violet' | 'amber';
}

const colorMap = {
  brand:   { bg: 'bg-brand-500/10',   icon: 'text-brand-400',   border: 'border-brand-500/20'   },
  emerald: { bg: 'bg-emerald-500/10', icon: 'text-emerald-400', border: 'border-emerald-500/20' },
  violet:  { bg: 'bg-violet-500/10',  icon: 'text-violet-400',  border: 'border-violet-500/20'  },
  amber:   { bg: 'bg-amber-500/10',   icon: 'text-amber-400',   border: 'border-amber-500/20'   },
};

export function StatCard({ icon: Icon, label, value, subtext, color = 'brand' }: StatCardProps) {
  const c = colorMap[color];

  return (
    <div className="glass-card p-5 flex items-start gap-4">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${c.bg} border ${c.border}`}>
        <Icon className={`w-5 h-5 ${c.icon}`} />
      </div>
      <div>
        <p className="text-xs text-slate-500 uppercase tracking-wider font-medium">{label}</p>
        <p className="text-2xl font-bold text-slate-100 mt-0.5 leading-none">{value}</p>
        {subtext && <p className="text-xs text-slate-500 mt-1">{subtext}</p>}
      </div>
    </div>
  );
}
