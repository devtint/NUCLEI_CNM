import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import OpenAI from "openai";

export async function POST(req: NextRequest) {
    const session = await auth();
    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const { apiKey } = await req.json();

        if (!apiKey) {
            return NextResponse.json({ error: "Groq API Key is required" }, { status: 400 });
        }

        const client = new OpenAI({
            apiKey: apiKey,
            baseURL: "https://api.groq.com/openai/v1",
        });

        // Test the connection by requesting models
        const models = await client.models.list();

        if (!models || models.data.length === 0) {
            return NextResponse.json({
                success: false,
                error: "Invalid Groq API Key or service is unreachable."
            });
        }

        return NextResponse.json({ success: true });
    } catch (e: any) {
        if (e.status === 401) {
            return NextResponse.json({ success: false, error: "Invalid API Key." });
        }
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
