import re

with open('artifacts/business-portal/src/pages/Members.tsx', 'r') as f:
    content = f.read()

# Add useQuery import if not present
if "useQuery" not in content:
    content = content.replace(
        'import React, { useEffect, useState, useRef } from "react";',
        'import React, { useEffect, useState, useRef } from "react";\nimport { useQuery } from "@tanstack/react-query";'
    )

old_state_block = """  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [aoraneQuery, setAoraneQuery] = useState("");
  const [searchResults, setSearchResults] = useState<MemberSearchResult[] | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [detailUserId, setDetailUserId] = useState<string | null>(null);
  const [detailName, setDetailName] = useState<string | null>(null);
  const [detailGradient, setDetailGradient] = useState<string>(AVATAR_GRADIENTS[0]);
  const [suspendedMembers, setSuspendedMembers] = useState<Member[]>([]);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchMembers = () => {
    setLoading(true);
    Promise.all([api.members(), api.getSuspendedMembers()])
      .then(([active, suspended]) => {
        setMembers(active);
        setSuspendedMembers(suspended);
        setError("");
      })
      .catch((err) => {
        console.error(err);
        setError("Failed to load members");
      })
      .finally(() => setLoading(false));
  };

  const handleRestore = async (userId: string) => {
    if (!confirm("Restore this member's access?")) return;
    setRestoringId(userId);
    try {
      await api.restoreMember(userId);
      fetchMembers();
    } catch (e: unknown) {
      alert((e as Error).message || "Failed to restore member");
    } finally { setRestoringId(null); }
  };

  useEffect(() => { fetchMembers(); }, []);"""

new_state_block = """  const [search, setSearch] = useState("");
  const [aoraneQuery, setAoraneQuery] = useState("");
  const [searchResults, setSearchResults] = useState<MemberSearchResult[] | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [detailUserId, setDetailUserId] = useState<string | null>(null);
  const [detailName, setDetailName] = useState<string | null>(null);
  const [detailGradient, setDetailGradient] = useState<string>(AVATAR_GRADIENTS[0]);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { data: membersData, isLoading: loadingMembers, error: membersError, refetch: refetchMembers } = useQuery({
    queryKey: ["members"],
    queryFn: () => api.members()
  });

  const { data: suspendedData, isLoading: loadingSuspended, refetch: refetchSuspended } = useQuery({
    queryKey: ["suspendedMembers"],
    queryFn: () => api.getSuspendedMembers()
  });

  const members = membersData || [];
  const suspendedMembers = suspendedData || [];
  const loading = loadingMembers || loadingSuspended;
  const error = membersError ? "Failed to load members" : "";

  const fetchMembers = () => {
    refetchMembers();
    refetchSuspended();
  };

  const handleRestore = async (userId: string) => {
    if (!confirm("Restore this member's access?")) return;
    setRestoringId(userId);
    try {
      await api.restoreMember(userId);
      fetchMembers();
    } catch (e: unknown) {
      alert((e as Error).message || "Failed to restore member");
    } finally { setRestoringId(null); }
  };"""

content = content.replace(old_state_block, new_state_block)

with open('artifacts/business-portal/src/pages/Members.tsx', 'w') as f:
    f.write(content)
