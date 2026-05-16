import re

with open('artifacts/business-portal/src/App.tsx', 'r') as f:
    content = f.read()

# Make the Landing modal container have tabs for Login/Register
old_container = """function LandingContainer() {
  const [authOpen, setAuthOpen] = React.useState(false);

  return (
    <>
      <Landing onOpenAuth={() => setAuthOpen(true)} />
      <Dialog open={authOpen} onOpenChange={setAuthOpen}>
        <DialogContent className="sm:max-w-[425px] p-0 overflow-hidden bg-white rounded-2xl border-0 shadow-2xl">
          <Login onAuthSuccess={() => setAuthOpen(false)} isModal={true} />
        </DialogContent>
      </Dialog>
    </>
  );
}"""

new_container = """import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

function LandingContainer() {
  const [authOpen, setAuthOpen] = React.useState(false);

  return (
    <>
      <Landing onOpenAuth={() => setAuthOpen(true)} />
      <Dialog open={authOpen} onOpenChange={setAuthOpen}>
        <DialogContent className="sm:max-w-[425px] p-0 overflow-hidden bg-white rounded-2xl border-0 shadow-2xl">
          <div className="p-4 bg-gray-50/50 border-b">
            <h2 className="text-xl font-bold text-[#005d90]">Welcome to Aorane</h2>
            <p className="text-sm text-gray-500">Sign in to your enterprise account</p>
          </div>
          <Tabs defaultValue="login" className="w-full">
            <div className="px-6 pt-4">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="login">Login</TabsTrigger>
                <TabsTrigger value="register">Register</TabsTrigger>
              </TabsList>
            </div>
            <TabsContent value="login">
              <Login onAuthSuccess={() => setAuthOpen(false)} isModal={true} />
            </TabsContent>
            <TabsContent value="register">
              <Register onAuthSuccess={() => setAuthOpen(false)} isModal={true} />
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
    </>
  );
}"""

content = content.replace(old_container, new_container)

if "import Register from" not in content:
    # it's already there
    pass

with open('artifacts/business-portal/src/App.tsx', 'w') as f:
    f.write(content)
