import requests, base64, sys, os, json, time

TOKEN = os.environ.get('GITEE_TOKEN', '')
if not TOKEN:
    print("ERROR: GITEE_TOKEN environment variable is not set!")
    print("Please set GITEE_TOKEN in GitHub Secrets.")
    sys.exit(1)

print(f"TOKEN length: {len(TOKEN)}")
print(f"TOKEN prefix: {TOKEN[:10]}...")

REPO = 'xdbzys/app'
APK_PATH = 'android/app/build/outputs/apk/debug/app-debug.apk'
APK_FILENAME = 'gaokao-vocab.apk'

# Read version from app-update.json
with open('app-update.json', 'r') as f:
    update_data = json.load(f)
version = update_data.get('version', '2.5')
print(f"Building for version: {version}")

# Read APK
with open(APK_PATH, 'rb') as f:
    content = base64.b64encode(f.read()).decode()
print(f"APK size: {len(content)} bytes (base64)")

def upload_file(filename, file_content, message, max_retries=3):
    """Upload a file to Gitee, creating or updating as needed."""
    url = f'https://gitee.com/api/v5/repos/{REPO}/contents/{filename}'

    for attempt in range(max_retries):
        if attempt > 0:
            print(f"  Retry {attempt}/{max_retries}...")
            time.sleep(2)

        # Get current SHA
        resp = requests.get(url, params={'access_token': TOKEN}, timeout=30)
        print(f'  GET {filename}: status={resp.status_code}')

        if resp.status_code == 401:
            print(f'  ERROR: Unauthorized (401). Token may be invalid or expired.')
            try:
                print(f'  Response: {resp.json()}')
            except:
                print(f'  Response: {resp.text[:200]}')
            return resp

        if resp.status_code == 404:
            # File doesn't exist, create it
            sha = None
        elif resp.status_code == 200:
            data = resp.json()
            sha = data.get('sha', '')
            print(f'  Current SHA: {sha[:10] if sha else "None"}...')
        else:
            try:
                print(f'  Response: {resp.json()}')
            except:
                print(f'  Response: {resp.text[:200]}')
            if attempt == max_retries - 1:
                return resp
            continue

        # Upload
        headers = {'Content-Type': 'application/json'}
        payload = {
            'access_token': TOKEN,
            'content': file_content,
            'message': message
        }
        if sha:
            payload['sha'] = sha

        if sha:
            r = requests.put(url, headers=headers, json=payload, timeout=60)
        else:
            r = requests.post(url, headers=headers, json=payload, timeout=60)

        print(f'  UPLOAD {filename}: status={r.status_code}')
        if r.status_code in (200, 201):
            return r

        try:
            print(f'  Response: {r.json()}')
        except:
            print(f'  Response: {r.text[:200]}')

    return r

# 1. Upload APK
print(f"\nUploading {APK_FILENAME}...")
r1 = upload_file(APK_FILENAME, content, f'auto build apk v{version}')
if r1.status_code in (200, 201):
    print(f'  {APK_FILENAME} uploaded successfully!')
else:
    print(f'  {APK_FILENAME} upload failed: {r1.status_code}')
    sys.exit(1)

# 2. Update app-update.json with correct APK URL and inject feedbackToken
update_data['apkUrl'] = f'https://gitee.com/{REPO}/raw/master/{APK_FILENAME}'
update_data['feedbackToken'] = TOKEN
with open('app-update.json', 'w') as f:
    json.dump(update_data, f, ensure_ascii=False, indent=2)

with open('app-update.json', 'rb') as f:
    update_content = base64.b64encode(f.read()).decode()

print(f"\nUploading app-update.json...")
r2 = upload_file('app-update.json', update_content, f'update app-update.json to v{version}')
if r2.status_code in (200, 201):
    print(f'  app-update.json uploaded successfully!')
else:
    print(f'  app-update.json upload failed: {r2.status_code}')
    sys.exit(1)

print("\nAll uploads completed!")
