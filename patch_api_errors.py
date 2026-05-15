import re

with open('artifacts/aorane-mobile/lib/api.ts', 'r') as f:
    content = f.read()

# Make request properly throw standard errors.
# Actually, the base rawRequest DOES throw standard errors or APILimitError already:
# throw new Error("Session expired — please log in again");
# throw new Error(`Server error (${res.status}) — please try again`);
# throw new Error((data as { error?: string }).error || `Request failed (${res.status})`);
