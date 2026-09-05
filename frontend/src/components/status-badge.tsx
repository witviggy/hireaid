import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const STATUS_VARIANT: Record<string, "success" | "destructive" | "info" | "muted" | "secondary"> = {
  COMPLETED: "success",
  FAILED: "destructive",
  NOT_CONNECTED: "destructive",
  CANCELLED: "muted",
  IN_PROGRESS: "info",
  RINGING: "info",
  INITIATED: "info",
  SCHEDULED: "secondary",
  NOT_STARTED: "muted",
};

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  const variant = STATUS_VARIANT[status] ?? "secondary";
  return (
    <Badge variant={variant} className={cn("font-medium tracking-wide", className)}>
      {status.replace(/_/g, " ")}
    </Badge>
  );
}
