import re

with open('artifacts/business-portal/src/pages/Dashboard.tsx', 'r') as f:
    content = f.read()

if "Skeleton" not in content:
    content = content.replace('import { api', 'import { Skeleton } from "@/components/ui/skeleton";\nimport { api')

old_loading = """  if (loading && !overview) {
    return (
      <Layout title="Dashboard">
        <div className="flex items-center justify-center h-64 text-muted-foreground gap-2">
          <Loader2 size={18} className="animate-spin" />
          Loading dashboard...
        </div>
      </Layout>
    );
  }"""

new_loading = """  if (loading && !overview) {
    return (
      <Layout title="Dashboard">
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="bg-white border rounded-2xl p-5 shadow-sm space-y-3">
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-8 w-3/4" />
                <Skeleton className="h-3 w-1/3" />
              </div>
            ))}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Skeleton className="h-64 rounded-2xl" />
            <Skeleton className="h-64 rounded-2xl" />
          </div>
        </div>
      </Layout>
    );
  }"""

content = content.replace(old_loading, new_loading)

with open('artifacts/business-portal/src/pages/Dashboard.tsx', 'w') as f:
    f.write(content)
