import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import {
    getSchedulerSettings,
    saveSchedulerSettings,
    getSchedulerStatus,
    getSchedulerHealth,
    initScheduler,
    triggerManualRun,
    getEnabledDomainsForScheduler,
    toggleDomainScheduler,
    getNucleiSettings,
    saveNucleiSettings,
    toggleDomainNuclei,
    getBackupSettings,
    saveBackupSettings,
    triggerBackup
} from "@/lib/scheduler";

// GET: Return scheduler settings and status
export async function GET(req: NextRequest) {
    const session = await auth();
    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const settings = getSchedulerSettings();
        const nucleiSettings = getNucleiSettings();
        const backupSettings = getBackupSettings();
        const status = getSchedulerStatus();
        const domains = getEnabledDomainsForScheduler();

        // Get all monitored targets with their scheduler status
        const { getDatabase } = await import("@/lib/db");
        const db = getDatabase();
        const allDomains = db.prepare(`
            SELECT id, target, last_scan_date, scheduler_enabled, nuclei_enabled, total_count 
            FROM monitored_targets 
            ORDER BY target ASC
        `).all();

        return NextResponse.json({
            settings,
            nucleiSettings,
            backupSettings,
            status,
            health: getSchedulerHealth(),
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

        // Manual backup trigger
        if (body.action === "backup") {
            const result = await triggerBackup();
            return NextResponse.json(result);
        }

        // Update backup settings
        if (body.backupUpdate) {
            const { backupEnabled, backupMode, backupHour, notifyDetail } = body.backupUpdate;
            const backupUpdates: any = {};
            if (backupEnabled !== undefined) backupUpdates.backupEnabled = backupEnabled;
            if (backupMode !== undefined) backupUpdates.backupMode = backupMode;
            if (backupHour !== undefined) backupUpdates.backupHour = backupHour;
            if (notifyDetail !== undefined) backupUpdates.notifyDetail = notifyDetail;

            saveBackupSettings(backupUpdates);
            return NextResponse.json({
                success: true,
                backupSettings: getBackupSettings()
            });
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

        // Toggle domain nuclei
        if (body.action === "toggleNuclei") {
            const { targetId, enabled } = body;
            if (targetId === undefined) {
                return NextResponse.json({ error: "targetId required" }, { status: 400 });
            }
            toggleDomainNuclei(targetId, enabled);
            return NextResponse.json({ success: true });
        }

        // Update nuclei settings
        if (body.nucleiUpdate) {
            const { scanMode, templates, severity, rateLimit, concurrency, maxNewThreshold } = body.nucleiUpdate;
            const nucleiUpdates: any = {};
            if (rateLimit !== undefined) {
                const rl = parseInt(rateLimit, 10);
                if (isNaN(rl) || rl < 1 || rl > 1000) {
                    return NextResponse.json({ error: "rateLimit must be 1-1000" }, { status: 400 });
                }
                nucleiUpdates.rateLimit = rl;
            }
            if (concurrency !== undefined) {
                const c = parseInt(concurrency, 10);
                if (isNaN(c) || c < 1 || c > 100) {
                    return NextResponse.json({ error: "concurrency must be 1-100" }, { status: 400 });
                }
                nucleiUpdates.concurrency = c;
            }
            if (maxNewThreshold !== undefined) {
                const t = parseInt(maxNewThreshold, 10);
                if (isNaN(t) || t < 1 || t > 10000) {
                    return NextResponse.json({ error: "maxNewThreshold must be 1-10000" }, { status: 400 });
                }
                nucleiUpdates.maxNewThreshold = t;
            }
            if (scanMode !== undefined) nucleiUpdates.scanMode = scanMode;
            if (templates !== undefined) nucleiUpdates.templates = templates;
            if (severity !== undefined) nucleiUpdates.severity = severity;

            saveNucleiSettings(nucleiUpdates);
            return NextResponse.json({
                success: true,
                nucleiSettings: getNucleiSettings()
            });
        }

        // Update scheduler settings
        const { enabled, frequency, hour, notifyMode, autoHttpx } = body;

        const updates: any = {};
        if (frequency !== undefined) {
            const valid = ["6h", "12h", "24h", "168h"];
            if (!valid.includes(frequency)) {
                return NextResponse.json({ error: `Invalid frequency: ${frequency}. Valid: ${valid.join(", ")}` }, { status: 400 });
            }
        }
        if (hour !== undefined) {
            const h = parseInt(hour, 10);
            if (isNaN(h) || h < 0 || h > 23) {
                return NextResponse.json({ error: `Invalid hour: ${hour}. Must be 0-23.` }, { status: 400 });
            }
            updates.hour = h;
        }
        if (notifyMode !== undefined && !["always", "new_only"].includes(notifyMode)) {
            return NextResponse.json({ error: `Invalid notifyMode: ${notifyMode}` }, { status: 400 });
        }
        if (enabled !== undefined) updates.enabled = enabled;
        if (frequency !== undefined) updates.frequency = frequency;
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
