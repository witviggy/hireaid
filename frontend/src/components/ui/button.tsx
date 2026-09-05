import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[6px] text-[13px] font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-[#111827] text-white hover:bg-[#1f2937] dark:bg-white dark:text-[#111827] dark:hover:bg-slate-200",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline: "border border-[#E5E7EB] bg-white text-[#374151] hover:bg-[#F9FAFB] dark:border-[#27272A] dark:bg-[#121215] dark:text-slate-200 dark:hover:bg-[#18181B]",
        secondary: "bg-[#F3F4F6] text-[#374151] hover:bg-[#E5E7EB] dark:bg-[#18181B] dark:text-slate-200 dark:hover:bg-[#27272A]",
        ghost: "bg-transparent text-[#374151] hover:bg-[#F9FAFB] dark:text-slate-200 dark:hover:bg-[#18181B]",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-[34px] px-3.5 py-2",
        sm: "h-[34px] rounded-[6px] px-3 text-[13px]",
        lg: "h-10 rounded-[6px] px-8",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
