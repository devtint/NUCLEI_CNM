import Database from 'better-sqlite3';
import path from 'path';
import crypto from 'crypto';

// Database file location
const DB_PATH = path.join(process.cwd(), 'nuclei.db');

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
            FOREIGN KEY (scan_id) REFERENCES subfinder_scans(id) ON DELETE CASCADE
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
    const data = `${templateId || ''}|${host || ''}|${matchedAt || ''}|${name || ''}|${matcherName || ''}`;
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
        ORDER BY r.id DESC
        LIMIT ?
    `);
    return stmt.all(limit) as { subdomain: string; last_seen: string; scan_target: string }[];
}

export function saveSubfinderResults(scanId: string, subdomains: string[]) {
    const db = getDatabase();
    if (!db) return;

    const now = new Date().toISOString();

    // Use INSERT OR IGNORE to skip duplicates within the same scan if unique index exists
    const insertStmt = db.prepare(`
        INSERT OR IGNORE INTO subfinder_results (scan_id, subdomain, first_seen, last_seen)
        VALUES (?, ?, ?, ?)
    `);

    const transaction = db.transaction((items: string[]) => {
        for (const sub of items) {
            insertStmt.run(scanId, sub, now, now);
        }
    });

    try {
        transaction(subdomains);
    } catch (e) {
        console.error("Error inserting subfinder results", e);
    }
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
