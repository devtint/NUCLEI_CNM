import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcrypt";
import { isSetupRequired, saveConfig, generateAuthSecret, AppConfig } from "@/lib/setup";

export async function POST(req: NextRequest) {
    // Security: Only allow setup if not already configured
    if (!isSetupRequired()) {
        return NextResponse.json(
            { error: "Setup already completed. Cannot reconfigure." },
            { status: 403 }
        );
    }

    try {
        const body = await req.json();
        const { password, confirmPassword } = body;

        // Validation
        if (!password || !confirmPassword) {
            return NextResponse.json(
                { error: "Password and confirmation are required" },
                { status: 400 }
            );
        }

        if (password !== confirmPassword) {
            return NextResponse.json(
                { error: "Passwords do not match" },
                { status: 400 }
            );
        }

        if (password.length < 8) {
            return NextResponse.json(
                { error: "Password must be at least 8 characters" },
                { status: 400 }
            );
        }

        // Generate bcrypt hash
        const passwordHash = await bcrypt.hash(password, 12);

        // Generate auth secret
        const authSecret = generateAuthSecret();

        // Create config
        const config: AppConfig = {
            version: 1,
            auth: {
                passwordHash,
                secret: authSecret,
            },
            createdAt: new Date().toISOString(),
        };

        // Save to persistent storage
        saveConfig(config);

        return NextResponse.json({
            success: true,
            message: "Setup completed successfully. Please log in.",
        });
    } catch (error: any) {
        console.error("Setup error:", error);
        return NextResponse.json(
            { error: error.message || "Setup failed" },
            { status: 500 }
        );
    }
}

export async function GET() {
    // Return setup status
    return NextResponse.json({
        setupRequired: isSetupRequired(),
    });
}
