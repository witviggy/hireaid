import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function StatCard({
  label,
  value,
  icon: Icon,
  accent = "text-[#111827] bg-transparent",
  className,
}: {
  label: string;
  value: string | number;
  icon: LucideIcon;
  accent?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex min-h-[72px] items-center gap-3 rounded-[8px] border border-[#E5E7EB] bg-white px-4 py-3 shadow-[0_1px_4px_rgba(0,0,0,0.06)]",
        className
      )}
    >
      <div className={cn("flex h-8 w-8 shrink-0 items-center justify-center", accent)}>
        <Icon className="h-[18px] w-[18px]" />
      </div>
      <div className="min-w-0">
        <div className="text-[28px] font-bold leading-none text-[#111827]">{value}</div>
        <div className="mt-1 truncate text-[13px] text-[#6B7280]">{label}</div>
      </div>
    </div>
  );
}
