import type { GpsFix, Job } from "./types";

const EARTH_RADIUS_M = 6_371_000;

/** Great-circle distance in metres. */
export function distanceMetres(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(s));
}

export interface GeofenceResult {
  distanceM: number;
  within: boolean;
}

/**
 * A fix counts as on site if its accuracy circle overlaps the geofence, so a
 * phone with poor GPS standing at the gate is not wrongly flagged.
 */
export function checkGeofence(job: Pick<Job, "lat" | "lng" | "geofenceRadiusM">, fix: GpsFix): GeofenceResult {
  const distanceM = Math.round(distanceMetres(job, fix));
  const slack = Math.min(fix.accuracyM, 100);
  return { distanceM, within: distanceM <= job.geofenceRadiusM + slack };
}
