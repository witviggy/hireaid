import { ReactNode, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export function StepSection({
  index,
  title,
  description,
  complete,
  defaultOpen = false,
  children,
}: {
  index: number;
  title: string;
  description: string;
  complete: boolean;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-[8px] border border-[#E5E7EB] dark:border-[#27272A] bg-white dark:bg-[#121215]">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left hover:bg-slate-50/50 dark:hover:bg-[#18181B]/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div
            className={cn(
              "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold transition-colors",
              complete
                ? "bg-emerald-600 text-white dark:bg-emerald-500"
                : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
            )}
          >
            {complete ? <Check className="h-3.5 w-3.5" /> : index}
          </div>
          <div>
            <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">{title}</div>
            <div className="text-xs text-muted-foreground dark:text-slate-400">{description}</div>
          </div>
        </div>
        <ChevronDown className={cn("h-4 w-4 shrink-0 text-slate-400 transition-transform", open && "rotate-180")} />
      </button>
      {open && <div className="border-t border-slate-100 px-4 py-4 dark:border-[#27272A]">{children}</div>}
    </div>
  );
}
