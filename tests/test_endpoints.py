import requests

# Test health
r = requests.get('http://127.0.0.1:8000/api/health')
print(f"Health: {r.json()}")

# Test meta
r = requests.get('http://127.0.0.1:8000/api/meta')
data = r.json()
print(f"Meta keys: {list(data.keys())}")
print(f"Courses: {len(data.get('courses', []))}")
print(f"Countries: {len(data.get('countries', []))}")

# Test validate
payload = {
    "academic": {"gpa": 3.5, "scale": "4.0", "backlogs": 0, "gradingSystem": "4.0"},
    "budget": "USD 30000",
    "englishTest": {"type": "IELTS", "score": 7.0},
    "course": "Computer Science",
    "countries": ["USA"],
    "degreeLevel": "Master's",
    "priorityFocus": "No specific priority"
}
r = requests.post('http://127.0.0.1:8000/api/validate', json=payload)
print(f"Validate status: {r.status_code}")
print(f"Validate: {r.json()}")

# Test search
r = requests.post('http://127.0.0.1:8000/api/search', json=payload)
print(f"Search status: {r.status_code}")
results = r.json()
print(f"Results count: {len(results)}")
if results:
    print(f"Top result: {results[0]['university']['name']} - Fit: {results[0]['fitScore']}")

# Test university detail
if results:
    key = results[0]['university']['key']
    r = requests.post(f'http://127.0.0.1:8000/api/university/{key}', json=payload)
    print(f"University detail status: {r.status_code}")
    detail = r.json()
    print(f"University: {detail.get('university', {}).get('name', 'N/A')}")

# Test roadmap
if results:
    key = results[0]['university']['key']
    r = requests.post(f'http://127.0.0.1:8000/api/university/{key}/roadmap', json=payload)
    print(f"Roadmap status: {r.status_code}")
    roadmap = r.json()
    print(f"Probability: {roadmap.get('probabilityLabel', 'N/A')}")

# Test compare
if len(results) >= 2:
    keys = [results[0]['university']['key'], results[1]['university']['key']]
    r = requests.post('http://127.0.0.1:8000/api/compare', json={"keys": keys, "profile": payload})
    print(f"Compare status: {r.status_code}")
    compare = r.json()
    print(f"Compare count: {len(compare.get('results', []))}")

# Test rerank
if results:
    keys = [results[0]['university']['key']]
    r = requests.post('http://127.0.0.1:8000/api/rerank', json={"keys": keys, "profile": payload})
    print(f"Rerank status: {r.status_code}")

print("\nAll endpoint tests completed!")