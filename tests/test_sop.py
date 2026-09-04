import requests
import json

# Test SOP generate - correct format with target
r = requests.post('http://127.0.0.1:8000/api/v1/sop/generate', json={
    'target': {
        'university_name': 'Northgate State University',
        'course_name': 'Computer Science',
        'country': 'United States',
        'degree_level': "Master's"
    },
    'answers': {
        'full_name': 'Test Student',
        'current_education': 'B.Tech Computer Science, IIT Delhi, graduating 2026, CGPA 8.7/10',
        'why_this_field': 'I got interested in distributed systems after a class project kept failing under load.',
        'career_goals_short_term': 'Join a backend infrastructure team at a product company.'
    }
}, timeout=30)

print('SOP Generate:', r.status_code)
print(json.dumps(r.json(), indent=2))