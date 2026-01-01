#!/usr/bin/env node

/**
 * First-Time Docker Setup Helper
 * Generates .env file and validates prerequisites
 */

const crypto = require('crypto');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

function question(query) {
    return new Promise(resolve => rl.question(query, resolve));
}

async function main() {
    console.log('🚀 Nuclei Command Center - Docker Setup\n');

    // Check Docker
    try {
        execSync('docker --version', { stdio: 'ignore' });
        console.log('✅ Docker installed');
    } catch {
        console.log('❌ Docker not found. Install: https://docs.docker.com/get-docker/');
        process.exit(1);
    }

    // Check Docker Compose
    try {
        execSync('docker-compose --version', { stdio: 'ignore' });
        console.log('✅ Docker Compose installed\n');
    } catch {
        console.log('⚠️  Docker Compose not found (optional)\n');
    }

    // Generate AUTH_SECRET
    const authSecret = crypto.randomBytes(32).toString('base64');
    console.log('🔑 Generated AUTH_SECRET');

    // Get password
    const password = await question('Enter admin password (min 8 chars): ');
    
    if (password.length < 8) {
        console.log('❌ Password too short. Must be at least 8 characters.');
        rl.close();
        process.exit(1);
    }

    // Hash password
    const bcrypt = require('bcrypt');
    const passwordHash = await bcrypt.hash(password, 10);
    console.log('🔒 Password hashed\n');

    // Create .env file
    const envContent = `# Nuclei Command Center - Environment Variables
# Generated: ${new Date().toISOString()}

# NextAuth.js Secret (DO NOT SHARE)
AUTH_SECRET=${authSecret}

# Admin Password Hash
ADMIN_PASSWORD_HASH=${passwordHash}

# Docker Environment
DOCKER_ENV=true
NODE_ENV=production
PORT=3000
`;

    fs.writeFileSync('.env', envContent);
    console.log('✅ Created .env file\n');

    // Summary
    console.log('📋 Setup Complete!\n');
    console.log('Next steps:');
    console.log('  1. docker-compose up -d');
    console.log('  2. docker logs -f nuclei-command-center');
    console.log('  3. Open http://localhost:3000\n');
    console.log('Login credentials:');
    console.log(`  Username: admin`);
    console.log(`  Password: ${password}\n`);
    console.log('⚠️  Save your password - it cannot be recovered!\n');

    rl.close();
}

main().catch(err => {
    console.error('❌ Setup failed:', err.message);
    process.exit(1);
});
