import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const srcDir = path.resolve(__dirname, '../src');

// Regex patterns to identify candidate hardcoded strings in JSX
// 1. Direct text node inside JSX tags: >Some Hardcoded Text<
const jsxTextRegex = />\s*([A-Za-z0-9,.:;?!' -]{3,})\s*</g;

// 2. Common text attributes with string literals: placeholder="...", title="...", alt="..."
const jsxAttrRegex = /(placeholder|title|alt|label)="([A-Za-z0-9,.:;?!' -]{3,})"/g;

let totalIssues = 0;
const report = [];

function scanFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const relativePath = path.relative(path.resolve(__dirname, '..'), filePath);
  const fileIssues = [];

  // Ignore imports, comments, or i18n file itself
  if (relativePath.includes('i18n.ts') || relativePath.includes('logoData.ts')) {
    return;
  }

  const lines = content.split('\n');

  lines.forEach((line, index) => {
    // Skip single-line comments or console.log
    if (line.trim().startsWith('//') || line.trim().startsWith('*') || line.includes('console.')) {
      return;
    }

    // Check JSX text nodes
    let match;
    jsxTextRegex.lastIndex = 0;
    while ((match = jsxTextRegex.exec(line)) !== null) {
      const text = match[1].trim();
      // Ignore text that is purely numbers, single symbols, or code keywords
      if (text && !/^\d+$/.test(text) && !/^(true|false|null|undefined)$/.test(text) && !text.includes('t(')) {
        fileIssues.push({ line: index + 1, type: 'JSX Text Node', text });
      }
    }

    // Check JSX attributes
    jsxAttrRegex.lastIndex = 0;
    while ((match = jsxAttrRegex.exec(line)) !== null) {
      const attr = match[1];
      const val = match[2].trim();
      if (val && !val.includes('t(')) {
        fileIssues.push({ line: index + 1, type: `Attribute (${attr})`, text: val });
      }
    }
  });

  if (fileIssues.length > 0) {
    report.push({ file: relativePath, issues: fileIssues });
    totalIssues += fileIssues.length;
  }
}

function walkDir(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      walkDir(fullPath);
    } else if (file.endsWith('.tsx') || file.endsWith('.ts')) {
      scanFile(fullPath);
    }
  }
}

console.log('🔍 Scanning /src directory for untranslated text nodes and attributes...\n');
walkDir(srcDir);

if (totalIssues === 0) {
  console.log('✅ Success: All JSX text nodes and key attributes appear properly localized or wrapped in t()!');
} else {
  console.log(`⚠️  Found ${totalIssues} potential untranslated string(s) across ${report.length} file(s):\n`);
  report.forEach(({ file, issues }) => {
    console.log(`📄 File: ${file}`);
    issues.forEach((iss) => {
      console.log(`   Line ${iss.line} [${iss.type}]: "${iss.text}"`);
    });
    console.log('');
  });
  console.log('💡 Tip: Wrap these strings using t("key", lang) and add keys to src/i18n.ts');
}
