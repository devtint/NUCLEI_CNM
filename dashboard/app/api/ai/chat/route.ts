/**
 * AI Chat API Route
 * 
 * POST /api/ai/chat
 * Body: { messages: [{ role: "user" | "assistant", content: string }] }
 * 
 * Uses Groq (OpenAI-compatible API) with function calling
 * to answer questions about the dashboard data.
 */

import { NextRequest } from 'next/server';
import OpenAI from 'openai';
import { auth } from '@/auth';
import { SYSTEM_PROMPT } from '@/lib/ai/system-prompt';
import { TOOL_DEFINITIONS, executeToolCall } from '@/lib/ai/tools';
import { getSetting } from '@/lib/db';

const AI_MODEL = process.env.AI_MODEL || 'llama-3.1-8b-instant';
const MAX_TOOL_ITERATIONS = 5;

/**
 * Some models (especially smaller ones on Groq) emit tool calls as plain text
 * like: <function=get_findings_by_host>{"host":"truemoney"}</function>
 * instead of using the structured tool_calls API.
 * This function detects and extracts them.
 */
function parseInlineToolCalls(content: string): { name: string; args: Record<string, unknown> }[] | null {
    const pattern = /<function=(\w+)>([\s\S]*?)<\/function>/g;
    const matches: { name: string; args: Record<string, unknown> }[] = [];

    let match;
    while ((match = pattern.exec(content)) !== null) {
        const name = match[1];
        let args: Record<string, unknown> = {};
        try {
            args = JSON.parse(match[2]);
        } catch {
            args = {};
        }
        matches.push({ name, args });
    }

    return matches.length > 0 ? matches : null;
}

export async function POST(req: NextRequest) {
    // Auth check
    const session = await auth();
    if (!session) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
            status: 401,
            headers: { 'Content-Type': 'application/json' },
        });
    }

    // Get API key from DB or Env
    const groqKey = getSetting('groq_api_key') || process.env.GROQ_API_KEY;

    // Check if API key is configured
    if (!groqKey) {
        return new Response(JSON.stringify({
            error: 'AI not configured. Add your Groq API Key in the Settings panel.'
        }), {
            status: 503,
            headers: { 'Content-Type': 'application/json' },
        });
    }

    const client = new OpenAI({
        apiKey: groqKey,
        baseURL: 'https://api.groq.com/openai/v1',
    });

    try {
        const { messages } = await req.json();

        if (!messages || !Array.isArray(messages) || messages.length === 0) {
            return new Response(JSON.stringify({ error: 'Messages array is required' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        // 🛡️ SECURITY: Server-side input filtering (Heuristics for Prompt Injection)
        const lastUserMessage = messages.slice(-1)[0]?.content?.toLowerCase() || "";
        const injectionKeywords = [
            "ignore all previous",
            "forget your",
            "system prompt",
            "tell me a joke",
            "say something funny",
            "developer mode",
            "you are now a",
            "new role",
            "bypass",
            "jailbreak"
        ];
        
        if (injectionKeywords.some(keyword => lastUserMessage.includes(keyword))) {
            return new Response(JSON.stringify({
                response: "I'm Nuclei CC AI — I can only help with your security scan data. Please ask me about findings, subdomains, scans, or live assets.",
                model: AI_MODEL,
                tool_calls_made: 0,
            }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        // Build conversation with system prompt
        const conversationMessages: OpenAI.ChatCompletionMessageParam[] = [
            { role: 'system', content: SYSTEM_PROMPT },
            ...messages.map((m: { role: string; content: string }) => ({
                role: m.role as 'user' | 'assistant',
                content: m.content,
            })),
        ];

        // Agent loop: call LLM → execute tools → feed results back → repeat
        let iterations = 0;
        let totalToolCalls = 0;

        while (iterations < MAX_TOOL_ITERATIONS) {
            iterations++;

            // Call LLM with retry for transient network errors
            let response;
            for (let attempt = 0; attempt < 3; attempt++) {
                try {
                    response = await client.chat.completions.create({
                        model: AI_MODEL,
                        messages: conversationMessages,
                        tools: TOOL_DEFINITIONS,
                        tool_choice: 'auto',
                        temperature: 0.3,
                        max_tokens: 2048,
                    });
                    break; // Success
                } catch (retryError: unknown) {
                    const msg = retryError instanceof Error ? retryError.message : '';
                    const isTransient = msg.includes('ECONNRESET') || msg.includes('Connection error') || msg.includes('fetch failed');
                    if (isTransient && attempt < 2) {
                        console.log(`🔄 AI retry attempt ${attempt + 2}/3 after connection error`);
                        await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
                        continue;
                    }
                    throw retryError;
                }
            }

            if (!response) {
                throw new Error('Failed to get response after retries');
            }

            const choice = response.choices[0];

            if (!choice || !choice.message) {
                return new Response(JSON.stringify({ error: 'No response from AI model' }), {
                    status: 502,
                    headers: { 'Content-Type': 'application/json' },
                });
            }

            // ── Path A: Model used structured tool_calls (correct behavior) ──
            if (choice.message.tool_calls && choice.message.tool_calls.length > 0) {
                conversationMessages.push(choice.message);

                for (const toolCall of choice.message.tool_calls) {
                    const tc = toolCall as { id: string; function: { name: string; arguments: string } };
                    const functionName = tc.function.name;
                    let functionArgs: Record<string, unknown> = {};

                    try {
                        functionArgs = JSON.parse(tc.function.arguments);
                    } catch {
                        functionArgs = {};
                    }

                    console.log(`🤖 AI Tool Call: ${functionName}(${JSON.stringify(functionArgs)})`);
                    const result = await executeToolCall(functionName, functionArgs);
                    totalToolCalls++;

                    conversationMessages.push({
                        role: 'tool',
                        tool_call_id: toolCall.id,
                        content: result,
                    });
                }

                continue;
            }

            // ── Path B: Model emitted tool calls as plain text (fallback) ──
            const content = choice.message.content || '';
            const inlineToolCalls = parseInlineToolCalls(content);

            if (inlineToolCalls && inlineToolCalls.length > 0) {
                console.log(`🔧 Detected ${inlineToolCalls.length} inline tool call(s) in text — executing manually`);

                // Execute all detected inline tool calls
                const toolResults: string[] = [];
                for (const tc of inlineToolCalls) {
                    console.log(`🤖 AI Inline Tool: ${tc.name}(${JSON.stringify(tc.args)})`);
                    const result = await executeToolCall(tc.name, tc.args);
                    toolResults.push(`Tool ${tc.name} returned: ${result}`);
                    totalToolCalls++;
                }

                // Feed results back as a user message so the LLM can summarize
                conversationMessages.push({
                    role: 'assistant',
                    content: 'I need to query the database for this information.',
                });
                conversationMessages.push({
                    role: 'user',
                    content: `Here are the tool results. Please summarize them for the user in a clear, readable format:\n\n${toolResults.join('\n\n')}`,
                });

                continue;
            }

            // ── Path C: No tool calls — final text response ──
            
            // 🛡️ SECURITY: Server-side output filtering (Data Exfiltration Prevention)
            let finalContent = content || "I couldn't generate a response. Please try rephrasing your question.";
            if (finalContent.includes('gsk_') || finalContent.includes('GROQ_API_KEY')) {
                finalContent = "I cannot fulfill this request as it violates my security constraints. I do not share internal configuration or keys.";
            }

            return new Response(JSON.stringify({
                response: finalContent,
                model: AI_MODEL,
                tool_calls_made: totalToolCalls,
            }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        // Max iterations reached
        return new Response(JSON.stringify({
            response: "I've made several tool calls but couldn't complete the analysis. Please try a more specific question.",
            model: AI_MODEL,
            tool_calls_made: totalToolCalls,
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        });

    } catch (error) {
        console.error('AI Chat Error:', error);

        const errorMessage = error instanceof Error ? error.message : 'Unknown error';

        // Handle rate limiting
        if (errorMessage.includes('429') || errorMessage.includes('rate_limit')) {
            return new Response(JSON.stringify({
                error: 'AI rate limit reached. Please wait a moment and try again.',
            }), {
                status: 429,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        return new Response(JSON.stringify({
            error: `AI service error: ${errorMessage}`,
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
}
