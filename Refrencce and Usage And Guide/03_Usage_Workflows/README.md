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
