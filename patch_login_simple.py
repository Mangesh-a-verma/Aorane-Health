import re

with open('artifacts/business-portal/src/pages/Login.tsx', 'r') as f:
    content = f.read()

# Make Login accept onAuthSuccess
if "onAuthSuccess?: () => void" not in content:
    content = content.replace("export default function Login() {", "export default function Login({ onAuthSuccess, isModal = true }: { onAuthSuccess?: () => void, isModal?: boolean } = {}) {")

login_success_logic = """      login(data.token, data.admin, data.org);
      if (onAuthSuccess) {
          onAuthSuccess();
      } else {
          navigate("/dashboard");
      }"""

content = re.sub(r'login\(data\.token, data\.admin, data\.org\);\s*navigate\("/dashboard"\);', login_success_logic, content)

with open('artifacts/business-portal/src/pages/Login.tsx', 'w') as f:
    f.write(content)
