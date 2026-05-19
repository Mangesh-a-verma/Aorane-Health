const fs = require('fs');
let file = fs.readFileSync('artifacts/api-server/src/routes/modules/ai.ts', 'utf8');

const brokenBlock = `For medicine:
{ "type": "medicine", "confidence": 0.88, "medicineName": "Name", "genericName": "Generic", "uses": "What it treats", "commonDosage": "Typical adult dose", "sideEffects": ["Side effect 1"], "warnings": ["Warning"], "disclaimer": "Always follow your doctor's prescription." }

    const payload: import("../../lib/ai").AIMessage[] = [{`;

const fixedBlock = `For medicine:
{ "type": "medicine", "confidence": 0.88, "medicineName": "Name", "genericName": "Generic", "uses": "What it treats", "commonDosage": "Typical adult dose", "sideEffects": ["Side effect 1"], "warnings": ["Warning"], "disclaimer": "Always follow your doctor's prescription." }

If no food or medical info is visible, return {"error": "No recognized items found."}\`;

    const payload: import("../../lib/ai").AIMessage[] = [{`;

file = file.replace(brokenBlock, fixedBlock);

fs.writeFileSync('artifacts/api-server/src/routes/modules/ai.ts', file);
