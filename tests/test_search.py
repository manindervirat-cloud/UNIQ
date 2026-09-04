import requests

payload = {
    'budgetText': '30000 USD',
    'gradingSystem': 'Percentage',
    'gradingValue': '85',
    'targetCourse': 'Computer Science',
    'preferredCountries': ['USA'],
    'degreeLevel': "Master's",
    'homeCountry': 'India',
    'englishTests': {'IELTS Academic': 7.0}
}

r = requests.post('http://127.0.0.1:8000/api/search', json=payload)
print(f"Status: {r.status_code}")
data = r.json()
print(f"Keys: {list(data.keys())}")
print(f"Data: {data}")