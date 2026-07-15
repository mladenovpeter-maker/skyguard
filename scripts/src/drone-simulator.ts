/**
 * SkyGuard OS drone simulator.
 *
 * Sends fake but realistic DJI-DroneID-style detection packets straight to
 * the SkyGuard API server's /api/detections endpoint, so the radar map,
 * geofence alarm, and history views can be exercised end-to-end *before*
 * any physical hardware (Raspberry Pi + HackRF + DragonSync) is on the roof.
 *
 * It simulates one drone flying a straight line from a starting point
 * outside the geofence toward the protected property (crossing the alarm
 * radius partway through), plus a fixed "hidden pilot" location off to the
 * side of the flight path.
 *
 * Usage:
 *   SKYGUARD_API_BASE=https://<dev-domain>/api \
 *   SKYGUARD_DEVICE_KEY=sg_xxx \
 *   pnpm --filter @workspace/scripts run simulate
 *
 * Optional env vars:
 *   HOME_LAT, HOME_LNG        Property coordinates to fly toward.
 *                             Defaults to SkyGuard's built-in default home
 *                             (42.6977, 23.3219).
 *   START_DISTANCE_M          How far out the drone starts (default 1500m).
 *   STEP_INTERVAL_MS          Time between simulated telemetry updates
 *                             (default 2000ms).
 *   STEP_COUNT                Number of updates before the flight ends
 *                             (default 40). Ignored when LOOP=true.
 *   LOOP                      Set to "true" to fly back and forth forever
 *                             between MIN_DISTANCE_M and START_DISTANCE_M,
 *                             instead of stopping after STEP_COUNT. Runs
 *                             until the process is killed (e.g. stopped
 *                             workflow / Ctrl+C).
 *   MIN_DISTANCE_M             Closest approach distance in loop mode
 *                             (default 300m).
 *   CYCLE_STEPS                 Steps for one leg (out or in) of the loop
 *                             (default 30).
 */

const API_BASE = process.env["SKYGUARD_API_BASE"];
const DEVICE_KEY = process.env["SKYGUARD_DEVICE_KEY"];

if (!API_BASE || !DEVICE_KEY) {
  console.error(
    "Missing SKYGUARD_API_BASE and/or SKYGUARD_DEVICE_KEY environment variables.\n" +
      "Example:\n" +
      "  SKYGUARD_API_BASE=https://<dev-domain>/api SKYGUARD_DEVICE_KEY=sg_xxx pnpm --filter @workspace/scripts run simulate",
  );
  process.exit(1);
}

const DETECTIONS_URL = `${API_BASE.replace(/\/$/, "")}/detections`;

const HOME_LAT = Number(process.env["HOME_LAT"] ?? 42.6977);
const HOME_LNG = Number(process.env["HOME_LNG"] ?? 23.3219);
const START_DISTANCE_M = Number(process.env["START_DISTANCE_M"] ?? 1500);
const STEP_INTERVAL_MS = Number(process.env["STEP_INTERVAL_MS"] ?? 2000);
const STEP_COUNT = Number(process.env["STEP_COUNT"] ?? 40);
const LOOP = (process.env["LOOP"] ?? "false").toLowerCase() === "true";
const MIN_DISTANCE_M = Number(process.env["MIN_DISTANCE_M"] ?? 300);
const CYCLE_STEPS = Number(process.env["CYCLE_STEPS"] ?? 30);

const EARTH_RADIUS_M = 6371000;

/** Offsets a lat/lng point by a bearing (degrees) and distance (meters). */
function offset(lat: number, lng: number, bearingDeg: number, distanceM: number): { lat: number; lng: number } {
  const bearing = (bearingDeg * Math.PI) / 180;
  const latRad = (lat * Math.PI) / 180;
  const lngRad = (lng * Math.PI) / 180;
  const angularDistance = distanceM / EARTH_RADIUS_M;

  const newLatRad = Math.asin(
    Math.sin(latRad) * Math.cos(angularDistance) + Math.cos(latRad) * Math.sin(angularDistance) * Math.cos(bearing),
  );
  const newLngRad =
    lngRad +
    Math.atan2(
      Math.sin(bearing) * Math.sin(angularDistance) * Math.cos(latRad),
      Math.cos(angularDistance) - Math.sin(latRad) * Math.sin(newLatRad),
    );

  return { lat: (newLatRad * 180) / Math.PI, lng: (newLngRad * 180) / Math.PI };
}

const APPROACH_BEARING = 210; // drone approaches from the south-west
const DRONE_ID = `SIM-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

// Pilot sits off to the side of the flight path, roughly 200m from the start.
const pilotBearing = (APPROACH_BEARING + 90) % 360;
const start = offset(HOME_LAT, HOME_LNG, (APPROACH_BEARING + 180) % 360, START_DISTANCE_M);
const pilot = offset(start.lat, start.lng, pilotBearing, 200);

const SPEED_MS = 12; // roughly 43 km/h, typical DJI cruise speed
let stepIndex = 0;

/** Triangle wave between MIN_DISTANCE_M and START_DISTANCE_M, one leg per CYCLE_STEPS. */
function loopDistance(i: number): number {
  const period = CYCLE_STEPS * 2;
  const phase = i % period;
  const leg = phase < CYCLE_STEPS ? phase / CYCLE_STEPS : (period - phase) / CYCLE_STEPS; // 0..1..0
  return MIN_DISTANCE_M + leg * (START_DISTANCE_M - MIN_DISTANCE_M);
}

async function sendStep(): Promise<void> {
  const remainingDistance = LOOP
    ? loopDistance(stepIndex)
    : Math.max(START_DISTANCE_M - stepIndex * SPEED_MS * (STEP_INTERVAL_MS / 1000), 0);
  const position = offset(HOME_LAT, HOME_LNG, (APPROACH_BEARING + 180) % 360, remainingDistance);
  const altitudeM = 80 + Math.round(Math.sin(stepIndex / 5) * 15);

  const body = {
    droneId: DRONE_ID,
    model: "DJI Mavic 3 (Simulated)",
    signalType: "SIM_OcuSync",
    lat: position.lat,
    lng: position.lng,
    altitudeM,
    speedKmh: Math.round(SPEED_MS * 3.6 * 10) / 10,
    headingDeg: APPROACH_BEARING,
    rssiDbm: -55 - Math.round(remainingDistance / 100),
    pilotLat: pilot.lat,
    pilotLng: pilot.lng,
  };

  try {
    const response = await fetch(DETECTIONS_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${DEVICE_KEY}`,
      },
      body: JSON.stringify(body),
    });

    if (response.ok) {
      const label = LOOP ? `[loop step ${stepIndex + 1}]` : `[${stepIndex + 1}/${STEP_COUNT}]`;
      console.log(
        `${label} ${DRONE_ID} @ (${position.lat.toFixed(5)}, ${position.lng.toFixed(5)}) ` +
          `~${Math.round(remainingDistance)}m from home, alt ${altitudeM}m -> ${response.status}`,
      );
    } else {
      const text = await response.text();
      console.error(`Request failed with ${response.status}: ${text}`);
      if (response.status === 401) {
        console.error("Check that SKYGUARD_DEVICE_KEY is valid and not revoked (Admin panel).");
        process.exit(1);
      }
    }
  } catch (err) {
    console.error(`Failed to reach ${DETECTIONS_URL}:`, err);
  }
}

async function main(): Promise<void> {
  console.log(`SkyGuard drone simulator starting.`);
  console.log(`Target property: (${HOME_LAT}, ${HOME_LNG})`);
  if (LOOP) {
    console.log(
      `Simulated drone ${DRONE_ID} looping between ${MIN_DISTANCE_M}m and ${START_DISTANCE_M}m from home ` +
        `until stopped (Ctrl+C or workflow stop).`,
    );
  } else {
    console.log(`Simulated drone ${DRONE_ID} starting ${START_DISTANCE_M}m out, approaching at ${SPEED_MS} m/s.`);
  }
  console.log(`Posting to ${DETECTIONS_URL}\n`);

  if (LOOP) {
    for (stepIndex = 0; ; stepIndex++) {
      await sendStep();
      await new Promise((resolve) => setTimeout(resolve, STEP_INTERVAL_MS));
    }
  }

  for (stepIndex = 0; stepIndex < STEP_COUNT; stepIndex++) {
    await sendStep();
    await new Promise((resolve) => setTimeout(resolve, STEP_INTERVAL_MS));
  }

  console.log("\nSimulated flight complete.");
}

main();
