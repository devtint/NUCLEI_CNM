import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";

export async function POST(req: NextRequest) {
    const session = await auth();
    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const body = await req.json();
        const { token, chatId } = body;

        if (!token || !chatId) {
            return NextResponse.json({ error: "Token and Chat ID are required" }, { status: 400 });
        }

        // Send Test Message
        const apiUrl = `https://api.telegram.org/bot${token}/sendMessage`;
        const payload = {
            chat_id: chatId,
            text: "✅ Nuclei Dashboard: Connection Verification Successful!\n\nYou will now receive notifications here.",
            parse_mode: "Markdown"
        };

        const res = await fetch(apiUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });

        const data = await res.json();

        if (!data.ok) {
            return NextResponse.json({
                success: false,
                error: data.description || "Telegram API Error"
            });
        }

        return NextResponse.json({ success: true });

    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
