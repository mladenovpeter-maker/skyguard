/**
 * Telegram alert notifications for SkyGuard drone detections.
 * Uses TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID env vars.
 * Includes per-drone cooldown to avoid spam.
 */

const COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes per drone
const lastAlertAt = new Map<string, number>();

export function isTelegramConfigured(): boolean {
  return !!(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID);
}

export async function sendDroneAlert(params: {
  droneId: string;
  signalType: string | null;
  model: string | null;
  distanceFromHomeM: number;
  lat: number;
  lng: number;
  altitudeM: number | null;
  rssiDbm: number | null;
}): Promise<void> {
  if (!isTelegramConfigured()) return;

  // Cooldown check
  const last = lastAlertAt.get(params.droneId) ?? 0;
  if (Date.now() - last < COOLDOWN_MS) return;
  lastAlertAt.set(params.droneId, Date.now());

  const token = process.env.TELEGRAM_BOT_TOKEN!;
  const chatId = process.env.TELEGRAM_CHAT_ID!;

  const signal = params.signalType ?? "RF";
  const model = params.model ? ` • ${params.model}` : "";
  const dist = Math.round(params.distanceFromHomeM);
  const alt = params.altitudeM != null ? `\n📐 Altitude: ${Math.round(params.altitudeM)}m` : "";
  const rssi = params.rssiDbm != null ? `\n📶 RSSI: ${params.rssiDbm} dBm` : "";
  const mapsUrl = `https://maps.google.com/?q=${params.lat},${params.lng}`;

  const text = [
    `🚨 *ДРОН ЗАСЕЧЕН* 🚨`,
    ``,
    `🆔 ID: \`${params.droneId}\`${model}`,
    `📡 Сигнал: ${signal}`,
    `📏 Разстояние: ${dist}m от базата${alt}${rssi}`,
    ``,
    `📍 [Локация в Google Maps](${mapsUrl})`,
    ``,
    `_SkyGuard OS • ${new Date().toLocaleTimeString("bg-BG")}_`,
  ].join("\n");

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: "Markdown",
        disable_web_page_preview: false,
      }),
    });
    if (!res.ok) {
      const err = await res.text();
      console.error("[Telegram] Failed to send alert:", err);
    }
  } catch (e) {
    console.error("[Telegram] Error sending alert:", e);
  }
}
