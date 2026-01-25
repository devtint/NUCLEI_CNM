import Database from 'better-sqlite3';
import path from 'path';
import crypto from 'crypto';
import { normalizeUrl } from './utils';

// Database file location - configurable for Docker volume mounting
const DB_PATH = process.env.DATABASE_PATH || path.join(process.cwd(), 'nuclei.db');

// Initialize database
let db: Database.Database | null = null;

export function getDatabase(): Database.Database {
    if (!db) {
        db = new Database(DB_PATH);
        db.pragma('journal_mode = WAL'); // Better performance for concurrent access
        initializeSchema();
    }
    return db;
}

function initializeSchema() {
    if (!db) return;

    // Create scans table with file metadata
    db.exec(`
        CREATE TABLE IF NOT EXISTS scans (
            id TEXT PRIMARY KEY,
            target TEXT NOT NULL,
            config TEXT,
            start_time INTEGER NOT NULL,
            end_time INTEGER,
            status TEXT NOT NULL,
            exit_code INTEGER,
            json_file_path TEXT,
            json_file_size INTEGER DEFAULT 0,
            log_file_path TEXT,
            created_at INTEGER DEFAULT (strftime('%s', 'now'))
        )
    `);

    // Create findings table
    db.exec(`
        CREATE TABLE IF NOT EXISTS findings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            scan_id TEXT NOT NULL,
            template_id TEXT,
            template_path TEXT,
            name TEXT,
            severity TEXT,
            type TEXT,
            host TEXT,
            matched_at TEXT,
            request TEXT,
            response TEXT,
            timestamp TEXT,
            raw_json TEXT NOT NULL,
            status TEXT DEFAULT 'New',
            finding_hash TEXT,
            first_seen INTEGER,
            last_seen INTEGER,
            created_at INTEGER DEFAULT (strftime('%s', 'now')),
            FOREIGN KEY (scan_id) REFERENCES scans(id) ON DELETE CASCADE
        )
    `);

    // Create subfinder scans table
    db.exec(`
        CREATE TABLE IF NOT EXISTS subfinder_scans (
            id TEXT PRIMARY KEY,
            target TEXT NOT NULL,
            start_time INTEGER NOT NULL,
            end_time INTEGER,
            status TEXT NOT NULL,
            count INTEGER DEFAULT 0,
            created_at INTEGER DEFAULT (strftime('%s', 'now'))
        )
    `);

    // Create subfinder results table
    db.exec(`
        CREATE TABLE IF NOT EXISTS subfinder_results (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            scan_id TEXT NOT NULL,
            subdomain TEXT NOT NULL,
            first_seen INTEGER,
            last_seen INTEGER,
            is_new BOOLEAN DEFAULT 0,
            FOREIGN KEY (scan_id) REFERENCES subfinder_scans(id) ON DELETE CASCADE
        )
    `);

    // Migration for existing tables: Add is_new column if not exists
    try {
        db.exec("ALTER TABLE subfinder_results ADD COLUMN is_new BOOLEAN DEFAULT 0");
    } catch (e: any) {
        // Ignore error if column already exists (Duplicate column name)
        if (!e.message.includes("duplicate column name")) {
            // console.log("Migration note:", e.message); 
        }
    }

    // Create monitored targets table (Inventory)
    db.exec(`
        CREATE TABLE IF NOT EXISTS monitored_targets (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            target TEXT UNIQUE NOT NULL,
            last_scan_date INTEGER,
            total_count INTEGER DEFAULT 0,
            created_at INTEGER DEFAULT (strftime('%s', 'now'))
        )
    `);

    // Create monitored subdomains table (Global List)
    db.exec(`
        CREATE TABLE IF NOT EXISTS monitored_subdomains (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            target_id INTEGER NOT NULL,
            subdomain TEXT NOT NULL,
            first_seen INTEGER,
            last_seen INTEGER,
            FOREIGN KEY (target_id) REFERENCES monitored_targets(id) ON DELETE CASCADE,
            UNIQUE(target_id, subdomain)
        )
    `);

    // Create indexes for better query performance
    db.exec(`
        CREATE INDEX IF NOT EXISTS idx_findings_scan_id ON findings(scan_id);
        CREATE INDEX IF NOT EXISTS idx_findings_severity ON findings(severity);
        CREATE INDEX IF NOT EXISTS idx_findings_scan_severity ON findings(scan_id, severity);
        CREATE UNIQUE INDEX IF NOT EXISTS idx_finding_hash ON findings(finding_hash);
        CREATE INDEX IF NOT EXISTS idx_scans_status ON scans(status);
        CREATE INDEX IF NOT EXISTS idx_scans_start_time ON scans(start_time DESC);
        CREATE INDEX IF NOT EXISTS idx_scans_status_time ON scans(status, start_time DESC);

        CREATE INDEX IF NOT EXISTS idx_subfinder_results_scan_id ON subfinder_results(scan_id);
        CREATE UNIQUE INDEX IF NOT EXISTS idx_subfinder_results_scan_subdomain ON subfinder_results(scan_id, subdomain);
        CREATE INDEX IF NOT EXISTS idx_subfinder_scans_start_time ON subfinder_scans(start_time DESC);

        -- HTTPX Tables
        CREATE TABLE IF NOT EXISTS httpx_scans (
            id TEXT PRIMARY KEY,
            target TEXT NOT NULL,
            start_time INTEGER NOT NULL,
            end_time INTEGER,
            status TEXT NOT NULL,
            count INTEGER DEFAULT 0,
            created_at INTEGER DEFAULT (strftime('%s', 'now'))
        )
    `);

    db.exec(`
        CREATE TABLE IF NOT EXISTS httpx_results (
            id TEXT PRIMARY KEY,
            scan_id TEXT NOT NULL,
            url TEXT NOT NULL,
            host TEXT NOT NULL,
            port INTEGER,
            scheme TEXT,
            title TEXT,
            status_code INTEGER,
            subdomain TEXT,
            technologies TEXT,
            web_server TEXT,
            content_type TEXT,
            content_length INTEGER,
            response_time TEXT,
            ip TEXT,
            cname TEXT,
            cdn_name TEXT,
            timestamp INTEGER,
            is_new BOOLEAN DEFAULT 0,
            change_status TEXT DEFAULT 'new',
            screenshot_path TEXT,
            FOREIGN KEY(scan_id) REFERENCES httpx_scans(id) ON DELETE CASCADE
        )
    `);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_httpx_results_scan_id ON httpx_results(scan_id);`);

    // Migrations for HTTPX
    try {
        db.exec("ALTER TABLE httpx_scans ADD COLUMN pid INTEGER");
    } catch (e: any) { if (!e.message.includes("duplicate column")) { } }
    try {
        db.exec("ALTER TABLE httpx_scans ADD COLUMN log_path TEXT");
    } catch (e: any) { if (!e.message.includes("duplicate column")) { } }
    try {
        db.prepare("ALTER TABLE httpx_results ADD COLUMN change_status TEXT DEFAULT 'new'").run();
    } catch (e) { /* ignore */ }
    try {
        db.prepare("ALTER TABLE httpx_results ADD COLUMN screenshot_path TEXT").run();
    } catch (e) { /* ignore */ }

    // Create access_logs table for Phase 7
    db.exec(`
        CREATE TABLE IF NOT EXISTS access_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp INTEGER NOT NULL,
            ip_address TEXT,
            user_agent TEXT,
            event_type TEXT DEFAULT 'LOGIN'
        )
    `);
}


// Scan operations
export interface ScanRecord {
    id: string;
    target: string;
    config?: string;
    start_time: number;
    end_time?: number;
    status: 'running' | 'completed' | 'failed' | 'stopped';
    exit_code?: number;
}

export function insertScan(scan: ScanRecord) {
    const db = getDatabase();
    const stmt = db.prepare(`
        INSERT INTO scans (id, target, config, start_time, status)
        VALUES (?, ?, ?, ?, ?)
    `);
    stmt.run(scan.id, scan.target, scan.config, scan.start_time, scan.status);
}

export function updateScan(id: string, updates: Partial<ScanRecord & { json_file_path?: string; json_file_size?: number; log_file_path?: string }>) {
    const db = getDatabase();
    const fields: string[] = [];
    const values: any[] = [];

    if (updates.status !== undefined) {
        fields.push('status = ?');
        values.push(updates.status);
    }
    if (updates.end_time !== undefined) {
        fields.push('end_time = ?');
        values.push(updates.end_time);
    }
    if (updates.exit_code !== undefined) {
        fields.push('exit_code = ?');
        values.push(updates.exit_code);
    }
    if (updates.json_file_path !== undefined) {
        fields.push('json_file_path = ?');
        values.push(updates.json_file_path);
    }
    if (updates.json_file_size !== undefined) {
        fields.push('json_file_size = ?');
        values.push(updates.json_file_size);
    }
    if (updates.log_file_path !== undefined) {
        fields.push('log_file_path = ?');
        values.push(updates.log_file_path);
    }

    if (fields.length === 0) return;

    values.push(id);
    const stmt = db.prepare(`UPDATE scans SET ${fields.join(', ')} WHERE id = ?`);
    stmt.run(...values);
}

export function getScan(id: string): ScanRecord | undefined {
    const db = getDatabase();
    const stmt = db.prepare('SELECT * FROM scans WHERE id = ?');
    return stmt.get(id) as ScanRecord | undefined;
}

export function getAllScans(): ScanRecord[] {
    const db = getDatabase();
    const stmt = db.prepare('SELECT * FROM scans ORDER BY start_time DESC');
    return stmt.all() as ScanRecord[];
}

export function deleteScan(id: string) {
    const db = getDatabase();
    const stmt = db.prepare('DELETE FROM scans WHERE id = ?');
    stmt.run(id);
}

// function deleteHttpxScan is already defined above

export function clearHttpxResults() {
    const db = getDatabase();
    // Delete all results and scans
    try {
        db.exec("DELETE FROM httpx_results");
        db.exec("DELETE FROM httpx_scans");
        // Also clean up screenshots? For now let's just clear DB.
    } catch (e) {
        console.error("Failed to clear httpx data", e);
        throw e;
    }
}

// Finding operations
export interface FindingRecord {
    id?: number;
    scan_id: string;
    template_id?: string;
    template_path?: string;
    name?: string;
    severity?: string;
    type?: string;
    host?: string;
    matched_at?: string;
    matcher_name?: string;
    request?: string;
    response?: string;
    timestamp?: string;
    raw_json: string;
    status?: string;
}

// Generate deterministic hash for finding deduplication
export function generateFindingHash(
    templateId?: string,
    host?: string,
    matchedAt?: string,
    name?: string,
    matcherName?: string
): string {
    // Use empty string if values are undefined to ensure consistent hashing
    // Include name AND matcher_name to differentiate findings from same template with different matchers
    // Example: http-missing-security-headers with different missing headers (x-frame-options, csp, etc.)
    // URL Normalization (P1): Strip protocol/slash to prevent duplicates on scheme change
    const normalizedUrl = normalizeUrl(matchedAt);
    const data = `${templateId || ''}|${host || ''}|${normalizedUrl}|${name || ''}|${matcherName || ''}`;
    return crypto.createHash('sha256').update(data).digest('hex');
}

// Upsert finding (insert new or update existing based on hash)
export function upsertFinding(finding: FindingRecord) {
    const db = getDatabase();
    const hash = generateFindingHash(finding.template_id, finding.host, finding.matched_at, finding.name, finding.matcher_name);
    const now = Math.floor(Date.now() / 1000);

    // Check if finding already exists
    const existing = db.prepare('SELECT * FROM findings WHERE finding_hash = ?').get(hash) as FindingRecord | undefined;

    if (existing) {
        // Finding already exists - update it
        let newStatus = existing.status || 'New';

        // Regression detection: if previously Fixed/Closed, mark as Regression
        if (newStatus === 'Fixed' || newStatus === 'Closed') {
            newStatus = 'Regression';
        }

        const updateStmt = db.prepare(`
            UPDATE findings 
            SET last_seen = ?, 
                status = ?, 
                scan_id = ?, 
                raw_json = ?,
                timestamp = ?
            WHERE finding_hash = ?
        `);
        updateStmt.run(now, newStatus, finding.scan_id, finding.raw_json, finding.timestamp, hash);
    } else {
        // New finding - insert it
        const insertStmt = db.prepare(`
            INSERT INTO findings (
                scan_id, template_id, template_path, name, severity, type,
                host, matched_at, request, response, timestamp, raw_json, 
                status, finding_hash, first_seen, last_seen
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        insertStmt.run(
            finding.scan_id,
            finding.template_id,
            finding.template_path,
            finding.name,
            finding.severity,
            finding.type,
            finding.host,
            finding.matched_at,
            finding.request,
            finding.response,
            finding.timestamp,
            finding.raw_json,
            finding.status || 'New',
            hash,
            now,
            now
        );
    }
}

export function insertFinding(finding: FindingRecord) {
    const db = getDatabase();
    const stmt = db.prepare(`
        INSERT INTO findings (
            scan_id, template_id, template_path, name, severity, type,
            host, matched_at, request, response, timestamp, raw_json, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
        finding.scan_id,
        finding.template_id,
        finding.template_path,
        finding.name,
        finding.severity,
        finding.type,
        finding.host,
        finding.matched_at,
        finding.request,
        finding.response,
        finding.timestamp,
        finding.raw_json,
        finding.status || 'New'
    );
}

export function updateFinding(id: number, updates: { status?: string }) {
    const db = getDatabase();
    const fields: string[] = [];
    const values: any[] = [];

    if (updates.status !== undefined) {
        fields.push('status = ?');
        values.push(updates.status);
    }

    if (fields.length === 0) return;

    values.push(id);
    const stmt = db.prepare(`UPDATE findings SET ${fields.join(', ')} WHERE id = ?`);
    stmt.run(...values);
}

export function insertFindings(findings: FindingRecord[]) {
    const db = getDatabase();

    // Use transaction for batch upsert operations
    const upsertMany = db.transaction((findings: FindingRecord[]) => {
        for (const finding of findings) {
            upsertFinding(finding);
        }
    });

    upsertMany(findings);
}

export function getFindingsByScan(scanId: string): FindingRecord[] {
    const db = getDatabase();
    const stmt = db.prepare('SELECT * FROM findings WHERE scan_id = ? ORDER BY id');
    return stmt.all(scanId) as FindingRecord[];
}

export function getFindingCount(scanId: string): number {
    const db = getDatabase();
    const stmt = db.prepare('SELECT COUNT(*) as count FROM findings WHERE scan_id = ?');
    const result = stmt.get(scanId) as { count: number };
    return result.count;
}

export function deleteFinding(id: number) {
    const db = getDatabase();
    const stmt = db.prepare('DELETE FROM findings WHERE id = ?');
    stmt.run(id);
}

export function deleteAllFindings(scanId: string) {
    const db = getDatabase();
    const stmt = db.prepare('DELETE FROM findings WHERE scan_id = ?');
    stmt.run(scanId);
}

// Close database connection (useful for cleanup)
export function closeDatabase() {
    if (db) {
        db.close();
        db = null;
    }
}

// Subfinder Operations

export interface SubfinderScanRecord {
    id: string;
    target: string;
    start_time: number;
    end_time?: number;
    status: 'running' | 'completed' | 'failed';
    count: number;
}

export function insertSubfinderScan(scan: SubfinderScanRecord) {
    const db = getDatabase();
    const stmt = db.prepare(`
        INSERT INTO subfinder_scans (id, target, start_time, status, count)
        VALUES (?, ?, ?, ?, ?)
    `);
    stmt.run(scan.id, scan.target, scan.start_time, scan.status, scan.count);
}

export function updateSubfinderScan(id: string, updates: Partial<SubfinderScanRecord>) {
    const db = getDatabase();
    const fields: string[] = [];
    const values: any[] = [];

    if (updates.status !== undefined) {
        fields.push('status = ?');
        values.push(updates.status);
    }
    if (updates.end_time !== undefined) {
        fields.push('end_time = ?');
        values.push(updates.end_time);
    }
    if (updates.count !== undefined) {
        fields.push('count = ?');
        values.push(updates.count);
    }

    if (fields.length === 0) return;

    values.push(id);
    const stmt = db.prepare(`UPDATE subfinder_scans SET ${fields.join(', ')} WHERE id = ?`);
    stmt.run(...values);
}

export function getSubfinderScans(): SubfinderScanRecord[] {
    const db = getDatabase();
    const stmt = db.prepare('SELECT * FROM subfinder_scans ORDER BY start_time DESC');
    return stmt.all() as SubfinderScanRecord[];
}

export function getSubfinderResults(scanId: string): string[] {
    const db = getDatabase(); // Ensure db is retrieved
    if (!db) return [];
    const rows = db.prepare("SELECT subdomain FROM subfinder_results WHERE scan_id = ?").all(scanId) as { subdomain: string }[];
    return rows.map(r => r.subdomain);
}

export function getRecentSubdomains(limit: number = 100): { subdomain: string; last_seen: string; scan_target: string }[] {
    const db = getDatabase();
    if (!db) return [];
    const stmt = db.prepare(`
        SELECT r.subdomain, r.last_seen, s.target as scan_target
        FROM subfinder_results r
        JOIN subfinder_scans s ON r.scan_id = s.id
        WHERE r.is_new = 1
        ORDER BY r.id DESC
        LIMIT ?
    `);
    return stmt.all(limit) as { subdomain: string; last_seen: string; scan_target: string }[];
}

export function saveSubfinderResults(scanId: string, target: string, subdomains: string[]) {
    console.log(`[DB] Saving ${subdomains.length} subdomains for ${target}`);
    const db = getDatabase();
    if (!db) return;

    const now = Math.floor(Date.now() / 1000);

    // 1. Update/Insert Parent Target (Inventory)
    // We use INSERT OR IGNORE then UPDATE to handle the UPSERT manually for SQLite compat or just simple logic
    let targetId: number | bigint;

    const getTarget = db.prepare("SELECT id FROM monitored_targets WHERE target = ?");
    const existingTarget = getTarget.get(target) as { id: number | bigint } | undefined;

    if (existingTarget) {
        targetId = existingTarget.id;
        db.prepare("UPDATE monitored_targets SET last_scan_date = ? WHERE id = ?")
            .run(now, targetId);
    } else {
        const insertTarget = db.prepare("INSERT INTO monitored_targets (target, last_scan_date, total_count) VALUES (?, ?, ?)");
        const info = insertTarget.run(target, now, 0); // Init with 0, update later
        targetId = info.lastInsertRowid;
    }

    // 2. Process Subdomains
    const insertResult = db.prepare(`
        INSERT INTO subfinder_results (scan_id, subdomain, first_seen, last_seen, is_new)
        VALUES (?, ?, ?, ?, ?)
    `);

    const checkGlobal = db.prepare("SELECT id FROM monitored_subdomains WHERE target_id = ? AND subdomain = ?");
    const insertGlobal = db.prepare("INSERT INTO monitored_subdomains (target_id, subdomain, first_seen, last_seen) VALUES (?, ?, ?, ?)");
    const updateGlobal = db.prepare("UPDATE monitored_subdomains SET last_seen = ? WHERE id = ?");

    const transaction = db.transaction((items: string[]) => {
        for (const sub of items) {
            let isNew = false;

            // Check Global Inventory
            const existingGlobal = checkGlobal.get(targetId, sub) as { id: number } | undefined;

            if (existingGlobal) {
                // Known subdomain: Update last_seen
                updateGlobal.run(now, existingGlobal.id);
                isNew = false;
            } else {
                // New discovery!
                insertGlobal.run(targetId, sub, now, now);
                isNew = true;
            }

            // Record in this specific scan result
            insertResult.run(scanId, sub, now, now, isNew ? 1 : 0);
        }
    });

    try {
        transaction(subdomains);

        // Update total_count with actual count from DB (handling accumulation)
        const countResult = db.prepare("SELECT COUNT(*) as count FROM monitored_subdomains WHERE target_id = ?").get(targetId) as { count: number };
        const realCount = countResult.count;

        db.prepare("UPDATE monitored_targets SET total_count = ? WHERE id = ?").run(realCount, targetId);

    } catch (e) {
        console.error("Error inserting subfinder results", e);
    }
}

export function deleteMonitoredTarget(id: number) {
    const db = getDatabase();
    if (!db) return;
    db.prepare("DELETE FROM monitored_targets WHERE id = ?").run(id);
    // Cascade should handle subdomains, but let's be safe if FK support isn't perfect in all sqlite versions (though we enabled WAL, did we enable FKs?)
    // Better-sqlite3 enables FKs by default if using 'pragma foreign_keys = ON'.
    // Let's manually delete to be sure.
    db.prepare("DELETE FROM monitored_subdomains WHERE target_id = ?").run(id);
}

export function deleteSubfinderScan(id: string) {
    const db = getDatabase();
    if (!db) return;

    const deleteResults = db.prepare("DELETE FROM subfinder_results WHERE scan_id = ?");
    const deleteScan = db.prepare("DELETE FROM subfinder_scans WHERE id = ?");

    const transaction = db.transaction(() => {
        deleteResults.run(id);
        deleteScan.run(id);
    });

    try {
        transaction();
    } catch (e) {
        console.error("Error deleting scan", e);
        throw e;
    }
}
// End of DB helpers

// HTTPX Operations
export interface HttpxScanRecord {
    id: string;
    target: string;
    start_time: number;
    end_time?: number;
    status: 'running' | 'completed' | 'failed' | 'stopped';
    count: number;
    pid?: number;
    log_path?: string;
}

export interface HttpxResultRecord {
    id: string; // url as id or random? Let's use random or hash.
    scan_id: string;
    url: string;
    host: string;
    port?: number;
    scheme: string;
    title?: string;
    status_code?: number;
    subdomain?: string;
    technologies?: string[]; // Stored as JSON string in DB
    web_server?: string;
    content_type?: string;
    content_length?: number;
    response_time?: string;
    ip?: string;
    cname?: string[]; // Stored as JSON or comma string? Httpx returns array.
    cdn_name?: string;
    timestamp?: string;
}

export function insertHttpxScan(scan: HttpxScanRecord) {
    const db = getDatabase();
    const stmt = db.prepare(`
        INSERT INTO httpx_scans (id, target, start_time, status, count, pid, log_path)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(scan.id, scan.target, scan.start_time, scan.status, scan.count, scan.pid, scan.log_path);
}

export function updateHttpxScan(id: string, updates: Partial<HttpxScanRecord>) {
    const db = getDatabase();
    const fields: string[] = [];
    const values: any[] = [];

    if (updates.status !== undefined) {
        fields.push('status = ?');
        values.push(updates.status);
    }
    if (updates.end_time !== undefined) {
        fields.push('end_time = ?');
        values.push(updates.end_time);
    }
    if (updates.count !== undefined) {
        fields.push('count = ?');
        values.push(updates.count);
    }
    if (updates.pid !== undefined) {
        fields.push('pid = ?');
        values.push(updates.pid);
    }
    if (updates.log_path !== undefined) {
        fields.push('log_path = ?');
        values.push(updates.log_path);
    }

    if (fields.length === 0) return;

    values.push(id);
    const stmt = db.prepare(`UPDATE httpx_scans SET ${fields.join(', ')} WHERE id = ?`);
    stmt.run(...values);
}

export function getHttpxScans(): HttpxScanRecord[] {
    const db = getDatabase();
    const stmt = db.prepare('SELECT * FROM httpx_scans ORDER BY start_time DESC');
    return stmt.all() as HttpxScanRecord[];
}

export function saveHttpxResults(scanId: string, results: any[]) {
    const db = getDatabase();

    // Prepare statement to find previous result for comparison
    const findPrev = db.prepare('SELECT status_code, title FROM httpx_results WHERE url = ? ORDER BY timestamp DESC LIMIT 1');

    const insert = db.prepare(`
        INSERT INTO httpx_results (
            id, scan_id, url, host, port, scheme, title, status_code,
            subdomain, technologies, web_server, content_type,
            content_length, response_time, ip, cname, cdn_name, 
            timestamp, change_status, screenshot_path
        ) VALUES (
            ?, ?, ?, ?, ?, ?, ?, ?,
            ?, ?, ?, ?,
            ?, ?, ?, ?, ?, ?, ?, ?
        )
    `);

    const transaction = db.transaction((items: any[]) => {
        for (const item of items) {
            const id = crypto.randomUUID();
            const technologies = item.tech ? JSON.stringify(item.tech) : null;
            const cnames = item.cname ? JSON.stringify(item.cname) : null;
            const now = Date.now();

            // Determine Changes
            let status = 'new';
            const prev = findPrev.get(item.url) as any;

            if (prev) {
                const prevCode = prev.status_code;
                const currCode = item.status_code;
                const prevTitle = prev.title || '';
                const currTitle = item.title || '';

                if (prevCode !== currCode || prevTitle !== currTitle) {
                    status = 'changed';
                } else {
                    status = 'old';
                }
            }

            insert.run(
                id, scanId, item.url, item.host, item.port, item.scheme, item.title, item.status_code,
                item.input, technologies, item.webserver, item.content_type,
                item.content_length, item.response_time || item.time || "0ms", item.host_ip || (Array.isArray(item.a) ? item.a[0] : item.a) || item.ip, cnames, item.cdn_name,
                now, status, item.screenshot_path
            );
        }
    });

    try {
        transaction(results);
    } catch (e) { console.error("Failed to insert results", e); }
}

export function getHttpxResults(scanId?: string) {
    const db = getDatabase();
    if (!scanId) {
        // Global View: Deduplicate by URL in JS to handle legacy NULL timestamps safely
        const all = db.prepare('SELECT * FROM httpx_results ORDER BY COALESCE(timestamp, 0) DESC').all() as any[];
        const seen = new Set<string>();
        const unique = [];
        for (const item of all) {
            if (!seen.has(item.url)) {
                seen.add(item.url);
                unique.push(item);
            }
        }
        return unique;
    }
    return db.prepare('SELECT * FROM httpx_results WHERE scan_id = ?').all(scanId);
}

export function deleteHttpxScan(id: string) {
    const db = getDatabase();
    db.transaction(() => {
        db.prepare("DELETE FROM httpx_results WHERE scan_id = ?").run(id);
        db.prepare("DELETE FROM httpx_scans WHERE id = ?").run(id);
    })();
}

export function getHttpxDomainSummary() {
    const results = getHttpxResults() as any[]; // Get all fresh results
    const groups: Record<string, number> = {};

    for (const r of results) {
        try {
            const hostname = new URL(r.url).hostname;
            const parts = hostname.split('.');
            let domain = hostname;

            // Simple logic: if > 2 parts, check for ccTLDs like .ac.th, .co.uk
            if (parts.length > 2) {
                const last = parts[parts.length - 1];
                const secondLast = parts[parts.length - 2];
                // Common 2-letter 2nd level domains
                if (['ac', 'co', 'go', 'or', 'in', 'com', 'org', 'net', 'edu', 'gov'].includes(secondLast) && last.length === 2) {
                    domain = parts.slice(-3).join('.');
                } else {
                    domain = parts.slice(-2).join('.');
                }
            }

            groups[domain] = (groups[domain] || 0) + 1;
        } catch (e) {
            // fallback
            groups["IP/Other"] = (groups["IP/Other"] || 0) + 1;
        }
    }

    return Object.entries(groups)
        .map(([domain, count]) => ({ domain, count }))
        .sort((a, b) => b.count - a.count);
}


// Access Log Helpers
export function logAccess(ip: string, userAgent: string, eventType: string = 'LOGIN') {
    const db = getDatabase();
    const stmt = db.prepare(`
        INSERT INTO access_logs (timestamp, ip_address, user_agent, event_type)
        VALUES (?, ?, ?, ?)
    `);
    stmt.run(Date.now(), ip, userAgent, eventType);
}

export function getAccessLogs(limit: number = 50) {
    const db = getDatabase();
    return db.prepare(`
        SELECT * FROM access_logs ORDER BY timestamp DESC LIMIT ?
    `).all(limit);
}
