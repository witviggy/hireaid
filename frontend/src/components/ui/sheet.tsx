import { ReactNode, useEffect } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export function Sheet({
  open,
  onClose,
  children,
  widthClassName = "max-w-4xl",
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  widthClassName?: string;
}) {
  useEffect(() => {
    if (!open) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [open]);

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 m-0 z-50 flex justify-end bg-slate-900/40 backdrop-blur-[0.5px]"
      onClick={onClose}
    >
      <div
        className={cn(
          "relative flex h-full w-full max-w-[580px] flex-col overflow-hidden border-l border-[#E5E7EB] bg-white shadow-[-4px_0_24px_rgba(0,0,0,0.08)] animate-slide-in-right dark:border-[#27272A] dark:bg-[#121215] dark:text-[#FAFAFA]",
          widthClassName
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>,
    document.body
  );
}

export function SheetHeader({
  title,
  subtitle,
  onClose,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
}) {
  return (
    <div className="sticky top-0 z-10 flex shrink-0 items-center justify-between border-b border-[#E5E7EB] bg-white px-6 py-4 dark:border-[#27272A] dark:bg-[#121215]">
      <div>
        <h2 className="text-base font-semibold text-slate-900 dark:text-[#FAFAFA]">{title}</h2>
        {subtitle && <p className="text-xs text-slate-500 dark:text-slate-400">{subtitle}</p>}
      </div>
      <button
        onClick={onClose}
        className="flex h-8 w-8 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-[#18181B] dark:hover:text-slate-200"
        aria-label="Close drawer"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
