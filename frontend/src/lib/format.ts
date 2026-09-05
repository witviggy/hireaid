export function formatStatus(status?: string | null): string {
  if (!status) return "—";
  const map: Record<string, string> = {
    // Pipeline statuses
    SOURCED: "Sourced",
    QUEUED: "Queued",
    CALLING: "Calling",
    NO_ANSWER: "No Answer",
    RETRY_PENDING: "Retry Pending",
    UNREACHABLE: "Unreachable",
    SCREENED: "Screened",
    SHORTLISTED: "Shortlisted",
    REJECTED: "Rejected",
    REVIEW_NEEDED: "Review Needed",
    ARCHIVED: "Archived",

    // Role statuses
    DRAFT: "Draft",
    ACTIVE: "Active",
    PAUSED: "Paused",
    CLOSED: "Closed",

    // Call statuses
    COMPLETED: "Completed",
    NOT_CONNECTED: "Not Connected",
    FAILED: "Failed",
    CANCELLED: "Cancelled",

    // Recommendations
    ADVANCE: "Advance",
    HOLD: "Hold",
    REJECT: "Reject",

    // Sources
    SANDBOX: "Sandbox",
    APOLLO: "Apollo",
    PDL: "People Data Labs",
    MANUAL: "Manual Upload",
  };

  if (map[status]) return map[status];

  // Fallback: title case
  return status
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function formatEmpty(val?: string | null): string {
  if (val == null || val.trim() === "") return "—";
  return val;
}

