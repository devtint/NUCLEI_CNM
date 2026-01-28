import { NextRequest, NextResponse } from "next/server";
import { spawn } from "child_process";
import fs from "fs";
import path from "path";
import {
    insertSubfinderScan,
    updateSubfinderScan,
    saveSubfinderResults,
    getSubfinderScans,
    getSubfinderResults,
    deleteSubfinderScan,
    getRecentSubdomains
} from "@/lib/db";
import { SUBFINDER_BINARY } from "@/lib/nuclei/config";
import { auth } from "@/auth";
import { sendTelegramNotification } from "@/lib/notifications";

export async function POST(req: NextRequest) {
    // Check authentication
    const session = await auth();
    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const body = await req.json();
        const { domain, args } = body;

        if (!domain) {
            return NextResponse.json({ error: "Domain is required" }, { status: 400 });
        }

        const scanId = crypto.randomUUID();

        insertSubfinderScan({
            id: scanId,
            target: domain,
            start_time: Date.now(),
            status: 'running',
            count: 0
        });

        // Base args
        // Note: For live logging of "Enumerating...", we generally need verbose output or just standard output.
        // -silent ONLY outputs domains.
        // If we want "Activity Monitor" feel, we might want to remove -silent or capture stderr for info.
        // Use -v for verbose to get [INF] messages?
        // User wants "like nuclei activity".
        // Let's use default (non-silent) for the log file context, but we need to parse domains cleanly.
        // Strategy: Run with -json if supported? `-oJ` gives JSON output.
        // `subfinder.txt` says: `-oJ, -json write output in JSONL(ines) format`.
        // This is easier to parse AND we can capture stderr for "Activity info".

        // Let's try: `subfinder -d domain -oJ`
        // stdout will be JSONL.
        // stderr will be [INF] messages.

        // Wait, `subfinder.txt` implies `-silent` for just subdomains.
        // Let's stick to `-silent` for simplicity of parsing if we just want results,
        // BUT for "Activity Monitor", `-silent` shows NOTHING but domains.
        // If we want logs like "[INF] Enumerating...", we MUST NOT use -silent.
        // But then stdout has mixed content? No, subfinder sends logs to stderr usually?
        // Let's assume standard behavior:
        // stdout: domains (if not silent, maybe formatted?)
        // stderr: info messages.

        // Safer bet: use `-json` (for results) and capture stderr (for logs).
        const cmdArgs = ["-d", domain, "-json"];

        if (args) {
            const extraArgs = (args as string).split(" ").filter(Boolean);
            cmdArgs.push(...extraArgs);
        }

        console.log(`Starting subfinder: ${SUBFINDER_BINARY} ${cmdArgs.join(" ")}`);
        const child = spawn(SUBFINDER_BINARY, cmdArgs);

        // Create log file
        const logPath = path.join(process.cwd(), "scans", `subfinder_${scanId}.log`);
        // Ensure scans dir exists
        if (!fs.existsSync(path.join(process.cwd(), "scans"))) {
            fs.mkdirSync(path.join(process.cwd(), "scans"));
        }

        const logStream = fs.createWriteStream(logPath);

        let jsonOutput = "";

        child.stdout.on("data", (data) => {
            const str = data.toString();
            // In -oJ mode, stdout is JSON objects.
            // We want to save this for processing results.
            jsonOutput += str;

            // For the "Activity Monitor", if the user wants to see what's happening,
            // json output isn't very readable as a "log" but it shows results coming in.
            // We can log it to the file too?
            logStream.write(data);
        });

        child.stderr.on("data", (data) => {
            // These are the [INF] messages
            logStream.write(data);
        });

        child.on("close", (code) => {
            logStream.end();

            if (code !== 0) {
                updateSubfinderScan(scanId, {
                    status: 'failed',
                    end_time: Date.now()
                });
            } else {
                try {
                    // Parse JSONL results
                    const subdomains: string[] = [];
                    const lines = jsonOutput.split("\n");
                    for (const line of lines) {
                        if (!line.trim()) continue;
                        try {
                            const parsed = JSON.parse(line);
                            if (parsed.host) {
                                subdomains.push(parsed.host);
                            }
                        } catch (e) {
                            // ignore invalid json lines
                        }
                    }

                    console.log(`[API] Parsed ${subdomains.length} subdomains:`, subdomains);
                    saveSubfinderResults(scanId, domain, subdomains);
                    updateSubfinderScan(scanId, {
                        status: 'completed',
                        end_time: Date.now(),
                        count: subdomains.length
                    });

                    // Notification
                    const msg = `🔍 *Subfinder Finished*\n\n` +
                        `🎯 *Target:* \`${domain}\`\n` +
                        `📊 *Subdomains Found:* ${subdomains.length}\n` +
                        `✅ *Status:* Completed`;
                    sendTelegramNotification(msg).catch(console.error);
                } catch (error: any) {
                    console.error("Error processing scan results:", error);
                    updateSubfinderScan(scanId, {
                        status: 'failed',
                        end_time: Date.now()
                    });
                }
            }
        });

        child.on("error", (err) => {
            logStream.write(`Error starting process: ${err.message}\n`);
            logStream.end();
            updateSubfinderScan(scanId, {
                status: 'failed',
                end_time: Date.now()
            });
        });

        // Return immediately
        return NextResponse.json({
            success: true,
            scanId,
            message: "Scan started"
        });

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
        const id = searchParams.get("id");

        if (!id) {
            return NextResponse.json({ error: "Scan ID is required" }, { status: 400 });
        }

        // Also try to delete the log file if it exists
        const logPath = path.join(process.cwd(), "scans", `subfinder_${id}.log`);
        if (fs.existsSync(logPath)) {
            try {
                fs.unlinkSync(logPath);
            } catch (e) {
                console.error("Failed to delete log file:", e);
            }
        }

        // Import the new function dynamically or ensure it's imported at top
        // Since we are editing the file, we should assume the import at top is updated or we update it now.
        // But the previous edit only touched db.ts. 
        // We need to update imports in this file too.
        // I will use a separate edit to update imports if needed, but 'deleteSubfinderScan' is exported from db.ts.
        // Let's assume I can add it to the import list in this block or valid code.
        // Wait, I can only replace the block I see. 
        // I'll blindly add the function call here and will update imports in a separate step if I can't reach the top.
        // actually, I can't reach the top import easily without massive context. 
        // I'll stick to just adding the function and trusting TS/I fill fix imports next.

        deleteSubfinderScan(id);

        return NextResponse.json({ success: true });
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

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    const recent = searchParams.get("recent");

    if (recent) {
        const results = getRecentSubdomains(50);
        return NextResponse.json(results);
    }

    if (id) {
        const results = getSubfinderResults(id);
        return NextResponse.json(results);
    }

    const scans = getSubfinderScans();
    return NextResponse.json(scans);
}
