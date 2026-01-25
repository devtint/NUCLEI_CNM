const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

const TOOLS = ['nuclei', 'subfinder', 'httpx'];
const GO_BIN_WINDOWS = path.join(os.homedir(), 'go', 'bin');
const IS_WINDOWS = process.platform === 'win32';

console.log("🔍 Checking environment path configuration...\n");
console.log(`System: ${process.platform}`);
console.log(`Go Bin Path (Guessed): ${GO_BIN_WINDOWS}`);
console.log(`PATH: ${process.env.PATH}\n`);

TOOLS.forEach(tool => {
    console.log(`Checking ${tool}...`);
    try {
        // Try 'where' on windows, 'which' on unix
        const cmd = IS_WINDOWS ? `where ${tool}` : `which ${tool}`;
        const output = execSync(cmd).toString().trim();
        console.log(`  ✅ Found in PATH: ${output}`);
    } catch (e) {
        console.log(`  ❌ Not found in PATH`);

        // Check if it exists in standard Go bin but not in path
        const exeName = IS_WINDOWS ? `${tool}.exe` : tool;
        const manualPath = path.join(GO_BIN_WINDOWS, exeName);
        if (fs.existsSync(manualPath)) {
            console.log(`  ⚠️ Found in Go bin directory but NOT in PATH: ${manualPath}`);
            console.log(`     -> Recommendation: Add ${GO_BIN_WINDOWS} to your system PATH`);
            console.log(`     -> Alternative: Set ${tool.toUpperCase()}_BINARY="${manualPath.replace(/\\/g, '\\\\')}" in .env.local`);
        } else {
            console.log(`  ❌ Not found in common locations. Is it installed?`);
        }
    }
    console.log("");
});
