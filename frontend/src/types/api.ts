/**
 * Shared API types — mirrors backend/services.py serialization exactly.
 */

export interface University {
  key: string;
  name: string;
  officialUrl: string;
  country: string;
  city: string;
  institutionType: string;
  qsRank: number | null;
  theRank: number | null;
  nationalRank: number | null;
  subjectStrengths: string[];
  courseName: string;
  courseCategory: string;
  degreeLevel: string;
  durationYears: number;
  tuitionUsdPerYear: number;
  livingCostUsdPerYear: number;
  totalCostUsdPerYear: number;
  avgGradSalaryUsd: number;
  scholarships: string[];
  ieltsRequired: number;
  toeflRequired: number;
  pteRequired: number;
  duolingoRequired: number;
  gpaRequiredPercent: number;
  greGmatNote: string;
  acceptanceRatePercent: number;
  intakes: string[];
  deadlines: string;
  placementRatePercent: number;
  internshipSupport: boolean;
  studentPopulation: number;
  internationalStudentPercent: number;
  campusFacilities: string[];
  eligibilityCriteria: string;
  campusHighlight: string;
  facultyHighlight: string;
  curriculumHighlight: string;
  topRecruiters: string[];
  logoUrl: string;
  monogram: string;
}

export interface RankedResult {
  university: University;
  fitScore: number;
  fitLabel: string;
  admissionChancePercent: number;
  admissionNote: string;
  pillarScores: Record<string, number>;
  headline: string;
  strengths: string[];
  reasons: string[];
  risks: string[];
  eligibilityStatus: "eligible" | "conditional" | "undetermined";
  conditionalNote: string;
  englishStatus: "met" | "below" | "missing";
  englishDetail: string;
  budgetStatus: "within" | "stretch" | "over";
  budgetNote: string;
  tuitionDisplay: string;
  livingDisplay: string;
  totalDisplay: string;
}

export interface SearchResponse {
  ranked: RankedResult[];
  excluded: { university: University; failures: string[] }[];
  nEligible: number;
  nConditional: number;
  nUndetermined: number;
  nWithinBudget: number;
  budgetFloorUsd: number;
  budgetFloorDisplay: string;
  cheapestName: string;
  budgetCheck: { level: "ok" | "tight" | "unrealistic"; message: string };
  fallbackAll: boolean;
  allowBroader: boolean;
}

export interface Meta {
  dataVersion: string;
  dataRefreshed: string;
  courses: string[];
  degreeLevels: string[];
  countries: string[];
  citiesByCountry: Record<string, string[]>;
  homeCountries: string[];
  gradingSystems: string[];
  englishTests: string[];
  englishTestRanges: Record<string, { min: number; max: number; step: number; hint: string }>;
  aptitudeByDegree: Record<string, string[]>;
  aptitudeTests: Record<
    string,
    { min: number; max: number; step: number; hint: string; aliases: string[]; for: string }
  >;
  courseLibrary: { name: string; aliases: string[]; supported: boolean }[];
  priorities: string[];
  intakes: string[];
  pillars: Record<string, { label: string; icon: string }>;
}

export interface StudentPayload {
  targetCourse: string;
  degreeLevel: string;
  preferredCountries: string[];
  preferredCity: string;
  budgetText: string;
  homeCountry: string;
  gradingSystem: string;
  gradingValue: string;
  intakeSession: string;
  wantsScholarship: boolean;
  workExperienceYears: string;
  backlogs: string;
  priorityFocus: string;
  priorityNote: string;
  englishTests: Record<string, number>;
  aptitudeTests?: Record<string, number>;
  satScore?: string;
  actScore?: string;
  greScore?: string;
  gmatScore?: string;
  allowBroader?: boolean;
}

export interface ValidationResponse {
  budget: { ok: boolean; note: string; error: string; amountUsd: number };
  academic: { ok: boolean; display: string; error: string; percent: number };
  city: {
    query: string;
    resolvedCity: string;
    method: string;
    note: string;
    hasUniversities: boolean;
  };
  course: {
    query: string;
    matched: string;
    supported: boolean;
    method: string;
    note: string;
  };
}

export interface Roadmap {
  probabilityLabel: "High" | "Moderate" | "Low";
  probabilityPercent: number;
  summary: string;
  strengths: string[];
  gaps: string[];
  items: { priority: "High" | "Medium" | "Optional"; area: string; action: string; impact: string }[];
  projectedChancePercent: number;
  disclaimer: string;
}

export interface UniversityDetail {
  result: RankedResult;
  verdict: {
    status: "eligible" | "conditional" | "undetermined" | "ineligible";
    failures: string[];
    conditions: string[];
    missing: string[];
    englishStatus: "met" | "below" | "missing";
    englishDetail: string;
    budgetStatus: string;
    budgetNote: string;
  };
  whyChoose: string;
  pros: string[];
  cons: string[];
  digest: {
    sentimentLabel: string;
    sentimentScore: number;
    summary: string;
    praised: string[];
    concerns: string[];
    approxSignals: number;
    refreshed: string;
    basisNote: string;
  };
  siblingCourses: string[];
  ieltsEquivalent: number | null;
  budgetDisplay: string | null;
}

export interface RerankEntry {
  name: string;
  oldRank: number;
  newRank: number;
  movement: string;
  reason: string;
}
