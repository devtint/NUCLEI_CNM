import { NextRequest, NextResponse } from "next/server";
import { spawn } from "child_process";
import path from "path";
import fs from "fs";
import { constructCommand, NUCLEI_BINARY } from "@/lib/nuclei/config";

// In-memory store for active scans (simple solution for local app)
// In a production serverless env, this wouldn't work, but for a local dashboard this is fine.
// We might move this to a database or file-based lock later if needed.
const activeScans = new Map<string, any>();

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { target, tags, severity, templateId, rateLimit, concurrency, bulkSize, customArgs } = body;

        if (!target) {
            return NextResponse.json({ error: "Target is required" }, { status: 400 });
        }

        const scanId = crypto.randomUUID();
        const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
        const filename = `${scanId}_${timestamp}.json`;
        const outputPath = path.join(process.cwd(), "scans", filename);

        const config = {
            target,
            tags,
            severity,
            templateId,
            rateLimit: rateLimit ? parseInt(rateLimit) : undefined,
            concurrency: concurrency ? parseInt(concurrency) : undefined,
            bulkSize: bulkSize ? parseInt(bulkSize) : undefined,
            customArgs
        };
        const args = constructCommand({ ...config, customArgs }, outputPath);

        // Spawn the process
        console.log(`Starting scan: ${NUCLEI_BINARY} ${args.join(" ")}`);
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

        // Log file path
        const logPath = path.join(process.cwd(), "scans", `${scanId}.log`);
        const logStream = fs.createWriteStream(logPath);

        child.stdout.on("data", (data) => {
            logStream.write(data);
        });

        child.stderr.on("data", (data) => {
            logStream.write(data);
        });

        child.on("error", (err) => {
            console.error(`Scan ${scanId} failed to start:`, err);
            logStream.write(`\nFailed to start process: ${err.message}\n`);
            logStream.end();
            const scan = activeScans.get(scanId);
            if (scan) {
                scan.status = "failed";
                scan.hasExited = true;
                scan.endTime = Date.now();
            }
        });

        child.on("close", (code) => {
            console.log(`Scan ${scanId} exited with code ${code}`);
            logStream.end();

            // Check if JSON output exists. If not (0 results), create empty array so history is valid.
            if (!fs.existsSync(outputPath)) {
                fs.writeFileSync(outputPath, "[]");
            }

            const scan = activeScans.get(scanId);
            if (scan) {
                if (scan.status !== "stopped") {
                    scan.status = "completed";
                }
                scan.exitCode = code;
                scan.endTime = Date.now();
                scan.hasExited = true;
            }
        });

        return NextResponse.json({
            success: true,
            scanId,
            message: "Scan started",
            command: `${NUCLEI_BINARY} ${args.join(" ")}`
        });

    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function GET(req: NextRequest) {
    // List active scans
    const scans_list = Array.from(activeScans.values()).map(s => ({
        id: s.id,
        target: s.target,
        status: s.status,
        startTime: s.startTime,
        config: s.config, // Send back config
    })).reverse();
    return NextResponse.json(scans_list);
}

export async function DELETE(req: NextRequest) {
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
        } catch (e) {
            console.error(`Failed to kill process ${id}`, e);
        }
    }

    return NextResponse.json({ success: true, message: "Scan stopped" });
}
