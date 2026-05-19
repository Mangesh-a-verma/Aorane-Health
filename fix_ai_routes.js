const fs = require('fs');
let file = fs.readFileSync('artifacts/api-server/src/routes/modules/ai.ts', 'utf8');

// The file has these blocks for text
const block1 = `    let payload: any = [{ role: "user", content: prompt }];
    try {
      const [config] = await db.select().from(aiConfigTable).where(eq(aiConfigTable.feature, "meal_planner")).limit(1);
      if (config && config.provider === "google") {
        payload = [{ role: "user", parts: [{ text: prompt }] }];
      }
    } catch (e) {}`;
file = file.replaceAll(block1, `    const payload: import("../../lib/ai").AIMessage[] = [{ role: "user", content: prompt }];`);

const block2 = `    let payload: any = [{ role: "user", content: prompt }];
    try {
      const [config] = await db.select().from(aiConfigTable).where(eq(aiConfigTable.feature, "health_suggestions")).limit(1);
      if (config && config.provider === "google") {
        payload = [{ role: "user", parts: [{ text: prompt }] }];
      }
    } catch (e) {}`;
file = file.replaceAll(block2, `    const payload: import("../../lib/ai").AIMessage[] = [{ role: "user", content: prompt }];`);

const block3 = `    let payload: any = [{
      role: "user",
      content: [
        { type: "text", text: prompt },
        { type: "image_url", image_url: { url: \`data:\${mimeType};base64,\${imageBase64}\` } }
      ]
    }];

    try {
      const [config] = await db.select().from(aiConfigTable).where(eq(aiConfigTable.feature, "smart_scan")).limit(1);
      if (config && config.provider === "google") {
        payload = [{ role: "user", parts: [{ text: prompt }, { inlineData: { mimeType, data: imageBase64 } }] }];
      }
    } catch (e) {}`;

const replace3 = `    const payload: import("../../lib/ai").AIMessage[] = [{
      role: "user",
      content: prompt,
      media: { mimeType, data: imageBase64 }
    }];`;
file = file.replaceAll(block3, replace3);

fs.writeFileSync('artifacts/api-server/src/routes/modules/ai.ts', file);
