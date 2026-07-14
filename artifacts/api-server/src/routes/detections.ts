import { Router, type IRouter } from "express";
import { desc, gte } from "drizzle-orm";
import { db, homeConfigTable, detectionsTable, type DetectionRow } from "@workspace/db";
import {
  IngestDetectionBody,
  IngestDetectionResponse,
  ListActiveDroneTracksResponse,
  ListFlightHistoryQueryParams,
  ListFlightHistoryResponse,
} from "@workspace/api-zod";
import { distanceMeters } from "../lib/geo";
import { groupIntoSessions, ACTIVE_WINDOW_MS } from "../lib/flight-sessions";

const router: IRouter = Router();

const DEFAULT_HOME = {
  propertyName: "Protected Property",
  lat: 42.6977,
  lng: 23.3219,
  geofenceRadiusMeters: 1000,
};

async function getOrCreateHomeConfig() {
  const [existing] = await db.select().from(homeConfigTable).limit(1);
  if (existing) {
    return existing;
  }
  const [created] = await db.insert(homeConfigTable).values(DEFAULT_HOME).returning();
  return created;
}

function toTrackPoint(detection: DetectionRow) {
  return {
    lat: detection.lat,
    lng: detection.lng,
    altitudeM: detection.altitudeM,
    timestamp: detection.timestamp.toISOString(),
  };
}

router.post("/detections", async (req, res): Promise<void> => {
  const parsed = IngestDetectionBody.safeParse(req.body);
  if (!parsed.success) {
    req.log.warn({ errors: parsed.error.message }, "Invalid detection payload");
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const home = await getOrCreateHomeConfig();
  const timestamp = parsed.data.timestamp ? new Date(parsed.data.timestamp) : new Date();
  const distanceFromHomeM = distanceMeters(home.lat, home.lng, parsed.data.lat, parsed.data.lng);

  const [detection] = await db
    .insert(detectionsTable)
    .values({
      droneId: parsed.data.droneId,
      model: parsed.data.model ?? null,
      signalType: parsed.data.signalType ?? null,
      lat: parsed.data.lat,
      lng: parsed.data.lng,
      altitudeM: parsed.data.altitudeM ?? null,
      speedKmh: parsed.data.speedKmh ?? null,
      headingDeg: parsed.data.headingDeg ?? null,
      rssiDbm: parsed.data.rssiDbm ?? null,
      pilotLat: parsed.data.pilotLat ?? null,
      pilotLng: parsed.data.pilotLng ?? null,
      distanceFromHomeM,
      timestamp,
    })
    .returning();

  req.log.info({ droneId: detection!.droneId, distanceFromHomeM }, "Detection ingested");

  res.status(201).json(
    IngestDetectionResponse.parse({
      ...detection,
      timestamp: detection!.timestamp.toISOString(),
      createdAt: detection!.createdAt.toISOString(),
    }),
  );
});

router.get("/detections/active", async (_req, res): Promise<void> => {
  const home = await getOrCreateHomeConfig();
  const cutoff = new Date(Date.now() - ACTIVE_WINDOW_MS);

  const recent = await db
    .select()
    .from(detectionsTable)
    .where(gte(detectionsTable.timestamp, cutoff))
    .orderBy(detectionsTable.timestamp);

  const sessions = groupIntoSessions(recent).filter((session) => {
    const last = session.points[session.points.length - 1]!;
    return last.timestamp.getTime() >= cutoff.getTime();
  });

  const tracks = sessions.map((session) => {
    const latest = session.points[session.points.length - 1]!;
    const first = session.points[0]!;
    const distanceFromHomeM = distanceMeters(home.lat, home.lng, latest.lat, latest.lng);
    return {
      droneId: session.droneId,
      model: session.model,
      signalType: session.signalType,
      firstSeenAt: first.timestamp.toISOString(),
      lastSeenAt: latest.timestamp.toISOString(),
      lat: latest.lat,
      lng: latest.lng,
      altitudeM: latest.altitudeM,
      speedKmh: latest.speedKmh,
      headingDeg: latest.headingDeg,
      rssiDbm: latest.rssiDbm,
      pilotLat: latest.pilotLat,
      pilotLng: latest.pilotLng,
      distanceFromHomeM,
      alarmActive: distanceFromHomeM <= home.geofenceRadiusMeters,
      path: session.points.slice(-200).map(toTrackPoint),
    };
  });

  res.json(ListActiveDroneTracksResponse.parse(tracks));
});

router.get("/detections/history", async (req, res): Promise<void> => {
  const query = ListFlightHistoryQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }

  const home = await getOrCreateHomeConfig();
  const activeCutoff = Date.now() - ACTIVE_WINDOW_MS;

  const recent = await db
    .select()
    .from(detectionsTable)
    .orderBy(desc(detectionsTable.timestamp))
    .limit(2000);

  const chronological = [...recent].reverse();
  const sessions = groupIntoSessions(chronological).slice(0, query.data.limit);

  const summaries = sessions.map((session) => {
    const first = session.points[0]!;
    const last = session.points[session.points.length - 1]!;
    const distances = session.points.map((p) => distanceMeters(home.lat, home.lng, p.lat, p.lng));
    const altitudes = session.points.map((p) => p.altitudeM).filter((v): v is number => v != null);
    const speeds = session.points.map((p) => p.speedKmh).filter((v): v is number => v != null);

    return {
      droneId: session.droneId,
      model: session.model,
      signalType: session.signalType,
      firstSeenAt: first.timestamp.toISOString(),
      lastSeenAt: last.timestamp.toISOString(),
      minDistanceM: Math.min(...distances),
      maxAltitudeM: altitudes.length > 0 ? Math.max(...altitudes) : null,
      maxSpeedKmh: speeds.length > 0 ? Math.max(...speeds) : null,
      pointCount: session.points.length,
      stillActive: last.timestamp.getTime() >= activeCutoff,
    };
  });

  res.json(ListFlightHistoryResponse.parse(summaries));
});

export default router;
