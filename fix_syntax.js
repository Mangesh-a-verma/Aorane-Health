const fs = require('fs');
let file = fs.readFileSync('artifacts/api-server/src/routes/modules/ai.ts', 'utf8');

const brokenBlock = `    const prompt = \`You are a certified Indian health coach. Give ONE practical, culturally relevant daily health tip for an Indian person\${context ? \` who \${context}\` : ""}.

Return ONLY valid JSON:
{
  "tip": "string (max 2 sentences, practical, specific)",
  "tipHindi": "string (same tip in Hindi)",
  "category": "nutrition|exercise|sleep|stress|hydration|ayurveda",
    const payload: import("../../lib/ai").AIMessage[] = [{ role: "user", content: prompt }];`;

const fixedBlock = `    const prompt = \`You are a certified Indian health coach. Give ONE practical, culturally relevant daily health tip for an Indian person\${context ? \` who \${context}\` : ""}.

Return ONLY valid JSON:
{
  "tip": "string (max 2 sentences, practical, specific)",
  "tipHindi": "string (same tip in Hindi)",
  "category": "nutrition|exercise|sleep|stress|hydration|ayurveda",
  "explanation": "Why this suggestion matters for your specific condition/goals."
}\`;

    const payload: import("../../lib/ai").AIMessage[] = [{ role: "user", content: prompt }];`;

file = file.replace(brokenBlock, fixedBlock);

fs.writeFileSync('artifacts/api-server/src/routes/modules/ai.ts', file);
