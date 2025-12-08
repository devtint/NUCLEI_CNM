import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const file = searchParams.get("file");

    if (!file) {
        return NextResponse.json({ error: "Missing file param" }, { status: 400 });
    }

    // Security: slightly sanitize to prevent ../ traversal, though 'scans' dir is specific.
    const safeFile = path.basename(file);
    const filePath = path.join(process.cwd(), "scans", safeFile);

    if (!fs.existsSync(filePath)) {
        return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    const content = fs.readFileSync(filePath);

    return new NextResponse(content, {
        headers: {
            "Content-Type": "application/octet-stream",
            "Content-Disposition": `attachment; filename="${safeFile}"`,
        },
    });
}
