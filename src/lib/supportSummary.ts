export type SupportSummaryTicket = {
  status: "Open" | "Waiting for Support" | "Waiting for Customer" | "Resolved";
  priority: "Normal" | "Urgent";
};

export function calculateSupportSummary(tickets: SupportSummaryTicket[]) {
  return {
    active: tickets.filter((ticket) => ticket.status !== "Resolved").length,
    waiting: tickets.filter((ticket) => ticket.status === "Waiting for Support").length,
    resolved: tickets.filter((ticket) => ticket.status === "Resolved").length,
    urgent: tickets.filter(
      (ticket) => ticket.priority === "Urgent" && ticket.status !== "Resolved"
    ).length,
  };
}
