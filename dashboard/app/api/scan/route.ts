import { NextRequest, NextResponse } from "next/server";
import { spawn } from "child_process";
import path from "path";
import fs from "fs";
import { constructCommand, NUCLEI_BINARY } from "@/lib/nuclei/config";
import { insertScan, updateScan, getScan, insertFindings, getDatabase, FindingRecord } from "@/lib/db";
import { sendTelegramNotification } from "@/lib/notifications";
import { cache } from "@/lib/cache";
import { auth } from "@/auth";

// In-memory store for active scans (simple solution for local app)
// In a production serverless env, this wouldn't work, but for a local dashboard this is fine.
// We might move this to a database or file-based lock later if needed.
const activeScans = new Map<string, any>();

export async function POST(req: NextRequest) {
    // Check authentication
    const session = await auth();
    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const body = await req.json();
        const { target, targetMode, tags, severity, templateId, rateLimit, concurrency, bulkSize, customArgs } = body;

        if (!target) {
            return NextResponse.json({ error: "Target is required" }, { status: 400 });
        }

        const scanId = crypto.randomUUID();
        const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
        const filename = `${scanId}_${timestamp}.json`;
        const scansDir = path.join(process.cwd(), "scans");

        // Ensure scans directory exists
        // Ensure scans directory exists
        try {
            await fs.promises.mkdir(scansDir, { recursive: true });
        } catch (e) {
            // Ignore if exists
        }

        const outputPath = path.join(scansDir, filename);

        const config = {
            target,
            targetMode: targetMode || 'url', // Default to 'url'
            tags,
            severity,
            templateId,
            rateLimit: rateLimit ? parseInt(rateLimit) : undefined,
            concurrency: concurrency ? parseInt(concurrency) : undefined,
            bulkSize: bulkSize ? parseInt(bulkSize) : undefined,
            customArgs
        };
        const args = constructCommand({ ...config, customArgs }, outputPath);

        // Insert scan into database
        insertScan({
            id: scanId,
            target,
            config: JSON.stringify(config),
            start_time: Date.now(),
            status: 'running'
        });

        // Spawn the process
        console.log(`Starting scan: ${NUCLEI_BINARY} ${args.join(" ")} `);
        const child = spawn(NUCLEI_BINARY, args);

        // Prevent process from waiting for input
        child.stdin.end();

        activeScans.set(scanId, {
            id: scanId,
            process: child,
            target,
            config, // Store config for UI
            args, // Store full args
            startTime: Date.now(),
            status: "running",
            hasExited: false,
        });

        // Log file path - create it first to avoid ENOENT errors
        // Log file path - create it first to avoid ENOENT errors
        const logPath = path.join(process.cwd(), "scans", `${scanId}.log`);
        await fs.promises.writeFile(logPath, ''); // Create empty file first
        const logStream = fs.createWriteStream(logPath);

        child.stdout.on("data", (data) => {
            logStream.write(data);
        });

        child.stderr.on("data", (data) => {
            logStream.write(data);
        });

        child.on("error", (err) => {
            console.error(`Scan ${scanId} failed to start: `, err);
            logStream.write(`\nFailed to start process: ${err.message} \n`);
            logStream.end();
            const scan = activeScans.get(scanId);
            if (scan) {
                scan.status = "failed";
                scan.hasExited = true;
                scan.endTime = Date.now();
            }
            // Update database
            updateScan(scanId, {
                status: 'failed',
                end_time: Date.now()
            });

        });

        child.on("close", async (code) => {
            console.log(`Scan ${scanId} exited with code ${code} `);
            logStream.end();


            // Get file sizes for database storage
            let jsonFileSize = 0;
            let logFileSize = 0;

            try {
                if (fs.existsSync(outputPath)) {
                    const stats = await fs.promises.stat(outputPath);
                    jsonFileSize = stats.size;
                }
                if (fs.existsSync(logPath)) {
                    const stats = await fs.promises.stat(logPath);
                    logFileSize = stats.size;
                }
            } catch (e) {
                console.error("Error getting file stats:", e);
            }

            // Parse and store findings in database
            if (fs.existsSync(outputPath)) {
                try {
                    const jsonContent = await fs.promises.readFile(outputPath, 'utf-8');
                    const findings = JSON.parse(jsonContent);

                    if (Array.isArray(findings) && findings.length > 0) {
                        const findingRecords: FindingRecord[] = findings.map((f: any) => ({
                            scan_id: scanId,
                            template_id: f['template-id'] || f.templateId,
                            template_path: f['template-path'] || f.templatePath,
                            name: f.info?.name,
                            severity: f.info?.severity,
                            type: f.type,
                            host: f.host,
                            matched_at: f['matched-at'] || f.matchedAt,
                            matcher_name: f['matcher-name'] || f.matcherName,
                            request: f.request,
                            response: f.response,
                            timestamp: f.timestamp,
                            raw_json: JSON.stringify(f)
                        }));

                        insertFindings(findingRecords);
                        console.log(`Stored ${findingRecords.length} findings for scan ${scanId}`);
                    }
                } catch (e) {
                    console.error(`Failed to parse findings for scan ${scanId}: `, e);
                }
            } else {
                // Create empty file if no results
                await fs.promises.writeFile(outputPath, "[]");
                jsonFileSize = 2; // "[]" is 2 bytes
            }

            const scan = activeScans.get(scanId);
            if (scan) {
                if (scan.status !== "stopped") {
                    scan.status = "completed";
                }
                scan.exitCode = code;
                scan.endTime = Date.now();
                scan.hasExited = true;

                // Cleanup memory (Fix Memory Leak)
                // We delay slightly to allow any final polls to see the status
                // Update database with file metadata in single operation
                updateScan(scanId, {
                    status: activeScans.get(scanId)?.status === 'stopped' ? 'stopped' : 'completed',
                    end_time: Date.now(),
                    exit_code: code || 0,
                    json_file_path: filename,
                    json_file_size: jsonFileSize,
                    log_file_path: `${scanId}.log`
                });

                // Send Telegram Notification
                const count = (await getDatabase().prepare('SELECT COUNT(*) as count FROM findings WHERE scan_id = ?').get(scanId) as any).count;
                const message = `🚨 *Nuclei Scan Finished*\n\n` +
                    `🎯 *Target:* \`${target}\`\n` +
                    `📊 *Findings:* ${count}\n` +
                    `✅ *Status:* ${code === 0 ? 'Completed' : 'Failed'}`;

                // Send asynchronously
                sendTelegramNotification(message, outputPath).catch(console.error);

                // Cleanup memory (Fix Memory Leak)
                setTimeout(() => {
                    activeScans.delete(scanId);
                    cache.invalidate("scan-history");
                    cache.invalidatePattern("findings");
                }, 5000);
            }
        });

        return NextResponse.json({
            success: true,
            scanId,
            message: "Scan started",
            command: `${NUCLEI_BINARY} ${args.join(" ")} `
        });

    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function GET(req: NextRequest) {
    // Check authentication
    const session = await auth();
    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get recent scans from database (last 20)
    try {
        const { getDatabase } = await import("@/lib/db");
        const db = getDatabase();

        const scans = db.prepare(`
SELECT
id,
    target,
    config,
    start_time,
    end_time,
    status,
    exit_code
            FROM scans 
            ORDER BY start_time DESC 
            LIMIT 20
        `).all();

        const scans_list = scans.map((s: any) => ({
            id: s.id,
            target: s.target,
            status: s.status || 'unknown',
            startTime: s.start_time,
            endTime: s.end_time,
            exitCode: s.exit_code,
            config: s.config ? JSON.parse(s.config) : {}
        }));

        return NextResponse.json(scans_list);
    } catch (error) {
        console.error("Failed to fetch scans from database:", error);
        return NextResponse.json([], { status: 500 });
    }
}

export async function DELETE(req: NextRequest) {
    // Check authentication
    const session = await auth();
    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
        return NextResponse.json({ error: "Scan ID required" }, { status: 400 });
    }

    const scan = activeScans.get(id);
    if (!scan) {
        return NextResponse.json({ error: "Scan not found" }, { status: 404 });
    }

    if (!scan.hasExited && scan.process) {
        try {
            scan.process.kill(); // Default SIGTERM
            scan.status = "stopped";
            scan.hasExited = true;
            console.log(`Scan ${id} stopped by user.`);

            // Update database
            updateScan(id, {
                status: 'stopped',
                end_time: Date.now()
            });
        } catch (e) {
            console.error(`Failed to kill process ${id} `, e);
        }
    }

    return NextResponse.json({ success: true, message: "Scan stopped" });
}
