import fs from "fs";
import path from "path";

export interface TelegramConfig {
  botToken: string;
  chatId: string;
  enabled: boolean;
}

const CONFIG_FILE_PATH = path.join(process.cwd(), "data", "telegram_config.json");
const ALT_CONFIG_FILE_PATH = path.join(process.cwd(), "telegram_config.json");

function ensureDataDir() {
  const dir = path.dirname(CONFIG_FILE_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

/**
 * Clean and sanitize Telegram bot tokens (strips 'bot' prefixes, quotes, and full API URLs)
 */
export function sanitizeBotToken(raw: string): string {
  if (!raw) return "";
  let clean = raw.trim().replace(/^["']|["']$/g, '');
  if (clean.startsWith("https://api.telegram.org/bot")) {
    clean = clean.replace("https://api.telegram.org/bot", "").split("/")[0];
  } else if (clean.toLowerCase().startsWith("bot") && clean.includes(":")) {
    clean = clean.substring(3);
  }
  return clean;
}

/**
 * Clean and sanitize Telegram Chat ID / Group ID
 */
export function sanitizeChatId(raw: string): string {
  if (!raw) return "";
  let clean = raw.trim().replace(/^["']|["']$/g, '');
  // If user entered a supergroup ID like "1003974535781" without leading dash, format as "-1003974535781"
  if (/^100\d{8,12}$/.test(clean)) {
    clean = `-${clean}`;
  }
  return clean;
}

/**
 * Get Telegram configuration from local file storage or fallback to environment variables
 */
export function getTelegramConfig(): TelegramConfig {
  let fileConfig: Partial<TelegramConfig> = {};
  try {
    if (fs.existsSync(CONFIG_FILE_PATH)) {
      const raw = fs.readFileSync(CONFIG_FILE_PATH, "utf-8");
      fileConfig = JSON.parse(raw);
    } else if (fs.existsSync(ALT_CONFIG_FILE_PATH)) {
      const raw = fs.readFileSync(ALT_CONFIG_FILE_PATH, "utf-8");
      fileConfig = JSON.parse(raw);
    }
  } catch (e) {
    console.error("Error reading telegram_config.json:", e);
  }

  const fileToken = fileConfig.botToken ? sanitizeBotToken(fileConfig.botToken) : "";
  const fileChat = fileConfig.chatId ? sanitizeChatId(fileConfig.chatId) : "";

  const botToken = fileToken || sanitizeBotToken(process.env.TELEGRAM_BOT_TOKEN || "");
  const chatId = fileChat || sanitizeChatId(process.env.TELEGRAM_CHAT_ID || "");
  const enabled = fileConfig.enabled ?? true;

  return { botToken, chatId, enabled };
}

/**
 * Save Telegram configuration to local file storage
 */
export function saveTelegramConfig(config: Partial<TelegramConfig>): TelegramConfig {
  ensureDataDir();
  const current = getTelegramConfig();

  let botTokenToSave = current.botToken;
  if (config.botToken !== undefined && config.botToken.trim() !== "") {
    const trimmed = sanitizeBotToken(config.botToken);
    // Do not overwrite with masked or placeholder token strings
    if (trimmed && !trimmed.includes("...") && !trimmed.includes("•••") && !trimmed.startsWith("Saved")) {
      botTokenToSave = trimmed;
    }
  }

  let chatIdToSave = current.chatId;
  if (config.chatId !== undefined && config.chatId.trim() !== "") {
    chatIdToSave = sanitizeChatId(config.chatId);
  }

  const updated: TelegramConfig = {
    botToken: botTokenToSave,
    chatId: chatIdToSave,
    enabled: config.enabled !== undefined ? Boolean(config.enabled) : current.enabled,
  };

  try {
    const dataStr = JSON.stringify(updated, null, 2);
    fs.writeFileSync(CONFIG_FILE_PATH, dataStr, "utf-8");
    fs.writeFileSync(ALT_CONFIG_FILE_PATH, dataStr, "utf-8");
  } catch (e) {
    console.error("Error saving telegram_config.json:", e);
  }

  return updated;
}

/**
 * Send custom text message to Telegram Chat using Telegram Bot API
 */
export async function sendTelegramMessage(
  text: string,
  customBotToken?: string,
  customChatId?: string
): Promise<{ success: boolean; error?: string }> {
  const config = getTelegramConfig();

  let botToken = config.botToken;
  if (customBotToken && customBotToken.trim()) {
    const cleaned = sanitizeBotToken(customBotToken);
    if (cleaned && !cleaned.includes("...") && !cleaned.includes("•••") && !cleaned.startsWith("Saved")) {
      botToken = cleaned;
    }
  }

  let chatId = config.chatId;
  if (customChatId && customChatId.trim()) {
    chatId = sanitizeChatId(customChatId);
  }

  if (!botToken || !chatId) {
    return {
      success: false,
      error: "Telegram Bot Token or Chat ID is missing. Please save both credentials in the Admin Portal first."
    };
  }

  const url = `https://api.telegram.org/bot${botToken}/sendMessage`;

  // LEVEL 1: Attempt HTML formatted delivery
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: text,
        parse_mode: "HTML",
        disable_web_page_preview: false
      }),
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    const data = await response.json();
    if (data.ok) {
      return { success: true };
    }
    console.warn("[Telegram HTML delivery failed, retrying plain text]:", data.description);
  } catch (err: any) {
    console.warn("[Telegram HTML fetch exception, retrying plain text]:", err.message);
  }

  // LEVEL 2: Retry with plain text (stripping HTML tags)
  try {
    const plainText = text.replace(/<[^>]*>/g, "");
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: plainText,
        disable_web_page_preview: false
      }),
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    const data = await response.json();
    if (data.ok) {
      return { success: true };
    }
    console.error("[Telegram Plaintext delivery failed]:", data);
    return {
      success: false,
      error: data.description || `Telegram API Error (${data.error_code || 'Unknown'})`
    };
  } catch (err: any) {
    console.error("[Telegram Plaintext fetch exception]:", err);
    return {
      success: false,
      error: err.name === "AbortError" 
        ? "Telegram API timed out after 8 seconds." 
        : (err.message || "Network error when contacting Telegram API.")
    };
  }
}

/**
 * Send rich notification for a newly created booking
 */
export async function sendBookingTelegramNotification(
  booking: any
): Promise<{ success: boolean; error?: string }> {
  const config = getTelegramConfig();
  if (!config.enabled) {
    console.log("[Telegram] Notifications disabled in settings.");
    return { success: false, error: "Telegram notifications are disabled in settings." };
  }

  if (!config.botToken || !config.chatId) {
    console.warn("[Telegram] Missing Bot Token or Chat ID.");
    return { success: false, error: "Missing Bot Token or Chat ID. Configure in Admin Portal." };
  }

  const requestId = booking.request_id || "N/A";
  const serviceType = booking.service_type || "General Service";
  const mobile = booking.mobile_number || "Not provided";
  const address = booking.address || "Not provided";
  const landmark = booking.landmark ? `\n🏷️ <b>Landmark:</b> ${escapeHtml(booking.landmark)}` : "";
  const notes = booking.additional_notes ? `\n📝 <b>Notes:</b> ${escapeHtml(booking.additional_notes)}` : "";
  const amountStr = booking.final_amount
    ? `\n💰 <b>Estimated Amount:</b> ₹${booking.final_amount}`
    : booking.amount
    ? `\n💰 <b>Amount:</b> ₹${booking.amount}`
    : "";

  const mapsUrl = booking.google_maps_url
    ? `\n\n📍 <a href="${booking.google_maps_url}"><b>View Location on Google Maps</b></a>`
    : "";
  const formattedDate = booking.created_at
    ? new Date(booking.created_at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })
    : new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });

  const message = `🔔 <b>New service is booked</b> 🔔

🆔 <b>Booking ID:</b> <code>#${escapeHtml(requestId)}</code>
🛠️ <b>Service Category:</b> <b>${escapeHtml(serviceType)}</b>
📱 <b>Customer Contact:</b> <code>${escapeHtml(mobile)}</code>${amountStr}
📍 <b>Service Address:</b> ${escapeHtml(address)}${landmark}${notes}

⏰ <b>Booking Time:</b> ${escapeHtml(formattedDate)}${mapsUrl}

<i>FixHome Automated Instant Dispatch Alert</i>`;

  console.log(`[Telegram Dispatching] Triggering alert for #${requestId} to Chat ID: ${config.chatId}`);
  const result = await sendTelegramMessage(message, config.botToken, config.chatId);
  if (result.success) {
    console.log(`[Telegram Dispatch SUCCESS] Alert delivered for #${requestId}`);
  } else {
    console.error(`[Telegram Dispatch ERROR] Alert failed for #${requestId}: ${result.error}`);
  }
  return result;
}

function escapeHtml(text: string): string {
  if (!text) return "";
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

