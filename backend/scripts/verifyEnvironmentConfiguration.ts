#!/usr/bin/env node

/**
 * Environment Configuration Verification Script
 * 
 * This script verifies that all required environment variables are properly configured
 * for the School Management System external services.
 * 
 * Usage: npm run verify:env
 */

import * as fs from 'fs';
import * as path from 'path';

// Define required environment variables
interface EnvironmentCheck {
  name: string;
  required: boolean;
  sensitive: boolean;
  description: string;
  pattern?: RegExp;
}

const ENVIRONMENT_CHECKS: EnvironmentCheck[] = [
  // External Services - Required
  {
    name: 'BREVO_API_KEY',
    required: true,
    sensitive: true,
    description: 'Brevo email service API key',
    pattern: /^xkeysib-/,
  },
  {
    name: 'BREVO_SENDER_EMAIL',
    required: true,
    sensitive: false,
    description: 'Brevo sender email address',
    pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  },
  {
    name: 'BREVO_SENDER_NAME',
    required: true,
    sensitive: false,
    description: 'Brevo sender name',
  },
  {
    name: 'UPLOADTHING_API_KEY',
    required: true,
    sensitive: true,
    description: 'UploadThing file upload service API key',
  },
  {
    name: 'DATABASE_URL',
    required: true,
    sensitive: true,
    description: 'Neon PostgreSQL database connection string',
    pattern: /^postgresql:\/\//,
  },
  // Backend Configuration - Required
  {
    name: 'NODE_ENV',
    required: true,
    sensitive: false,
    description: 'Node environment',
    pattern: /^(development|staging|production)$/,
  },
  {
    name: 'PORT',
    required: true,
    sensitive: false,
    description: 'Server port',
    pattern: /^\d+$/,
  },
  {
    name: 'JWT_SECRET',
    required: true,
    sensitive: true,
    description: 'JWT authentication secret',
  },
  {
    name: 'REFRESH_TOKEN_SECRET',
    required: true,
    sensitive: true,
    description: 'Refresh token secret',
  },
  // Optional but Recommended
  {
    name: 'LOG_LEVEL',
    required: false,
    sensitive: false,
    description: 'Logging level',
  },
  {
    name: 'CORS_ORIGIN',
    required: false,
    sensitive: false,
    description: 'CORS allowed origins',
  },
];

interface CheckResult {
  name: string;
  status: 'present' | 'missing' | 'invalid' | 'warning';
  message: string;
  sensitive: boolean;
}

const results: CheckResult[] = [];

console.log('🔍 Environment Configuration Verification\n');
console.log('=' .repeat(60));

// 1. Check if .env file exists
const envPath = path.resolve(process.cwd(), '.env');
const envExamplePath = path.resolve(process.cwd(), '.env.example');

console.log('\n📁 File Checks:\n');

if (fs.existsSync(envPath)) {
  console.log('✅ .env file exists');
  
  // Check file permissions (on Unix systems)
  try {
    const stats = fs.statSync(envPath);
    const mode = stats.mode & parseInt('777', 8);
    const modeStr = '0' + mode.toString(8);
    
    if (mode !== 0o600 && mode !== 0o644) {
      console.log(`⚠️  .env file permissions: ${modeStr} (recommended: 0600)`);
    } else {
      console.log(`✅ .env file permissions: ${modeStr}`);
    }
  } catch (e) {
    console.log('ℹ️  Could not check file permissions');
  }
} else {
  console.log('❌ .env file NOT found');
  console.log('   Create .env from .env.example and add your credentials');
}

if (fs.existsSync(envExamplePath)) {
  console.log('✅ .env.example file exists');
} else {
  console.log('❌ .env.example file NOT found');
}

// 2. Check .gitignore
const gitignorePath = path.resolve(process.cwd(), '.gitignore');
if (fs.existsSync(gitignorePath)) {
  const gitignoreContent = fs.readFileSync(gitignorePath, 'utf-8');
  if (gitignoreContent.includes('.env')) {
    console.log('✅ .env is in .gitignore (secrets protected)');
  } else {
    console.log('❌ .env is NOT in .gitignore (secrets may be exposed)');
  }
}

// 3. Check environment variables
console.log('\n🔐 Environment Variables:\n');

for (const check of ENVIRONMENT_CHECKS) {
  const value = process.env[check.name];
  
  let result: CheckResult;
  
  if (!value) {
    if (check.required) {
      result = {
        name: check.name,
        status: 'missing',
        message: 'MISSING - Required variable not set',
        sensitive: check.sensitive,
      };
    } else {
      result = {
        name: check.name,
        status: 'warning',
        message: 'Optional variable not set',
        sensitive: check.sensitive,
      };
    }
  } else if (check.pattern && !check.pattern.test(value)) {
    result = {
      name: check.name,
      status: 'invalid',
      message: `Invalid format: expected pattern ${check.pattern}`,
      sensitive: check.sensitive,
    };
  } else {
    result = {
      name: check.name,
      status: 'present',
      message: 'Configured',
      sensitive: check.sensitive,
    };
  }
  
  results.push(result);
  
  // Print result
  const icon = {
    present: '✅',
    missing: '❌',
    invalid: '⚠️ ',
    warning: 'ℹ️ ',
  }[result.status];
  
  const displayValue = result.sensitive ? '***' : (value?.substring(0, 30) + (value && value.length > 30 ? '...' : '') || 'not set');
  
  console.log(`${icon} ${check.name.padEnd(30)} ${result.message.padEnd(35)} [${displayValue}]`);
}

// 4. Summary
console.log('\n' + '='.repeat(60));
console.log('\n📊 Summary:\n');

const present = results.filter(r => r.status === 'present').length;
const missing = results.filter(r => r.status === 'missing').length;
const invalid = results.filter(r => r.status === 'invalid').length;
const warnings = results.filter(r => r.status === 'warning').length;

console.log(`✅ Present:  ${present}/${results.length}`);
console.log(`❌ Missing:  ${missing}`);
console.log(`⚠️  Invalid:  ${invalid}`);
console.log(`ℹ️  Warnings: ${warnings}`);

// 5. Security checks
console.log('\n🔒 Security Checks:\n');

const allRequired = results.filter(r => r.status !== 'missing' && r.status !== 'invalid').length === results.filter(r => {
  const check = ENVIRONMENT_CHECKS.find(c => c.name === r.name);
  return check?.required;
}).length;

console.log(`${allRequired ? '✅' : '❌'} All required variables configured`);

const jwtSecret = process.env.JWT_SECRET;
if (jwtSecret && jwtSecret.length >= 32) {
  console.log(`✅ JWT_SECRET is at least 32 characters`);
} else if (jwtSecret) {
  console.log(`⚠️  JWT_SECRET should be at least 32 characters (current: ${jwtSecret.length})`);
}

const refreshSecret = process.env.REFRESH_TOKEN_SECRET;
if (refreshSecret && refreshSecret.length >= 32) {
  console.log(`✅ REFRESH_TOKEN_SECRET is at least 32 characters`);
} else if (refreshSecret) {
  console.log(`⚠️  REFRESH_TOKEN_SECRET should be at least 32 characters (current: ${refreshSecret.length})`);
}

const nodeEnv = process.env.NODE_ENV;
if (['development', 'staging', 'production'].includes(nodeEnv || '')) {
  console.log(`✅ NODE_ENV is set to: ${nodeEnv}`);
} else {
  console.log(`⚠️  NODE_ENV should be development, staging, or production`);
}

// 6. Recommendations
if (missing > 0 || invalid > 0) {
  console.log('\n📝 Recommendations:\n');
  
  if (missing > 0) {
    console.log('1. Set missing required environment variables:');
    results.filter(r => r.status === 'missing').forEach(r => {
      const check = ENVIRONMENT_CHECKS.find(c => c.name === r.name);
      console.log(`   - ${r.name}: ${check?.description}`);
    });
  }
  
  if (invalid > 0) {
    console.log('\n2. Fix invalid environment variables:');
    results.filter(r => r.status === 'invalid').forEach(r => {
      console.log(`   - ${r.name}: ${r.message}`);
    });
  }
  
  console.log('\n3. See docs/ENVIRONMENT_CONFIGURATION_GUIDE.md for setup instructions');
}

// Final status
console.log('\n' + '='.repeat(60));

if (missing === 0 && invalid === 0) {
  console.log('\n✅ Environment configuration is valid and ready to use!\n');
  process.exit(0);
} else {
  console.log('\n⚠️  Environment configuration needs attention.\n');
  process.exit(1);
}
