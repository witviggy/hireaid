import { LucideIcon } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

export function StatProgressCard({
  label,
  value,
  subtitle,
  progress,
  icon: Icon,
  className,
}: {
  label: string;
  value: string | number;
  subtitle?: string;
  progress?: number;
  icon?: LucideIcon;
  className?: string;
}) {
  return (
    <div className={cn("rounded-[8px] border border-[#E5E7EB] dark:border-[#27272A] bg-white dark:bg-[#121215] p-5 shadow-[0_1px_4px_rgba(0,0,0,0.06)] flex flex-col justify-between", className)}>
      <div>
        <div className="mb-2 flex items-center gap-1.5 text-[13px] text-[#6B7280] dark:text-[#9CA3AF]">
          {Icon && <Icon className="h-3.5 w-3.5" />}
          {label}
        </div>
        <div className="text-[28px] font-bold leading-none text-[#111827] dark:text-[#FAFAFA]">{value}</div>
      </div>
      {subtitle && (
        <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">
          {subtitle}
        </div>
      )}
      {progress != null && (
        <div className="mt-2.5">
          <Progress value={progress} />
        </div>
      )}
    </div>
  );
}
