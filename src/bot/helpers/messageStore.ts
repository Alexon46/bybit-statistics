const lastBotMessageIds = new Map<number, number[]>();

export function getStoredMessageIds(userId: number): number[] {
  return lastBotMessageIds.get(userId) ?? [];
}

export function clearStoredMessages(userId: number): void {
  lastBotMessageIds.delete(userId);
}

export function storeMessageIds(userId: number, messageIds: number[]): void {
  lastBotMessageIds.set(userId, messageIds);
}
