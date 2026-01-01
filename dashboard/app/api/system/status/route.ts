
import { NextResponse } from "next/server";
import { exec } from "child_process";
import util from "util";

const execAsync = util.promisify(exec);

async function checkTool(command: string): Promise<{ installed: boolean; version?: string; error?: string }> {
    try {
        const { stdout } = await execAsync(`${command} -version`, { timeout: 5000 });
        // Nuclei output: "Nuclei Engine Version: v3.x.x"
        // Subfinder output: "Current subfinder version v2.x.x"
        // Let's just take the first line or a safe substring.
        const versionLine = stdout.split('\n')[0].trim();
        return { installed: true, version: versionLine };
    } catch (error: any) {
        return { installed: false, error: error.message };
    }
}

export async function GET() {
    const [nuclei, subfinder, httpx] = await Promise.all([
        checkTool("nuclei"),
        checkTool("subfinder"),
        checkTool("httpx")
    ]);

    return NextResponse.json({
        nuclei,
        subfinder,
        httpx,
        timestamp: Date.now()
    });
}
