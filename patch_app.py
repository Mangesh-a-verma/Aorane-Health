import re

with open('artifacts/business-portal/src/App.tsx', 'r') as f:
    content = f.read()

# Make sure isModal is passed to Login in App.tsx LandingContainer
content = content.replace('<Login onAuthSuccess={() => setAuthOpen(false)} />', '<Login onAuthSuccess={() => setAuthOpen(false)} isModal={true} />')

with open('artifacts/business-portal/src/App.tsx', 'w') as f:
    f.write(content)
