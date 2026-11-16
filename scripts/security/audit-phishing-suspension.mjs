import fs from 'node:fs';
import path from 'node:path';

const SKIP = new Set(['.git','node_modules','dist','.cache','coverage','android','ios']);
const root=process.cwd();
const all=[];
function walk(dir){
  for(const item of fs.readdirSync(dir,{withFileTypes:true})){
    if(item.isDirectory() && SKIP.has(item.name))continue;
    const full=path.join(dir,item.name);
    if(item.isDirectory())walk(full);
    else if(item.isFile())all.push(path.relative(root,full).replaceAll('\\','/'));
  }
}
walk(root);
const publicFiles=all.filter(f=>f.startsWith('public/')).sort();
const htmlFiles=all.filter(f=>f==='index.html'||f.endsWith('.html')&&f.startsWith('public/')).sort();
const sourceFiles=all.filter(f=>/^src\/.*\.(jsx?|tsx?)$/.test(f));
const htmlResults=[];
const srcPatterns=[
 ['dangerouslySetInnerHTML',/dangerouslySetInnerHTML/g],
 ['document.write',/document\.write\s*\(/g],
 ['dynamic code execution',/\b(?:eval|Function)\s*\(/g],
 ['iframe creation',/createElement\s*\(\s*['"]iframe['"]\s*\)/g],
 ['form submit',/\.submit\s*\(/g],
 ['location redirects',/(?:window\.)?location\.(?:assign|replace)\s*\(/g],
 ['potential external credential send',/(?:fetch|axios|XMLHttpRequest)[\s\S]{0,250}(?:password|credential)/gi],
 ['base64 decoding',/\b(?:atob|decodeURIComponent)\s*\(/g],
 ['storage access',/(?:localStorage|sessionStorage)/g],
];
const srcHits=Object.fromEntries(srcPatterns.map(([k])=>[k,[]]));
for(const file of sourceFiles){
  const body=fs.readFileSync(file,'utf8');
  for(const [label,pattern] of srcPatterns){
    const matches=body.match(pattern)||[];
    if(matches.length)srcHits[label].push({file,occurrences:matches.length});
  }
}
function domains(text){
  const candidates=[...text.matchAll(/https?:\/\/[^\s"'<>\\{}]+/g)].map(m=>m[0]);
  const found=[];
  for(const s of candidates){
    try{const hostname=new URL(s).hostname.toLowerCase();if(hostname&&hostname.includes('.'))found.push(hostname)}catch{}
  }
  return [...new Set(found)].sort();
}
for(const file of htmlFiles){
  const text=fs.readFileSync(file,'utf8');
  const forms=[...text.matchAll(/<form\b[^>]*>/gi)].map(m=>m[0]);
  const scripts=[...text.matchAll(/<script\b[^>]*>/gi)].map(m=>m[0]);
  const frames=[...text.matchAll(/<iframe\b[^>]*>/gi)].map(m=>m[0]);
  const exScript=scripts.filter(t=>/\bsrc\s*=\s*["']https?:\/\//i.test(t));
  const externalForm=forms.filter(t=>/\baction\s*=\s*["']https?:\/\//i.test(t));
  htmlResults.push({file,bytes:Buffer.byteLength(text),formCount:forms.length,scriptTags:scripts.length,
    externallyHostedScripts:exScript,externalFormTargets:externalForm,iframeCount:frames.length,
    metaRefresh:/http-equiv=["']?refresh/i.test(text),domains:domains(text).slice(0,32),
    passwordFields:(text.match(/type=["']password["']/gi)||[]).length});
}
const importantFiles=sourceFiles.filter(f=>/(auth|login|session|landing|supabase|oauth|federat|redirect|api)/i.test(f));
const interestingDomains={};
for(const f of importantFiles){
  const matches=domains(fs.readFileSync(f,'utf8'));
  if(matches.length)interestingDomains[f]=matches;
}
const report={
  analyzedAt:new Date().toISOString(),
  scannedFiles:all.length,
  srcFiles:sourceFiles.length,
  publicFiles,
  htmlResults,
  runtimePatternHits:srcHits,
  authRelatedDomains:interestingDomains,
  verificationTagInIndex:fs.readFileSync('index.html','utf8').includes('B8nc-U0CFH1hL6WNjYY64nEoGAYLExP5krS4MRyzkWQ'),
  verificationFileExists:publicFiles.includes('public/googleee018f2d5cc05ee0.html'),
};
fs.writeFileSync('/tmp/acg-phishing-static-audit.json',JSON.stringify(report,null,2));
console.log('AUDIT_STATIC_BEGIN');
console.log(JSON.stringify(report,null,2));
console.log('AUDIT_STATIC_END');
