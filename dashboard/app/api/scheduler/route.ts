import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import {
    getSchedulerSettings,
    saveSchedulerSettings,
    getSchedulerStatus,
    initScheduler,
    triggerManualRun,
    getEnabledDomainsForScheduler,
    toggleDomainScheduler
} from "@/lib/scheduler";

// GET: Return scheduler settings and status
export async function GET(req: NextRequest) {
    const session = await auth();
    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const settings = getSchedulerSettings();
        const status = getSchedulerStatus();
        const domains = getEnabledDomainsForScheduler();

        // Get all monitored targets with their scheduler status
        const { getDatabase } = await import("@/lib/db");
        const db = getDatabase();
        const allDomains = db.prepare(`
            SELECT id, target, last_scan_date, scheduler_enabled, total_count 
            FROM monitored_targets 
            ORDER BY target ASC
        `).all();

        return NextResponse.json({
            settings,
            status,
            domains: allDomains,
            enabledCount: domains.length
        });

    } catch (error: any) {
        console.error("[Scheduler API] GET error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// POST: Update scheduler settings or trigger manual run
export async function POST(req: NextRequest) {
    const session = await auth();
    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const body = await req.json();

        // Manual trigger
        if (body.action === "trigger") {
            await triggerManualRun();
            return NextResponse.json({ success: true, message: "Manual scan triggered" });
        }

        // Toggle domain scheduler
        if (body.action === "toggleDomain") {
            const { targetId, enabled } = body;
            if (targetId === undefined) {
                return NextResponse.json({ error: "targetId required" }, { status: 400 });
            }
            toggleDomainScheduler(targetId, enabled);
            return NextResponse.json({ success: true });
        }

        // Update settings
        const { enabled, frequency, hour, notifyMode, autoHttpx } = body;

        const updates: any = {};
        if (enabled !== undefined) updates.enabled = enabled;
        if (frequency !== undefined) updates.frequency = frequency;
        if (hour !== undefined) updates.hour = hour;
        if (notifyMode !== undefined) updates.notifyMode = notifyMode;
        if (autoHttpx !== undefined) updates.autoHttpx = autoHttpx;

        saveSchedulerSettings(updates);

        // Reinitialize scheduler with new settings
        initScheduler();

        return NextResponse.json({
            success: true,
            settings: getSchedulerSettings()
        });

    } catch (error: any) {
        console.error("[Scheduler API] POST error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
