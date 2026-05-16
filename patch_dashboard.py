import re

with open('artifacts/business-portal/src/pages/Dashboard.tsx', 'r') as f:
    content = f.read()

# Add useQuery import if not present
if "useQuery" not in content:
    content = content.replace(
        'import React, { useEffect, useState } from "react";',
        'import React, { useEffect, useState } from "react";\nimport { useQuery } from "@tanstack/react-query";'
    )

# Replace state and useEffect
old_state_block = """  const firstName = admin?.fullName?.split(" ")[0] || "there";
  const [overview, setOverview] = useState<Overview | null>(null);
  const [analytics, setAnalytics] = useState<HealthAnalytics | null>(null);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);
  const [analyticsLoading, setAnalyticsLoading] = useState(true);

  // Employee stress lookup state
  const [stressQuery, setStressQuery] = useState("");
  const [stressResults, setStressResults] = useState<MemberSearchResult[]>([]);
  const [stressSearching, setStressSearching] = useState(false);
  const [stressSearchErr, setStressSearchErr] = useState("");
  const [selectedStressUser, setSelectedStressUser] = useState<MemberSearchResult | null>(null);
  const [memberStress, setMemberStress] = useState<MemberStress | null>(null);
  const [stressLookupLoading, setStressLookupLoading] = useState(false);

  useEffect(() => {
    api.overview().then(setOverview).catch(console.error).finally(() => setLoading(false));
    api.getHealthAnalytics().then(setAnalytics).catch(console.error).finally(() => setAnalyticsLoading(false));
  }, []);"""

new_state_block = """  const firstName = admin?.fullName?.split(" ")[0] || "there";

  const { data: overview, isLoading: loading } = useQuery({
    queryKey: ["overview"],
    queryFn: () => api.overview()
  });

  const { data: analytics, isLoading: analyticsLoading } = useQuery({
    queryKey: ["healthAnalytics"],
    queryFn: () => api.getHealthAnalytics()
  });

  const [copied, setCopied] = useState(false);

  // Employee stress lookup state
  const [stressQuery, setStressQuery] = useState("");
  const [stressResults, setStressResults] = useState<MemberSearchResult[]>([]);
  const [stressSearching, setStressSearching] = useState(false);
  const [stressSearchErr, setStressSearchErr] = useState("");
  const [selectedStressUser, setSelectedStressUser] = useState<MemberSearchResult | null>(null);
  const [memberStress, setMemberStress] = useState<MemberStress | null>(null);
  const [stressLookupLoading, setStressLookupLoading] = useState(false);"""

content = content.replace(old_state_block, new_state_block)

with open('artifacts/business-portal/src/pages/Dashboard.tsx', 'w') as f:
    f.write(content)
