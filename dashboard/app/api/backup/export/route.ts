import { NextRequest, NextResponse } from "next/server";
import { getDatabase } from "@/lib/db";
import { auth } from "@/auth";

export async function GET(req: NextRequest) {
    // Check authentication
    const session = await auth();
    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const db = getDatabase();
        const timestamp = new Date().toISOString().replace(/[:.]/g, "-");

        // Gather all data from all tables
        const backup = {
            metadata: {
                version: "1.0.0",
                exportedAt: new Date().toISOString(),
                exportedBy: "Nuclei CC Backup System",
                format: "nuclei-cc-backup"
            },
            nuclei: {
                scans: db.prepare("SELECT * FROM scans").all(),
                findings: db.prepare("SELECT * FROM findings").all()
            },
            subfinder: {
                scans: db.prepare("SELECT * FROM subfinder_scans").all(),
                results: db.prepare("SELECT * FROM subfinder_results").all(),
                monitored_targets: db.prepare("SELECT * FROM monitored_targets").all(),
                monitored_subdomains: db.prepare("SELECT * FROM monitored_subdomains").all()
            },
            httpx: {
                scans: db.prepare("SELECT * FROM httpx_scans").all(),
                results: db.prepare("SELECT * FROM httpx_results").all()
            }
        };

        // Convert to JSON string
        const jsonData = JSON.stringify(backup, null, 2);
        const filename = `nuclei-cc-backup_${timestamp}.json`;

        // Return as downloadable file
        return new NextResponse(jsonData, {
            headers: {
                'Content-Type': 'application/json',
                'Content-Disposition': `attachment; filename="${filename}"`,
            },
        });

    } catch (error: any) {
        console.error("Backup error:", error);
        return NextResponse.json({
            error: error.message || "Failed to create backup"
        }, { status: 500 });
    }
}
