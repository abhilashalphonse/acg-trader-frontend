// GitHub Secret Scanning is authoritative for history; this guard blocks
// preventable future disclosures in currently tracked source files.
// Do not print matched values: even CI logs are an exfiltration surface.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { extname, basename } from 'node:path';

const names = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' }).split('\0').filter(Boolean);
const configName = /^\.env(?:\..*)?$/i;
const textExt = new Set(['.js', '.jsx', '.mjs', '.cjs', '.ts', '.tsx', '.json', '.html', '.md', '.yml', '.yaml', '.txt', '.toml', '.sh', '.example', '.css', '.xml']);
const supabaseSecretPattern = new RegExp(['sb', 'secret'].join('_') + '[A-Za-z0-9_-]{8,}', 'g');
const accidentallyPublicSecret = /\b(?:VITE|NEXT_PUBLIC|REACT_APP)_[A-Z0-9_]*(?:SECRET|SERVICE_ROLE|PRIVATE_KEY|DATABASE_PASSWORD|ADMIN_KEY)[A-Z0-9_]*\s*=/gi;
const envAssignment = /^\s*(?:SUPABASE_SECRET_KEY|SUPABASE_SERVICE_ROLE_KEY|DATABASE_URL|JWT_SECRET|PRIVATE_KEY)\s*=\s*\S+/m;
const gitConflict = /^(?:<{7}|={7}|>{7})(?:\s|$)/m;
const problems = [];

for (const file of names) {
  if (!configName.test(basename(file)) && !textExt.has(extname(file).toLowerCase())) continue;
  let contents;
  try { contents = readFileSync(file, 'utf8'); } catch { continue; }
  if (contents.includes('\0') || contents.length > 3_000_000) continue;
  for (const [label, pattern] of [
    ['Supabase privileged API key', supabaseSecretPattern],
    ['private credential in a browser-visible variable', accidentallyPublicSecret],
    ['secret assignment in tracked source', envAssignment],
    ['unresolved Git conflict marker', gitConflict],
  ]) {
    const found = pattern.exec(contents);
    pattern.lastIndex = 0;
    if (!found) continue;
    const line = contents.slice(0, found.index).split('\n').length;
    problems.push({ file, line, type: label });
  }
}

if (problems.length) {
  for (const item of problems) {
    console.error(`SECURITY_GUARD_FAILED: ${item.file}:${item.line} — ${item.type} (value intentionally not logged)`);
  }
  process.exitCode = 1;
} else {
  console.log(`SECURITY_GUARD_PASS: scanned ${names.length} tracked files without exposed privileged key patterns or conflict markers`);
}
