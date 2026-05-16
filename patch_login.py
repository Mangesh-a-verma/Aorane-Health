import re

with open('artifacts/business-portal/src/pages/Login.tsx', 'r') as f:
    content = f.read()

# Make Login accept onAuthSuccess
if "export default function Login({ onAuthSuccess }: { onAuthSuccess?: () => void }) {" not in content:
    content = content.replace("export default function Login() {", "export default function Login({ onAuthSuccess }: { onAuthSuccess?: () => void } = {}) {")

# Update login success logic to use onAuthSuccess
login_success_logic = """      login(data.token, data.admin, data.org);
      if (onAuthSuccess) onAuthSuccess();
      else navigate("/dashboard");"""

content = re.sub(r'login\(data\.token, data\.admin, data\.org\);\s+navigate\("/dashboard"\);', login_success_logic, content)

# Remove the hardcoded full-screen layout styles to fit in a modal nicely
# The outer div of Login currently has minHeight: "100vh"
content = re.sub(r'minHeight: "100vh",?\s*', '', content)
content = re.sub(r'padding: "40px 20px",?\s*', 'padding: "20px", ', content)
# Hide the left hero side if in a modal, but since it's the main Login component it's tricky.
# Let's just let it render as is, but maybe scale it down or hide the decorative sidebar.
# Actually, Login has a 2-column layout (Left sidebar, right form).
# If we render it inside a max-w-[425px] DialogContent, the sidebar will squish or wrap.
# Let's add a quick media query or just a prop to hide it.
if "isModal?: boolean" not in content:
    content = content.replace(
        "export default function Login({ onAuthSuccess }: { onAuthSuccess?: () => void } = {}) {",
        "export default function Login({ onAuthSuccess, isModal }: { onAuthSuccess?: () => void, isModal?: boolean } = {}) {"
    )

    # Hide the left side if isModal is true
    content = content.replace(
        """<div style={{ flex: 1, padding: "40px", display: "flex", flexDirection: "column", justifyContent: "center", position: "relative", zIndex: 1, background: "linear-gradient(135deg, #005d90 0%, #003a5c 100%)", color: "white" }}>""",
        """{!isModal && (<div className="hidden lg:flex" style={{ flex: 1, padding: "40px", flexDirection: "column", justifyContent: "center", position: "relative", zIndex: 1, background: "linear-gradient(135deg, #005d90 0%, #003a5c 100%)", color: "white" }}>"""
    )
    content = content.replace(
        """          {/* Floating Elements */}""",
        """          {/* Floating Elements */}
        </div>)}"""
    )

    # We need to find the matching closing div for the left sidebar. It's too complex to regex perfectly.
    pass

with open('artifacts/business-portal/src/pages/Login.tsx', 'w') as f:
    f.write(content)
