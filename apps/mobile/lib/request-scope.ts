export type NativeRequestTicket = Readonly<{
  owner: string | null;
  revision: number;
  channel: string;
  sequence: number;
}>;

/** UI ownership only; authentication and data authorization remain server-owned. */
export function createNativeRequestScope() {
  let owner: string | null = null;
  let revision = 0;
  const sequences = new Map<string, number>();

  function invalidate() {
    revision += 1;
    sequences.clear();
  }

  return {
    setOwner(next: string | null) {
      if (owner === next) return false;
      invalidate();
      owner = next;
      return true;
    },
    invalidate,
    owns(userId: string) { return owner === userId; },
    begin(channel: string): NativeRequestTicket {
      const sequence = (sequences.get(channel) ?? 0) + 1;
      sequences.set(channel, sequence);
      return { owner, revision, channel, sequence };
    },
    isCurrent(ticket: NativeRequestTicket) {
      return ticket.owner === owner && ticket.revision === revision &&
        sequences.get(ticket.channel) === ticket.sequence;
    }
  };
}
