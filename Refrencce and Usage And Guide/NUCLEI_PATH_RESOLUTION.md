# Nuclei Path Resolution

## Overview

This document explains how the Nuclei Command Center Dashboard locates and executes the Nuclei binary (GO executable).

## How It Works

### Path Resolution Method

The system calls the **Nuclei (GO binary)** from the management console using the system PATH environment variable.

**Location in Code**: `dashboard/lib/nuclei/config.ts` (line 28)

```typescript
export const NUCLEI_BINARY = "nuclei"; // Assuming it is in PATH as per guide
```

### Execution Flow

1. **Installation**
   ```bash
   go install -v github.com/projectdiscovery/nuclei/v3/cmd/nuclei@latest
   ```
   - Go installs the binary to: `C:\Users\<username>\go\bin\nuclei.exe` (Windows)
   - This directory should be in your system PATH

2. **Dashboard Invocation**
   
   When a scan is initiated, the API route spawns the Nuclei process:
   
   **File**: `dashboard/app/api/scan/route.ts` (line 51)
   ```typescript
   const child = spawn(NUCLEI_BINARY, args);
   ```

3. **System PATH Search**
   - Node.js `spawn()` function uses the system PATH
   - Windows searches through all PATH directories
   - Finds and executes `nuclei.exe`

## Key Implementation Details

### Binary Name
- **Current**: `"nuclei"` (relies on PATH)
- **Platform Independent**: Works on Windows, Linux, macOS
- **No Hardcoded Path**: More portable and maintainable

### Command Construction

The `constructCommand()` function in `lib/nuclei/config.ts` builds the argument array:

```typescript
export function constructCommand(config: ScanConfig, outputFile: string): string[] {
    const args = ["-u", config.target];
    args.push("-json-export", outputFile);
    
    if (config.templateId) {
        args.push("-t", config.templateId);
    }
    
    if (config.severity && config.severity.length > 0) {
        args.push("-s", config.severity.join(","));
    }
    
    // ... additional flags
    
    return args;
}
```

### Full Execution Example

```typescript
// From route.ts
const args = constructCommand({ ...config, customArgs }, outputPath);
console.log(`Starting scan: ${NUCLEI_BINARY} ${args.join(" ")}`);
const child = spawn(NUCLEI_BINARY, args);
```

**Example Output**:
```
Starting scan: nuclei -u https://example.com -json-export ./scans/abc-123.json -s critical,high
```

## Verification

### Check if Nuclei is in PATH

**Windows (PowerShell)**:
```powershell
where nuclei
```

**Linux/macOS**:
```bash
which nuclei
```

**Expected Output**:
```
C:\Users\<username>\go\bin\nuclei.exe
```

### Verify Nuclei Version

```bash
nuclei -version
```

**Expected Output**:
```
[INF] Nuclei Engine Version: v3.6.0
[INF] Nuclei Config Directory: C:\Users\<username>\AppData\Roaming\nuclei
[INF] Nuclei Cache Directory: C:\Users\<username>\AppData\Local\nuclei
[INF] PDCP Directory: C:\Users\<username>\.pdcp
```

## Configuration Paths

The system is aware of Nuclei's standard directories:

```typescript
export const NUCLEI_PATHS = {
    // Config: C:\Users\<username>\AppData\Roaming\nuclei
    CONFIG_DIR: path.join(HOME_DIR, "AppData", "Roaming", "nuclei"),

    // Cache: C:\Users\<username>\AppData\Local\nuclei
    CACHE_DIR: path.join(HOME_DIR, "AppData", "Local", "nuclei"),

    // PDCP: C:\Users\<username>\.pdcp
    PDCP_DIR: path.join(HOME_DIR, ".pdcp"),

    // Default Templates
    TEMPLATES_DIR: path.join(HOME_DIR, "nuclei-templates"),
};
```

These paths are dynamically resolved using:
```typescript
const HOME_DIR = os.homedir();
```

## Alternative: Hardcoded Path

If you need to use a specific Nuclei binary path instead of relying on PATH, modify `lib/nuclei/config.ts`:

```typescript
// Option 1: Absolute path
export const NUCLEI_BINARY = "C:\\Users\\<username>\\go\\bin\\nuclei.exe";

// Option 2: Relative to Go bin
export const NUCLEI_BINARY = path.join(os.homedir(), "go", "bin", "nuclei.exe");

// Option 3: Environment variable
export const NUCLEI_BINARY = process.env.NUCLEI_PATH || "nuclei";
```

## Advantages of Current Approach

✅ **Platform Independent** - Works across Windows, Linux, macOS  
✅ **No Hardcoding** - Adapts to different user environments  
✅ **Standard Practice** - Uses system PATH like terminal commands  
✅ **Easy Updates** - Updating Nuclei via `go install` automatically works  
✅ **Portable** - Project can be shared without path modifications  

## Troubleshooting

### Issue: "nuclei: command not found"

**Cause**: Nuclei is not in system PATH

**Solution**:
1. Verify Go bin directory is in PATH
2. Add Go bin to PATH:
   ```powershell
   # Windows PowerShell (Admin)
   $env:Path += ";C:\Users\<username>\go\bin"
   
   # Permanent (System Properties > Environment Variables)
   # Add: C:\Users\<username>\go\bin to PATH
   ```

### Issue: Spawn fails with ENOENT

**Cause**: Binary not found or permissions issue

**Solution**:
1. Check `where nuclei` returns valid path
2. Verify execute permissions
3. Try hardcoded path as temporary fix

## Related Files

- `dashboard/lib/nuclei/config.ts` - Binary path and command construction
- `dashboard/app/api/scan/route.ts` - Scan execution and process spawning
- `dashboard/app/api/rescan/route.ts` - Rescan functionality
- `guide.txt` - Installation and setup instructions

## References

- [Nuclei Installation](https://docs.projectdiscovery.io/opensource/nuclei/install)
- [Nuclei Running Guide](https://docs.projectdiscovery.io/opensource/nuclei/running)
- [Node.js child_process.spawn()](https://nodejs.org/api/child_process.html#child_processspawncommand-args-options)
