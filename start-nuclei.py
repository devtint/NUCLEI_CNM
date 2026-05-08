#!/usr/bin/env python3
"""
Nuclei Command Center - Auto Start Script
This script automates the startup process and opens the Cloudflare tunnel URL
Works on: Windows, Linux, macOS

Usage:
    python start-nuclei.py              # Normal startup
    python start-nuclei.py --dry-run    # Preview without starting
    python start-nuclei.py --stop       # Stop containers
    python start-nuclei.py --down       # Stop and remove containers
    python start-nuclei.py --status     # Show current status
    python start-nuclei.py --version    # Show version
    
For Windows users without Python:
    Create a start-nuclei.bat file with: python start-nuclei.py
"""

import subprocess
import re
import time
import platform
import sys
import os
import urllib.request
import urllib.error
from pathlib import Path

# Script Version (independent from Docker image version)
VERSION = "2.0.0"

# Configuration
GITHUB_COMPOSE_URL = "https://raw.githubusercontent.com/devtint/NUCLEI_CNM/main/docker-compose.yml"
GITHUB_SCRIPT_URL = "https://raw.githubusercontent.com/devtint/NUCLEI_CNM/main/start-nuclei.py"
HEALTH_CHECK_URL = "http://localhost:3000/login"
MAX_TUNNEL_WAIT = 30  # seconds
MAX_HEALTH_WAIT = 60  # seconds
MAX_LOG_SIZE = 5 * 1024 * 1024  # 5MB

# Default resource limits (can be changed interactively)
DEFAULT_CPU_LIMIT = "2.0"
DEFAULT_MEM_LIMIT = "2G"

# Logging
LOG_DIR = os.path.join(os.path.expanduser("~"), ".nuclei-cnm")
LOG_FILE = os.path.join(LOG_DIR, "start.log")

# Preset resource profiles
RESOURCE_PROFILES = {
    "1": {"name": "Light (1 CPU / 1GB)",   "cpu": "1.0", "mem": "1G"},
    "2": {"name": "Normal (2 CPU / 2GB)",   "cpu": "2.0", "mem": "2G"},
    "3": {"name": "Heavy (3 CPU / 4GB)",    "cpu": "3.0", "mem": "4G"},
    "4": {"name": "Max (4 CPU / 6GB)",      "cpu": "4.0", "mem": "6G"},
}

# ANSI color codes
class Colors:
    CYAN = '\033[0;36m'
    GREEN = '\033[0;32m'
    YELLOW = '\033[0;33m'
    RED = '\033[0;31m'
    GRAY = '\033[0;90m'
    BOLD = '\033[1m'
    RESET = '\033[0m'
    
    @staticmethod
    def supports_color():
        """Check if terminal supports colors"""
        if platform.system() == 'Windows':
            # Windows Terminal, PowerShell 7+, or ANSICON enabled
            return 'WT_SESSION' in os.environ or 'ANSICON' in os.environ or os.environ.get('TERM_PROGRAM') == 'vscode'
        return True

def icon(emoji, fallback='*'):
    """Return emoji or fallback for terminals that don't support Unicode"""
    if platform.system() == 'Windows' and 'WT_SESSION' not in os.environ:
        return fallback
    return emoji

def print_colored(text, color=''):
    """Print colored text if supported, otherwise plain text"""
    write_log(text)
    if Colors.supports_color():
        print(f"{color}{text}{Colors.RESET}")
    else:
        print(text)

def rotate_log():
    """Rotate log file if it exceeds MAX_LOG_SIZE"""
    try:
        if os.path.exists(LOG_FILE) and os.path.getsize(LOG_FILE) > MAX_LOG_SIZE:
            old_log = LOG_FILE + ".old"
            if os.path.exists(old_log):
                os.remove(old_log)
            os.rename(LOG_FILE, old_log)
    except Exception:
        pass

def write_log(text):
    """Write log text to file (best-effort)"""
    try:
        if not os.path.exists(LOG_DIR):
            os.makedirs(LOG_DIR, exist_ok=True)
        timestamp = time.strftime("%Y-%m-%d %H:%M:%S")
        with open(LOG_FILE, "a", encoding="utf-8") as f:
            f.write(f"[{timestamp}] {text}\n")
    except Exception:
        # Logging should never block startup
        pass

def print_header():
    """Print stylish header"""
    print()
    print_colored("=" * 60, Colors.CYAN)
    print_colored(f"  {icon('🐳')} NUCLEI COMMAND CENTER - Auto Start Script", Colors.BOLD)
    print_colored("=" * 60, Colors.CYAN)
    print()

def run_command(cmd, capture_output=False, silent=False, timeout=None):
    """Run a command and return subprocess.CompletedProcess or None"""
    try:
        if capture_output:
            return subprocess.run(cmd, shell=True, capture_output=True, text=True, timeout=timeout)
        else:
            if silent:
                return subprocess.run(cmd, shell=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=timeout)
            else:
                return subprocess.run(cmd, shell=True, timeout=timeout)
    except Exception as e:
        print_colored(f"Error running command: {e}", Colors.RED)
        return None

def run_with_retries(cmd, attempts=3, delay=2):
    """Run a command with retry and basic backoff"""
    for attempt in range(1, attempts + 1):
        result = run_command(cmd)
        if result and result.returncode == 0:
            return True
        if attempt < attempts:
            print_colored(f"   Retrying ({attempt}/{attempts})...", Colors.YELLOW)
            time.sleep(delay * attempt)
    return False

def get_compose_command():
    """Detect docker compose v2 or v1 command"""
    v2 = run_command("docker compose version", capture_output=True)
    if v2 and v2.returncode == 0:
        return "docker compose"
    v1 = run_command("docker-compose version", capture_output=True)
    if v1 and v1.returncode == 0:
        return "docker-compose"
    return None

def validate_cpu(value):
    return re.fullmatch(r"\d+(\.\d+)?", value or "") is not None

def validate_mem(value):
    return re.fullmatch(r"\d+(M|G|MB|GB)", value or "", re.IGNORECASE) is not None

def check_docker():
    """Verify Docker is running"""
    print_colored(f"{icon('🔍')} Checking Docker status...", Colors.CYAN)
    try:
        result = subprocess.run('docker info', shell=True, capture_output=True, text=True, timeout=5)
        # Check if command succeeded and contains server information
        if result.returncode == 0 and 'Server' in result.stdout:
            print_colored(f"   {icon('✓', '+')} Docker is running", Colors.GREEN)
            return True
        else:
            print_colored(f"   {icon('✗', 'X')} Docker is not running!", Colors.RED)
            print_colored("   Please start Docker Desktop and try again.", Colors.YELLOW)
            if platform.system() == 'Windows':
                print_colored("   Hint: Launch Docker Desktop from Start Menu", Colors.GRAY)
            return False
    except subprocess.TimeoutExpired:
        print_colored(f"   {icon('✗', 'X')} Docker command timed out!", Colors.RED)
        print_colored("   Docker may be starting or not responding.", Colors.YELLOW)
        return False
    except Exception as e:
        print_colored(f"   {icon('✗', 'X')} Error checking Docker: {e}", Colors.RED)
        print_colored("   Please ensure Docker is installed and running.", Colors.YELLOW)
        return False

def check_compose_file():
    """Check if docker-compose.yml exists"""
    if not os.path.exists('docker-compose.yml'):
        print_colored(f"\n{icon('⚠️', '!')} docker-compose.yml not found!", Colors.YELLOW)
        print_colored("   Downloading from GitHub...", Colors.GRAY)
        return download_docker_compose()
    return True

def copy_to_clipboard(text):
    """Copy text to clipboard (cross-platform)"""
    try:
        system = platform.system()
        if system == 'Windows':
            # Use PowerShell for better Unicode support
            subprocess.run(['powershell', '-NoProfile', '-Command', 'Set-Clipboard', '-Value', text],
                         capture_output=True, check=True)
        elif system == 'Darwin':  # macOS
            subprocess.run(['pbcopy'], input=text.encode('utf-8'), check=True)
        elif system == 'Linux':
            # Try xclip first, then xsel
            try:
                subprocess.run(['xclip', '-selection', 'clipboard'], 
                             input=text.encode('utf-8'), check=True)
            except FileNotFoundError:
                try:
                    subprocess.run(['xsel', '--clipboard'], 
                                 input=text.encode('utf-8'), check=True)
                except FileNotFoundError:
                    return False
        return True
    except Exception:
        return False

def extract_cloudflare_url(compose_cmd):
    """Extract Cloudflare URL from logs and wait for tunnel to be ready"""
    url_pattern = r'https://[a-zA-Z0-9-]+\.trycloudflare\.com'
    tunnel_ready_pattern = r'Registered tunnel connection|Connection registered'
    
    cloudflare_url = None
    tunnel_ready = False
    
    for attempt in range(MAX_TUNNEL_WAIT):
        logs = run_command(f"{compose_cmd} logs cloudflared 2>&1", capture_output=True)
        if logs and logs.stdout:
            # First find the URL
            if not cloudflare_url:
                matches = re.findall(url_pattern, logs.stdout)
                for match in matches:
                    if match != "https://api.trycloudflare.com":
                        cloudflare_url = match
                        print_colored(f"   Found URL: {cloudflare_url}", Colors.GRAY)
                        break
            
            # Then wait for tunnel to be registered
            if cloudflare_url and not tunnel_ready:
                if re.search(tunnel_ready_pattern, logs.stdout):
                    tunnel_ready = True
                    print_colored(f"   {icon('✓', '+')} Tunnel connected!", Colors.GRAY)
                    time.sleep(2)
                    return cloudflare_url
        
        # Progress indicator
        sys.stdout.write('.')
        sys.stdout.flush()
        time.sleep(1)
    
    print()  # New line after dots
    return cloudflare_url

def wait_for_health():
    """Wait for the application to be healthy"""
    print_colored(f"\n{icon('🏥')} Waiting for application health check...", Colors.CYAN)
    
    for attempt in range(MAX_HEALTH_WAIT):
        try:
            req = urllib.request.Request(HEALTH_CHECK_URL, method='HEAD')
            req.add_header('User-Agent', 'NucleiCNM-StartupCheck/1.0')
            response = urllib.request.urlopen(req, timeout=5)
            if response.status in [200, 302, 301]:
                print_colored(f"   {icon('✓', '+')} Application is healthy!", Colors.GREEN)
                return True
        except (urllib.error.URLError, urllib.error.HTTPError, TimeoutError):
            pass
        
        # Progress indicator
        if attempt % 5 == 0 and attempt > 0:
            print_colored(f"   Still waiting... ({attempt}s)", Colors.GRAY)
        time.sleep(1)
    
    print_colored(f"   {icon('⚠️', '!')} Health check timed out (app may still be starting)", Colors.YELLOW)
    return False

def download_docker_compose():
    """Download latest docker-compose.yml from GitHub"""
    try:
        print_colored(f"{icon('📡')} Downloading docker-compose.yml from GitHub...", Colors.CYAN)
        urllib.request.urlretrieve(GITHUB_COMPOSE_URL, 'docker-compose.yml')
        print_colored(f"   {icon('✓', '+')} Download complete!", Colors.GREEN)
        return True
    except Exception as e:
        print_colored(f"   {icon('✗', 'X')} Download failed: {e}", Colors.RED)
        return False

def prompt_update_choice():
    """Ask user if they want to update docker-compose.yml"""
    print("Choose startup mode:\n")
    print(f"  1. {icon('🚀')} Quick Start (use local docker-compose.yml)")
    print(f"  2. {icon('📥')} Update First (download latest from GitHub)")
    print()
    
    try:
        choice = input("Enter choice [1/2] (default: 1): ").strip()
        return choice == '2'
    except (KeyboardInterrupt, EOFError):
        print()
        return False

def prompt_permissions_choice():
    """Ask user if they want to automatically fix permissions"""
    print_colored(f"\n{icon('🔧')} Permissions Check", Colors.CYAN)
    print("If this is your first run, you might see 'no templates provided' errors.")
    print("This script can fix folder permissions automatically.")
    print()
    
    try:
        choice = input("Run permission fix? [Y/n] (default: Y): ").strip().lower()
        print()
        return choice != 'n'
    except (KeyboardInterrupt, EOFError):
        print()
        return False

def confirm_action(prompt):
    """Ask for a Y/n confirmation, default is Yes on Enter"""
    suffix = "[Y/n] (Enter = Y)"
    while True:
        try:
            choice = input(f"{prompt} {suffix} ").strip().lower()
        except (KeyboardInterrupt, EOFError):
            print()
            return False

        if choice == "":
            return True
        if choice in ("y", "yes"):
            return True
        if choice in ("n", "no"):
            return False
        print_colored("   Please enter Y or N (Enter = default)", Colors.YELLOW)

def prompt_resource_choice():
    """Ask user to choose resource limits for the scanner container"""
    print_colored(f"\n{icon('⚙️')} Resource Allocation", Colors.CYAN)
    print_colored("  How much CPU/RAM should the scanner use?", Colors.GRAY)
    print_colored("  (Your data is safe — only container resources change)\n", Colors.GRAY)
    
    for key, profile in RESOURCE_PROFILES.items():
        marker = " (default)" if key == "2" else ""
        print(f"  {key}. {icon('📦')} {profile['name']}{marker}")
    print(f"  5. {icon('✏️')}  Custom (enter your own values)")
    print()
    
    try:
        choice = input("Enter choice [1-5] (default: 2): ").strip()
        
        if choice in RESOURCE_PROFILES:
            p = RESOURCE_PROFILES[choice]
            print_colored(f"   {icon('✓', '+')} Selected: {p['name']}", Colors.GREEN)
            return p['cpu'], p['mem']
        elif choice == '5':
            while True:
                cpu = input(f"  CPU cores (e.g. 2.0, default {DEFAULT_CPU_LIMIT}): ").strip() or DEFAULT_CPU_LIMIT
                if validate_cpu(cpu):
                    break
                print_colored("   Invalid CPU value. Example: 2.0", Colors.YELLOW)
            while True:
                mem = input(f"  Memory (e.g. 2G, 4G, default {DEFAULT_MEM_LIMIT}): ").strip() or DEFAULT_MEM_LIMIT
                if validate_mem(mem):
                    break
                print_colored("   Invalid memory value. Example: 2G", Colors.YELLOW)
            print_colored(f"   {icon('✓', '+')} Custom: {cpu} CPU, {mem} RAM", Colors.GREEN)
            return cpu, mem
        else:
            # Default: Normal
            print_colored(f"   {icon('✓', '+')} Using default: 2 CPU, 2G RAM", Colors.GREEN)
            return DEFAULT_CPU_LIMIT, DEFAULT_MEM_LIMIT
    except (KeyboardInterrupt, EOFError):
        print()
        return DEFAULT_CPU_LIMIT, DEFAULT_MEM_LIMIT

def check_permissions_needed():
    """Check if permission fix is actually needed"""
    # Check ownership of templates directory inside container
    cmd = "docker exec nuclei-command-center stat -c '%U' /home/nextjs/nuclei-templates"
    owner = run_command(cmd, capture_output=True)
    
    # If owner is 'root', we need to fix it (should be 'nextjs')
    if owner and owner.stdout and 'root' in owner.stdout:
        return True
    return False

def show_status():
    """Show current container status, uptime, and Cloudflare URL"""
    print_header()
    print_colored(f"  Version: {VERSION}\n", Colors.GRAY)
    
    compose_cmd = get_compose_command()
    if not compose_cmd:
        print_colored(f"  {icon('✗', 'X')} Docker Compose not available", Colors.RED)
        return
    
    # Container status
    print_colored(f"{icon('📊')} Container Status:", Colors.CYAN)
    result = run_command(f"{compose_cmd} ps", capture_output=True)
    if result and result.stdout:
        print(result.stdout)
    else:
        print_colored("   No containers running.\n", Colors.YELLOW)
        return
    
    # Health check
    print_colored(f"{icon('🏥')} Health Check:", Colors.CYAN)
    try:
        req = urllib.request.Request(HEALTH_CHECK_URL, method='HEAD')
        req.add_header('User-Agent', 'NucleiCNM-StatusCheck/1.0')
        response = urllib.request.urlopen(req, timeout=5)
        if response.status in [200, 302, 301]:
            print_colored(f"   {icon('✓', '+')} Application is healthy (HTTP {response.status})", Colors.GREEN)
    except Exception:
        print_colored(f"   {icon('✗', 'X')} Application is not responding", Colors.RED)
    
    # Cloudflare URL
    print_colored(f"\n{icon('🌐')} Cloudflare Tunnel:", Colors.CYAN)
    url_pattern = r'https://[a-zA-Z0-9-]+\.trycloudflare\.com'
    logs = run_command(f"{compose_cmd} logs cloudflared 2>&1", capture_output=True)
    if logs and logs.stdout:
        matches = re.findall(url_pattern, logs.stdout)
        found_url = None
        for match in matches:
            if match != "https://api.trycloudflare.com":
                found_url = match
                break
        if found_url:
            print_colored(f"   {icon('✓', '+')} {found_url}", Colors.GREEN)
            if copy_to_clipboard(found_url):
                print_colored(f"   {icon('📋')} Copied to clipboard!", Colors.GREEN)
        else:
            print_colored(f"   {icon('✗', 'X')} No tunnel URL detected", Colors.YELLOW)
    else:
        print_colored(f"   {icon('✗', 'X')} Cloudflared container not running", Colors.YELLOW)
    
    # Resource usage
    print_colored(f"\n{icon('💻')} Resource Usage:", Colors.CYAN)
    stats = run_command("docker stats --no-stream --format \"   {{.Name}}: CPU {{.CPUPerc}} | MEM {{.MemUsage}}\" nuclei-command-center nuclei-cnm-tunnel", capture_output=True)
    if stats and stats.stdout:
        print(stats.stdout)
    
    print()


def parse_version(version_str):
    """Parse a version string like '1.8.3' into a tuple of ints for comparison"""
    try:
        return tuple(int(x) for x in version_str.strip().split('.'))
    except (ValueError, AttributeError):
        return (0, 0, 0)


def check_for_update():
    """Check GitHub for a newer version of this script and offer to update"""
    try:
        req = urllib.request.Request(GITHUB_SCRIPT_URL)
        req.add_header('User-Agent', 'NucleiCNM-UpdateCheck/1.0')
        response = urllib.request.urlopen(req, timeout=5)
        remote_content = response.read().decode('utf-8')
        
        # Extract VERSION from remote script
        match = re.search(r'^VERSION\s*=\s*["\']([\d.]+)["\']', remote_content, re.MULTILINE)
        if not match:
            return  # Can't determine remote version, skip silently
        
        remote_version = match.group(1)
        
        if parse_version(remote_version) <= parse_version(VERSION):
            print_colored(f"  {icon('✓', '+')} Script is up to date (v{VERSION})", Colors.GREEN)
            return
        
        # Newer version available!
        print_colored(f"\n  {icon('🆕')} Update available: v{VERSION} → v{remote_version}", Colors.YELLOW)
        
        try:
            choice = input(f"  Update now? [Y/n] (Enter = Y): ").strip().lower()
        except (KeyboardInterrupt, EOFError):
            print()
            return
        
        if choice in ('', 'y', 'yes'):
            script_path = os.path.abspath(__file__)
            backup_path = script_path + ".backup"
            
            try:
                # Backup current script
                if os.path.exists(backup_path):
                    os.remove(backup_path)
                os.rename(script_path, backup_path)
                
                # Write new version
                with open(script_path, 'w', encoding='utf-8') as f:
                    f.write(remote_content)
                
                print_colored(f"  {icon('✓', '+')} Updated to v{remote_version}!", Colors.GREEN)
                print_colored(f"  {icon('💾')} Backup saved: {os.path.basename(backup_path)}", Colors.GRAY)
                print_colored(f"  {icon('🔄')} Please re-run the script to use the new version.\n", Colors.CYAN)
                sys.exit(0)
            except Exception as e:
                # Restore backup if update failed
                if os.path.exists(backup_path) and not os.path.exists(script_path):
                    os.rename(backup_path, script_path)
                print_colored(f"  {icon('✗', 'X')} Update failed: {e}", Colors.RED)
                print_colored(f"  Continuing with current version...\n", Colors.GRAY)
        else:
            print_colored(f"  {icon('ℹ', 'i')} Skipping update\n", Colors.GRAY)
    
    except (urllib.error.URLError, TimeoutError):
        # Network error — skip silently, don't block startup
        pass
    except Exception:
        # Any other error — skip silently
        pass
def main():
    """Main execution flow"""
    # Handle simple flags first
    if "--version" in sys.argv:
        print(f"Nuclei CNM Start Script v{VERSION}")
        sys.exit(0)
    
    if "--status" in sys.argv:
        show_status()
        sys.exit(0)
    
    dry_run = "--dry-run" in sys.argv
    stop_only = "--stop" in sys.argv
    down_only = "--down" in sys.argv

    # Change to script directory
    script_dir = Path(__file__).parent
    if script_dir.exists():
        os.chdir(script_dir)
    
    print_header()
    print_colored(f"  v{VERSION}", Colors.GRAY)
    print_colored(f"{icon('📝', '-')} Log file: {LOG_FILE}", Colors.GRAY)
    
    # Rotate log if needed
    rotate_log()
    
    # Check for script updates (non-blocking)
    check_for_update()
    
    # Pre-flight checks
    print_colored("\nStep 1/6: Docker checks", Colors.CYAN)
    if not check_docker():
        sys.exit(1)
    
    if not check_compose_file():
        print_colored(f"\n{icon('✗', 'X')} Cannot proceed without docker-compose.yml", Colors.RED)
        sys.exit(1)

    compose_cmd = get_compose_command()
    if not compose_cmd:
        print_colored(f"\n{icon('✗', 'X')} Docker Compose not available", Colors.RED)
        print_colored("   Please install Docker Compose v2 or v1 and try again.", Colors.YELLOW)
        sys.exit(1)

    if down_only:
        print_colored(f"\n{icon('🧹')} Stopping and removing containers...", Colors.CYAN)
        run_command(f"{compose_cmd} down")
        return

    if stop_only:
        print_colored(f"\n{icon('⏹️', '[]')} Stopping containers...", Colors.CYAN)
        run_command(f"{compose_cmd} stop")
        return
    
    # Ask user about updating
    print()
    if prompt_update_choice():
        download_docker_compose()
        time.sleep(1)
    
    print_colored("\nStep 2/6: Resource selection", Colors.CYAN)
    # Ask user about resource limits
    cpu_limit, mem_limit = prompt_resource_choice()
    os.environ['CNM_CPU_LIMIT'] = cpu_limit
    os.environ['CNM_MEM_LIMIT'] = mem_limit

    if dry_run:
        print_colored(f"\n{icon('🧪')} Dry run enabled. Skipping container operations.", Colors.YELLOW)
        return
    
    print_colored("\nStep 3/6: Container cleanup", Colors.CYAN)
    if confirm_action("Stop existing containers?"):
        print_colored(f"{icon('🔄')} Stopping existing containers...", Colors.CYAN)
        run_command(f"{compose_cmd} down", silent=True)
        time.sleep(2)
    else:
        print_colored(f"{icon('ℹ', 'i')} Skipping container stop", Colors.GRAY)
    
    print_colored("\nStep 4/6: Image update", Colors.CYAN)
    if confirm_action("Pull latest images?"):
        print_colored(f"{icon('📥')} Pulling latest images...", Colors.CYAN)
        if not run_with_retries(f"{compose_cmd} pull"):
            print_colored(f"   {icon('✗', 'X')} Failed to pull images after retries", Colors.RED)
            print_colored("   Hint: Check your network and Docker login status.", Colors.YELLOW)
            sys.exit(1)
    else:
        print_colored(f"{icon('ℹ', 'i')} Skipping image pull", Colors.GRAY)
    
    print_colored("\nStep 5/6: Start containers", Colors.CYAN)
    print_colored(f"{icon('🚀')} Starting containers (CPU: {cpu_limit}, RAM: {mem_limit})...", Colors.CYAN)
    run_command(f"{compose_cmd} up -d")
    time.sleep(3)
    
    # Smart Permission Fix
    print_colored(f"\n{icon('🔍')} Checking file permissions...", Colors.CYAN)
    
    if check_permissions_needed():
        print_colored(f"   {icon('⚠️', '!')} Detected incorrectly owned files (root)", Colors.YELLOW)
        
        # Interactive prompt for fix
        if prompt_permissions_choice():
            print_colored(f"{icon('🔧')} Enforcing Correct Permissions...", Colors.CYAN)
            fix_cmd = "docker exec -u 0 nuclei-command-center chown -R nextjs:nodejs /home/nextjs/nuclei-templates /home/nextjs/nuclei-custom-templates"
            run_command(fix_cmd, silent=True)
            print_colored(f"   {icon('✓', '+')} Permissions fixed", Colors.GREEN)
        else:
            print_colored(f"   {icon('ℹ', 'i')} Skipping permission fix", Colors.GRAY)
    else:
        print_colored(f"   {icon('✓', '+')} Permissions are correct (owned by nextjs)", Colors.GREEN)
    
    print_colored("\nStep 6/6: Health + tunnel", Colors.CYAN)
    # Wait for health
    wait_for_health()
    
    # Get Cloudflare URL
    print_colored(f"\n{icon('🔍')} Capturing Cloudflare tunnel URL...", Colors.CYAN)
    time.sleep(5)
    cloudflare_url = extract_cloudflare_url(compose_cmd)
    
    # Final output
    print()
    print_colored("=" * 60, Colors.GREEN)
    
    if cloudflare_url:
        print_colored(f"  {icon('✅')} SUCCESS! Nuclei Command Center is running", Colors.GREEN)
        print_colored("=" * 60, Colors.GREEN)
        print()
        print_colored(f"  {icon('🌐')} Cloudflare URL:", Colors.CYAN)
        print_colored(f"     {cloudflare_url}", Colors.BOLD)
        print()
        print_colored(f"  {icon('🏠')} Local URL:", Colors.CYAN)
        print_colored(f"     http://localhost:3000", Colors.BOLD)
        print()
        
        # Copy to clipboard
        if copy_to_clipboard(cloudflare_url):
            print_colored(f"  {icon('📋')} Cloudflare URL copied to clipboard!", Colors.GREEN)
        
        print()
        print_colored(f"  {icon('💡')} Tip: Run '{compose_cmd} logs -f' to view logs", Colors.GRAY)
    else:
        print_colored(f"  {icon('⚠️')} Started, but Cloudflare URL not detected", Colors.YELLOW)
        print_colored("=" * 60, Colors.YELLOW)
        print()
        print_colored(f"  {icon('🏠')} Local URL: http://localhost:3000", Colors.CYAN)
        print()
        print_colored(f"  {icon('💡')} Run '{compose_cmd} logs cloudflared' to find the URL", Colors.GRAY)
        print_colored("  Hint: Look for a https://<id>.trycloudflare.com URL in the logs.", Colors.GRAY)
    
    print()

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print_colored(f"\n\n{icon('👋')} Cancelled by user.", Colors.YELLOW)
        sys.exit(0)
