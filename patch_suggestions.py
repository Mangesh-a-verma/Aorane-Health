import re

with open('artifacts/api-server/src/routes/modules/suggestions.ts', 'r') as f:
    content = f.read()

replacement = """    let suggestions: unknown;
    const generatedAt = new Date();
    try {
      const jsonStr = await callAI("health_suggestions", [{ role: "user", content: prompt }], { maxTokens: 2000 });
      let cleanJson = jsonStr.trim();
      if (cleanJson.startsWith("```json")) {
        cleanJson = cleanJson.substring(7);
      }
      if (cleanJson.endsWith("```")) {
        cleanJson = cleanJson.substring(0, cleanJson.length - 3);
      }
      cleanJson = cleanJson.trim();
      suggestions = JSON.parse(cleanJson);
    } catch {"""

content = re.sub(
    r"    let suggestions: unknown;\n    const generatedAt = new Date\(\);\n    try \{\n      const jsonStr = await callAI\(\"health_suggestions\", \[\{ role: \"user\", content: prompt \}\], \{ maxTokens: 2000 \}\);\n      suggestions = JSON\.parse\(jsonStr\);\n    \} catch \{",
    replacement,
    content,
    flags=re.DOTALL
)

with open('artifacts/api-server/src/routes/modules/suggestions.ts', 'w') as f:
    f.write(content)
