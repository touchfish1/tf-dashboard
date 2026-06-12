/**
 * Typed Event Bus
 *
 * Simple publish/subscribe system for internal dashboard events.
 * Events flow synchronously from pollers → alert engine → notification dispatcher.
 */

export type DashboardEvent =
  | { type: 'deepseek_balance'; balanceTotal: number; balanceGranted: number; balanceToppedUp: number }
  | { type: 'server_metrics'; serverId: number; serverName: string; cpuPercent: number; memoryPercent: number; isOnline: boolean }
  | { type: 'server_offline'; serverId: number; serverName: string }
  | { type: 'opencode_etl_error'; error: string }
  | { type: 'opencode_cost_anomaly'; todayCost: number; avgCost: number; ratio: number }
  | { type: 'opencode_usage_updated'; totalCost: number }
  | { type: 'monthly_budget_check'; currentCost: number; budget: number; usagePercent: number };

type EventHandler = (event: DashboardEvent) => void;

const subscribers = new Set<EventHandler>();

/**
 * Register an event handler. Returns an unsubscribe function.
 */
export function subscribe(handler: EventHandler): () => void {
  subscribers.add(handler);
  return () => { subscribers.delete(handler); };
}

/**
 * Emit an event to all registered subscribers (synchronous).
 */
export function emit(event: DashboardEvent): void {
  for (const handler of subscribers) {
    try {
      handler(event);
    } catch (err) {
      console.error('[event-bus] subscriber error:', err);
    }
  }
}

/**
 * Remove all subscribers (for cleanup / testing).
 */
export function clearSubscribers(): void {
  subscribers.clear();
}
