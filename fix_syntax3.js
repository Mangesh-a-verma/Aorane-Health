const fs = require('fs');
let file = fs.readFileSync('artifacts/api-server/src/routes/modules/ai.ts', 'utf8');

const brokenBlock = `  "swaps": [
    { "name": "string", "nameHindi": "string", "reason": "string (why it's better)", "calories": number, "benefit": "string" }
    const payload: import("../../lib/ai").AIMessage[] = [{ role: "user", content: prompt }];`;

const fixedBlock = `  "swaps": [
    { "name": "string", "nameHindi": "string", "reason": "string (why it's better)", "calories": number, "benefit": "string" }
  ],
  "tips": "Tips for preparation"
}\`;

    const payload: import("../../lib/ai").AIMessage[] = [{ role: "user", content: prompt }];`;

file = file.replace(brokenBlock, fixedBlock);

fs.writeFileSync('artifacts/api-server/src/routes/modules/ai.ts', file);
