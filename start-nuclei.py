#!/usr/bin/env python3
"""
Nuclei Command Center - Auto Start Script
This script automates the startup process and opens the Cloudflare tunnel URL
Works on: Windows, Linux, macOS

Usage:
    python start-nuclei.py
    
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

# Configuration
GITHUB_COMPOSE_URL = "https://raw.githubusercontent.com/devtint/NUCLEI_CNM/main/docker-compose.yml"
HEALTH_CHECK_URL = "http://localhost:3000/login"
MAX_TUNNEL_WAIT = 30  # seconds
MAX_HEALTH_WAIT = 60  # seconds

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
    if Colors.supports_color():
        print(f"{color}{text}{Colors.RESET}")
    else:
        print(text)

def print_header():
    """Print stylish header"""
    print()
    print_colored("=" * 60, Colors.CYAN)
    print_colored(f"  {icon('🐳')} NUCLEI COMMAND CENTER - Auto Start Script", Colors.BOLD)
    print_colored("=" * 60, Colors.CYAN)
    print()

def run_command(cmd, capture_output=False, silent=False):
    """Run a docker compose command"""
    try:
        if capture_output:
            result = subprocess.run(cmd, shell=True, capture_output=True, text=True)
            return result.stdout + result.stderr
        else:
            if silent:
                subprocess.run(cmd, shell=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            else:
                subprocess.run(cmd, shell=True)
            return None
    except Exception as e:
        print_colored(f"Error running command: {e}", Colors.RED)
        return None

def check_docker():
    """Verify Docker is running"""
    print_colored(f"{icon('🔍')} Checking Docker status...", Colors.CYAN)
    result = run_command('docker info', capture_output=True)
    if result and 'Server:' in result:
        print_colored(f"   {icon('✓', '+')} Docker is running", Colors.GREEN)
        return True
    else:
        print_colored(f"   {icon('✗', 'X')} Docker is not running!", Colors.RED)
        print_colored("   Please start Docker Desktop and try again.", Colors.YELLOW)
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
            subprocess.run(['powershell', '-command', f'Set-Clipboard -Value "{text}"'], 
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

def extract_cloudflare_url():
    """Extract Cloudflare URL from logs and wait for tunnel to be ready"""
    url_pattern = r'https://[a-zA-Z0-9-]+\.trycloudflare\.com'
    tunnel_ready_pattern = r'Registered tunnel connection|Connection registered'
    
    cloudflare_url = None
    tunnel_ready = False
    
    for attempt in range(MAX_TUNNEL_WAIT):
        logs = run_command('docker compose logs cloudflared 2>&1', capture_output=True)
        if logs:
            # First find the URL
            if not cloudflare_url:
                match = re.search(url_pattern, logs)
                if match:
                    cloudflare_url = match.group(0)
                    print_colored(f"   Found URL: {cloudflare_url}", Colors.GRAY)
            
            # Then wait for tunnel to be registered
            if cloudflare_url and not tunnel_ready:
                if re.search(tunnel_ready_pattern, logs):
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

def main():
    """Main execution flow"""
    # Change to script directory
    script_dir = Path(__file__).parent
    if script_dir.exists():
        os.chdir(script_dir)
    
    print_header()
    
    # Pre-flight checks
    if not check_docker():
        sys.exit(1)
    
    if not check_compose_file():
        print_colored(f"\n{icon('✗', 'X')} Cannot proceed without docker-compose.yml", Colors.RED)
        sys.exit(1)
    
    # Ask user about updating
    print()
    if prompt_update_choice():
        download_docker_compose()
        time.sleep(1)
    
    # Stop existing containers
    print_colored(f"\n{icon('🔄')} Stopping existing containers...", Colors.CYAN)
    run_command('docker compose down', silent=True)
    time.sleep(2)
    
    # Pull latest images
    print_colored(f"\n{icon('📥')} Pulling latest images...", Colors.CYAN)
    run_command('docker compose pull')
    
    # Start containers
    print_colored(f"\n{icon('🚀')} Starting containers...", Colors.CYAN)
    run_command('docker compose up -d')
    time.sleep(3)
    
    # Wait for health
    wait_for_health()
    
    # Get Cloudflare URL
    print_colored(f"\n{icon('🔍')} Capturing Cloudflare tunnel URL...", Colors.CYAN)
    time.sleep(5)
    cloudflare_url = extract_cloudflare_url()
    
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
        print_colored(f"  {icon('💡')} Tip: Run 'docker compose logs -f' to view logs", Colors.GRAY)
    else:
        print_colored(f"  {icon('⚠️')} Started, but Cloudflare URL not detected", Colors.YELLOW)
        print_colored("=" * 60, Colors.YELLOW)
        print()
        print_colored(f"  {icon('🏠')} Local URL: http://localhost:3000", Colors.CYAN)
        print()
        print_colored(f"  {icon('💡')} Run 'docker compose logs cloudflared' to find the URL", Colors.GRAY)
    
    print()

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print_colored(f"\n\n{icon('👋')} Cancelled by user.", Colors.YELLOW)
        sys.exit(0)
