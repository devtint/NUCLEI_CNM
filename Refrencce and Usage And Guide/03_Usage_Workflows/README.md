# Usage Workflows & Scenarios

This module defines the specific user interactions and command logic for the dashboard.

## 1. "One-Click" Command Execution

**Concept**: The user wants to avoid typing complex CLI commands repeatedly.
**Implementation**: define "Popular and Basic" commands in a configuration file, mapped to UI buttons.

### Example Workflow
1.  **User**: Opens "Quick Actions" panel.
2.  **User**: Clicks "Full Scan - Critical".
3.  **System**:
    -   Lookup Command: `nuclei -u <target> -s critical -o <output>`
    -   Prompt for `<target>`.
    -   Execute and Stream logs.

## 2. Rescan Functionality (Surgical Scan)

**Concept**: Re-verify a single finding without running the entire scan again.

### The Algorithm
1.  **Input**: A specific finding object from the JSON results.
2.  **Extraction**: Get the `template-id` (e.g., `tech-detect`, `cve-2021-44228`).
3.  **Command Construction**:
    ```powershell
    nuclei -u <target_url> -t <template_id> -o <new_output_file.json>
    ```
4.  **Execution**: Run command in background.
5.  **Result**: Update the UI with the *new* status of that specific vulnerability.

## 3. Exporting Findings

**Concept**: Flexible reporting capabilities with visual aids.

### Severity-Based Export
**User Interface**: A dropdown menu in the "Findings" or "Reporting" view.

**Options**:
-   `[Export All]` -> Dumps entire dataset.
-   `[Export Critical]` -> Filters list where `severity == "critical"`.
-   `[Export High]` -> Filters list where `severity == "high"`.
-   `[Export Medium]` -> Filters list where `severity == "medium"`.
-   `[Export Low]` -> Filters list where `severity == "low"`.
-   `[Export Info]` -> Filters list where `severity == "info"`.

**Output Requirement**: "Colorized Output"
-   *Note*: Standard CSV/JSON doesn't support color. This likely refers to:
    -   **HTML Export**: Generating an HTML table with CSS colors.
    -   **ANSI-coded Text**: For terminal viewing.
    -   *Assumption*: Prioritize HTML/Excel with cell coloring or ANSI text if strictly requested as "SV files" (Separated Values).

## 4. Custom Template Creation
1.  **UI**: Form with fields for `id`, `info` (name, author, severity), and `requests` (DSL).
2.  **Action**: Save to `Costume Template` directory (as noted in guide typo "Custom template Create").
3.  **Validation**: Run `nuclei -t <new_template> -validate`.

## 5. Backup & Restore Workflows

### Backup Workflow
1. **User**: Navigates to Backup & Restore section.
2. **User**: Clicks Download Backup button.
3. **System**: Exports all data (Nuclei, Subfinder, HTTPX) to JSON.
4. **System**: Downloads file as nuclei-cc-backup_{timestamp}.json.

### Restore Workflow
1. **User**: Navigates to Backup & Restore section.
2. **User**: Selects Restore tab.
3. **User**: Uploads Nuclei CC backup file.
4. **System**: Validates backup format.
5. **System**: Restores data using SQLite transaction.
6. **System**: Shows restore statistics.

### Import External Scan Workflow
1. **User**: Navigates to Backup & Restore section.
2. **User**: Selects Import Nuclei JSON tab.
3. **User**: Uploads Nuclei JSON output file.
4. **System**: Validates Nuclei format.
5. **System**: Creates scan record and imports findings.
6. **System**: Shows import statistics.

## 6. Authentication Workflow

### Initial Setup
1. **Admin**: Generates a bcrypt hash of their chosen password.
2. **Admin**: Sets `ADMIN_PASSWORD_HASH` and `AUTH_SECRET` in `.env.local`.
3. **Admin**: Restarts the dashboard server.

### User Interaction
1. **User**: Accesses the dashboard URL.
2. **System**: Middleware detects no session and redirects to `/login`.
3. **User**: Enters password on the login page.
4. **System**: Validates password hash and creates a secure session.
5. **User**: Accesses protected dashboard features.
6. **User**: Clicks "Log Out" to terminate the session.
