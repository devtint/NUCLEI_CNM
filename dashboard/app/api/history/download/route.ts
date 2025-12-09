import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const file = searchParams.get("file");

    if (!file) {
        return NextResponse.json({ error: "Missing file param" }, { status: 400 });
    }

    // Decode URL-encoded filename and sanitize to prevent ../ traversal
    const decodedFile = decodeURIComponent(file);
    const safeFile = path.basename(decodedFile);
    const filePath = path.join(process.cwd(), "scans", safeFile);

    console.log(`Download request: ${file} -> ${safeFile} -> ${filePath}`);

    if (!fs.existsSync(filePath)) {
        console.error(`File not found: ${filePath}`);
        // List available files for debugging
        const scansDir = path.join(process.cwd(), "scans");
        if (fs.existsSync(scansDir)) {
            const files = fs.readdirSync(scansDir);
            console.log(`Available files:`, files.slice(0, 5));
        }
        return NextResponse.json({ error: "File not found", requested: safeFile }, { status: 404 });
    }

    const content = fs.readFileSync(filePath);

    return new NextResponse(content, {
        headers: {
            "Content-Type": "application/octet-stream",
            "Content-Disposition": `attachment; filename="${safeFile}"`,
        },
    });
}
