#!/usr/bin/env node

/**
 * Build Verification Script
 * Validates that all modernization changes are ready for deployment
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 Nuclei Command Center - Build Verification\n');

const checks = [
    {
        name: 'Database Pagination Functions',
        file: 'lib/db.ts',
        pattern: /getFindingsPaginated|getFindingsTotalCount/,
        critical: true
    },
    {
        name: 'API Pagination Support',
        file: 'app/api/findings/route.ts',
        pattern: /pagination.*page.*limit/,
        critical: true
    },
    {
        name: 'Stream-JSON Dependency',
        file: 'package.json',
        pattern: /"stream-json"/,
        critical: true
    },
    {
        name: 'Streaming JSON Parser',
        file: 'app/api/scan/route.ts',
        pattern: /StreamArray|stream-json/,
        critical: true
    },
    {
        name: 'Process Recovery Function',
        file: 'lib/db.ts',
        pattern: /recoverOrphanedScans/,
        critical: true
    },
    {
        name: 'Docker Configuration',
        file: 'Dockerfile',
        pattern: /FROM.*alpine/,
        critical: true
    },
    {
        name: 'Docker Compose',
        file: 'docker-compose.yml',
        pattern: /nuclei-dashboard/,
        critical: false
    },
    {
        name: 'Linux Path Configuration',
        file: 'lib/nuclei/config.ts',
        pattern: /IS_DOCKER|DOCKER_ENV/,
        critical: true
    }
];

let passed = 0;
let failed = 0;

checks.forEach(check => {
    const filePath = path.join(__dirname, check.file);
    
    try {
        if (!fs.existsSync(filePath)) {
            console.log(`❌ ${check.name}: File not found (${check.file})`);
            if (check.critical) failed++;
            return;
        }
        
        const content = fs.readFileSync(filePath, 'utf-8');
        
        if (check.pattern.test(content)) {
            console.log(`✅ ${check.name}`);
            passed++;
        } else {
            console.log(`❌ ${check.name}: Pattern not found`);
            if (check.critical) failed++;
        }
    } catch (err) {
        console.log(`⚠️  ${check.name}: Error reading file - ${err.message}`);
        if (check.critical) failed++;
    }
});

console.log(`\n📊 Results: ${passed}/${checks.length} checks passed`);

if (failed > 0) {
    console.log(`\n❌ ${failed} critical check(s) failed. Fix before deploying.`);
    process.exit(1);
} else {
    console.log('\n✅ All critical checks passed! Ready for deployment.');
    console.log('\n📝 Next steps:');
    console.log('   1. npm run build (test build)');
    console.log('   2. docker build -t nuclei-dashboard:latest .');
    console.log('   3. docker-compose up -d');
    process.exit(0);
}
