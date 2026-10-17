// S4 read-only view safety: reject stale saved-report/network results across account changes.
// No persistence, Provider, image access or change to server authorization.
export type SavedReportViewTicket = Readonly<{ generation: number; userId: string }>;

export function createSavedReportViewGate() {
  let generation = 0;
  let userId: string | null = null;

  return {
    begin(nextUserId: string): SavedReportViewTicket {
      if (typeof nextUserId !== "string" || !nextUserId.trim()) {
        throw new Error("saved_report_user_id_required");
      }
      userId = nextUserId;
      generation += 1;
      return { generation, userId: nextUserId };
    },
    snapshot(): SavedReportViewTicket | null {
      return userId ? { generation, userId } : null;
    },
    isCurrent(ticket: SavedReportViewTicket | null): boolean {
      return Boolean(ticket && userId !== null &&
        ticket.userId === userId && ticket.generation === generation);
    },
    invalidate(): void {
      generation += 1;
      userId = null;
    }
  };
}
