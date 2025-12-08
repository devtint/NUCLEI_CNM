# Dashboard Features & Requirements

This document outlines the functional requirements, core features, and architectural goals for the Nuclei Dashboard.

## Core Objectives

### 1. Visual Identity
- **Goal**: Clone the style and aesthetic of the official Nuclei Cloud Dashboard.
- **Reference**: [https://cloud.projectdiscovery.io/](https://cloud.projectdiscovery.io/)
- **Requirement**: "Make detailed perfect big documents" -> High fidelity UI/UX.

### 2. Data Persistence Model
- **Scan Storage**:
  - **Strategy**: One JSON file per scan.
  - **Content**: Each file must contain **ALL** findings from that scan session.
  - **Avoid**: Do NOT split findings into individual files per finding.
- **Structure**: `scans/{scan_id}_{timestamp}.json` (implied structure).

### 3. Functional Modules

#### A. Dashboard Overview
- **Purpose**: Bird's-eye view of security posture.
- **Metrics**: Total scans, recent critical findings, system status.

#### B. Vulnerability Management
- **Purpose**: Deep dive into specific findings.
- **Actions**:
  - View details.
  - Trigger **Rescan** (See `03_Usage_Workflows`).
  - Mark as False Positive (implied standard feature).

#### C. Scans Management
- **Purpose**: History and Control.
- **Capabilities**:
  - List past scans.
  - View status (Running/Completed).
  - Download/Export results.

#### D. Reporting & Exports
- **Format**: SV (Separated Values - CSV/TSV).
- **Key Feature**: **Colorized Output** in the export files (where supported).
- **Filtering Logic**:
  - Export **All**
  - Export by Severity: **Critical**, **High**, **Medium**, **Low**, **Info**.

### 4. Extra Features (Prioritized)
- **Custom Templates**: UI to create, edit, and upload new templates (`.yaml`).
- **Custom Commands**: UI to build, save, and execute complex Nuclei CLI strings as reusable "One-Click" actions.

### 5. Non-Essential Features (Deprioritized)
*The following features from the official dashboard were explicitly marked as NOT needed for the MVP:*
- **Template Inventory**: Global search/filtering of all available templates.
- **Asset Groups**: Complex asset management and IP range monitoring.

## Focus Areas
1. **Analysing Official Cmds**: Deep analysis of `nuclei -u` usage.
2. **Local Integration**: Using the paths defined in `01_System_Configuration`.
3. **Cloud Usage**: Utilizing PDCP login for learning/template fetching only.
