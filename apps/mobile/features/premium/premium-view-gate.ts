// S4 native Premium UI safety: gate access/finalize responses to one active account.
// Client-only guard. Server authorization, idempotency and DB RLS remain independent.
export type PremiumViewTicket = Readonly<{ generation: number; userId: string }>;

export function createPremiumViewGate() {
  let generation = 0;
  let userId: string | null = null;
  let finalizing = false;

  function isCurrent(ticket: PremiumViewTicket | null): boolean {
    return Boolean(ticket && userId !== null &&
      ticket.userId === userId && ticket.generation === generation);
  }

  return {
    begin(nextUserId: string): PremiumViewTicket {
      if (typeof nextUserId !== "string" || !nextUserId.trim()) {
        throw new Error("premium_user_id_required");
      }
      generation += 1;
      userId = nextUserId;
      finalizing = false;
      return { generation, userId: nextUserId };
    },
    snapshot(): PremiumViewTicket | null {
      return userId ? { generation, userId } : null;
    },
    isCurrent,
    tryBeginFinalize(ticket: PremiumViewTicket | null): boolean {
      if (!isCurrent(ticket) || finalizing) return false;
      finalizing = true; // synchronous single-flight before React can rerender
      return true;
    },
    finishFinalize(ticket: PremiumViewTicket | null): boolean {
      if (!isCurrent(ticket) || !finalizing) return false;
      finalizing = false;
      return true;
    },
    invalidate(): void {
      generation += 1;
      userId = null;
      finalizing = false;
    }
  };
}
