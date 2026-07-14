import base64, sys, os, json
from urllib.request import Request, urlopen
from urllib.error import HTTPError

TOKEN = os.environ.get('GITEE_TOKEN', '')
if not TOKEN:
    print("No GITEE_TOKEN provided")
    sys.exit(1)

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
    url = f'https://gitee.com/api/v5/repos/{REPO}/contents/{filename}'

    # Get current SHA
    params = f'?access_token={TOKEN}'
    req = Request(url + params)
    resp_data = None
    sha = ''
    try:
        resp = urlopen(req, timeout=30)
        resp_data = json.loads(resp.read().decode())
        sha = resp_data.get('sha', '')
        print(f'  Current SHA: {sha[:10] if sha else "None"}...')
    except HTTPError as e:
        print(f'  GET {filename}: status={e.code}')
        body = e.read().decode()
        print(f'  Response: {body[:200]}')
        return
    except Exception as e:
        print(f'  GET {filename}: error={e}')
        return

    # Upload
    payload = {
        'access_token': TOKEN,
        'content': file_content,
        'message': message
    }
    if sha:
        payload['sha'] = sha

    data = json.dumps(payload).encode()
    method = 'PUT' if sha else 'POST'
    req = Request(url, data=data, headers={'Content-Type': 'application/json'}, method=method)

    try:
        resp = urlopen(req, timeout=60)
        print(f'  {filename} uploaded successfully!')
        return resp
    except HTTPError as e:
        print(f'  {filename} upload failed: {e.code}')
        print(f'  Error: {e.read().decode()[:200]}')
        return None
    except Exception as e:
        print(f'  {filename} upload failed: {e}')
        return None

# 1. Upload APK
print(f"\nUploading {APK_FILENAME}...")
upload_file(APK_FILENAME, content, f'auto build apk v{version}')

# 2. Update app-update.json with correct APK URL
update_data['apkUrl'] = f'https://gitee.com/{REPO}/raw/master/{APK_FILENAME}'
with open('app-update.json', 'w') as f:
    json.dump(update_data, f, ensure_ascii=False, indent=2)

with open('app-update.json', 'rb') as f:
    update_content = base64.b64encode(f.read()).decode()

print(f"\nUploading app-update.json...")
upload_file('app-update.json', update_content, f'update app-update.json to v{version}')

print("\nAll uploads completed!")