// בודק שאין קוד ברמה העליונה שמשתמש בפונקציה שמוגדרת בקובץ מאוחר יותר
// (בקובץ אחד זה עבד בזכות hoisting; בקבצים נפרדים זה נשבר).
const fs = require('fs'), path = require('path');
const acorn = require('acorn'), walk = require('acorn-walk');
const dir = path.join(__dirname, '..', 'site', 'js');
const files = fs.readdirSync(dir).filter((f) => f.endsWith('.js')).sort();
const asts = files.map((f) => acorn.parse(fs.readFileSync(path.join(dir, f), 'utf8'), { ecmaVersion: 'latest', locations: true }));
const declIn = {};
asts.forEach((a, i) => a.body.forEach((n) => { if (n.type === 'FunctionDeclaration') declIn[n.id.name] = i; }));
let bad = 0;
asts.forEach((a, i) => {
  for (const stmt of a.body) {
    if (stmt.type === 'FunctionDeclaration') continue;
    walk.recursive(stmt, null, {
      Function() {}, // לא נכנסים לגוף של פונקציות — הן רצות מאוחר יותר
      Identifier(n) { if (declIn[n.name] > i) { bad++; console.log(`${files[i]}:${n.loc.start.line}  ${n.name}  (מוגדר ב-${files[declIn[n.name]]})`); } },
    });
  }
});
console.log(bad ? `נמצאו ${bad}` : 'תקין');
process.exit(bad ? 1 : 0);
