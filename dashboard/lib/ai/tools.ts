/**
 * AI Agent Tool Definitions
 * 
 * Tools are organized into two categories:
 * 1. READ-ONLY: Safe database query functions for analyzing scan data.
 * 2. ACTION: Scoped mutation tools for triggering scans and updating findings.
 * 
 * SECURITY: Action tools enforce concurrency guards, private IP blocking,
 * and strict allowlists for mutation operations.
 */

import { getDatabase, getSetting, updateFinding, insertScan, updateScan } from '@/lib/db';
import OpenAI from 'openai';
import { tool, jsonSchema } from 'ai';
import fs from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';
import { triggerSubfinderScan, triggerHttpxScan, triggerNucleiScan, getNucleiSettings, getSchedulerStatus, type NucleiScanSettings } from '@/lib/scheduler';
import { cache } from '@/lib/cache';

// ─── Tool Definitions (OpenAI Function Calling Schema) ───────────────────────

export const TOOL_DEFINITIONS = [
    {
        type: "function" as const,
        function: {
            name: "get_findings_summary",
            description: "Get a summary of all vulnerability findings, optionally filtered by severity. Returns counts grouped by severity and status. Use this when the user asks about findings, vulnerabilities, or security issues.",
            parameters: {
                type: "object",
                properties: {
                    severity: {
                        type: "string",
                        enum: ["critical", "high", "medium", "low", "info"],
                        description: "Optional severity filter. If omitted, returns all severities."
                    },
                    host: {
                        type: "string",
                        description: "Optional host/domain filter. Partial match supported."
                    }
                },
                required: []
            }
        }
    },
    {
        type: "function" as const,
        function: {
            name: "get_recent_scans",
            description: "Get recent Nuclei scan history with their status and target. Use when the user asks about scan history, last scans, or scan status.",
            parameters: {
                type: "object",
                properties: {
                    limit: {
                        type: "number",
                        description: "Number of recent scans to return. Default 10."
                    },
                    status: {
                        type: "string",
                        enum: ["running", "completed", "failed", "stopped", "interrupted"],
                        description: "Optional status filter."
                    }
                },
                required: []
            }
        }
    },
    {
        type: "function" as const,
        function: {
            name: "get_subdomains",
            description: "Get subdomains for a specific domain from the monitored inventory. Use when the user asks about subdomains, subdomain enumeration results, or domain reconnaissance.",
            parameters: {
                type: "object",
                properties: {
                    domain: {
                        type: "string",
                        description: "The parent domain to look up subdomains for (e.g., 'example.com')."
                    },
                    limit: {
                        type: "number",
                        description: "Max subdomains to return. Default 50."
                    }
                },
                required: ["domain"]
            }
        }
    },
    {
        type: "function" as const,
        function: {
            name: "get_monitored_targets",
            description: "Get all monitored domains/targets in the inventory with their subdomain counts and last scan dates. Use when the user asks about monitored domains, targets, or the asset inventory.",
            parameters: {
                type: "object",
                properties: {},
                required: []
            }
        }
    },
    {
        type: "function" as const,
        function: {
            name: "get_live_assets",
            description: "Get live web assets discovered by HTTPX, optionally filtered by domain. Returns URLs, status codes, technologies, web servers. Use when the user asks about live hosts, web technologies, tech stacks, or HTTP probing results.",
            parameters: {
                type: "object",
                properties: {
                    domain: {
                        type: "string",
                        description: "Optional domain filter (partial match)."
                    },
                    limit: {
                        type: "number",
                        description: "Max results to return. Default 30."
                    }
                },
                required: []
            }
        }
    },
    {
        type: "function" as const,
        function: {
            name: "get_findings_by_host",
            description: "Get all vulnerability findings for a specific host or domain. Use when the user asks about vulnerabilities on a specific target.",
            parameters: {
                type: "object",
                properties: {
                    host: {
                        type: "string",
                        description: "The host or domain to search for (partial match supported)."
                    }
                },
                required: ["host"]
            }
        }
    },
    {
        type: "function" as const,
        function: {
            name: "get_findings_by_scan",
            description: "Get all vulnerabilities found during a specific scan ID, including the target, scan status, duration, and findings grouped by template.",
            parameters: {
                type: "object",
                properties: {
                    scan_id: {
                        type: "string",
                        description: "The exact UUID of the scan."
                    }
                },
                required: ["scan_id"]
            }
        }
    },
    {
        type: "function" as const,
        function: {
            name: "get_findings_trend",
            description: "Get vulnerability counts grouped by severity over time (daily). Use when the user asks about trends, if vulnerabilities are increasing/decreasing, or historical progression.",
            parameters: {
                type: "object",
                properties: {},
                required: []
            }
        }
    },
    {
        type: "function" as const,
        function: {
            name: "get_scheduler_history",
            description: "Get automation/scheduler run history showing automated scan pipeline results. Use when the user asks about automated scans, scheduler status, or automation history.",
            parameters: {
                type: "object",
                properties: {
                    limit: {
                        type: "number",
                        description: "Max results. Default 20."
                    }
                },
                required: []
            }
        }
    },
    {
        type: "function" as const,
        function: {
            name: "get_dashboard_stats",
            description: "Get overall dashboard statistics: total scans, total findings by severity, total monitored domains, total subdomains, total live assets. Use when the user asks for a general overview or summary of the dashboard.",
            parameters: {
                type: "object",
                properties: {},
                required: []
            }
        }
    },
    {
        type: "function" as const,
        function: {
            name: "query_shodan_ip",
            description: "Query the Shodan OSINT API for information about a specific IP address. Returns open ports, vulnerabilities (CVEs), organization, OS, and location. Use this when the user asks about an IP address, OSINT, or Shodan data for an IP.",
            parameters: {
                type: "object",
                properties: {
                    ip: {
                        type: "string",
                        description: "The IPv4 address to lookup (e.g., '1.1.1.1')."
                    }
                },
                required: ["ip"]
            }
        }
    },
    {
        type: "function" as const,
        function: {
            name: "generate_nuclei_template",
            description: "Automatically generate and save a custom Nuclei YAML template based on a CVE ID or a vulnerability description. Use this when the user asks to create, write, or generate a Nuclei template for a specific CVE or vulnerability.",
            parameters: {
                type: "object",
                properties: {
                    cveOrDescription: {
                        type: "string",
                        description: "The CVE ID (e.g., 'CVE-2024-1234') or a description of the vulnerability."
                    }
                },
                required: ["cveOrDescription"]
            }
        }
    },
    {
        type: "function" as const,
        function: {
            name: "list_custom_templates",
            description: "List all custom Nuclei templates saved in the user's ~/nuclei-custom-templates/ directory. Use when the user asks about their custom templates, what templates they have, or wants to see generated templates.",
            parameters: {
                type: "object",
                properties: {},
                required: []
            }
        }
    },
    {
        type: "function" as const,
        function: {
            name: "delete_custom_template",
            description: "Delete a custom Nuclei template by its ID (filename without .yaml). Use when the user asks to remove or delete a specific custom template.",
            parameters: {
                type: "object",
                properties: {
                    template_id: {
                        type: "string",
                        description: "The template ID to delete (e.g., 'cve-2024-38812')."
                    }
                },
                required: ["template_id"]
            }
        }
    },
    {
        type: "function" as const,
        function: {
            name: "compare_scans",
            description: "Compare findings between two scans to see what's new, resolved, or persistent. Use when the user asks to compare two scans or see what changed between scans.",
            parameters: {
                type: "object",
                properties: {
                    scan_id_a: {
                        type: "string",
                        description: "The UUID of the first (older) scan."
                    },
                    scan_id_b: {
                        type: "string",
                        description: "The UUID of the second (newer) scan."
                    }
                },
                required: ["scan_id_a", "scan_id_b"]
            }
        }
    },
    {
        type: "function" as const,
        function: {
            name: "advanced_asset_search",
            description: "Advanced dynamic search for inventory, domains, subdomains, and live assets. Use this when the user asks for complex combinations, 'except' filters, or specific technologies.",
            parameters: {
                type: "object",
                properties: {
                    query_type: {
                        type: "string",
                        enum: ["subdomains", "live_assets", "monitored_targets"],
                        description: "The type of asset to query."
                    },
                    includes: {
                        type: "array",
                        items: { type: "string" },
                        description: "Keywords that MUST be present in the record (e.g. ['php', 'example.com'])."
                    },
                    excludes: {
                        type: "array",
                        items: { type: "string" },
                        description: "Keywords that MUST NOT be present in the record (e.g. ['cloudflare'])."
                    },
                    limit: { type: "number", description: "Max results to return. Default 50." }
                },
                required: ["query_type"]
            }
        }
    },
    {
        type: "function" as const,
        function: {
            name: "advanced_vuln_search",
            description: "Advanced dynamic search for vulnerabilities/findings. Use this when the user asks for complex combinations like 'vulns with XSS except on staging' or multiple severities.",
            parameters: {
                type: "object",
                properties: {
                    includes: {
                        type: "array",
                        items: { type: "string" },
                        description: "Keywords that MUST be present (matches name, template_id, host)."
                    },
                    excludes: {
                        type: "array",
                        items: { type: "string" },
                        description: "Keywords that MUST NOT be present."
                    },
                    severities: {
                        type: "array",
                        items: { type: "string" },
                        description: "List of severities to include (e.g., ['high', 'critical'])."
                    },
                    limit: { type: "number", description: "Max results to return. Default 50." }
                },
                required: []
            }
        }
    },
    {
        type: "function" as const,
        function: {
            name: "execute_readonly_sql",
            description: "Execute raw read-only SQL queries directly against the SQLite database. Use this ONLY as a fallback for complex analytical questions that standard tools cannot answer. The query MUST start with SELECT and must not perform mutations.",
            parameters: {
                type: "object",
                properties: {
                    query: {
                        type: "string",
                        description: "The SQLite SELECT query to execute."
                    }
                },
                required: ["query"]
            }
        }
    },
    // ─── ACTION TOOLS (Scan Triggering & Mutations) ────────────────────────────
    {
        type: "function" as const,
        function: {
            name: "trigger_nuclei_scan",
            description: "Start a Nuclei vulnerability scan on a specific target URL or domain. Use when the user explicitly asks to scan a target for vulnerabilities. ALWAYS confirm the target with the user in the conversation before calling this tool. NEVER call this without explicit user approval of the target.",
            parameters: {
                type: "object",
                properties: {
                    target: {
                        type: "string",
                        description: "The URL or domain to scan (e.g. 'https://example.com' or 'example.com')."
                    },
                    severity: {
                        type: "array",
                        items: { type: "string" },
                        description: "Optional severity filters e.g. ['critical','high']. If omitted, uses dashboard default settings."
                    },
                    tags: {
                        type: "array",
                        items: { type: "string" },
                        description: "Optional template tags e.g. ['cve','wordpress','jira']. Narrows scan to specific technology."
                    },
                    template_id: {
                        type: "string",
                        description: "Optional: specific template path to run (e.g. '~/nuclei-custom-templates/cve-2024-1234.yaml')."
                    }
                },
                required: ["target"]
            }
        }
    },
    {
        type: "function" as const,
        function: {
            name: "trigger_subfinder_scan",
            description: "Run Subfinder to enumerate subdomains for a root domain. Use when the user asks to discover, find, or enumerate subdomains for a domain.",
            parameters: {
                type: "object",
                properties: {
                    domain: {
                        type: "string",
                        description: "The root domain to enumerate subdomains for (e.g. 'example.com')."
                    }
                },
                required: ["domain"]
            }
        }
    },
    {
        type: "function" as const,
        function: {
            name: "trigger_full_recon",
            description: "Run a FULL reconnaissance chain on a domain: Subfinder (subdomains) → HTTPX (live host probing) → Nuclei (vulnerability scan). This is a long-running operation. Use when the user asks for a 'complete scan', 'full recon', or 'map out' a domain.",
            parameters: {
                type: "object",
                properties: {
                    domain: {
                        type: "string",
                        description: "The root domain to fully recon (e.g. 'example.com')."
                    }
                },
                required: ["domain"]
            }
        }
    },
    {
        type: "function" as const,
        function: {
            name: "mark_finding_status",
            description: "Update the status of a specific vulnerability finding by its ID. Use when the user says a finding is a false positive, has been fixed, or wants to change its status.",
            parameters: {
                type: "object",
                properties: {
                    finding_id: {
                        type: "number",
                        description: "The integer ID of the finding from the findings table."
                    },
                    status: {
                        type: "string",
                        enum: ["False Positive", "Fixed", "Accepted Risk", "New"],
                        description: "The new status to apply to the finding."
                    }
                },
                required: ["finding_id", "status"]
            }
        }
    },
    {
        type: "function" as const,
        function: {
            name: "get_scan_status",
            description: "Check if there are any scans currently running, including AI-triggered, manual, and scheduler-triggered scans. Use when the user asks if a scan is running or wants to check scan progress.",
            parameters: {
                type: "object",
                properties: {},
                required: []
            }
        }
    }
];


// ─── Tool Execution Functions ────────────────────────────────────────────────

export async function executeToolCall(toolName: string, args: Record<string, unknown>): Promise<string> {
    try {
        switch (toolName) {
            case 'get_findings_summary':
                return JSON.stringify(getFindingsSummary(args.severity as string, args.host as string));
            case 'get_recent_scans':
                return JSON.stringify(getRecentScans(args.limit as number, args.status as string));
            case 'get_subdomains':
                return JSON.stringify(getSubdomains(args.domain as string, args.limit as number));
            case 'get_monitored_targets':
                return JSON.stringify(getMonitoredTargets());
            case 'get_live_assets':
                return JSON.stringify(getLiveAssets(args.domain as string, args.limit as number));
            case 'get_findings_by_host':
                return JSON.stringify(getFindingsByHost(args.host as string));
            case 'get_findings_by_scan':
                return JSON.stringify(getFindingsByScan(args.scan_id as string));
            case 'get_findings_trend':
                return JSON.stringify(getFindingsTrend());
            case 'get_scheduler_history':
                return JSON.stringify(getSchedulerHistory(args.limit as number));
            case 'get_dashboard_stats':
                return JSON.stringify(getDashboardStats());
            case 'query_shodan_ip':
                return JSON.stringify(await queryShodanIP(args.ip as string));
            case 'generate_nuclei_template':
                return JSON.stringify(await generateNucleiTemplate(args.cveOrDescription as string));
            case 'list_custom_templates':
                return JSON.stringify(listCustomTemplates());
            case 'delete_custom_template':
                return JSON.stringify(deleteCustomTemplate(args.template_id as string));
            case 'compare_scans':
                return JSON.stringify(compareScans(args.scan_id_a as string, args.scan_id_b as string));
            case 'advanced_asset_search':
                return JSON.stringify(advancedAssetSearch(args.query_type as string, args.includes as string[], args.excludes as string[], args.limit as number));
            case 'advanced_vuln_search':
                return JSON.stringify(advancedVulnSearch(args.includes as string[], args.excludes as string[], args.severities as string[], args.limit as number));
            case 'execute_readonly_sql':
                return JSON.stringify(executeReadonlySql(args.query as string));
            // ─── ACTION TOOLS ─────────────────────────────────────────────
            case 'trigger_nuclei_scan':
                return JSON.stringify(await aiTriggerNucleiScan(args.target as string, args.severity as string[], args.tags as string[], args.template_id as string));
            case 'trigger_subfinder_scan':
                return JSON.stringify(await aiTriggerSubfinderScan(args.domain as string));
            case 'trigger_full_recon':
                return JSON.stringify(await aiTriggerFullRecon(args.domain as string));
            case 'mark_finding_status':
                return JSON.stringify(aiMarkFindingStatus(args.finding_id as number, args.status as string));
            case 'get_scan_status':
                return JSON.stringify(aiGetScanStatus());
            default:
                return JSON.stringify({ error: `Unknown tool: ${toolName}` });
        }
    } catch (error) {
        console.error(`AI Tool Error [${toolName}]:`, error);
        return JSON.stringify({ error: `Tool execution failed: ${error instanceof Error ? error.message : 'Unknown error'}` });
    }
}


// ─── Individual Tool Implementations ─────────────────────────────

async function generateNucleiTemplate(cveOrDescription: string) {
    if (!cveOrDescription) return { error: "CVE or description is required" };

    const API_KEY = getSetting("groq_api_key") || process.env.GROQ_API_KEY;
    if (!API_KEY) {
        return { error: "Groq API key is not configured. Tell the user to add it in the Settings." };
    }

    const client = new OpenAI({
        apiKey: API_KEY,
        baseURL: 'https://api.groq.com/openai/v1',
    });

    const systemPrompt = `
You are an expert security researcher and open-source contributor to ProjectDiscovery Nuclei.
Your task is to write a highly accurate Nuclei v3 YAML template based on the user's provided CVE ID or vulnerability description.

CRITICAL RULES:
1. ONLY output raw YAML. No backticks, no markdown wrapping, no explanation. Just the raw valid YAML content.
2. Follow rigid Nuclei v3 syntax exactly. The 'info' block must strictly contain name, author, severity, description, reference, and tags. Do not put 'description' or 'severity' outside of the info block.
3. Use 'http:' instead of 'requests:' for v3 templates.
4. Ensure the 'path' starts with '{{BaseURL}}' (e.g., path: [ "{{BaseURL}}/" ]).
5. NEVER invent hallucinated keywords in matchers (e.g. 'not:', 'name:', 'value:', 'condition:'). 
6. ONLY use standard matcher properties: type (word, regex, status, dsl), part (body, header), words, regex, and negative (true/false).
7. If matching a header, you MUST use 'part: header' and 'words' or 'regex'. Do not invent custom properties.

EXAMPLE STRUCTURE:
id: cve-1234
info:
  name: Example Vulnerability
  author: AI-Assistant
  severity: high
  description: A detailed description here.
  tags: cve,cve1234
http:
  - method: GET
    path:
      - "{{BaseURL}}/vulnerable/endpoint"
    matchers:
      - type: word
        negative: true
        words:
          - "safe indicator"
`;

    try {
        // Use 70b model specifically for template generation (better instruction following)
        const response = await client.chat.completions.create({
            model: 'llama-3.3-70b-versatile',
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: `Write a nuclei template for: ${cveOrDescription}` }
            ],
            temperature: 0.1,
        });

        let yamlOutput = response.choices[0]?.message?.content || "";
        yamlOutput = yamlOutput.replace(/^```(yaml|yml)?\n/im, '').replace(/\n```$/im, '').trim();

        if (!yamlOutput) {
             return { error: "AI failed to generate template content." };
        }

        // ── YAML Validation ──
        // Check required top-level keys
        if (!yamlOutput.match(/^id:/m)) {
            return { error: "Generated template is missing 'id:' field. Please try again." };
        }
        if (!yamlOutput.match(/^info:/m)) {
            return { error: "Generated template is missing 'info:' block. Please try again." };
        }
        if (!yamlOutput.match(/^http:/m) && !yamlOutput.match(/^tcp:/m) && !yamlOutput.match(/^dns:/m)) {
            return { error: "Generated template has no protocol block (http/tcp/dns). Please try again." };
        }
        // Fix common hallucination: 'requests:' → 'http:'
        yamlOutput = yamlOutput.replace(/^requests:/m, 'http:');
        // Strip invalid matcher properties the model might hallucinate
        yamlOutput = yamlOutput.replace(/^\s+(condition|value|selector):\s+.+$/gm, '');

        // Extract ID from YAML to use as filename
        const idMatch = yamlOutput.match(/^id:\s*([^\s]+)$/m);
        const templateId = idMatch ? idMatch[1] : `custom-template-${Date.now()}`;
        
        const customDir = path.join(os.homedir(), 'nuclei-custom-templates');
        if (!fs.existsSync(customDir)) {
            fs.mkdirSync(customDir, { recursive: true });
        }

        const filePath = path.join(customDir, `${templateId}.yaml`);
        fs.writeFileSync(filePath, yamlOutput, 'utf8');

        return { 
            success: true, 
            message: `Successfully generated Nuclei template for ${cveOrDescription}`,
            template_id: templateId,
            saved_path: filePath,
            preview: yamlOutput.substring(0, 300) + "...\n(truncated)"
        };

    } catch (e: any) {
        console.error("Template generation error:", e);
        return { error: `Failed to generate template: ${e.message}` };
    }
}

// ─── Individual Tool Implementations (Read-Only) ─────────────────────────────

async function queryShodanIP(ip: string) {
    if (!ip) return { error: "IP address is required" };
    
    const API_KEY = getSetting("shodan_api_key") || process.env.SHODAN_API_KEY;
    if (!API_KEY) {
        return { error: "Shodan API key is not configured in settings. Tell the user to add it in the Settings panel." };
    }

    const res = await fetch(`https://api.shodan.io/shodan/host/${ip}?key=${API_KEY}`);
    
    if (!res.ok) {
        if (res.status === 404) return { message: `No Shodan data available for IP: ${ip}` };
        return { error: `Shodan API error: ${res.statusText}` };
    }

    const data = await res.json();
    return {
        ip: data.ip_str,
        organization: data.org || data.isp,
        os: data.os || "Unknown",
        location: `${data.city || 'Unknown City'}, ${data.country_name || 'Unknown Country'}`,
        open_ports: data.ports || [],
        vulns: Object.keys(data.vulns || {}),
        hostnames: data.hostnames || [],
        domains: data.domains || []
    };
}

function getFindingsSummary(severity?: string, host?: string) {
    const db = getDatabase();

    // Get counts by severity
    let countQuery = 'SELECT severity, COUNT(*) as count FROM findings';
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (severity) {
        conditions.push('LOWER(severity) = LOWER(?)');
        params.push(severity);
    }
    if (host) {
        conditions.push('(host LIKE ? OR matched_at LIKE ?)');
        params.push(`%${host}%`, `%${host}%`);
    }

    if (conditions.length > 0) {
        countQuery += ' WHERE ' + conditions.join(' AND ');
    }
    countQuery += ` GROUP BY severity ORDER BY CASE severity WHEN 'critical' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 WHEN 'low' THEN 4 WHEN 'info' THEN 5 ELSE 6 END`;

    const severityCounts = db.prepare(countQuery).all(...params);

    // Get counts by status
    let statusQuery = 'SELECT status, COUNT(*) as count FROM findings';
    if (conditions.length > 0) {
        statusQuery += ' WHERE ' + conditions.join(' AND ');
    }
    statusQuery += ' GROUP BY status';

    const statusCounts = db.prepare(statusQuery).all(...params);

    // Get total
    let totalQuery = 'SELECT COUNT(*) as total FROM findings';
    if (conditions.length > 0) {
        totalQuery += ' WHERE ' + conditions.join(' AND ');
    }
    const total = (db.prepare(totalQuery).get(...params) as { total: number }).total;

    // Get recent findings (top 10)
    let recentQuery = 'SELECT name, severity, host, matched_at, status, template_id FROM findings';
    if (conditions.length > 0) {
        recentQuery += ' WHERE ' + conditions.join(' AND ');
    }
    recentQuery += ' ORDER BY created_at DESC LIMIT 10';

    const recent = db.prepare(recentQuery).all(...params);

    return { total, by_severity: severityCounts, by_status: statusCounts, recent_findings: recent };
}

function getRecentScans(limit?: number, status?: string) {
    const db = getDatabase();
    const max = Math.min(limit || 10, 50);

    let query = 'SELECT id, target, status, start_time, end_time, exit_code FROM scans';
    const params: unknown[] = [];

    if (status) {
        query += ' WHERE status = ?';
        params.push(status);
    }

    query += ' ORDER BY start_time DESC LIMIT ?';
    params.push(max);

    const scans = db.prepare(query).all(...params) as any[];

    return scans.map(s => ({
        ...s,
        start_time_human: new Date(s.start_time).toLocaleString(),
        end_time_human: s.end_time ? new Date(s.end_time).toLocaleString() : null,
        duration_seconds: s.end_time ? Math.round((s.end_time - s.start_time) / 1000) : null
    }));
}

function getSubdomains(domain: string, limit?: number) {
    const db = getDatabase();
    const max = Math.min(limit || 50, 200);

    // Find the target
    const target = db.prepare('SELECT * FROM monitored_targets WHERE target LIKE ?').get(`%${domain}%`) as any;

    if (!target) {
        return { error: `No monitored target found matching "${domain}"`, suggestion: 'Run a Subfinder scan first to discover subdomains.' };
    }

    const subdomains = db.prepare(
        'SELECT subdomain, first_seen, last_seen, shodan_status FROM monitored_subdomains WHERE target_id = ? ORDER BY subdomain LIMIT ?'
    ).all(target.id, max) as any[];

    return {
        domain: target.target,
        total_subdomains: target.total_count,
        last_scan: target.last_scan_date ? new Date(target.last_scan_date * 1000).toLocaleString() : 'Never',
        subdomains: subdomains.map(s => ({
            subdomain: s.subdomain,
            first_seen: s.first_seen ? new Date(s.first_seen * 1000).toLocaleString() : null,
            last_seen: s.last_seen ? new Date(s.last_seen * 1000).toLocaleString() : null,
            shodan_verified: s.shodan_status === 1
        }))
    };
}

function getMonitoredTargets() {
    const db = getDatabase();
    const targets = db.prepare('SELECT * FROM monitored_targets ORDER BY last_scan_date DESC').all() as any[];

    return targets.map(t => ({
        id: t.id,
        domain: t.target,
        total_subdomains: t.total_count,
        last_scan: t.last_scan_date ? new Date(t.last_scan_date * 1000).toLocaleString() : 'Never',
        scheduler_enabled: t.scheduler_enabled === 1,
        nuclei_enabled: t.nuclei_enabled === 1
    }));
}

function getLiveAssets(domain?: string, limit?: number) {
    const db = getDatabase();
    const max = Math.min(limit || 30, 100);

    let query = 'SELECT url, host, port, scheme, title, status_code, technologies, web_server, ip, cdn_name, change_status FROM httpx_results';
    const params: unknown[] = [];

    if (domain) {
        query += ' WHERE host LIKE ? OR url LIKE ?';
        params.push(`%${domain}%`, `%${domain}%`);
    }

    query += ' ORDER BY COALESCE(timestamp, 0) DESC LIMIT ?';
    params.push(max);

    const results = db.prepare(query).all(...params) as any[];

    return results.map(r => ({
        url: r.url,
        host: r.host,
        port: r.port,
        title: r.title || '(no title)',
        status_code: r.status_code,
        technologies: r.technologies ? JSON.parse(r.technologies) : [],
        web_server: r.web_server,
        ip: r.ip,
        cdn: r.cdn_name,
        change_status: r.change_status
    }));
}

function getFindingsByHost(host: string) {
    const db = getDatabase();

    const findings = db.prepare(
        `SELECT name, severity, type, host, matched_at, status, template_id, timestamp FROM findings WHERE host LIKE ? OR matched_at LIKE ? ORDER BY CASE severity WHEN 'critical' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 WHEN 'low' THEN 4 ELSE 5 END LIMIT 50`
    ).all(`%${host}%`, `%${host}%`) as any[];

    const severityCounts = db.prepare(
        'SELECT severity, COUNT(*) as count FROM findings WHERE host LIKE ? OR matched_at LIKE ? GROUP BY severity'
    ).all(`%${host}%`, `%${host}%`);

    return {
        host_filter: host,
        total: findings.length,
        by_severity: severityCounts,
        findings: findings.map(f => ({
            name: f.name,
            severity: f.severity,
            type: f.type,
            host: f.host,
            matched_at: f.matched_at,
            status: f.status,
            template_id: f.template_id
        }))
    };
}

function getSchedulerHistory(limit?: number) {
    const db = getDatabase();
    const max = Math.min(limit || 20, 100);

    const logs = db.prepare(
        'SELECT * FROM scheduler_logs ORDER BY started_at DESC LIMIT ?'
    ).all(max) as any[];

    return logs.map(l => ({
        domain: l.domain,
        status: l.status,
        started_at: new Date(l.started_at).toLocaleString(),
        completed_at: l.completed_at ? new Date(l.completed_at).toLocaleString() : null,
        subdomains_found: l.subdomains_total,
        new_subdomains: l.subdomains_new,
        live_hosts: l.live_hosts,
        findings: l.findings_count,
        error: l.error_message
    }));
}

function getDashboardStats() {
    const db = getDatabase();

    const totalScans = (db.prepare('SELECT COUNT(*) as count FROM scans').get() as any).count;
    const runningScans = (db.prepare("SELECT COUNT(*) as count FROM scans WHERE status = 'running'").get() as any).count;
    const totalFindings = (db.prepare('SELECT COUNT(*) as count FROM findings').get() as any).count;
    const criticalFindings = (db.prepare("SELECT COUNT(*) as count FROM findings WHERE severity = 'critical'").get() as any).count;
    const highFindings = (db.prepare("SELECT COUNT(*) as count FROM findings WHERE severity = 'high'").get() as any).count;
    const mediumFindings = (db.prepare("SELECT COUNT(*) as count FROM findings WHERE severity = 'medium'").get() as any).count;
    const lowFindings = (db.prepare("SELECT COUNT(*) as count FROM findings WHERE severity = 'low'").get() as any).count;
    const infoFindings = (db.prepare("SELECT COUNT(*) as count FROM findings WHERE severity = 'info'").get() as any).count;
    const totalTargets = (db.prepare('SELECT COUNT(*) as count FROM monitored_targets').get() as any).count;
    const totalSubdomains = (db.prepare('SELECT COUNT(*) as count FROM monitored_subdomains').get() as any).count;
    const totalLiveAssets = (db.prepare('SELECT COUNT(DISTINCT url) as count FROM httpx_results').get() as any).count;

    // Open findings (not closed/fixed)
    const openFindings = (db.prepare("SELECT COUNT(*) as count FROM findings WHERE status NOT IN ('Fixed', 'Closed', 'False Positive')").get() as any).count;

    return {
        scans: { total: totalScans, running: runningScans },
        findings: {
            total: totalFindings,
            open: openFindings,
            critical: criticalFindings,
            high: highFindings,
            medium: mediumFindings,
            low: lowFindings,
            info: infoFindings
        },
        assets: {
            monitored_domains: totalTargets,
            total_subdomains: totalSubdomains,
            live_assets: totalLiveAssets
        }
    };
}

function getFindingsByScan(scanId: string) {
    const db = getDatabase();

    // 1. Get Scan Metadata
    const scan = db.prepare(
        'SELECT target, status, start_time, end_time, config FROM scans WHERE id = ?'
    ).get(scanId) as any;

    let scanMeta = { id: scanId, target: 'Unknown', status: 'Unknown', duration_sec: 0, config: {} };
    
    if (scan) {
        let duration = 0;
        if (scan.start_time && scan.end_time) {
            duration = Math.round((new Date(scan.end_time).getTime() - new Date(scan.start_time).getTime()) / 1000);
        }
        let config = {};
        try { config = JSON.parse(scan.config); } catch {}
        
        scanMeta = {
            id: scanId,
            target: scan.target,
            status: scan.status,
            duration_sec: duration,
            config
        };
    }

    // 2. Get Findings
    const findings = db.prepare(
        `SELECT name, severity, type, host, matched_at, status, template_id, timestamp FROM findings WHERE scan_id = ? ORDER BY CASE severity WHEN 'critical' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 WHEN 'low' THEN 4 ELSE 5 END`
    ).all(scanId) as any[];

    // 3. Group by severity
    const countsBySeverity = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
    findings.forEach(f => {
        const sev = (f.severity || 'info').toLowerCase();
        if (sev in countsBySeverity) (countsBySeverity as any)[sev]++;
    });

    // 4. Group by template for concise summary
    const byTemplate: Record<string, { name: string, severity: string, count: number, hosts: string[] }> = {};
    findings.forEach(f => {
        if (!byTemplate[f.template_id]) {
            byTemplate[f.template_id] = { name: f.name, severity: f.severity, count: 0, hosts: [] };
        }
        byTemplate[f.template_id].count++;
        const target = f.host || f.matched_at;
        if (target && !byTemplate[f.template_id].hosts.includes(target) && byTemplate[f.template_id].hosts.length < 5) {
            byTemplate[f.template_id].hosts.push(target);
        }
    });

    return {
        scan: scanMeta,
        findings_summary: {
            total: findings.length,
            ...countsBySeverity,
        },
        grouped_by_template: Object.values(byTemplate)
    };
}

function getFindingsTrend() {
    const db = getDatabase();
    
    // Group findings by date (YYYY-MM-DD) and calculate running totals via JS
    const findings = db.prepare(
        'SELECT severity, timestamp FROM findings ORDER BY timestamp ASC'
    ).all() as any[];

    const trend: Record<string, any> = {};
    
    const currentCounts = { critical: 0, high: 0, medium: 0, low: 0 };

    findings.forEach(f => {
        if (!f.timestamp) return;
        const date = f.timestamp.split('T')[0];
        const sev = (f.severity || '').toLowerCase();
        
        if (!trend[date]) {
            trend[date] = { ...currentCounts, date };
        }
        
        if (sev in currentCounts) {
            currentCounts[sev as keyof typeof currentCounts]++;
            trend[date][sev]++;
        }
    });

    const timeline = Object.values(trend).sort((a: any, b: any) => a.date.localeCompare(b.date));
    
    // Output only last 14 days of activity to save tokens
    return timeline.slice(-14);
}

function listCustomTemplates() {
    const customDir = path.join(os.homedir(), 'nuclei-custom-templates');
    if (!fs.existsSync(customDir)) {
        return { templates: [], message: "No custom templates directory found. Generate a template first." };
    }

    const files = fs.readdirSync(customDir).filter(f => f.endsWith('.yaml') || f.endsWith('.yml'));
    
    const templates = files.map(f => {
        const filePath = path.join(customDir, f);
        const stats = fs.statSync(filePath);
        const content = fs.readFileSync(filePath, 'utf8');
        const idMatch = content.match(/^id:\s*(.+)$/m);
        const nameMatch = content.match(/^\s+name:\s*(.+)$/m);
        const severityMatch = content.match(/^\s+severity:\s*(.+)$/m);
        return {
            filename: f,
            template_id: idMatch ? idMatch[1].trim() : f.replace(/\.ya?ml$/, ''),
            name: nameMatch ? nameMatch[1].trim() : 'Unknown',
            severity: severityMatch ? severityMatch[1].trim() : 'unknown',
            size_bytes: stats.size,
            created: stats.birthtime.toLocaleString(),
            path: filePath
        };
    });

    return { total: templates.length, templates };
}

function deleteCustomTemplate(templateId: string) {
    if (!templateId) return { error: "Template ID is required" };
    
    const customDir = path.join(os.homedir(), 'nuclei-custom-templates');
    const filePath = path.join(customDir, `${templateId}.yaml`);
    
    if (!fs.existsSync(filePath)) {
        const ymlPath = path.join(customDir, `${templateId}.yml`);
        if (!fs.existsSync(ymlPath)) {
            return { error: `Template '${templateId}' not found in ${customDir}` };
        }
        fs.unlinkSync(ymlPath);
        return { success: true, message: `Deleted template: ${templateId}.yml` };
    }
    
    fs.unlinkSync(filePath);
    return { success: true, message: `Deleted template: ${templateId}.yaml` };
}

function compareScans(scanIdA: string, scanIdB: string) {
    const db = getDatabase();

    const findingsA = db.prepare(
        'SELECT template_id, host, name, severity FROM findings WHERE scan_id = ?'
    ).all(scanIdA) as any[];

    const findingsB = db.prepare(
        'SELECT template_id, host, name, severity FROM findings WHERE scan_id = ?'
    ).all(scanIdB) as any[];

    if (findingsA.length === 0 && findingsB.length === 0) {
        return { error: "Both scans have zero findings. Nothing to compare." };
    }

    const keyA = new Set(findingsA.map(f => `${f.template_id}||${f.host}`));
    const keyB = new Set(findingsB.map(f => `${f.template_id}||${f.host}`));

    const newFindings = findingsB.filter(f => !keyA.has(`${f.template_id}||${f.host}`));
    const resolvedFindings = findingsA.filter(f => !keyB.has(`${f.template_id}||${f.host}`));
    const persistentFindings = findingsB.filter(f => keyA.has(`${f.template_id}||${f.host}`));

    return {
        scan_a: { id: scanIdA, total_findings: findingsA.length },
        scan_b: { id: scanIdB, total_findings: findingsB.length },
        new_in_scan_b: { count: newFindings.length, findings: newFindings },
        resolved_from_scan_a: { count: resolvedFindings.length, findings: resolvedFindings },
        persistent: { count: persistentFindings.length, findings: persistentFindings.slice(0, 20) },
    };
}

// ─── Advanced Tools Implementations ─────────────────────────────

function formatLargeResult(results: any[]) {
    if (results.length > 20) {
        if (results.length === 0) return results;
        const headers = Object.keys(results[0]).join(',');
        const rows = results.map(row => Object.values(row).map(v => JSON.stringify(v ?? '')).join(',')).join('\n');
        const csv = `${headers}\n${rows}`;
        const base64Csv = Buffer.from(csv).toString('base64');
        const downloadLink = `<export_data href="data:text/csv;base64,${base64Csv}" count="${results.length}" />`;
        
        return {
            note: "Dataset was too large to fully display inline. A CSV file has been generated. You MUST display the first 5 sample rows for context, and explicitly output the raw <export_data> XML tag so the UI can render the download button.",
            total_records: results.length,
            sample: results.slice(0, 5),
            download_payload: downloadLink
        };
    }
    return results;
}

function advancedAssetSearch(queryType: string, includes?: string[], excludes?: string[], limit: number = 50) {
    const db = getDatabase();
    let tableName = "";
    let selectFields = "";
    
    if (queryType === "subdomains") {
        tableName = "subfinder_results";
        selectFields = "subdomain, first_seen, last_seen";
    } else if (queryType === "live_assets") {
        tableName = "httpx_results";
        selectFields = "url, status_code, title, webserver, tech, content_length";
    } else if (queryType === "monitored_targets") {
        tableName = "monitored_targets";
        selectFields = "target, last_scan_date, total_count";
    } else {
        return { error: "Invalid query_type" };
    }

    let query = `SELECT ${selectFields} FROM ${tableName} WHERE 1=1 `;
    const params: any[] = [];

    let searchConcat = "";
    if (queryType === "subdomains") searchConcat = "subdomain";
    else if (queryType === "live_assets") searchConcat = "url || ' ' || COALESCE(title,'') || ' ' || COALESCE(webserver,'') || ' ' || COALESCE(tech,'')";
    else searchConcat = "target";

    if (includes && includes.length > 0) {
        includes.forEach(inc => {
            query += ` AND LOWER(${searchConcat}) LIKE ? `;
            params.push(`%${inc.toLowerCase()}%`);
        });
    }

    if (excludes && excludes.length > 0) {
        excludes.forEach(exc => {
            query += ` AND LOWER(${searchConcat}) NOT LIKE ? `;
            params.push(`%${exc.toLowerCase()}%`);
        });
    }

    query += ` LIMIT ?`;
    params.push(limit);

    try {
        const stmt = db.prepare(query);
        const results = stmt.all(...params);
        return formatLargeResult(results);
    } catch (e: any) {
        return { error: e.message };
    }
}

function advancedVulnSearch(includes?: string[], excludes?: string[], severities?: string[], limit: number = 50) {
    const db = getDatabase();
    let query = `SELECT template_id, name, severity, host, type, matched_at FROM findings WHERE 1=1 `;
    const params: any[] = [];
    const searchConcat = "COALESCE(template_id,'') || ' ' || COALESCE(name,'') || ' ' || COALESCE(host,'') || ' ' || COALESCE(matched_at,'')";

    if (severities && severities.length > 0) {
        const placeholders = severities.map(() => '?').join(',');
        query += ` AND LOWER(severity) IN (${placeholders}) `;
        severities.forEach(s => params.push(s.toLowerCase()));
    }

    if (includes && includes.length > 0) {
        includes.forEach(inc => {
            query += ` AND LOWER(${searchConcat}) LIKE ? `;
            params.push(`%${inc.toLowerCase()}%`);
        });
    }

    if (excludes && excludes.length > 0) {
        excludes.forEach(exc => {
            query += ` AND LOWER(${searchConcat}) NOT LIKE ? `;
            params.push(`%${exc.toLowerCase()}%`);
        });
    }

    query += ` ORDER BY created_at DESC LIMIT ?`;
    params.push(limit);

    try {
        const stmt = db.prepare(query);
        const results = stmt.all(...params);
        return formatLargeResult(results);
    } catch (e: any) {
        return { error: e.message };
    }
}

function executeReadonlySql(rawQuery: string) {
    if (!rawQuery) return { error: "No query provided" };
    const q = rawQuery.trim().toUpperCase();
    
    // Strict safety checks
    if (!q.startsWith("SELECT") && !q.startsWith("WITH") && !q.startsWith("EXPLAIN") && !q.startsWith("PRAGMA ")) {
        return { error: "Only SELECT queries are allowed." };
    }
    
    const blockedKeywords = ["INSERT ", "UPDATE ", "DELETE ", "DROP ", "ALTER ", "ATTACH ", "DETACH ", "REPLACE ", "CREATE "];
    for (const kw of blockedKeywords) {
        if (q.includes(kw)) {
             return { error: `Query contains forbidden keyword: ${kw}` };
        }
    }
    
    const db = getDatabase();
    try {
        // Enforce a hard limit internally to prevent massive queries from locking everything
        let finalQuery = rawQuery;
        if (!q.includes("LIMIT")) {
            finalQuery = rawQuery + " LIMIT 150";
        }
        
        const stmt = db.prepare(finalQuery);
        const results = stmt.all();
        return formatLargeResult(results);
    } catch (e: any) {
        return { error: `SQLite Error: ${e.message}` };
    }
}

// ─── ACTION TOOL IMPLEMENTATIONS ─────────────────────────────────────────────

// Security: Block private/loopback IPs from being scanned by AI
function isPrivateTarget(target: string): boolean {
    const privatePatterns = [
        /^127\./,
        /^10\./,
        /^192\.168\./,
        /^172\.(1[6-9]|2[0-9]|3[01])\./,
        /^0\./,
        /^localhost/i,
        /^\[?::1\]?/,
        /^fc00:/i,
        /^fe80:/i,
    ];
    // Strip protocol to check the hostname/IP
    const stripped = target.replace(/^https?:\/\//, '').split('/')[0].split(':')[0];
    return privatePatterns.some(p => p.test(stripped));
}

// Concurrency guard: check if a scan is already running
function isAnyScanRunning(): boolean {
    try {
        const db = getDatabase();
        const running = db.prepare("SELECT COUNT(*) as count FROM scans WHERE status = 'running'").get() as { count: number };
        return running.count > 0;
    } catch {
        return false;
    }
}

async function aiTriggerNucleiScan(
    target: string,
    severity?: string[],
    tags?: string[],
    templateId?: string
): Promise<Record<string, unknown>> {
    if (!target) return { error: "Target is required." };

    // Security: block private IPs
    if (isPrivateTarget(target)) {
        return { error: "Scanning private or loopback IPs (127.x, 10.x, 192.168.x, localhost) is not allowed for safety." };
    }

    // Concurrency guard
    if (isAnyScanRunning()) {
        return { error: "A scan is already running. Please wait for it to complete or stop it first before starting a new one." };
    }

    // Build settings from user params, falling back to dashboard defaults
    const defaults = getNucleiSettings();
    const settings: NucleiScanSettings = {
        scanMode: defaults.scanMode,
        templates: templateId || (tags && tags.length > 0 ? '' : defaults.templates),
        severity: severity && severity.length > 0 ? severity.join(',') : defaults.severity,
        rateLimit: defaults.rateLimit,
        concurrency: defaults.concurrency,
    };

    console.log(`🤖 AI triggering Nuclei scan on: ${target}`);

    // Create a scan record so it appears in Activity Monitor IMMEDIATELY
    const scanId = `ai-${crypto.randomUUID()}`;
    insertScan({
        id: scanId,
        target,
        config: JSON.stringify({ source: 'ai-agent', severity: settings.severity, templates: settings.templates }),
        start_time: Date.now(),
        status: 'running',
    });

    // 🔥 FIRE-AND-FORGET: Start scan in background, return immediately
    triggerNucleiScan([target], settings)
        .then((result) => {
            updateScan(scanId, {
                status: 'completed',
                end_time: Date.now(),
                exit_code: 0,
            });
            cache.invalidate("scan-history");
            cache.invalidatePattern("findings");
            console.log(`🤖 ✅ AI Nuclei scan completed on ${target}: ${result?.findingsCount || 0} findings`);
        })
        .catch((e: Error) => {
            updateScan(scanId, {
                status: 'failed',
                end_time: Date.now(),
                exit_code: 1,
            });
            cache.invalidate("scan-history");
            console.error(`🤖 ❌ AI Nuclei scan failed on ${target}:`, e.message);
        });

    // Return IMMEDIATELY — don't wait for scan to finish
    return {
        success: true,
        scan_id: scanId,
        message: `Nuclei vulnerability scan started on ${target}`,
        status: "running",
        monitor: "You can track progress in the Scan History tab or ask me 'is there a scan running?' to check status.",
        note: "I'll notify you automatically when the scan completes via the chat panel."
    };
}

async function aiTriggerSubfinderScan(domain: string): Promise<Record<string, unknown>> {
    if (!domain) return { error: "Domain is required." };

    // Basic validation: should look like a domain
    if (!domain.includes('.')) {
        return { error: `"${domain}" doesn't look like a valid domain. Expected format: example.com` };
    }

    console.log(`🤖 AI triggering Subfinder scan on: ${domain}`);

    // Create a scan record so it appears in Activity Monitor IMMEDIATELY
    const scanId = `ai-subfinder-${crypto.randomUUID()}`;
    insertScan({
        id: scanId,
        target: domain,
        config: JSON.stringify({ source: 'ai-agent', type: 'subfinder' }),
        start_time: Date.now(),
        status: 'running',
    });

    // 🔥 FIRE-AND-FORGET: Start subfinder in background, return immediately
    triggerSubfinderScan(domain)
        .then((result) => {
            updateScan(scanId, {
                status: 'completed',
                end_time: Date.now(),
                exit_code: 0,
            });
            if (result) {
                console.log(`🤖 ✅ AI Subfinder completed for ${domain}: ${result.total} total, ${result.newCount} new`);
            } else {
                console.log(`🤖 ⚠️ AI Subfinder returned no results for ${domain}`);
            }
        })
        .catch((e: Error) => {
            updateScan(scanId, {
                status: 'failed',
                end_time: Date.now(),
                exit_code: 1,
            });
            console.error(`🤖 ❌ AI Subfinder failed for ${domain}:`, e.message);
        });

    // Return IMMEDIATELY
    return {
        success: true,
        scan_id: scanId,
        message: `Subfinder subdomain scan started on ${domain}`,
        status: "running",
        monitor: "You can track progress in the Activity log via dashboard.",
        note: "The scan typically takes 1-3 minutes depending on the domain size. I'll notify you when it completes."
    };
}

async function aiTriggerFullRecon(domain: string): Promise<Record<string, unknown>> {
    if (!domain) return { error: "Domain is required." };

    if (!domain.includes('.')) {
        return { error: `"${domain}" doesn't look like a valid domain. Expected format: example.com` };
    }

    // Concurrency guard
    if (isAnyScanRunning()) {
        return { error: "A scan is already running. Please wait for it to complete before starting a full recon." };
    }

    console.log(`🤖 AI triggering FULL RECON on: ${domain}`);

    // Create a scan record for the full recon pipeline
    const scanId = `ai-recon-${crypto.randomUUID()}`;
    insertScan({
        id: scanId,
        target: domain,
        config: JSON.stringify({ source: 'ai-full-recon', phases: ['subfinder', 'httpx', 'nuclei'] }),
        start_time: Date.now(),
        status: 'running',
    });

    // 🔥 FIRE-AND-FORGET: Chain all 3 phases in background
    (async () => {
        try {
            // Phase 1: Subfinder
            console.log(`🤖 [Phase 1/3] Running Subfinder for ${domain}...`);
            const subResult = await triggerSubfinderScan(domain);

            if (!subResult) {
                updateScan(scanId, { status: 'failed', end_time: Date.now(), exit_code: 1 });
                console.error(`🤖 ❌ Full recon failed at Phase 1 (Subfinder) for ${domain}`);
                return;
            }

            console.log(`🤖 [Phase 1/3] ✅ Subfinder: ${subResult.total} total, ${subResult.newCount} new`);

            // Phase 2: HTTPX (only if new subdomains found)
            if (subResult.newSubdomains.length > 0) {
                console.log(`🤖 [Phase 2/3] Running HTTPX on ${subResult.newSubdomains.length} new subdomains...`);
                const httpxResult = await triggerHttpxScan(subResult.newSubdomains);

                if (httpxResult && httpxResult.liveCount > 0) {
                    console.log(`🤖 [Phase 2/3] ✅ HTTPX: ${httpxResult.liveCount} live hosts`);

                    // Phase 3: Nuclei
                    console.log(`🤖 [Phase 3/3] Running Nuclei on ${httpxResult.liveCount} live hosts...`);
                    const liveUrls = httpxResult.liveHosts.map(h => h.host);
                    const nucleiResult = await triggerNucleiScan(liveUrls, getNucleiSettings());
                    console.log(`🤖 [Phase 3/3] ✅ Nuclei: ${nucleiResult?.findingsCount || 0} findings`);
                } else {
                    console.log(`🤖 [Phase 2/3] ⚠️ No live hosts found, skipping Nuclei`);
                }
            } else {
                console.log(`🤖 [Phase 2/3] ⚠️ No new subdomains, skipping HTTPX and Nuclei`);
            }

            // Mark pipeline as completed
            updateScan(scanId, { status: 'completed', end_time: Date.now(), exit_code: 0 });
            cache.invalidate("scan-history");
            cache.invalidatePattern("findings");
            console.log(`🤖 ✅ Full recon completed for ${domain}`);
        } catch (e: any) {
            updateScan(scanId, { status: 'failed', end_time: Date.now(), exit_code: 1 });
            cache.invalidate("scan-history");
            console.error(`🤖 ❌ Full recon failed for ${domain}:`, e.message);
        }
    })();

    // Return IMMEDIATELY
    return {
        success: true,
        scan_id: scanId,
        message: `Full reconnaissance pipeline started on ${domain}`,
        status: "running",
        phases: "Subfinder (subdomains) → HTTPX (live probing) → Nuclei (vulnerability scan)",
        monitor: "Track progress in the Scan History tab. Each phase will log to the console.",
        note: "This is a long-running operation (10-60 min depending on domain size). I'll notify you when it completes."
    };
}

function aiMarkFindingStatus(findingId: number, status: string): Record<string, unknown> {
    if (!findingId) return { error: "finding_id is required." };
    if (!status) return { error: "status is required." };

    // Strict allowlist enforcement
    const allowedStatuses = ["False Positive", "Fixed", "Accepted Risk", "New"];
    if (!allowedStatuses.includes(status)) {
        return { error: `Invalid status "${status}". Allowed values: ${allowedStatuses.join(', ')}` };
    }

    try {
        // Verify the finding exists first
        const db = getDatabase();
        const existing = db.prepare("SELECT id, name, severity, host FROM findings WHERE id = ?").get(findingId) as any;
        if (!existing) {
            return { error: `Finding with ID ${findingId} not found.` };
        }

        updateFinding(findingId, { status });

        // Invalidate findings cache
        cache.invalidatePattern("findings");

        return {
            success: true,
            message: `Finding #${findingId} status updated to "${status}"`,
            finding: {
                id: existing.id,
                name: existing.name,
                severity: existing.severity,
                host: existing.host,
                new_status: status
            }
        };
    } catch (e: any) {
        console.error("AI mark finding error:", e);
        return { error: `Failed to update finding: ${e.message}` };
    }
}

function aiGetScanStatus(): Record<string, unknown> {
    try {
        const db = getDatabase();

        // Check for running scans in the database
        const runningScans = db.prepare(
            "SELECT id, target, status, start_time FROM scans WHERE status = 'running' ORDER BY start_time DESC LIMIT 5"
        ).all() as any[];

        // Check scheduler status
        const schedulerStatus = getSchedulerStatus();

        // Check for recent completed scans (last 3)
        const recentCompleted = db.prepare(
            "SELECT id, target, status, start_time, end_time FROM scans WHERE status IN ('completed', 'failed', 'stopped') ORDER BY end_time DESC LIMIT 3"
        ).all() as any[];

        return {
            has_running_scans: runningScans.length > 0,
            running_scans: runningScans.map(s => ({
                id: s.id,
                target: s.target,
                started: new Date(s.start_time).toLocaleString(),
                running_for_seconds: Math.round((Date.now() - s.start_time) / 1000)
            })),
            scheduler: {
                is_processing: schedulerStatus.isProcessing,
                current_domain: schedulerStatus.currentDomain,
                next_run: schedulerStatus.nextRun ? schedulerStatus.nextRun.toLocaleString() : null
            },
            recent_completed: recentCompleted.map(s => ({
                id: s.id,
                target: s.target,
                status: s.status,
                completed: s.end_time ? new Date(s.end_time).toLocaleString() : null
            }))
        };
    } catch (e: any) {
        console.error("AI scan status error:", e);
        return { error: `Failed to check scan status: ${e.message}` };
    }
}

// Export for API route use (custom templates page)
export { listCustomTemplates, deleteCustomTemplate };

// ─── Vercel AI SDK Tool Export ───────────────────────────────────────────────
// Dynamically converts our raw JSON schema definitions into Vercel AI Core tools
// This allows native streaming, streaming tool calls, and parallel execution.
export const AI_TOOLS: Record<string, any> = TOOL_DEFINITIONS.reduce((acc, def) => {
    acc[def.function.name] = tool({
        description: def.function.description,
        parameters: jsonSchema(def.function.parameters as any),
        execute: async (args: any) => {
            console.log(`🤖 Vercel Executing: ${def.function.name}(${JSON.stringify(args)})`);
            // Run the existing legacy tool handler
            const rawResult = await executeToolCall(def.function.name, args);
            try {
                // If the tool returned stringified JSON, parse it back to a standard object 
                // so the Vercel SDK can stream the structured result to the LLM better.
                return JSON.parse(rawResult);
            } catch {
                return rawResult; // Fallback to raw string
            }
        }
    } as any);
    return acc;
}, {} as Record<string, any>);
