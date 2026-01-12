import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { auth } from "@/auth";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    // Check authentication
    const session = await auth();
    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    // We need to return a ReadableStream for SSE
    const stream = new ReadableStream({
        async start(controller) {
            const logPath = path.join(process.cwd(), "scans", `${id}.log`);
            const encoder = new TextEncoder();

            // Check if file exists initially
            if (!fs.existsSync(logPath)) {
                controller.enqueue(encoder.encode(`data: Log file not found for ${id}\n\n`));
                controller.close();
                return;
            }

            // Initial read
            let currentSize = 0;

            // Simple polling mechanism
            const interval = setInterval(() => {
                if (!fs.existsSync(logPath)) {
                    clearInterval(interval);
                    controller.close();
                    return;
                }

                const stats = fs.statSync(logPath);
                if (stats.size > currentSize) {
                    const stream = fs.createReadStream(logPath, {
                        start: currentSize,
                        end: stats.size
                    });

                    stream.on("data", (chunk) => {
                        // Send as data event
                        // Sanitize newlines for SSE
                        const text = chunk.toString();
                        controller.enqueue(encoder.encode(`data: ${JSON.stringify(text)}\n\n`));
                    });

                    currentSize = stats.size;
                }
            }, 500); // Check every 500ms

            // Cleanup on close (not always guaranteed in Next.js but good practice)
            req.signal.addEventListener("abort", () => {
                clearInterval(interval);
            });
        }
    });

    return new Response(stream, {
        headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
        },
    });
}
