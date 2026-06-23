import json

users = []

for i in range(1, 10001):
    users.append({
        "email": f"perfuser{i}@test.com",
        "password": "Welcome"
    })

with open("users.json", "w") as f:
    json.dump(users, f, indent=2)

print(f"Generated {len(users)} users")