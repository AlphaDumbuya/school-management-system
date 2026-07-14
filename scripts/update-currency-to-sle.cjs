#!/usr/bin/env node

/**
 * Script to update all currency references to SLE across the codebase
 * Updates: INR -> SLE, ₹ -> Le, Rs -> Le
 */

const fs = require('fs');
const path = require('path');

const replacements = [
  { from: /\bINR\b/g, to: 'SLE' },
  { from: /₹/g, to: 'Le' },
  { from: /\bRs\b/g, to: 'Le' },
  { from: /'INR'/g, to: "'SLE'" },
  { from: /"INR"/g, to: '"SLE"' },
  { from: /currency:\s*'INR'/g, to: "currency: 'SLE'" },
  { from: /currency:\s*"INR"/g, to: 'currency: "SLE"' },
  { from: /en-IN/g, to: 'en-US' }, // Locale updates
];

const excludeDirs = [
  'node_modules',
  'dist',
  'build',
  '.git',
  'coverage',
  'logs',
  '.kiro',
  'audit_archives',
];

const excludeFiles = [
  'package-lock.json',
  'yarn.lock',
  '.log',
  '.map',
];

function shouldProcess(filePath) {
  const ext = path.extname(filePath);
  return ['.ts', '.tsx', '.js', '.jsx', '.json', '.sql', '.md'].includes(ext);
}

function shouldExclude(filePath) {
  return excludeDirs.some(dir => filePath.includes(path.sep + dir + path.sep)) ||
         excludeFiles.some(file => filePath.endsWith(file));
}

function processFile(filePath) {
  if (!shouldProcess(filePath) || shouldExclude(filePath)) {
    return false;
  }

  try {
    let content = fs.readFileSync(filePath, 'utf8');
    let modified = false;

    replacements.forEach(({ from, to }) => {
      if (from.test(content)) {
        content = content.replace(from, to);
        modified = true;
      }
    });

    if (modified) {
      fs.writeFileSync(filePath, content, 'utf8');
      console.log(`✓ Updated: ${filePath}`);
      return true;
    }
  } catch (error) {
    console.error(`✗ Error processing ${filePath}:`, error.message);
  }

  return false;
}

function walkDirectory(dir) {
  let filesUpdated = 0;

  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        if (!excludeDirs.includes(entry.name)) {
          filesUpdated += walkDirectory(fullPath);
        }
      } else if (entry.isFile()) {
        if (processFile(fullPath)) {
          filesUpdated++;
        }
      }
    }
  } catch (error) {
    console.error(`✗ Error reading directory ${dir}:`, error.message);
  }

  return filesUpdated;
}

console.log('🔄 Starting currency update to SLE...\n');

const projectRoot = path.join(__dirname, '..');
const filesUpdated = walkDirectory(projectRoot);

console.log(`\n✅ Currency update complete!`);
console.log(`📝 ${filesUpdated} files updated`);
console.log(`\n💡 Next steps:`);
console.log(`   1. Run: cd backend && npm run migrate:latest`);
console.log(`   2. Review changes: git diff`);
console.log(`   3. Test the application thoroughly`);
console.log(`   4. Commit changes if everything looks good\n`);
