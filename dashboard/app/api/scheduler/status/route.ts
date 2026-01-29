import { NextRequest, NextResponse } from "next/server";
import { getDatabase } from "@/lib/db";
import { getSchedulerSettings } from "@/lib/scheduler";
import { auth } from "@/auth";

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
    const session = await auth();
    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        // Get scheduler settings
        const settings = getSchedulerSettings();

        // Get count of enabled domains
        const db = getDatabase();
        const enabledCount = db.prepare("SELECT COUNT(*) as count FROM monitored_targets WHERE scheduler_enabled = 1").get() as { count: number };

        // Calculate next run time
        let nextRun = null;
        if (settings.enabled && settings.lastRun) {
            const lastRunDate = new Date(settings.lastRun);
            let intervalHours = 24;
            if (settings.frequency === "6h") intervalHours = 6;
            if (settings.frequency === "12h") intervalHours = 12;
            if (settings.frequency === "168h") intervalHours = 168;

            // Simple calculation: lastRun + interval
            // Note: This is an approximation. Real cron uses existing logic, but this is good for UI status.
            nextRun = lastRunDate.getTime() + (intervalHours * 60 * 60 * 1000);

            // If next run is in the past (missed run), show "Now" or catch up logic
            // But usually scheduler runs at specific hour for 24h
            if (settings.frequency === "24h") {
                const now = new Date();
                const next = new Date();
                next.setHours(settings.hour, 0, 0, 0);
                if (next < now) {
                    next.setDate(next.getDate() + 1);
                }
                nextRun = next.getTime();
            }
        }

        return NextResponse.json({
            enabled: settings.enabled,
            enabledDomains: enabledCount.count,
            nextRun: nextRun,
            frequency: settings.frequency
        });
    } catch (error: any) {
        console.error("Error fetching scheduler status:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
