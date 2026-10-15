const fs = require('fs');
const c = JSON.parse(fs.readFileSync('C:/CodeRoot/AI/skills-site/generated/catalog.json','utf8'));
let mism=0, unsafe=0;
for (const s of c.skills) {
  const dir = s.path.split('/').slice(-2,-1)[0];
  if (dir !== s.name) { mism++; if (mism<=10) console.log('MISMATCH dir='+dir+' name='+s.name); }
  if (/[\\/:*?"<>|]/.test(s.name)) { unsafe++; console.log('UNSAFE NAME: '+s.name); }
}
console.log('total skills:', c.skills.length, 'mismatches:', mism, 'unsafe:', unsafe);
