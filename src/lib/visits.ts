import type { Race, Results } from "./types";

const KEY = "wpr-midterm-2026-last-visit";

/** What the reader's browser had seen called the last time this page held results. Lives only in that browser. */
export interface Visit {
  at: string; // ISO time of that visit
  called: number[]; // race ids with a called winner then
}

export function readVisit(): Visit | null {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const v: unknown = JSON.parse(raw);
    return typeof v === "object" && v !== null && typeof (v as Visit).at === "string" && Array.isArray((v as Visit).called) ? (v as Visit) : null;
  } catch {
    return null; // private windows and blocked storage: no strip, nothing else changes
  }
}

export function writeVisit(results: Results, at: number): void {
  try {
    const visit: Visit = { at: new Date(at).toISOString(), called: results.races.filter((r) => r.winner !== null).map((r) => r.id) };
    window.localStorage.setItem(KEY, JSON.stringify(visit));
  } catch {
    // storage unavailable: the next visit simply has nothing to compare against
  }
}

/** Races called since that visit, newest call first; calls without a time last. */
export function calledSince(results: Results, visit: Visit): Race[] {
  const seen = new Set(visit.called);
  return results.races
    .filter((r) => r.winner !== null && !seen.has(r.id))
    .sort((a, z) => (z.calledAt ?? "").localeCompare(a.calledAt ?? ""));
}
