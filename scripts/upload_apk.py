import requests, base64, sys, os, json, time

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
    """Upload file via Contents API."""
    url = f'{api_base}/repos/{repo}/contents/{filename}'
    headers = {'Authorization': f'token {token}'} if token else {}

    # Get current SHA
    get_resp = requests.get(url, headers=headers, timeout=30)
    sha = None
    if get_resp.status_code == 200:
        sha = get_resp.json().get('sha', '')
    elif get_resp.status_code == 404:
        print(f'  {filename} not found, will create')
    else:
        print(f'  GET {filename}: {get_resp.status_code} - {get_resp.text[:100]}')
        return None

    # Upload
    payload = {'message': message, 'content': file_content, 'branch': 'master'}
    if sha:
        payload['sha'] = sha
    method = 'PUT' if sha else 'POST'

    upload_resp = requests.request(method, url, headers=headers, json=payload, timeout=60)
    print(f'  UPLOAD {filename}: {upload_resp.status_code}')
    if upload_resp.status_code not in (200, 201):
        print(f'  Error: {upload_resp.text[:200]}')
        return None
    return upload_resp

# 1. Upload APK to GitHub Releases (via create release step in workflow)
print("\n--- Uploading to GitHub API ---")

# Write feedback token into app-update.json
if GITEE_TOKEN:
    update_data['feedbackToken'] = GITEE_TOKEN
with open('app-update.json', 'w') as f:
    json.dump(update_data, f, ensure_ascii=False, indent=2)
update_content = base64.b64encode(open('app-update.json', 'rb').read()).decode()

if GITHUB_TOKEN:
    print("Uploading app-update.json to GitHub...")
    r = api_upload(GITHUB_TOKEN, GITHUB_REPO, 'app-update.json', update_content,
                   f'update app-update.json to v{version}', 'https://api.github.com')
    if r:
        print("  GitHub upload OK")
    else:
        print("  GitHub upload failed")
else:
    print("No GITHUB_TOKEN, skipping GitHub upload")

# 2. Upload to Gitee
print("\n--- Uploading to Gitee ---")
if GITEE_TOKEN:
    print("Uploading APK to Gitee...")
    r1 = api_upload(GITEE_TOKEN, GITEE_REPO, APK_FILENAME, apk_content,
                    f'auto build apk v{version}', 'https://gitee.com/api/v5')
    if not r1:
        print("  Gitee APK upload failed (non-fatal)")

    print("Uploading app-update.json to Gitee...")
    r2 = api_upload(GITEE_TOKEN, GITEE_REPO, 'app-update.json', update_content,
                    f'update app-update.json to v{version}', 'https://gitee.com/api/v5')
    if not r2:
        print("  Gitee JSON upload failed (non-fatal)")
else:
    print("No GITEE_TOKEN, skipping Gitee upload")

print("\nDone!")
