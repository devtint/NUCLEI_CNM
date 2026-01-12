# System Environment & Configuration

This module details the specific environment configuration, paths, and versioning required for the Nuclei Dashboard integration.

## Nuclei Engine Stats

### Version Control
- **Current Version**: `v3.6.0`
- **Installation Source**: Go (Golang)
- **Install Command**: 
  ```powershell
  go install -v github.com/projectdiscovery/nuclei/v3/cmd/nuclei@latest
  ```

## File System Architecture

The dashboard must interact with the following directory structures. Ensure the backend has permissions to read/write to these locations.

### 1. Configuration Directory
- **Path**: `C:\Users\name\AppData\Roaming\nuclei`
- **Purpose**: Contains the main `config.yaml`, reporting configurations, and other global settings.
- **Usage**: Read this to pre-fill settings in the dashboard.

### 2. Cache Directory
- **Path**: `C:\Users\name\AppData\Local\nuclei`
- **Purpose**: Stores temporary data, update caches, and other transient files.
- **Usage**: Useful for debugging or clearing state.

### 3. ProjectDiscovery Cloud Platform (PDCP)
- **Path**: `C:\Users\name\.pdcp`
- **Purpose**: Stores API keys and authentication tokens for the Cloud Platform.
- **Usage**: Required for cloud integrations if implemented.

### 4. Templates Directory
- **Location**: *Managed via Nuclei Config*
- **Default**: Usually in `C:\Users\name\nuclei-templates` or within the AppData structure depending on install method.
- **Command to Verify**: `nuclei -version` (Outputs the paths as seen in logs).

---

## Dashboard Configuration (.env.local)

The dashboard requires sensitive environment variables for security. These should be placed in `dashboard/.env.local`.

### 1. ADMIN_PASSWORD_HASH
- **Purpose**: Bcrypt hash of the admin password.
- **Example**: `$2b$10$...`

### 2. AUTH_SECRET
- **Purpose**: Random string for signing session tokens.
- **Generate**: `openssl rand -base64 32`

---

## Security Configuration

### Middleware (proxy.ts)
- Handles authentication redirects.
- Enforces HTTPS in production environment.
- Configured via `matcher` in `proxy.ts`.
