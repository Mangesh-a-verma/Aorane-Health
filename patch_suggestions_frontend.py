import re

with open('artifacts/aorane-mobile/app/suggestions.tsx', 'r') as f:
    content = f.read()

replacement = """      let cleanSuggestions = res.suggestions as unknown;
      if (typeof cleanSuggestions === "string") {
        try {
          cleanSuggestions = JSON.parse(cleanSuggestions);
        } catch {
          let cleanStr = (cleanSuggestions as string).trim();
          if (cleanStr.startsWith("```json")) cleanStr = cleanStr.substring(7);
          if (cleanStr.endsWith("```")) cleanStr = cleanStr.substring(0, cleanStr.length - 3);
          try {
            cleanSuggestions = JSON.parse(cleanStr.trim());
          } catch {
            cleanSuggestions = { greeting: "Hello!", foodSuggestions: [], medicalWarnings: [] };
          }
        }
      }
      setSuggestions(cleanSuggestions as Suggestion || { greeting: "Hello!", foodSuggestions: [], medicalWarnings: [] });"""

content = re.sub(
    r"      let cleanSuggestions = res\.suggestions;.*?setSuggestions\(cleanSuggestions \|\| \{ greeting: \"Hello!\", foodSuggestions: \[\], medicalWarnings: \[\] \}\);",
    replacement,
    content,
    flags=re.DOTALL
)

with open('artifacts/aorane-mobile/app/suggestions.tsx', 'w') as f:
    f.write(content)
