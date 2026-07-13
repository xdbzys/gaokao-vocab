import json, sys

token = sys.argv[1] if len(sys.argv) > 1 else ''
if not token:
    print("No token provided")
    sys.exit(0)

with open('app-update.json', 'r') as f:
    data = json.load(f)

data['feedbackToken'] = token

with open('app-update.json', 'w') as f:
    json.dump(data, f, ensure_ascii=False, indent=2)

print("Token injected into app-update.json")
