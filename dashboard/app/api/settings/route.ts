import { NextRequest, NextResponse } from "next/server";
import { getSetting, setSetting } from "@/lib/db";
import { auth } from "@/auth";

export async function GET(req: NextRequest) {
    const session = await auth();
    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Lazy Sync: Check env vars
    let token = getSetting("telegram_bot_token");
    let chatId = getSetting("telegram_chat_id");
    let notificationsEnabled = getSetting("notifications_enabled");

    // If missing in DB, check Env and Sync
    if (!token && process.env.TELEGRAM_BOT_TOKEN) {
        token = process.env.TELEGRAM_BOT_TOKEN;
        setSetting("telegram_bot_token", token);
        // Auto-enable if env provided
        if (!notificationsEnabled) {
            setSetting("notifications_enabled", "true");
            notificationsEnabled = "true";
        }
    }

    if (!chatId && process.env.TELEGRAM_CHAT_ID) {
        chatId = process.env.TELEGRAM_CHAT_ID;
        setSetting("telegram_chat_id", chatId);
    }

    // Mask Token for security
    let maskedToken = "";
    if (token) {
        if (token.length > 10) {
            maskedToken = token.substring(0, 6) + "••••••••" + token.substring(token.length - 4);
        } else {
            maskedToken = "••••";
        }
    }

    return NextResponse.json({
        telegram_bot_token: maskedToken,
        telegram_chat_id: chatId || "",
        notifications_enabled: notificationsEnabled === "true",
        is_configured: !!(token && chatId)
    });
}

export async function POST(req: NextRequest) {
    const session = await auth();
    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const body = await req.json();
        const { telegram_bot_token, telegram_chat_id, notifications_enabled } = body;

        // If user sends masked token, DO NOT update it in DB (keep existing)
        // If user sends new token (not masked), update it
        if (telegram_bot_token && !telegram_bot_token.includes("••••")) {
            setSetting("telegram_bot_token", telegram_bot_token);
        }

        if (telegram_chat_id !== undefined) {
            setSetting("telegram_chat_id", telegram_chat_id);
        }

        if (notifications_enabled !== undefined) {
            setSetting("notifications_enabled", String(notifications_enabled));
        }

        return NextResponse.json({ success: true });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
