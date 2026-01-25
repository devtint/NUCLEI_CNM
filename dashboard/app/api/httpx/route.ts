import { NextRequest, NextResponse } from "next/server";
import { spawn } from "child_process";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import {
    insertHttpxScan,
    updateHttpxScan,
    saveHttpxResults,
    getHttpxScans,
    getHttpxResults,
    deleteHttpxScan,
    getHttpxDomainSummary,
    clearHttpxResults
} from "@/lib/db";
import { HTTPX_BINARY } from "@/lib/nuclei/config";
import { auth } from "@/auth";


export async function DELETE(req: NextRequest) {
    // Check authentication
    const session = await auth();
    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    const action = searchParams.get('action');

    if (action === 'clear_all') {
        try {
            clearHttpxResults();
            // Optional: clean up logs/screenshots directory if needed
            return NextResponse.json({ success: true, message: 'All assets cleared' });
        } catch (e: any) {
            return NextResponse.json({ error: e.message }, { status: 500 });
        }
    }

    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

    try {
        const scan = getHttpxScans().find(s => s.id === id);
        if (scan && scan.log_path) {
            try {
                await fs.promises.access(scan.log_path);
                await fs.promises.unlink(scan.log_path);
            } catch (e) {
                // Ignore if file doesn't exist
            }
        }
        deleteHttpxScan(id);
        return NextResponse.json({ success: true, message: 'Scan deleted' });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

export async function GET(req: NextRequest) {
    // Check authentication
    const session = await auth();
    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    const logs = searchParams.get("logs");
    const view = searchParams.get("view");

    if (view === 'all') {
        const allResults = getHttpxResults();
        return NextResponse.json(allResults);
    }

    if (view === 'domains') {
        const domainSummary = getHttpxDomainSummary();
        return NextResponse.json(domainSummary);
    }

    if (id) {
        if (logs === "true") {
            const scan = getHttpxScans().find(s => s.id === id);
            if (scan && scan.log_path) {
                try {
                    await fs.promises.access(scan.log_path);
                    const logContent = await fs.promises.readFile(scan.log_path, 'utf-8');
                    return new NextResponse(logContent);
                } catch (e) {
                    return new NextResponse("");
                }
            }
            return new NextResponse("");
        }
        const results = getHttpxResults(id);
        return NextResponse.json(results);
    }

    const scans = getHttpxScans();
    return NextResponse.json(scans);
}

export async function PATCH(req: NextRequest) {
    // Check authentication
    const session = await auth();
    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const body = await req.json();
        const { id, action } = body;

        if (action === 'stop' && id) {
            const scans = getHttpxScans();
            const scan = scans.find(s => s.id === id);

            if (scan && scan.status === 'running' && scan.pid) {
                try {
                    process.kill(scan.pid);
                    updateHttpxScan(id, { status: 'stopped', end_time: Date.now() });
                    return NextResponse.json({ success: true, message: "Scan stopped" });
                } catch (e) {
                    // Process might be already gone
                    updateHttpxScan(id, { status: 'stopped', end_time: Date.now() });
                    return NextResponse.json({ success: true, message: "Scan forced stopped (process not found)" });
                }
            }
            return NextResponse.json({ error: "Scan not running or PID missing" }, { status: 400 });
        }
        return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    // Check authentication
    const session = await auth();
    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const body = await req.json();
        const { target, inputs, targetMode = 'url', flags } = body;

        // Validation
        if (!target && (!inputs || inputs.length === 0)) {
            return NextResponse.json({ error: "Target or inputs are required" }, { status: 400 });
        }

        const scanId = crypto.randomUUID();
        // Target Name Logic
        let targetName = "Unknown Target";
        if (targetMode === 'list') {
            targetName = path.basename(target);
        } else if (target) {
            targetName = target;
        } else if (inputs) {
            targetName = `${inputs.length} targets`;
        }

        // Prepare Logs Directory
        // Prepare Logs Directory
        const logsDir = path.join(process.cwd(), "scans", "logs");
        try {
            await fs.promises.mkdir(logsDir, { recursive: true });
        } catch (e) { }

        const logPath = path.join(logsDir, `scan_${scanId}_httpx.log`);

        // Create write stream for logs
        await fs.promises.writeFile(logPath, '');
        const logStream = fs.createWriteStream(logPath);

        // DB Entry
        insertHttpxScan({
            id: scanId,
            target: targetName,
            status: 'running',
            count: 0,
            start_time: Date.now(),
            log_path: logPath
        });

        // Ensure screenshots directory exists
        const screenshotsDir = path.join(process.cwd(), "public", "screenshots");
        try {
            await fs.promises.mkdir(screenshotsDir, { recursive: true });
        } catch (e) { }

        // Construct Command
        const args = ["-json"]; // JSON is mandatory for parsing

        // Add User Flags or Defaults
        if (flags) {
            const userFlags = flags.split(" ").filter((f: string) => f.trim() !== "");
            args.push(...userFlags);
        } else {
            args.push("-title", "-tech-detect", "-sc", "-ip", "-cname");
        }

        // Enable Screenshots
        // args.push("-ss", "-srd", screenshotsDir);

        let tempFilePath = "";

        // Add Target
        if (targetMode === 'list') {
            args.push("-l", target); // 'target' is the absolute file path
        } else if (inputs && inputs.length > 0) {
            // Temporary file for "Enrich" functionality
            // Temporary file for "Enrich" functionality
            const scansDir = path.join(process.cwd(), "scans");
            try {
                await fs.promises.mkdir(scansDir, { recursive: true });
            } catch (e) { }

            tempFilePath = path.join(scansDir, `httpx_targets_${scanId}.txt`);
            await fs.promises.writeFile(tempFilePath, inputs.join("\n"));
            args.push("-l", tempFilePath);
        } else {
            // Single target mode
            args.push("-u", target);
        }

        args.push("-no-color");
        console.log(`[API] Starting httpx scan ${scanId} with args: ${args.join(" ")}`);

        const child = spawn(HTTPX_BINARY, args, { stdio: ['ignore', 'pipe', 'pipe'] });

        if (child.pid) {
            updateHttpxScan(scanId, { pid: child.pid });
            logStream.write(`[INFO] Process started with PID: ${child.pid}\n`);
        }

        let jsonOutput = "";

        child.stdout?.on("data", (data) => {
            const str = data.toString();
            jsonOutput += str;
            logStream.write(str);
        });

        child.stderr?.on("data", (data) => {
            const str = data.toString();
            // console.log(`[HTTPX STDERR] ${str}`); // Keep console clean
            logStream.write(str);
        });

        child.on("close", async (code) => {
            // Close log stream
            logStream.end();

            if (tempFilePath) {
                try {
                    await fs.promises.unlink(tempFilePath);
                } catch (e) { }
            }

            if (code !== 0) {
                console.error(`httpx exited with code ${code}`);
                updateHttpxScan(scanId, {
                    status: 'failed',
                    end_time: Date.now()
                });
            } else {
                try {
                    // Parse JSONL
                    const results: any[] = [];
                    const lines = jsonOutput.split("\n");
                    for (const line of lines) {
                        if (!line.trim()) continue;
                        try {
                            const parsed = JSON.parse(line);
                            // Map screenshot path if exists
                            if (parsed.screenshot_path) {
                                // parsed.screenshot_path is absolute path from httpx
                                // We need relative path for frontend: /screenshots/filename.png
                                const filename = path.basename(parsed.screenshot_path);
                                parsed.screenshot_path = `/screenshots/${filename}`;
                            }
                            results.push(parsed);
                        } catch (e) {
                            // ignore invalid json lines
                        }
                    }

                    console.log(`[API] Httpx finished. Parsed ${results.length} results.`);
                    saveHttpxResults(scanId, results);

                    updateHttpxScan(scanId, {
                        status: 'completed',
                        end_time: Date.now(),
                        count: results.length
                    });

                } catch (e: any) {
                    console.error("Error processing httpx results:", e);
                    updateHttpxScan(scanId, {
                        status: 'failed',
                        end_time: Date.now()
                    });
                }
            }
        });

        child.on("error", async (err) => {
            console.error("Failed to start httpx:", err);
            logStream.end(); // close stream on error

            if (tempFilePath) {
                try {
                    await fs.promises.unlink(tempFilePath);
                } catch (e) { }
            }
            updateHttpxScan(scanId, {
                status: 'failed',
                end_time: Date.now()
            });
        });

        return NextResponse.json({
            success: true,
            scanId,
            message: "Scan started"
        });

    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
