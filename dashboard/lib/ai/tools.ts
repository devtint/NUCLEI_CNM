/**
 * AI Agent Tool Definitions
 * 
 * Each tool is a safe, READ-ONLY database query function.
 * The LLM picks which tool to call based on the user's question.
 * 
 * SECURITY: No write operations. No mutations. Read-only queries only.
 */

import { getDatabase, getSetting } from '@/lib/db';
import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';
import os from 'os';

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

// Export for API route use (custom templates page)
export { listCustomTemplates, deleteCustomTemplate };
