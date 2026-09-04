# API Reference

Base URL: `http://localhost:8000` (development)

All endpoints return JSON. POST endpoints accept JSON payloads.

## Table of Contents

- [Health Check](#health-check)
- [Metadata](#metadata)
- [Profile Validation](#profile-validation)
- [University Search](#university-search)
- [University Detail](#university-detail)
- [Admission Roadmap](#admission-roadmap)
- [Rerank Results](#rerank-results)
- [Compare Universities](#compare-universities)
- [Common Data Types](#common-data-types)
- [Error Responses](#error-responses)

---

## Health Check

Check if the API is running.

**Endpoint:** `GET /api/health`

**Response:**
```json
{
  "status": "ok",
  "version": "2.0.0"
}
```

---

## Metadata

Get available countries, cities, courses, and other metadata.

**Endpoint:** `GET /api/meta`

**Response:**
```json
{
  "countries": ["USA", "UK", "Canada", ...],
  "top_countries": [...],
  "cities_by_country": {
    "USA": ["New York", "Boston", "San Francisco", ...],
    ...
  },
  "courses": ["Computer Science", "Business Analytics", ...],
  "grading_systems": ["Percentage", "CGPA (4.0)", "CGPA (10.0)", "GPA (5.0)"],
  "intakes": ["Fall", "Spring", "Summer"],
  "priorities": ["Cost", "Career Prospects", "University Reputation", "Location"],
  "scholarship_preferences": ["High priority", "Moderate priority", "Low priority"],
  "data_version": "v1.0.0",
  "last_updated": "July 2026"
}
```

---

## Profile Validation

Validate a student profile without performing search.

**Endpoint:** `POST /api/validate`

**Request Body:**
```json
{
  "homeCountry": "India",
  "targetCountries": ["USA", "UK"],
  "preferredCity": "New York",
  "preferredCourse": "Computer Science",
  "degreeLevel": "Master's",
  "preferredIntake": "Fall 2025",
  "gradingSystem": "Percentage",
  "gradingValue": "85",
  "englishTest": "IELTS",
  "englishScore": "7.5",
  "budgetText": "$50000 per year",
  "priority": "Cost",
  "scholarshipPreference": "High priority"
}
```

**Response:**
```json
{
  "valid": true,
  "messages": {
    "budget": "Budget recognized: $50,000/year total",
    "academic": "85% normalized to 3.4/4.0 CGPA",
    "city": "New York, USA matched",
    "english": "IELTS 7.5 is competitive for top universities"
  },
  "warnings": [],
  "profile_summary": {
    "academic_strength": "Strong",
    "budget_category": "Medium",
    "english_level": "Excellent"
  }
}
```

---

## University Search

Search for universities matching the student profile.

**Endpoint:** `POST /api/search`

**Request Body:** Same as Profile Validation

**Response:**
```json
{
  "results": [
    {
      "key": "university-of-california-berkeley-usa",
      "name": "University of California, Berkeley",
      "country": "USA",
      "city": "Berkeley",
      "course_name": "Master of Science in Computer Science",
      "ai_fit_score": 92,
      "admission_likelihood": "Target",
      "tuition_usd": 45000,
      "total_cost_usd": 72000,
      "duration_years": 2,
      "qs_rank": 27,
      "fit_reasons": [
        "Strong academic match (your 3.4 vs required 3.0)",
        "Excellent computer science program",
        "Within budget range",
        "High scholarship availability"
      ],
      "concerns": [
        "Highly competitive (15% acceptance rate)"
      ],
      "scholarship_available": true,
      "pillar_scores": {
        "academic": 0.95,
        "course": 1.0,
        "reputation": 0.98,
        "career": 0.95,
        "roi": 0.85,
        "scholarship": 0.90,
        "location": 0.85,
        "visa": 0.88
      }
    },
    ...
  ],
  "total_count": 42,
  "filters_applied": {
    "min_cgpa": 3.0,
    "countries": ["USA", "UK"],
    "course": "Computer Science",
    "degree": "Master's"
  }
}
```

---

## University Detail

Get detailed information about a specific university.

**Endpoint:** `POST /api/university/{key}`

**URL Parameters:**
- `key` - University key (e.g., "university-of-california-berkeley-usa")

**Request Body:** Same as Profile Validation (for personalization)

**Response:**
```json
{
  "key": "university-of-california-berkeley-usa",
  "name": "University of California, Berkeley",
  "official_url": "https://www.berkeley.edu",
  "country": "USA",
  "city": "Berkeley",
  "institution_type": "Public Research University",
  
  "rankings": {
    "qs_rank": 27,
    "the_rank": 8,
    "national_rank": 3
  },
  
  "program": {
    "course_name": "Master of Science in Computer Science",
    "course_category": "Computer Science",
    "degree_level": "Master's",
    "duration_years": 2
  },
  
  "costs": {
    "tuition_usd_per_year": 45000,
    "living_cost_usd_per_year": 27000,
    "total_cost_usd": 144000,
    "avg_grad_salary_usd": 120000
  },
  
  "admission": {
    "ielts_required": 7.0,
    "toefl_required": 90,
    "pte_required": 68,
    "duolingo_required": 120,
    "gpa_required_percent": 75.0,
    "gre_gmat_note": "GRE recommended",
    "acceptance_rate_percent": 15.0,
    "application_fee_usd": 135
  },
  
  "eligibility": {
    "eligible": true,
    "your_cgpa": 3.4,
    "required_cgpa": 3.0,
    "margin": "+0.4",
    "english_test": "IELTS 7.5 (required: 7.0)",
    "backlogs_ok": true
  },
  
  "scholarships": [
    "Merit-Based Fellowship ($10,000-$25,000)",
    "Graduate Research Assistantship (Full tuition)",
    "Diversity Excellence Award ($15,000)"
  ],
  
  "highlights": {
    "campus": ["State-of-the-art AI research labs", "Silicon Valley proximity", ...],
    "faculty": ["Nobel Prize laureates", "Industry veterans from Google, Meta", ...],
    "curriculum": ["Specializations in ML, AI, Systems", "Capstone project", ...]
  },
  
  "career": {
    "placement_rate_percent": 95,
    "top_recruiters": ["Google", "Apple", "Meta", "Microsoft", ...],
    "avg_starting_salary_usd": 120000
  },
  
  "ai_analysis": {
    "fit_score": 92,
    "admission_likelihood": "Target",
    "strengths": ["Strong academic profile", "Excellent ROI", ...],
    "concerns": ["High competition", ...],
    "recommendation": "Highly recommended - great fit for your profile"
  }
}
```

---

## Admission Roadmap

Get a personalized admission timeline for a university.

**Endpoint:** `POST /api/university/{key}/roadmap`

**URL Parameters:**
- `key` - University key

**Request Body:** Same as Profile Validation

**Response:**
```json
{
  "university": "University of California, Berkeley",
  "target_intake": "Fall 2025",
  "timeline": [
    {
      "phase": "Preparation",
      "deadline": "December 2024",
      "tasks": [
        "Finalize statement of purpose",
        "Request recommendation letters (3 required)",
        "Prepare transcripts and certificates",
        "Take GRE (score: 320+ recommended)"
      ],
      "status": "upcoming"
    },
    {
      "phase": "Application",
      "deadline": "January 15, 2025",
      "tasks": [
        "Submit online application",
        "Upload all documents",
        "Pay application fee ($135)",
        "Submit English test scores (IELTS 7.0+)"
      ],
      "status": "upcoming",
      "critical": true
    },
    {
      "phase": "Decision",
      "deadline": "April 2025",
      "tasks": [
        "Wait for admission decision",
        "Review scholarship offers if admitted",
        "Compare with other offers"
      ],
      "status": "future"
    },
    {
      "phase": "Visa & Enrollment",
      "deadline": "June-August 2025",
      "tasks": [
        "Accept offer and pay deposit",
        "Apply for F-1 student visa",
        "Arrange housing",
        "Book flights",
        "Attend orientation"
      ],
      "status": "future"
    }
  ],
  "important_dates": {
    "application_deadline": "January 15, 2025",
    "decision_release": "April 1-15, 2025",
    "enrollment_deadline": "May 1, 2025",
    "program_start": "August 25, 2025"
  },
  "required_documents": [
    "Bachelor's degree transcripts",
    "Statement of Purpose (500-1000 words)",
    "3 Letters of Recommendation",
    "Resume/CV",
    "English proficiency test scores",
    "GRE scores (optional but recommended)",
    "Passport copy",
    "Financial documents ($75,000+ for visa)"
  ]
}
```

---

## Rerank Results

Rerank universities when the student updates preferences.

**Endpoint:** `POST /api/rerank`

**Request Body:**
```json
{
  // Full profile with updated priority
  "priority": "University Reputation",  // Changed from "Cost"
  ...
}
```

**Response:** Same format as University Search, but with updated rankings based on new weights.

---

## Compare Universities

Compare multiple universities side-by-side.

**Endpoint:** `POST /api/compare`

**Request Body:**
```json
{
  "universities": [
    "university-of-california-berkeley-usa",
    "stanford-university-usa",
    "mit-usa"
  ],
  // Student profile for personalization
  ...
}
```

**Response:**
```json
{
  "comparison": [
    {
      "university": "UC Berkeley",
      "key": "university-of-california-berkeley-usa",
      "ai_fit_score": 92,
      "tuition": 45000,
      "total_cost": 144000,
      "duration": 2,
      "qs_rank": 27,
      "acceptance_rate": 15,
      "avg_salary": 120000,
      "roi_years": 1.2,
      "scholarships": "High availability",
      "location": "Berkeley, USA",
      "pros": ["Excellent ROI", "Strong CS program", "Silicon Valley proximity"],
      "cons": ["High competition"]
    },
    ...
  ],
  "best_for": {
    "cost": "University Name",
    "reputation": "Stanford University",
    "roi": "UC Berkeley",
    "career": "MIT"
  }
}
```

---

## Common Data Types

### StudentProfile (Request)

```typescript
interface StudentProfile {
  // Demographics
  homeCountry: string;                    // e.g., "India"
  targetCountries: string[];              // e.g., ["USA", "UK"]
  preferredCity?: string;                 // Optional, e.g., "New York"
  
  // Academic
  preferredCourse: string;                // e.g., "Computer Science"
  degreeLevel: string;                    // "Bachelor's" | "Master's" | "PhD"
  preferredIntake: string;                // e.g., "Fall 2025"
  gradingSystem: string;                  // "Percentage" | "CGPA (4.0)" | etc.
  gradingValue: string;                   // e.g., "85" or "3.5"
  backlogs?: number;                      // Number of backlogs (optional)
  workExperience?: number;                // Years (for MBA)
  
  // English Proficiency
  englishTest: string;                    // "IELTS" | "TOEFL" | "PTE" | "Duolingo"
  englishScore: string;                   // e.g., "7.5"
  
  // Financial
  budgetText: string;                     // Free-form, e.g., "$50000 per year"
  
  // Preferences
  priority: string;                       // "Cost" | "Career Prospects" | etc.
  scholarshipPreference: string;          // "High" | "Moderate" | "Low priority"
}
```

### University Result (Response)

```typescript
interface UniversityResult {
  key: string;                            // Unique identifier
  name: string;
  country: string;
  city: string;
  course_name: string;
  ai_fit_score: number;                   // 0-100
  admission_likelihood: string;           // "Reach" | "Target" | "Safety"
  tuition_usd: number;
  total_cost_usd: number;
  duration_years: number;
  qs_rank: number | null;
  fit_reasons: string[];
  concerns: string[];
  scholarship_available: boolean;
  pillar_scores: {
    academic: number;                     // 0-1
    course: number;
    reputation: number;
    career: number;
    roi: number;
    scholarship: number;
    location: number;
    visa: number;
  };
}
```

---

## Error Responses

### 400 Bad Request

Invalid input data.

```json
{
  "error": "Validation error",
  "detail": "gradingValue must be a number"
}
```

### 404 Not Found

University not found.

```json
{
  "detail": "University not found"
}
```

### 500 Internal Server Error

Server error.

```json
{
  "error": "Internal server error",
  "detail": "An unexpected error occurred"
}
```

---

## Rate Limiting

Currently no rate limiting is applied. In production:

- **Anonymous users:** 100 requests/hour
- **Authenticated users:** 1000 requests/hour

---

## CORS

Allowed origins (configurable via `CORS_ORIGINS` env variable):
- `http://localhost:3000` (development)
- `http://127.0.0.1:3000` (development)
- Production domains (to be configured)

---

## Authentication

Currently no authentication is required. Future versions will support:

- JWT tokens
- OAuth2 (Google, GitHub)
- API keys

---

## Versioning

API version is included in the `/api/health` response.

Future breaking changes will be versioned as:
- `/api/v2/search`
- `/api/v3/search`

---

**Next:** See [ARCHITECTURE.md](ARCHITECTURE.md) for how these endpoints map onto
the service and domain layers, or the [root README](../README.md) for setup and
how to run the app.
