import type { DetectionRow } from "@workspace/db";

/** Gap between consecutive points (ms) beyond which we treat it as a new flight session. */
export const SESSION_GAP_MS = 5 * 60 * 1000;

/** A drone is considered "actively" tracked if we've heard from it within this window. */
export const ACTIVE_WINDOW_MS = 2 * 60 * 1000;

export interface FlightSession {
  droneId: string;
  model: string | null;
  signalType: string | null;
  points: DetectionRow[];
}

/**
 * Groups detections (already ordered oldest -> newest) into flight sessions per drone,
 * splitting a drone's points into a new session whenever the gap between consecutive
 * points exceeds SESSION_GAP_MS.
 */
export function groupIntoSessions(detections: DetectionRow[]): FlightSession[] {
  const byDrone = new Map<string, DetectionRow[]>();
  for (const detection of detections) {
    const list = byDrone.get(detection.droneId) ?? [];
    list.push(detection);
    byDrone.set(detection.droneId, list);
  }

  const sessions: FlightSession[] = [];
  for (const [droneId, points] of byDrone) {
    let current: DetectionRow[] = [];
    for (const point of points) {
      const prev = current[current.length - 1];
      if (prev && point.timestamp.getTime() - prev.timestamp.getTime() > SESSION_GAP_MS) {
        sessions.push({
          droneId,
          model: current[0]!.model,
          signalType: current[0]!.signalType,
          points: current,
        });
        current = [];
      }
      current.push(point);
    }
    if (current.length > 0) {
      sessions.push({
        droneId,
        model: current[0]!.model,
        signalType: current[0]!.signalType,
        points: current,
      });
    }
  }

  sessions.sort(
    (a, b) =>
      b.points[b.points.length - 1]!.timestamp.getTime() -
      a.points[a.points.length - 1]!.timestamp.getTime(),
  );
  return sessions;
}
