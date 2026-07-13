import requests, base64, sys, os, json

TOKEN = os.environ['GITEE_TOKEN']
REPO = 'xdbzys/app'
APK_PATH = 'android/app/build/outputs/apk/debug/app-debug.apk'

# Read version from app-update.json
with open('app-update.json', 'r') as f:
    update_data = json.load(f)
version = update_data.get('version', '2.5')
version_code = update_data.get('versionCode', 0)
print(f"Building for version: {version} (code: {version_code})")

# Filenames to upload
VERSIONED_APK = f'gaokao-vocab-v{version}.apk'
DEFAULT_APK = 'gaokao-vocab.apk'

with open(APK_PATH, 'rb') as f:
    content = base64.b64encode(f.read()).decode()

print(f"APK size: {len(content)} bytes (base64)")
print(f"Target filename: {VERSIONED_APK}")

def upload_file(filename, file_content, message):
    """Upload a file to Gitee, creating or updating as needed."""
    # Get current SHA
    resp = requests.get(
        f'https://gitee.com/api/v5/repos/{REPO}/contents/{filename}',
        params={'access_token': TOKEN}
    )
    data = resp.json()
    sha = data.get('sha', '')

    # Upload
    if sha:
        r = requests.put(
            f'https://gitee.com/api/v5/repos/{REPO}/contents/{filename}',
            params={'access_token': TOKEN},
            json={'access_token': TOKEN, 'content': file_content, 'message': message, 'sha': sha}
        )
    else:
        r = requests.post(
            f'https://gitee.com/api/v5/repos/{REPO}/contents/{filename}',
            params={'access_token': TOKEN},
            json={'access_token': TOKEN, 'content': file_content, 'message': message}
        )
    return r

# 1. Upload versioned APK (new file = no CDN cache issues)
print(f"Uploading {VERSIONED_APK}...")
r1 = upload_file(VERSIONED_APK, content, f'auto build apk v{version}')
if r1.status_code in (200, 201):
    print(f'  {VERSIONED_APK} uploaded successfully!')
else:
    print(f'  {VERSIONED_APK} upload failed: {r1.status_code} {r1.text[:200]}')
    # Don't exit - try the other uploads anyway

# 2. Also update default APK (for backward compatibility)
print(f"Uploading {DEFAULT_APK}...")
r2 = upload_file(DEFAULT_APK, content, f'auto build apk v{version}')
if r2.status_code in (200, 201):
    print(f'  {DEFAULT_APK} uploaded successfully!')
else:
    print(f'  {DEFAULT_APK} upload failed: {r2.status_code} {r2.text[:200]}')

# 3. Update app-update.json to point to versioned APK
update_data['apkUrl'] = f'https://gitee.com/{REPO}/raw/master/{VERSIONED_APK}'
with open('app-update.json', 'w') as f:
    json.dump(update_data, f, ensure_ascii=False, indent=2)

with open('app-update.json', 'rb') as f:
    update_content = base64.b64encode(f.read()).decode()

print("Uploading app-update.json...")
r3 = upload_file('app-update.json', update_content, f'update app-update.json to v{version}')
if r3.status_code in (200, 201):
    print('  app-update.json uploaded successfully!')
else:
    print(f'  app-update.json upload failed: {r3.status_code} {r3.text[:200]}')
    sys.exit(1)

print("\nAll uploads completed!")