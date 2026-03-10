import { NextRequest, NextResponse } from "next/server";
import { getDatabase, bulkUpdateShodanStatus } from "@/lib/db";
import { auth } from "@/auth";

export async function POST(req: NextRequest) {
    // Check authentication
    const session = await auth();
    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const body = await req.json();
        const { targetId } = body;

        if (!targetId) {
            return NextResponse.json({ error: "Target ID is required" }, { status: 400 });
        }

        const db = getDatabase();

        // 1. Get the target domain name
        const targetRecord = db.prepare("SELECT target FROM monitored_targets WHERE id = ?").get(targetId) as { target: string };
        if (!targetRecord) {
            return NextResponse.json({ error: "Target not found in inventory" }, { status: 404 });
        }
        const domain = targetRecord.target;

        // 2. Safely get the Shodan API key from the DB
        const shodanKeyRecord = db.prepare("SELECT value FROM settings WHERE key = 'shodan_api_key'").get() as { value: string } | undefined;
        // Fallback to Env variable for safety
        const shodanKey = shodanKeyRecord?.value || process.env.SHODAN_API_KEY;

        if (!shodanKey) {
            return NextResponse.json({ error: "Shodan API key is not configured. Please add it in settings or .env file." }, { status: 401 });
        }

        // 3. Hit the Official Shodan API
        const shodanRes = await fetch(`https://api.shodan.io/dns/domain/${domain}?key=${shodanKey}`);

        if (!shodanRes.ok) {
            const errorMsg = await shodanRes.text();
            throw new Error(`Shodan API Error: ${shodanRes.status} ${errorMsg}`);
        }

        const data = await shodanRes.json();

        // 4. Extract subdomains from the Shodan Response
        // The DNS domain endpoint returns { data: [ { subdomain: "api", type: "A", value: "1.1.1.1" } ] }
        const shodanSubdomains: string[] = [];
        if (data && data.subdomains) {
            // Wait, the API documentation for /dns/domain/{domain} says it returns {"domain": "example.com", "subdomains": ["api", "www", ...]}
            // Let's support both common Shodan formats just in case
            if (Array.isArray(data.subdomains)) {
                for (const sub of data.subdomains) {
                    shodanSubdomains.push(sub === "" ? domain : `${sub}.${domain}`);
                }
            }
        } else if (data && Array.isArray(data.data)) {
            for (const rec of data.data) {
                if (rec.subdomain) {
                    shodanSubdomains.push(rec.subdomain === "" ? domain : `${rec.subdomain}.${domain}`);
                }
            }
        }

        if (shodanSubdomains.length === 0) {
            // Even if 0, we should run the bulk update so all rows become -1 (verified, but missed)
            bulkUpdateShodanStatus(targetId, []);
            return NextResponse.json({ success: true, count: 0, message: "Shodan found no subdomains" });
        }

        // 5. Bulk verify via SQL AND inject any newly discovered ones
        const newlyAdded = bulkUpdateShodanStatus(targetId, shodanSubdomains);

        let msg = `Verified ${shodanSubdomains.length} Shodan records.`;
        if (newlyAdded > 0) {
            msg += ` Discovered ${newlyAdded} NEW subdomains!`;
        }

        return NextResponse.json({
            success: true,
            count: shodanSubdomains.length,
            message: msg
        });

    } catch (error: any) {
        console.error("Shodan Verification Error:", error);
        return NextResponse.json({ error: error.message || "Failed to verify with Shodan" }, { status: 500 });
    }
}
