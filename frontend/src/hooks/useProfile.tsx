"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { StudentPayload } from "@/types/api";

/**
 * Profile store — the single source of truth for the student's answers.
 * Persisted to localStorage so navigation and reloads never lose data
 * (the same guarantee the previous UI made with its keep-alive pattern).
 */

const STORAGE_KEY = "study-abroad-profile-v1";

export const emptyProfile: StudentPayload = {
  targetCourse: "",
  degreeLevel: "",
  preferredCountries: [],
  preferredCity: "",
  budgetText: "",
  homeCountry: "",
  gradingSystem: "",
  gradingValue: "",
  intakeSession: "",
  wantsScholarship: false,
  workExperienceYears: "",
  backlogs: "",
  priorityFocus: "No specific priority",
  priorityNote: "",
  englishTests: {},
  aptitudeTests: {},
  satScore: "",
  actScore: "",
  greScore: "",
  gmatScore: "",
  allowBroader: false,
};

interface ProfileContextValue {
  profile: StudentPayload;
  setProfile: (p: StudentPayload) => void;
  update: (patch: Partial<StudentPayload>) => void;
  reset: () => void;
  compareKeys: string[];
  toggleCompare: (key: string) => void;
  clearCompare: () => void;
  hydrated: boolean;
}

const ProfileContext = createContext<ProfileContextValue | null>(null);

export function ProfileProvider({ children }: { children: React.ReactNode }) {
  const [profile, setProfileState] = useState<StudentPayload>(emptyProfile);
  const [compareKeys, setCompareKeys] = useState<string[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        setProfileState({ ...emptyProfile, ...parsed.profile });
        setCompareKeys(parsed.compareKeys ?? []);
      }
    } catch {
      /* corrupted storage must never break the app */
    }
    setHydrated(true);
  }, []);

  const persist = useCallback((p: StudentPayload, keys: string[]) => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ profile: p, compareKeys: keys }));
    } catch {
      /* storage full/blocked — in-memory state still works */
    }
  }, []);

  const setProfile = useCallback(
    (p: StudentPayload) => {
      setProfileState(p);
      persist(p, compareKeys);
    },
    [compareKeys, persist]
  );

  const update = useCallback(
    (patch: Partial<StudentPayload>) => {
      setProfileState((prev) => {
        const next = { ...prev, ...patch };
        persist(next, compareKeys);
        return next;
      });
    },
    [compareKeys, persist]
  );

  const reset = useCallback(() => {
    setProfileState(emptyProfile);
    setCompareKeys([]);
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* noop */
    }
  }, []);

  const toggleCompare = useCallback(
    (key: string) => {
      setCompareKeys((prev) => {
        const next = prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key];
        persist(profile, next);
        return next;
      });
    },
    [persist, profile]
  );

  const clearCompare = useCallback(() => {
    setCompareKeys([]);
    persist(profile, []);
  }, [persist, profile]);

  const value = useMemo(
    () => ({ profile, setProfile, update, reset, compareKeys, toggleCompare, clearCompare, hydrated }),
    [profile, setProfile, update, reset, compareKeys, toggleCompare, clearCompare, hydrated]
  );

  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>;
}

export function useProfile(): ProfileContextValue {
  const ctx = useContext(ProfileContext);
  if (!ctx) throw new Error("useProfile must be used inside <ProfileProvider>");
  return ctx;
}
