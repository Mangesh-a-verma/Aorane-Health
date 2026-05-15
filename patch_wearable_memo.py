import re

with open('artifacts/aorane-mobile/app/wearable.tsx', 'r') as f:
    content = f.read()

# Add useMemo around filtered providers
content = content.replace(
    'const activeConnections = connections.filter((c) => c.status === "active");',
    'const activeConnections = useMemo(() => connections.filter((c) => c.status === "active"), [connections]);'
)

with open('artifacts/aorane-mobile/app/wearable.tsx', 'w') as f:
    f.write(content)
