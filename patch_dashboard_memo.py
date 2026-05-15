import re

with open('artifacts/aorane-mobile/app/(tabs)/dashboard.tsx', 'r') as f:
    content = f.read()

# Add useMemo
content = content.replace('useState, useEffect, useCallback, useRef', 'useState, useEffect, useCallback, useRef, useMemo')

# Memoize metric pills (we can see a few heavy components inside Dashboard that might re-render)
# Let's find some good candidates for useMemo in dashboard.tsx
