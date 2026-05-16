with open('artifacts/api-server/src/routes/modules/business.ts', 'r') as f:
    content = f.read()

content = content.replace("const results = resultsRaw.map((p) => ({", "const results = resultsRaw.map((p: any) => ({")

with open('artifacts/api-server/src/routes/modules/business.ts', 'w') as f:
    f.write(content)
