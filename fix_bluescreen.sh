#!/bin/bash
# 背群英蓝屏修复脚本（手机端 Termux 版）
#
# 使用方法：
#   1. 手机安装 Termux（Google Play 或 F-Droid）
#   2. 在 Termux 中运行：
#      pkg install android-tools curl
#      bash fix_bluescreen.sh
#
# 或者在电脑上用 ADB 运行本脚本
#
# 原理：通过 ADB 让 APP 的 WebView 跳转到修复后的网页版

PACKAGE="com.gaokao.vocab"
ACTIVITY="com.gaokao.vocab.MainActivity"
FIX_URL="https://xdbzys.github.io/gaokao-vocab/%E8%83%8C%E7%BE%A4%E8%8B%B1.html"
PORT=9222

echo "========================================"
echo "  背群英蓝屏修复工具"
echo "========================================"

# Check adb
if ! command -v adb &> /dev/null; then
    echo "错误：未安装 adb"
    echo "Termux 用户：pkg install android-tools"
    echo "电脑用户：下载 Android Platform Tools"
    exit 1
fi

# Check device (for USB ADB) or connect to local ADB (for wireless ADB)
adb devices 2>/dev/null | grep -q "device$" || {
    echo "未检测到设备，尝试连接本地 ADB..."
    # Try wireless ADB (for on-device Termux)
    adb connect localhost:5555 2>/dev/null || adb connect 127.0.0.1:5555 2>/dev/null
    sleep 1
    adb devices 2>/dev/null | grep -q "device$" || {
        echo "错误：未检测到设备"
        echo "请确认："
        echo "  - 手机已开启 USB 调试"
        echo "  - 数据线已连接（电脑端）"
        echo "  - 或已开启无线调试（手机端 Termux）"
        exit 1
    }
}
echo "✅ 设备已连接"

# Start the app
echo ""
echo "启动背群英 APP..."
adb shell am start -n $PACKAGE/$ACTIVITY 2>/dev/null
sleep 3

# Find WebView DevTools socket
echo "查找 WebView 调试端口..."
SOCKET=$(adb shell cat /proc/net/unix 2>/dev/null | grep "webview_devtools_remote" | awk '{print $8}' | head -1)

if [ -z "$SOCKET" ]; then
    echo "❌ 未找到 WebView 调试端口"
    echo "可能原因：APP 是 Release 版本（不支持调试）"
    echo ""
    echo "替代方案：用手机浏览器打开以下链接："
    echo "  $FIX_URL"
    exit 1
fi
echo "✅ 找到调试端口：$SOCKET"

# Forward port
adb forward tcp:$PORT localabstract:$SOCKET 2>/dev/null
echo "✅ 端口转发完成"

# Get WebSocket URL
echo ""
echo "获取页面信息..."
PAGE_JSON=$(curl -s "http://localhost:$PORT/json/list" 2>/dev/null)

if [ -z "$PAGE_JSON" ]; then
    echo "❌ 无法获取页面信息"
    exit 1
fi

WS_URL=$(echo "$PAGE_JSON" | python3 -c "import sys,json; pages=json.load(sys.stdin); print(pages[0].get('webSocketDebuggerUrl',''))" 2>/dev/null)

if [ -z "$WS_URL" ]; then
    echo "❌ 无法获取 WebSocket URL"
    exit 1
fi
echo "✅ 获取到 WebSocket URL"

# Navigate using Python WebSocket
echo ""
echo "正在加载修复版网页..."
python3 -c "
import socket, base64, secrets, json, sys, time

ws_url = '$WS_URL'
target_url = '$FIX_URL'

# Parse ws://localhost:9222/devtools/page/<id>
addr = ws_url.replace('ws://','').replace('wss://','')
host_port, _, path = addr.partition('/')
host, _, port = host_port.partition(':')
port = int(port) if port else 80

# WebSocket handshake
key = base64.b64encode(secrets.token_bytes(16)).decode()
sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
sock.settimeout(10)
sock.connect((host, port))

req = f'GET /{path} HTTP/1.1\r\nHost: {host}:{port}\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Key: {key}\r\nSec-WebSocket-Version: 13\r\n\r\n'
sock.sendall(req.encode())

resp = b''
while b'\r\n\r\n' not in resp:
    chunk = sock.recv(4096)
    if not chunk: break
    resp += chunk

if b'101' not in resp.split(b'\r\n')[0]:
    print('WebSocket 握手失败')
    sys.exit(1)

# Send Page.navigate
msg = json.dumps({'id':1,'method':'Page.navigate','params':{'url':target_url}})
payload = msg.encode('utf-8')
mask = secrets.token_bytes(4)
masked = bytearray(b ^ mask[i%4] for i,b in enumerate(payload))

frame = bytearray([0x81])  # FIN + text
if len(payload) < 126:
    frame.append(0x80 | len(payload))
elif len(payload) < 65536:
    frame.append(0x80 | 126)
    frame.extend(len(payload).to_bytes(2,'big'))
else:
    frame.append(0x80 | 127)
    frame.extend(len(payload).to_bytes(8,'big'))
frame.extend(mask)
frame.extend(masked)

sock.sendall(frame)
print('✅ 导航命令已发送')
time.sleep(3)
try:
    data = sock.recv(4096)
    print(f'✅ 收到响应（{len(data)} 字节）')
except:
    print('⚠ 等待响应超时（正常现象）')
sock.close()
" 2>&1

# Clean up
adb forward --remove tcp:$PORT 2>/dev/null

echo ""
echo "========================================"
echo "  ✅ 修复完成！请查看手机上的 APP"
echo "========================================"
echo ""
echo "注意："
echo "  1. 临时修复：APP 被杀后需重新运行"
echo "  2. 永久修复：安装新版 APK（不影响学习记录）"
echo "     https://github.com/xdbzys/gaokao-vocab/releases/latest/download/app-debug.apk"
echo "  3. 无 ADB 替代方案：浏览器打开"
echo "     $FIX_URL"
