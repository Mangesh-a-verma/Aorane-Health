const fs = require('fs');
let file = fs.readFileSync('artifacts/api-server/src/routes/modules/ai.ts', 'utf8');

const brokenBlock = `        "snacks": { "items": [...], "totalCalories": number }
      },
      "waterIntakeMl": number,
      "tip": "string (1 health tip for the day in English)"
    }
  ],
    const payload: import("../../lib/ai").AIMessage[] = [{ role: "user", content: prompt }];`;

const fixedBlock = `        "snacks": { "items": [...], "totalCalories": number }
      },
      "waterIntakeMl": number,
      "tip": "string (1 health tip for the day in English)"
    }
  ],
  "generalTips": ["tip1", "tip2", "tip3"]
}\`;

    const payload: import("../../lib/ai").AIMessage[] = [{ role: "user", content: prompt }];`;

file = file.replace(brokenBlock, fixedBlock);

fs.writeFileSync('artifacts/api-server/src/routes/modules/ai.ts', file);
