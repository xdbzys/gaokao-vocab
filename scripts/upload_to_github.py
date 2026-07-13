import json, base64, os, sys
try:
    from urllib.request import Request, urlopen
    from urllib.error import URLError, HTTPError
except ImportError:
    print("urllib not available")
    sys.exit(1)

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
try:
    req = Request('https://api.github.com/repos/xdbzys/gaokao-vocab/contents/app-update.json', headers=headers)
    resp = urlopen(req)
    sha = json.loads(resp.read().decode()).get('sha', '')
except HTTPError as e:
    if e.code == 404:
        sha = ''
    else:
        print(f'GET error: {e.code}')
        sha = ''

# Upload
payload = json.dumps({'message': 'ci: update app-update.json', 'content': content, 'branch': 'master', 'sha': sha}).encode()
req2 = Request('https://api.github.com/repos/xdbzys/gaokao-vocab/contents/app-update.json', data=payload, headers=headers, method='PUT')
try:
    resp2 = urlopen(req2)
    print(f'GitHub upload: {resp2.status}')
    print('app-update.json uploaded to GitHub')
except HTTPError as e:
    print(f'GitHub upload error: {e.code}')
    print(e.read().decode()[:200])
except Exception as e:
    print(f'GitHub upload failed: {e}')
