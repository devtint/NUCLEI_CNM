import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { writeFile, readdir } from "fs/promises";
import { auth } from "@/auth";

const UPLOAD_DIR = path.join(process.cwd(), "scans", "uploads");

async function ensureUploadDir() {
    if (!fs.existsSync(UPLOAD_DIR)) {
        await fs.promises.mkdir(UPLOAD_DIR, { recursive: true });
    }
}

export async function GET(req: NextRequest) {
    // Check authentication
    const session = await auth();
    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        await ensureUploadDir();
        const files = await readdir(UPLOAD_DIR);
        // Return full objects so frontend can use name and path
        const fileList = files.map(name => ({
            name,
            path: path.join(UPLOAD_DIR, name),
            createdAt: fs.statSync(path.join(UPLOAD_DIR, name)).birthtime
        })).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()); // Newest first

        return NextResponse.json({ success: true, files: fileList });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    // Check authentication
    const session = await auth();
    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        await ensureUploadDir();
        const contentType = req.headers.get("content-type") || "";

        let filename = "";
        let buffer: Buffer;

        if (contentType.includes("multipart/form-data")) {
            const formData = await req.formData();
            const file = formData.get("file") as File;

            if (!file) {
                return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
            }

            const bytes = await file.arrayBuffer();
            buffer = Buffer.from(bytes);

            // Generate safe filename with timestamp
            const timestamp = Date.now();
            const originalName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
            filename = `${timestamp}_${originalName}`;

        } else if (contentType.includes("application/json")) {
            // Handle raw content creation
            const body = await req.json();
            const { content, name } = body;

            if (!content || !name) {
                return NextResponse.json({ error: "Content and name are required" }, { status: 400 });
            }

            buffer = Buffer.from(content);
            // Ensure .txt extension
            const safeName = name.replace(/[^a-zA-Z0-9.-]/g, "_");
            filename = safeName.endsWith('.txt') ? safeName : `${safeName}.txt`;
        } else {
            return NextResponse.json({ error: "Unsupported content type" }, { status: 400 });
        }

        const filepath = path.join(UPLOAD_DIR, filename);

        // Write file
        await writeFile(filepath, buffer);

        return NextResponse.json({
            success: true,
            filepath,
            filename
        });

    } catch (error: any) {
        console.error("Upload failed:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
