import { NextRequest, NextResponse } from "next/server";
import { getDatabase, getShodanIp, upsertShodanIp } from "@/lib/db";
import { auth } from "@/auth";

export async function POST(req: NextRequest) {
    // Check authentication
    const session = await auth();
    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const body = await req.json();
        const { ip, force } = body;

        if (!ip) {
            return NextResponse.json({ error: "IP address is required" }, { status: 400 });
        }

        // 1. Check the local SQLite Cache (skip if force=true)
        if (!force) {
            const cached = getShodanIp(ip);
            if (cached) {
                const now = Math.floor(Date.now() / 1000);
                const ageInSeconds = now - cached.last_updated;
                const IS_FRESH = ageInSeconds < 604800; // 7 days cache validity limit

                if (IS_FRESH) {
                    return NextResponse.json({
                        success: true,
                        cached: true,
                        data: JSON.parse(cached.raw_data)
                    });
                }
            }
        }

        // 2. Safely get the Shodan API key from the DB
        const db = getDatabase();
        if (!db) throw new Error("Database not connected");

        const shodanKeyRecord = db.prepare("SELECT value FROM settings WHERE key = 'shodan_api_key'").get() as { value: string } | undefined;
        // Fallback to Env variable for safety
        const shodanKey = shodanKeyRecord?.value || process.env.SHODAN_API_KEY;

        if (!shodanKey) {
            return NextResponse.json({ error: "Shodan API key is not configured. Please add it in settings or .env file." }, { status: 401 });
        }

        // 3. Hit the Official Shodan API for the specific Host IP
        // We use wait=true in params to wait if rate-limited? No, just straight API call is sufficient for single on-demand.
        const shodanRes = await fetch(`https://api.shodan.io/shodan/host/${ip}?key=${shodanKey}`);

        if (!shodanRes.ok) {
            const errorMsg = await shodanRes.text();
            throw new Error(`Shodan API Error: ${shodanRes.status} ${errorMsg}`);
        }

        const data = await shodanRes.json();

        // 4. Cache the results in our local database
        upsertShodanIp(ip, JSON.stringify(data));

        return NextResponse.json({
            success: true,
            cached: false,
            data: data
        });

    } catch (error: any) {
        console.error(`Shodan Enrichment Error [ip]:`, error);
        return NextResponse.json({ error: error.message || "Failed to enrich IP with Shodan" }, { status: 500 });
    }
}
