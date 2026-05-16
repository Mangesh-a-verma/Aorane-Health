with open('artifacts/api-server/src/routes/modules/business.ts', 'r') as f:
    content = f.read()

content = content.replace("});\n});\n\n// ─── Per-employee stress data", "});\n\n// ─── Per-employee stress data")

with open('artifacts/api-server/src/routes/modules/business.ts', 'w') as f:
    f.write(content)
