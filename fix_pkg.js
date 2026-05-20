const fs = require('fs');
let pkg = JSON.parse(fs.readFileSync('artifacts/api-server/package.json', 'utf8'));
pkg.scripts["db:fix"] = "npx tsx src/scripts/fix-db.ts";
fs.writeFileSync('artifacts/api-server/package.json', JSON.stringify(pkg, null, 2));
