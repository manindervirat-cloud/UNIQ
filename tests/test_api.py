import requests

# Test search endpoint with correct payload format
payload = {
    'targetCourse': 'Computer Science',
    'degreeLevel': "Master's",
    'preferredCountries': ['USA'],
    'preferredCity': 'Boston',
    'budgetText': '30 lakh',
    'homeCountry': 'India',
    'gradingSystem': 'CGPA (4.0 scale)',
    'gradingValue': '3.5',
    'intakeSession': 'Fall',
    'wantsScholarship': True,
    'workExperienceYears': '0',
    'backlogs': '0',
    'priorityFocus': 'No specific priority',
    'priorityNote': '',
    'englishTests': {'IELTS Academic': 7.0},
    'aptitudeTests': {},
}

# Test search endpoint
r = requests.post('http://127.0.0.1:8000/api/search', json=payload, timeout=30)
print(f"Search status: {r.status_code}")
import json
data = r.json()
print(f"Ranked count: {len(data.get('ranked', []))}")
print(f"Eligible count: {data.get('nEligible', 0)}")
print(f"Conditional count: {data.get('nConditional', 0)}")
print(f"Undetermined count: {data.get('nUndetermined', 0)}")

# Test meta endpoint
r2 = requests.get('http://127.0.0.1:8000/api/meta', timeout=10)
print(f"\nMeta status: {r2.status_code}")
meta = r2.json()
print(f"Countries: {meta.get('countries', [])[:5]}...")
print(f"Courses: {meta.get('courses', [])[:5]}...")

# Test validate endpoint
r3 = requests.post('http://127.0.0.1:8000/api/validate', json=payload, timeout=10)
print(f"\nValidate status: {r3.status_code}")
print(json.dumps(r3.json(), indent=2))

# Test university detail
if data.get('ranked'):
    key = data['ranked'][0]['university']['key']
    r4 = requests.post(f'http://127.0.0.1:8000/api/university/{key}', json=payload, timeout=30)
    print(f"\nUniversity detail status: {r4.status_code}")
    detail = r4.json()
    print(f"University: {detail.get('result', {}).get('university', {}).get('name', 'N/A')}")
    print(f"Fit score: {detail.get('result', {}).get('fitScore', 'N/A')}")
    
    # Test roadmap
    r5 = requests.post(f'http://127.0.0.1:8000/api/university/{key}/roadmap', json=payload, timeout=30)
    print(f"\nRoadmap status: {r5.status_code}")
    roadmap = r5.json()
    print(f"Probability: {roadmap.get('probabilityLabel', 'N/A')}")
    print(f"Projected chance: {roadmap.get('projectedChancePercent', 'N/A')}")
    print(f"Items: {len(roadmap.get('items', []))}")

# Test rerank
if data.get('ranked'):
    ranked_keys = [r['university']['key'] for r in data['ranked'][:10]]
    r6 = requests.post('http://127.0.0.1:8000/api/rerank', json={**payload, 'rankedKeys': ranked_keys}, timeout=30)
    print(f"\nRerank status: {r6.status_code}")
    rerank = r6.json()
    print(f"Entries: {len(rerank.get('entries', []))}")

# Test compare
if data.get('ranked'):
    compare_keys = [data['ranked'][0]['university']['key'], data['ranked'][1]['university']['key']]
    r7 = requests.post('http://127.0.0.1:8000/api/compare', json={**payload, 'keys': compare_keys}, timeout=30)
    print(f"\nCompare status: {r7.status_code}")
    compare = r7.json()
    print(f"Results: {len(compare.get('results', []))}")