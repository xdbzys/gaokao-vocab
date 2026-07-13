import requests, base64, sys, os

TOKEN = os.environ['GITEE_TOKEN']
REPO = 'xdbzys/app'
APK_PATH = 'android/app/build/outputs/apk/debug/app-debug.apk'

with open(APK_PATH, 'rb') as f:
    content = base64.b64encode(f.read()).decode()

print(f"APK size: {len(content)} bytes (base64)")

# Get current SHA
resp = requests.get(
    f'https://gitee.com/api/v5/repos/{REPO}/contents/gaokao-vocab.apk',
    params={'access_token': TOKEN}
)
data = resp.json()
sha = data.get('sha', '')

# Upload
if sha:
    r = requests.put(
        f'https://gitee.com/api/v5/repos/{REPO}/contents/gaokao-vocab.apk',
        params={'access_token': TOKEN},
        json={'access_token': TOKEN, 'content': content, 'message': 'auto build apk', 'sha': sha}
    )
else:
    r = requests.post(
        f'https://gitee.com/api/v5/repos/{REPO}/contents/gaokao-vocab.apk',
        params={'access_token': TOKEN},
        json={'access_token': TOKEN, 'content': content, 'message': 'auto build apk'}
    )

if r.status_code in (200, 201):
    print('APK uploaded to Gitee successfully!')
else:
    print(f'APK upload failed: {r.status_code} {r.text[:200]}')
    sys.exit(1)

# Also upload app-update.json
with open('app-update.json', 'rb') as f:
    update_content = base64.b64encode(f.read()).decode()

resp2 = requests.get(
    f'https://gitee.com/api/v5/repos/{REPO}/contents/app-update.json',
    params={'access_token': TOKEN}
)
data2 = resp2.json()
sha2 = data2.get('sha', '')

if sha2:
    r2 = requests.put(
        f'https://gitee.com/api/v5/repos/{REPO}/contents/app-update.json',
        params={'access_token': TOKEN},
        json={'access_token': TOKEN, 'content': update_content, 'message': 'update app-update.json', 'sha': sha2}
    )
else:
    r2 = requests.post(
        f'https://gitee.com/api/v5/repos/{REPO}/contents/app-update.json',
        params={'access_token': TOKEN},
        json={'access_token': TOKEN, 'content': update_content, 'message': 'update app-update.json'}
    )

if r2.status_code in (200, 201):
    print('app-update.json uploaded to Gitee successfully!')
else:
    print(f'app-update.json upload failed: {r2.status_code} {r2.text[:200]}')
    sys.exit(1)
