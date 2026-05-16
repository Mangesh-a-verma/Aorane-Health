import re

with open('artifacts/business-portal/src/pages/Members.tsx', 'r') as f:
    content = f.read()

# Add a Skeleton import
if "Skeleton" not in content:
    content = content.replace('import { api', 'import { Skeleton } from "@/components/ui/skeleton";\nimport { api')

# Replace the old loading state with skeleton loaders
old_loading = """  if (loading && !members.length) {
    return (
      <Layout title="Members">
        <div className="flex items-center justify-center h-64 text-muted-foreground gap-2">
          <Loader2 size={18} className="animate-spin" />
          Loading members...
        </div>
      </Layout>
    );
  }"""

new_loading = """  if (loading && !members.length) {
    return (
      <Layout title="Members">
        <div className="mb-8 flex items-center justify-between">
          <Skeleton className="h-10 w-48 rounded-xl" />
          <Skeleton className="h-10 w-32 rounded-xl" />
        </div>
        <div className="bg-white border rounded-2xl overflow-hidden shadow-sm">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex items-center justify-between p-4 border-b">
              <div className="flex items-center gap-4">
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="space-y-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-24" />
                </div>
              </div>
              <Skeleton className="h-6 w-16 rounded-full" />
            </div>
          ))}
        </div>
      </Layout>
    );
  }"""

content = content.replace(old_loading, new_loading)

# Let's make the table more premium (sticky header, better spacing, rounded edges)
old_table = """          <div className="bg-card border border-border rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-muted/50 text-muted-foreground text-xs uppercase font-semibold">
                  <tr>
                    <th className="px-6 py-4">Employee</th>
                    <th className="px-6 py-4">Role</th>
                    <th className="px-6 py-4 text-center">Health Plan</th>
                    <th className="px-6 py-4">Joined At</th>
                    <th className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">"""

new_table = """          <div className="bg-white border border-gray-100 shadow-[0_4px_24px_rgba(0,0,0,0.02)] rounded-[24px] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-[#F8FAFC] text-gray-500 text-[11px] uppercase tracking-wider font-semibold sticky top-0 z-10">
                  <tr>
                    <th className="px-6 py-5 border-b border-gray-100">Employee</th>
                    <th className="px-6 py-5 border-b border-gray-100">Role</th>
                    <th className="px-6 py-5 border-b border-gray-100 text-center">Health Plan</th>
                    <th className="px-6 py-5 border-b border-gray-100">Joined At</th>
                    <th className="px-6 py-5 border-b border-gray-100 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">"""

content = content.replace(old_table, new_table)

with open('artifacts/business-portal/src/pages/Members.tsx', 'w') as f:
    f.write(content)
