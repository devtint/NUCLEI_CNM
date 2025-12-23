
import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
        return NextResponse.json({ error: "Missing id" }, { status: 400 });
    }

    const logPath = path.join(process.cwd(), "scans", `subfinder_${id}.log`);

    if (!fs.existsSync(logPath)) {
        return NextResponse.json({ error: "Log file not found" }, { status: 404 });
    }

    try {
        const content = fs.readFileSync(logPath, "utf-8");
        return new NextResponse(content, {
            headers: { "Content-Type": "text/plain" },
        });
    } catch (e) {
        return NextResponse.json({ error: "Failed to read log" }, { status: 500 });
    }
}
