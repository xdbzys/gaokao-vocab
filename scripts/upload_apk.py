import requests, base64, sys, os, json, time

TOKEN = os.environ.get('GITEE_TOKEN', '')
if not TOKEN:
    print("ERROR: GITEE_TOKEN environment variable is not set!")
    sys.exit(1)

print(f"TOKEN length: {len(TOKEN)}")

REPO = 'xdbzys/app'
APK_PATH = 'android/app/build/outputs/apk/debug/app-debug.apk'
APK_FILENAME = 'gaokao-vocab.apk'

with open('app-update.json', 'r') as f:
    update_data = json.load(f)
version = update_data.get('version', '2.5')
print(f"Building for version: {version}")

with open(APK_PATH, 'rb') as f:
    content = base64.b64encode(f.read()).decode()
print(f"APK size: {len(content)} bytes (base64)")

def gitee_upload(filename, file_content, message):
    """Upload file to Gitee using Contents API."""
    url = f'https://gitee.com/api/v5/repos/{REPO}/contents/{filename}'

    # 1. Get current SHA
    get_resp = requests.get(url, params={'access_token': TOKEN}, timeout=30)
    print(f'  GET {filename}: {get_resp.status_code}')

    if get_resp.status_code == 401:
        print(f'  ERROR: 401 Unauthorized - token invalid')
        return get_resp

    sha = None
    if get_resp.status_code == 200:
        sha = get_resp.json().get('sha', '')
        print(f'  Current SHA: {sha[:16] if sha else "new file"}')
    elif get_resp.status_code == 404:
        print(f'  File not found, will create new')
    else:
        print(f'  GET error: {get_resp.text[:200]}')
        return get_resp

    # 2. Upload
    payload = {
        'access_token': TOKEN,
        'content': file_content,
        'message': message,
        'branch': 'master'
    }
    if sha:
        payload['sha'] = sha

    if sha:
        upload_resp = requests.put(url, json=payload, timeout=60)
    else:
        upload_resp = requests.post(url, json=payload, timeout=60)

    print(f'  UPLOAD {filename}: {upload_resp.status_code}')
    try:
        resp_json = upload_resp.json()
        print(f'  Response: {json.dumps(resp_json, ensure_ascii=False)[:300]}')
    except:
        print(f'  Response: {upload_resp.text[:200]}')

    return upload_resp

# Upload APK
print(f"\nUploading {APK_FILENAME}...")
r1 = gitee_upload(APK_FILENAME, content, f'auto build apk v{version}')
if r1.status_code not in (200, 201):
    print(f'  APK upload failed!')
    sys.exit(1)
print(f'  APK uploaded OK')

# Update app-update.json
update_data['apkUrl'] = f'https://gitee.com/{REPO}/raw/master/{APK_FILENAME}'
update_data['feedbackToken'] = TOKEN
with open('app-update.json', 'w') as f:
    json.dump(update_data, f, ensure_ascii=False, indent=2)

with open('app-update.json', 'rb') as f:
    update_content = base64.b64encode(f.read()).decode()

print(f"\nUploading app-update.json...")
r2 = gitee_upload('app-update.json', update_content, f'update app-update.json to v{version}')
if r2.status_code not in (200, 201):
    print(f'  app-update.json upload failed!')
    sys.exit(1)
print(f'  app-update.json uploaded OK')

# Verify
print("\nVerifying upload...")
time.sleep(5)
verify = requests.get(f'https://gitee.com/api/v5/repos/{REPO}/contents/app-update.json', params={'access_token': TOKEN})
if verify.status_code == 200:
    vdata = verify.json()
    vcontent = base64.b64decode(vdata.get('content','')).decode('utf-8')
    vjson = json.loads(vcontent)
    print(f"  Remote version: {vjson.get('version')}")
    if vjson.get('version') == version:
        print("  ✓ Verified!")
    else:
        print(f"  ✗ Mismatch! Expected {version}")
        sys.exit(1)
else:
    print(f"  Verify GET failed: {verify.status_code}")

print("\nDone!")
