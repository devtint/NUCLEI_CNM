import { NextRequest, NextResponse } from "next/server";
import { getDatabase } from "@/lib/db";
import { auth } from "@/auth";

export async function POST(req: NextRequest) {
    const session = await auth();
    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const body = await req.json();
        const { query } = body;

        if (!query) {
            return NextResponse.json({ error: "Search query is required" }, { status: 400 });
        }

        const db = getDatabase();
        if (!db) throw new Error("Database not connected");

        const shodanKeyRecord = db.prepare("SELECT value FROM settings WHERE key = 'shodan_api_key'").get() as { value: string } | undefined;
        const shodanKey = shodanKeyRecord?.value || process.env.SHODAN_API_KEY;

        if (!shodanKey) {
            return NextResponse.json({ error: "Shodan API key is not configured." }, { status: 401 });
        }

        const shodanRes = await fetch(`https://api.shodan.io/shodan/host/search?query=${encodeURIComponent(query)}&key=${shodanKey}`);

        if (!shodanRes.ok) {
            const errorMsg = await shodanRes.text();
            throw new Error(`Shodan API Error: ${shodanRes.status} ${errorMsg}`);
        }

        const data = await shodanRes.json();

        return NextResponse.json({
            success: true,
            data: data
        });

    } catch (error: any) {
        console.error(`Shodan Search Error:`, error);
        return NextResponse.json({ error: error.message || "Failed to search Shodan" }, { status: 500 });
    }
}
