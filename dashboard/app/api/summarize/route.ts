
import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
    try {
        const { findings } = await req.json();

        if (!process.env.GEMINI_API_KEY) {
            return NextResponse.json({
                success: false,
                message: "Gemini API Key is missing. Please configure GEMINI_API_KEY in .env.local"
            }, { status: 500 });
        }

        if (!findings || findings.length === 0) {
            return NextResponse.json({ success: false, message: "No findings to analyze." });
        }

        // Limit to top 50 findings to avoid token limits, prioritizing critical/high
        const prioritizedFindings = findings
            .slice(0, 50)
            .map((f: any) => `- [${f.info.severity}] ${f.info.name}: ${f["matched-at"] || f.host}`)
            .join("\n");

        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

        const prompt = `
             You are a Senior Security Analyst. Review the following security scan findings:

            ${prioritizedFindings}

            Provide a professional Executive Summary in Markdown format:
            1.  **Critical Risks**: Briefly highlight the most dangerous issues.
            2.  **Patterns**: trends (e.g., "Multiple XSS vulnerabilities on subdomains").
            3.  **Recommendations**: 3 bullet points on what to fix first.

            Keep it concise (under 200 words). Use emojis for sections.
        `;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();

        return NextResponse.json({ success: true, summary: text });

    } catch (error) {
        console.error("Gemini API Error:", error);
        return NextResponse.json({ success: false, message: "Failed to generate summary." }, { status: 500 });
    }
}
