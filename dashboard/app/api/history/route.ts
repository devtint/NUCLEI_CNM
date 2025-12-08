import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export async function GET() {
    const scansDir = path.join(process.cwd(), "scans");
    const history: any[] = [];

    if (fs.existsSync(scansDir)) {
        const files = fs.readdirSync(scansDir).filter(f => f.endsWith(".json"));

        for (const file of files) {
            try {
                const filePath = path.join(scansDir, file);
                const stats = fs.statSync(filePath);

                // Try to find matching log file
                const logFile = file.replace(".json", ".log");
                const hasLog = fs.existsSync(path.join(scansDir, logFile));

                history.push({
                    id: file.replace(".json", ""),
                    filename: file,
                    size: stats.size,
                    date: stats.mtime.toISOString(),
                    hasLog
                });
            } catch (e) {
                // ignore
            }
        }
    }

    // Sort by date desc
    history.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return NextResponse.json(history);
}
