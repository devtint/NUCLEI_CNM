import { NextRequest, NextResponse } from "next/server";
import { getDatabase } from "@/lib/db";
import { auth } from "@/auth";

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
    // Check authentication
    const session = await auth();
    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const { searchParams } = new URL(req.url);
        const targetId = searchParams.get("targetId");

        const db = getDatabase();

        if (targetId) {
            // Get subdomains for a specific target
            const subdomains = db.prepare(`
                SELECT * FROM monitored_subdomains 
                WHERE target_id = ? 
                ORDER BY last_seen DESC, first_seen DESC
            `).all(targetId);

            const target = db.prepare("SELECT * FROM monitored_targets WHERE id = ?").get(targetId);

            return NextResponse.json({ target, subdomains });
        } else {
            // Get all monitored targets (Inventory)
            const targets = db.prepare(`
                SELECT * FROM monitored_targets 
                ORDER BY last_scan_date DESC
            `).all();

            return NextResponse.json(targets);
        }
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function DELETE(req: NextRequest) {
    // Check authentication
    const session = await auth();
    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const { searchParams } = new URL(req.url);
        const targetId = searchParams.get("targetId");

        if (!targetId) {
            return NextResponse.json({ error: "Target ID is required" }, { status: 400 });
        }

        const { deleteMonitoredTarget } = await import("@/lib/db");
        deleteMonitoredTarget(parseInt(targetId));

        return NextResponse.json({ success: true });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
