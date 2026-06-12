/**
 * Poller health monitoring system.
 *
 * Tracks run status, error counts, and last execution times for
 * each background data collector (poller).
 */

export interface PollerStatus {
  name: string;
  lastRunAt: string | null;
  lastSuccessAt: string | null;
  lastError: string | null;
  runCount: number;
  errorCount: number;
  isRunning: boolean;
}

const pollers = new Map<string, PollerStatus>();

export function createPoller(name: string): void {
  pollers.set(name, {
    name,
    lastRunAt: null,
    lastSuccessAt: null,
    lastError: null,
    runCount: 0,
    errorCount: 0,
    isRunning: false,
  });
}

export function markPollerStart(name: string): void {
  const p = pollers.get(name);
  if (p) {
    p.isRunning = true;
    p.lastRunAt = new Date().toISOString();
    p.runCount++;
  }
}

export function markPollerSuccess(name: string): void {
  const p = pollers.get(name);
  if (p) {
    p.isRunning = false;
    p.lastSuccessAt = new Date().toISOString();
    p.lastError = null;
  }
}

export function markPollerError(name: string, error: string): void {
  const p = pollers.get(name);
  if (p) {
    p.isRunning = false;
    p.lastError = error;
    p.errorCount++;
  }
}

export function getAllPollerStatus(): PollerStatus[] {
  return Array.from(pollers.values());
}
