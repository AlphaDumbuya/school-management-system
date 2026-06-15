/**
 * Refactoring Script: Admin to Principal
 * Phase 1.2: Role System Enhancement
 * 
 * This script helps identify and update 'admin' references to 'principal'
 * throughout the codebase.
 * 
 * Usage:
 *   npm run refactor:admin-to-principal
 * 
 * This is a dry-run script that outputs what would be changed.
 * Actual file modifications should be done carefully with version control.
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface RefactorResult {
  file: string;
  occurrences: number;
  lines: { lineNumber: number; content: string }[];
}

const results: RefactorResult[] = [];

// Patterns to search for
const patterns = [
  /\b'admin'\b/g,
  /\b"admin"\b/g,
  /\brole:\s*'admin'/g,
  /\brole:\s*"admin"/g,
  /\bUserRole\.ADMIN\b/g,
  /\bADMIN\s*=\s*'admin'/g,
];

// Files and directories to exclude
const excludePatterns = [
  'node_modules',
  'dist',
  '.git',
  'logs',
  'audit_archives',
  'migration_output.log',
  'refactorAdminToPrincipal.ts', // Exclude this script
];

// File extensions to search
const includeExtensions = ['.ts', '.tsx', '.js', '.jsx', '.json'];

function shouldExclude(filePath: string): boolean {
  return excludePatterns.some(pattern => filePath.includes(pattern));
}

function searchInFile(filePath: string): void {
  if (!includeExtensions.some(ext => filePath.endsWith(ext))) {
    return;
  }

  if (shouldExclude(filePath)) {
    return;
  }

  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');
    const occurrences: { lineNumber: number; content: string }[] = [];

    lines.forEach((line, index) => {
      // Check if line contains 'admin' in a role context
      if (
        /\badmin\b/i.test(line) &&
        (
          /role.*admin|admin.*role/i.test(line) ||
          /'admin'|"admin"/.test(line) ||
          /requiredRoles.*admin/i.test(line) ||
          /UserRole\.ADMIN/.test(line) ||
          /\.includes\(.*admin/i.test(line)
        )
      ) {
        occurrences.push({
          lineNumber: index + 1,
          content: line.trim(),
        });
      }
    });

    if (occurrences.length > 0) {
      results.push({
        file: filePath,
        occurrences: occurrences.length,
        lines: occurrences,
      });
    }
  } catch (error) {
    // Ignore read errors
  }
}

function searchDirectory(dir: string): void {
  try {
    const items = fs.readdirSync(dir);

    for (const item of items) {
      const fullPath = path.join(dir, item);
      const stat = fs.statSync(fullPath);

      if (stat.isDirectory()) {
        searchDirectory(fullPath);
      } else if (stat.isFile()) {
        searchInFile(fullPath);
      }
    }
  } catch (error) {
    // Ignore directory read errors
  }
}

async function main() {
  console.log('🔍 Searching for admin role references...\n');
  console.log('=' .repeat(80));

  const projectRoot = path.resolve(__dirname, '../..');
  searchDirectory(projectRoot);

  console.log(`\n📊 REFACTORING SUMMARY`);
  console.log('='.repeat(80));
  console.log(`Total files with admin references: ${results.length}`);
  console.log(`Total occurrences: ${results.reduce((sum, r) => sum + r.occurrences, 0)}`);
  console.log('='.repeat(80));

  // Group by directory
  const byDirectory = results.reduce((acc, result) => {
    const dir = path.dirname(result.file).split(path.sep).slice(-2).join('/');
    if (!acc[dir]) {
      acc[dir] = [];
    }
    acc[dir].push(result);
    return acc;
  }, {} as Record<string, RefactorResult[]>);

  // Display results by directory
  console.log('\n📁 BY DIRECTORY:\n');
  Object.entries(byDirectory).forEach(([dir, files]) => {
    const totalOccurrences = files.reduce((sum, f) => sum + f.occurrences, 0);
    console.log(`\n${dir}/ (${files.length} files, ${totalOccurrences} occurrences)`);
    console.log('-'.repeat(80));
    
    files.forEach(file => {
      console.log(`\n  📄 ${path.basename(file.file)} (${file.occurrences} occurrences)`);
      file.lines.slice(0, 5).forEach(line => {
        console.log(`     Line ${line.lineNumber}: ${line.content.substring(0, 70)}${line.content.length > 70 ? '...' : ''}`);
      });
      if (file.lines.length > 5) {
        console.log(`     ... and ${file.lines.length - 5} more occurrences`);
      }
    });
  });

  console.log('\n\n📋 FILES TO UPDATE:');
  console.log('='.repeat(80));
  results.forEach(result => {
    console.log(`${result.file.replace(projectRoot, '.')} (${result.occurrences} occurrences)`);
  });

  console.log('\n\n⚠️  IMPORTANT NOTES:');
  console.log('='.repeat(80));
  console.log('1. Run database migration FIRST: npm run db:migrate');
  console.log('2. Update backend type definitions (backend/src/types/auth.ts)');
  console.log('3. Update frontend type definitions (frontend/src/types/index.ts)');
  console.log('4. Update route authorizations in backend/src/routes/');
  console.log('5. Update frontend components and protected routes');
  console.log('6. Update service methods that check roles');
  console.log('7. Update test files');
  console.log('8. Search for string literals: "admin", \'admin\'');
  console.log('9. Update comments and documentation');
  console.log('10. Test thoroughly before deployment');
  console.log('\n⚠️  NOTE: Not all "admin" references should be changed!');
  console.log('    Keep: admin@school.com, admin user, admin panel (UI terms)');
  console.log('    Change: role checks, enum values, database records');
  console.log('='.repeat(80));
}

main().catch(console.error);
