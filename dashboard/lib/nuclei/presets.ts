export const PREDEFINED_COMMANDS = [
    {
        name: "Full Scan (Critical)",
        description: "Scans for all critical severity vulnerabilities",
        flags: "-s critical",
        config: { severity: ["critical"] }
    },
    {
        name: "Full Scan (High/Crit)",
        description: "Scans for high and critical vulnerabilities",
        flags: "-s critical,high",
        config: { severity: ["critical", "high"] }
    },
    {
        name: "Tech Detect",
        description: "Identifies technologies running on the target",
        flags: "-tags tech",
        config: { tags: ["tech"] }
    },
    {
        name: "CVEs (2023-2024)",
        description: "Scans for recent CVEs",
        flags: "-tags cve2023,cve2024",
        config: { tags: ["cve2023", "cve2024"] }
    },
    {
        name: "Misconfigurations",
        description: "Checks for common security misconfigurations",
        flags: "-tags misconfig",
        config: { tags: ["misconfig"] }
    },
    {
        name: "Panels & Logins",
        description: "Finds exposed login panels",
        flags: "-tags panel,login",
        config: { tags: ["panel", "login"] }
    }
];
