import json, base64, requests, os, sys

run_number = os.environ.get('GITHUB_RUN_NUMBER', '0')
github_token = os.environ.get('GH_TOKEN', '')
gitee_token = os.environ.get('GITEE_FEEDBACK_TOKEN', '')

if not github_token:
    print("No GH_TOKEN provided")
    sys.exit(0)

with open('app-update.json', 'r') as f:
    data = json.load(f)

if gitee_token:
    data['feedbackToken'] = gitee_token

data['apkUrl'] = f'https://github.com/xdbzys/gaokao-vocab/releases/download/v{run_number}/gaokao-vocab.apk'

with open('app-update.json', 'w') as f:
    json.dump(data, f, ensure_ascii=False, indent=2)

content = base64.b64encode(open('app-update.json', 'rb').read()).decode()

headers = {'Authorization': f'token {github_token}', 'Content-Type': 'application/json'}

# Get SHA
r = requests.get('https://api.github.com/repos/xdbzys/gaokao-vocab/contents/app-update.json', headers=headers)
sha = r.json().get('sha', '') if r.ok else ''

# Upload
payload = {'message': 'ci: update app-update.json', 'content': content, 'branch': 'master'}
if sha:
    payload['sha'] = sha

r2 = requests.put('https://api.github.com/repos/xdbzys/gaokao-vocab/contents/app-update.json', headers=headers, json=payload)
print(f'GitHub upload: {r2.status_code}')
if r2.ok:
    print('app-update.json uploaded to GitHub')
else:
    print(f'Error: {r2.text[:200]}')
