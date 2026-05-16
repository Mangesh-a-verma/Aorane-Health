import re

with open('artifacts/business-portal/src/App.tsx', 'r') as f:
    content = f.read()

# We need to render the Auth Modal when on the landing page if requested,
# or convert Login/Register pages into modal contents.
# But wait, Landing.tsx already accepts an `onOpenAuth` prop in our newly rewritten file.
# Let's wrap Landing with a container that renders the Modal.

new_landing_route = """
import { Dialog, DialogContent } from "@/components/ui/dialog";

function LandingContainer() {
  const [authOpen, setAuthOpen] = React.useState(false);

  return (
    <>
      <Landing onOpenAuth={() => setAuthOpen(true)} />
      <Dialog open={authOpen} onOpenChange={setAuthOpen}>
        <DialogContent className="sm:max-w-[425px] p-0 overflow-hidden bg-white rounded-2xl border-0 shadow-2xl">
          <Login onAuthSuccess={() => setAuthOpen(false)} />
        </DialogContent>
      </Dialog>
    </>
  );
}
"""

content = content.replace('import Landing from "@/pages/Landing";', 'import Landing from "@/pages/Landing";\n' + new_landing_route)

content = content.replace('<Route path="/" component={() => <PublicOnlyRoute component={Landing} />} />', '<Route path="/" component={() => <PublicOnlyRoute component={LandingContainer} />} />')

# Let's also update Login.tsx to accept onAuthSuccess and render inside the modal seamlessly,
# stripping out its background and Helmet since it's now in a modal.

with open('artifacts/business-portal/src/App.tsx', 'w') as f:
    f.write(content)
