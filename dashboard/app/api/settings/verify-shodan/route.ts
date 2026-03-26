import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";

export async function POST(req: NextRequest) {
    const session = await auth();
    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const { apiKey } = await req.json();

        if (!apiKey) {
            return NextResponse.json({ error: "Shodan API Key is required" }, { status: 400 });
        }

        // Hit the Shodan /api-info endpoint which requires a valid key
        const shodanRes = await fetch(`https://api.shodan.io/api-info?key=${apiKey}`);

        if (!shodanRes.ok) {
            return NextResponse.json({
                success: false,
                error: "Invalid Shodan API Key or Shodan is unreachable."
            });
        }

        return NextResponse.json({ success: true });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
