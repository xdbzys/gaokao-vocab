import base64, sys, os, json, time
try:
    from urllib.request import Request, urlopen
    from urllib.error import URLError, HTTPError
except ImportError:
    print("urllib not available")
    sys.exit(1)

GITEE_TOKEN = os.environ.get('GITEE_TOKEN', '')
GITHUB_TOKEN = os.environ.get('GITHUB_TOKEN', '')
GITEE_REPO = 'xdbzys/app'
GITHUB_REPO = 'xdbzys/gaokao-vocab'
APK_PATH = 'android/app/build/outputs/apk/debug/app-debug.apk'
APK_FILENAME = 'gaokao-vocab.apk'

with open('app-update.json', 'r') as f:
    update_data = json.load(f)
version = update_data.get('version', '2.5')
print(f"Version: {version}")

with open(APK_PATH, 'rb') as f:
    apk_content = base64.b64encode(f.read()).decode()
print(f"APK size: {len(apk_content)} bytes (base64)")

def api_upload(token, repo, filename, file_content, message, api_base):
    url = f'{api_base}/repos/{repo}/contents/{filename}'
    headers = {'Authorization': f'token {token}'} if token else {}

    sha = ''
    try:
        req = Request(url, headers=headers)
        resp = urlopen(req, timeout=30)
        sha = json.loads(resp.read().decode()).get('sha', '')
    except HTTPError as e:
        if e.code == 404:
            print(f'  {filename} not found, will create')
        else:
            print(f'  GET {filename}: {e.code}')
            return None

    payload = {'message': message, 'content': file_content, 'branch': 'master'}
    if sha:
        payload['sha'] = sha
    data = json.dumps(payload).encode()

    try:
        req = Request(url, data=data, headers={**headers, 'Content-Type': 'application/json'}, method='PUT' if sha else 'POST')
        resp = urlopen(req, timeout=60)
        print(f'  UPLOAD {filename}: {resp.status}')
        return resp
    except HTTPError as e:
        print(f'  UPLOAD {filename} error: {e.code}')
        print(f'  {e.read().decode()[:200]}')
        return None
    except Exception as e:
        print(f'  UPLOAD {filename} failed: {e}')
        return None

# Write feedback token into app-update.json
if GITEE_TOKEN:
    update_data['feedbackToken'] = GITEE_TOKEN
with open('app-update.json', 'w') as f:
    json.dump(update_data, f, ensure_ascii=False, indent=2)
update_content = base64.b64encode(open('app-update.json', 'rb').read()).decode()

# Upload to Gitee
print("\n--- Uploading to Gitee ---")
if GITEE_TOKEN:
    print("Uploading APK to Gitee...")
    api_upload(GITEE_TOKEN, GITEE_REPO, APK_FILENAME, apk_content,
               f'auto build apk v{version}', 'https://gitee.com/api/v5')

    print("Uploading app-update.json to Gitee...")
    api_upload(GITEE_TOKEN, GITEE_REPO, 'app-update.json', update_content,
               f'update app-update.json to v{version}', 'https://gitee.com/api/v5')
else:
    print("No GITEE_TOKEN, skipping Gitee upload")

print("\nDone!")
