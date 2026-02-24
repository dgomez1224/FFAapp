/**
 * useEntryId Hook - Entry ID Management
 * 
 * Manages entry ID selection from URL query params or localStorage.
 * URL is the source of truth; localStorage is convenience only.
 * 
 * This is NOT authentication - it's just a UX convenience for selecting
 * which team/entry to view in the live matchups.
 */

import { useState, useEffect, useCallback } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";

const STORAGE_KEY = "ffa.entryId";

/**
 * Validates that a string is a positive integer
 */
function isValidEntryId(value: string | null): value is string {
  if (!value) return false;
  const num = Number.parseInt(value, 10);
  return Number.isInteger(num) && num > 0;
}

/**
 * Hook to manage entry ID from URL params or localStorage
 * 
 * @returns { entryId: string | null, setEntryId: (id: string | null) => void }
 */
export function useEntryId(): {
  entryId: string | null;
  setEntryId: (id: string | null) => void;
} {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const [entryId, setEntryIdState] = useState<string | null>(null);

  // Initialize from URL or localStorage
  useEffect(() => {
    const urlEntryId = searchParams.get("entryId");
    
    if (urlEntryId && isValidEntryId(urlEntryId)) {
      setEntryIdState(urlEntryId);
      // Sync to localStorage for convenience
      localStorage.setItem(STORAGE_KEY, urlEntryId);
    } else {
      // Fall back to localStorage if no URL param
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored && isValidEntryId(stored)) {
        setEntryIdState(stored);
        // Update URL to reflect localStorage value
        const newParams = new URLSearchParams(searchParams);
        newParams.set("entryId", stored);
        setSearchParams(newParams, { replace: true });
      } else {
        setEntryIdState(null);
      }
    }
  }, [searchParams, setSearchParams]);

  const setEntryId = useCallback(
    (id: string | null) => {
      if (id === null) {
        setEntryIdState(null);
        // Remove from URL and localStorage
        const newParams = new URLSearchParams(searchParams);
        newParams.delete("entryId");
        setSearchParams(newParams, { replace: true });
        localStorage.removeItem(STORAGE_KEY);
      } else if (isValidEntryId(id)) {
        setEntryIdState(id);
        // Update URL (source of truth)
        const newParams = new URLSearchParams(searchParams);
        newParams.set("entryId", id);
        setSearchParams(newParams, { replace: false }); // Use pushState, not replace
        // Also update localStorage for convenience
        localStorage.setItem(STORAGE_KEY, id);
      }
      // If invalid, silently ignore
    },
    [searchParams, setSearchParams]
  );

  return { entryId, setEntryId };
}
