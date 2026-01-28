import { getSetting } from "./db";
import fs from "fs";
import path from "path";

export async function sendTelegramNotification(message: string, filePath?: string) {
    let token = getSetting("telegram_bot_token") || process.env.TELEGRAM_BOT_TOKEN;
    let chatId = getSetting("telegram_chat_id") || process.env.TELEGRAM_CHAT_ID;
    const enabled = getSetting("notifications_enabled");

    // Strictly respect the toggle if it's set to "false"
    if (enabled === "false") return;

    // If keys are missing, we can't send
    if (!token || !chatId) return;

    try {
        const formData = new FormData();
        formData.append("chat_id", chatId);
        formData.append("parse_mode", "Markdown");

        if (filePath && fs.existsSync(filePath)) {
            const stats = fs.statSync(filePath);
            if (stats.size > 0) {
                const fileBuffer = fs.readFileSync(filePath);
                const blob = new Blob([fileBuffer]);
                const filename = path.basename(filePath);

                formData.append("document", blob, filename);
                formData.append("caption", message);

                await fetch(`https://api.telegram.org/bot${token}/sendDocument`, {
                    method: "POST",
                    body: formData
                });
                return;
            }
        }

        // Fallback or plain text
        formData.append("text", message);
        await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
            method: "POST",
            body: formData
        });

    } catch (e) {
        console.error("Failed to send Telegram notification", e);
    }
}
