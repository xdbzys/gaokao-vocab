import requests, base64, sys, os, json

TOKEN = os.environ['GITEE_TOKEN']
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

def upload_file(filename, file_content, message):
    """Upload a file to Gitee, creating or updating as needed."""
    # Get current SHA
    url = f'https://gitee.com/api/v5/repos/{REPO}/contents/{filename}'
    resp = requests.get(url, params={'access_token': TOKEN})
    
    if resp.status_code != 200:
        print(f'  GET {filename}: status={resp.status_code}')
        try:
            data = resp.json()
            print(f'  Response: {json.dumps(data, ensure_ascii=False)[:200]}')
        except:
            print(f'  Response: {resp.text[:200]}')
        return resp
    
    data = resp.json()
    sha = data.get('sha', '')
    print(f'  Current SHA: {sha[:10] if sha else "None"}...')

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
        r = requests.put(url, headers=headers, json=payload)
    else:
        r = requests.post(url, headers=headers, json=payload)
    
    return r

# 1. Upload APK
print(f"\nUploading {APK_FILENAME}...")
r1 = upload_file(APK_FILENAME, content, f'auto build apk v{version}')
if r1.status_code in (200, 201):
    print(f'  {APK_FILENAME} uploaded successfully!')
else:
    print(f'  {APK_FILENAME} upload failed: {r1.status_code}')
    try:
        print(f'  Error: {r1.json().get("message", r1.text[:200])}')
    except:
        print(f'  Error: {r1.text[:200]}')
    sys.exit(1)

# 2. Update app-update.json with correct APK URL
update_data['apkUrl'] = f'https://gitee.com/{REPO}/raw/master/{APK_FILENAME}'
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
    try:
        print(f'  Error: {r2.json().get("message", r2.text[:200])}')
    except:
        print(f'  Error: {r2.text[:200]}')
    sys.exit(1)

print("\nAll uploads completed!")