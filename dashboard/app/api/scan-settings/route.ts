import { NextRequest, NextResponse } from "next/server";
import { getSetting, setSetting } from "@/lib/db";
import { auth } from "@/auth";

const SETTING_KEYS = ["scan_rate_limit", "scan_concurrency", "scan_bulk_size"] as const;

const DEFAULTS: Record<string, number> = {
    scan_rate_limit: 150,
    scan_concurrency: 25,
    scan_bulk_size: 25,
};

export async function GET(req: NextRequest) {
    const session = await auth();
    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    return NextResponse.json({
        rateLimit: parseInt(getSetting("scan_rate_limit") || String(DEFAULTS.scan_rate_limit), 10),
        concurrency: parseInt(getSetting("scan_concurrency") || String(DEFAULTS.scan_concurrency), 10),
        bulkSize: parseInt(getSetting("scan_bulk_size") || String(DEFAULTS.scan_bulk_size), 10),
    });
}

export async function POST(req: NextRequest) {
    const session = await auth();
    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const body = await req.json();
        const { rateLimit, concurrency, bulkSize } = body;

        if (rateLimit !== undefined) {
            const val = Math.max(1, Math.min(10000, parseInt(rateLimit, 10) || DEFAULTS.scan_rate_limit));
            setSetting("scan_rate_limit", String(val));
        }
        if (concurrency !== undefined) {
            const val = Math.max(1, Math.min(500, parseInt(concurrency, 10) || DEFAULTS.scan_concurrency));
            setSetting("scan_concurrency", String(val));
        }
        if (bulkSize !== undefined) {
            const val = Math.max(1, Math.min(500, parseInt(bulkSize, 10) || DEFAULTS.scan_bulk_size));
            setSetting("scan_bulk_size", String(val));
        }

        return NextResponse.json({ success: true });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
