import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const scanId = searchParams.get("id");

    if (!scanId) {
        return NextResponse.json({ error: "Scan ID required" }, { status: 400 });
    }

    const logPath = path.join(process.cwd(), "scans", `${scanId}.log`);

    if (!fs.existsSync(logPath)) {
        return NextResponse.json({ error: "Log file not found" }, { status: 404 });
    }

    try {
        const logs = fs.readFileSync(logPath, "utf-8");
        const stats = fs.statSync(logPath);

        return NextResponse.json({
            logs,
            fileSize: stats.size,
            lastModified: stats.mtime.toISOString()
        });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
