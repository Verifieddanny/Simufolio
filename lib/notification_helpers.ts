import type { Subscription } from "./portfolio.ts";

const TG_API_BASE = `https://api.telegram.org/bot${process.env.TG_BOT_API_KEY}`;
const NOTIFICATION_INTERVALS: { [key: string]: number } = {
  hourly: 60 * 60 * 1000, // 1 hour in milliseconds
  daily: 24 * 60 * 60 * 1000, // 1 day
  monthly: 30 * 24 * 60 * 60 * 1000, // 30 days (approximation)
};

/**
 * Sends a message directly to a user's Telegram chat ID.
 * This function bypasses the GrammY bot instance used for webhooks.
 */
export async function sendTelegramNotification(
  chatId: string,
  text: string,
  parseMode: string = "MarkdownV2"
) {
  const url = `${TG_API_BASE}/sendMessage`;

  const payload = {
    chat_id: chatId,
    text: text,
    parse_mode: parseMode,
  };

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.CRON_SECRET}`,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      console.error("Telegram sendMessage failed:", await response.text());
    }
    return response.ok;
  } catch (error) {
    console.error("Error sending Telegram message:", error);
    return false;
  }
}

/**
 * Calculates if a notification should be sent based on the subscription interval.
 * @param sub - The subscription object from MongoDB.
 * @returns boolean - True if the notification is due.
 */
export function isNotificationDue(sub: Subscription): boolean {
  //   const intervalMs = NOTIFICATION_INTERVALS[sub.updateInterval];
  const intervalMs = 5 * 60 * 60;
  if (!intervalMs) return false;

  const lastNotif = sub.lastNotificationDate.getTime();
  const now = Date.now();

  return now - lastNotif >= intervalMs;
}
