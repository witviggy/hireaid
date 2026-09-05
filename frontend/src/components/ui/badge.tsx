import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full px-2.5 py-0.5 text-[12px] font-medium transition-colors focus:outline-none",
  {
    variants: {
      variant: {
        default: "bg-[#2563EB] text-white",
        secondary: "bg-[#F3F4F6] text-[#374151]",
        outline: "bg-[#F3F4F6] text-[#374151]",
        success: "bg-[#DCFCE7] text-[#16A34A]",
        destructive: "bg-[#FEE2E2] text-[#B91C1C]",
        info: "bg-[#2563EB] text-white",
        muted: "bg-[#F3F4F6] text-[#374151]",
      },
    },
    defaultVariants: { variant: "default" },
  }
);

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
