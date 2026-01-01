import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

export const dynamic = 'force-dynamic';

async function getVersion(command: string, regex: RegExp): Promise<string> {
    try {
        const { stdout, stderr } = await execAsync(command);
        // ProjectDiscovery tools often print info/banners to stderr
        // We combine both and strip ANSI codes just in case
        const combined = (stdout || "") + (stderr || "");
        // Basic ANSI strip regex
        const clean = combined.replace(/[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g, "");

        const match = clean.match(regex);
        return match ? match[1] : "Unknown";
    } catch (e: any) {
        return "Not Found";
    }
}

import { stat } from "fs/promises";
import { join } from "path";
import { homedir } from "os";

async function getTemplateDate(): Promise<string> {
    const commonPaths = [
        join(homedir(), "nuclei-templates"),
        join(homedir(), ".local", "nuclei-templates"), // Common on some Linux setups
        join(homedir(), ".config", "nuclei-templates")
    ];

    for (const p of commonPaths) {
        try {
            const stats = await stat(p);
            return stats.mtime.toISOString().split('T')[0];
        } catch (e) {
            continue;
        }
    }
    return "Unknown";
}

export async function GET(req: Request) {
    const session = await auth();
    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const [nucleiEngine, templatesDate, subfinder, httpx] = await Promise.all([
            getVersion("nuclei -version", /Nuclei Engine Version: (v[\d.]+)/),
            getTemplateDate(),
            getVersion("subfinder -version", /Current Version: (v[\d.]+)/),
            getVersion("httpx -version", /Current Version: (v[\d.]+)/)
        ]);

        return NextResponse.json({
            versions: {
                nuclei_engine: nucleiEngine,
                nuclei_templates: templatesDate, // Sending date instead of version
                subfinder: subfinder,
                httpx: httpx
            }
        });

    } catch (error: any) {
        console.error("Version check failed:", error);
        return NextResponse.json({
            error: "Failed to check versions",
            details: error.message
        }, { status: 500 });
    }
}

export async function POST(req: Request) {
    const session = await auth();
    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const { action } = await req.json();
        let command = "";

        switch (action) {
            case "update-nuclei":
                command = "nuclei -up";
                break;
            case "update-templates":
                command = "nuclei -ut";
                break;
            case "update-subfinder":
                command = "subfinder -up";
                break;
            case "update-httpx":
                command = "httpx -up";
                break;
            default:
                return NextResponse.json({ error: "Invalid action" }, { status: 400 });
        }

        // Execute update
        const { stdout, stderr } = await execAsync(command);

        const combined = (stdout || "") + (stderr || "");
        // Basic ANSI strip regex for clean UI logs
        const cleanOutput = combined.replace(/[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g, "");

        return NextResponse.json({
            success: true,
            message: `${action} executed successfully`,
            output: cleanOutput
        });

    } catch (error: any) {
        console.error("Update failed:", error);
        return NextResponse.json({
            success: false,
            error: "Update failed",
            details: error.message
        }, { status: 500 });
    }
}
