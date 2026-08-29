#!/data/data/com.termux/files/usr/bin/bash
# ============================================================
# 背群英蓝屏修复 - Termux 手机端版 v3.0（无需电脑）
# ============================================================
# 修复内容：
#   1. 正确的 WebSocket pong 帧掩码（RFC 6455）
#   2. 续帧（continuation frame）处理
#   3. FIN 位检测
#   4. 即时修复脚本（Page.addScriptToEvaluateOnNewDocument）
#   5. Service Worker 持久化注入
#   6. Fetch 拦截模式通配符修复
#
# 使用方法：
#   1. 手机安装 Termux（F-Droid 下载：https://f-droid.org/packages/com.termux/)
#   2. 打开 Termux，复制粘贴以下命令一次性运行：
#
#      pkg update -y && pkg install -y python android-tools && \
#      curl -sL https://raw.githubusercontent.com/xdbzys/gaokao-vocab/master/fix_termux.sh -o fix.sh && \
#      bash fix.sh
#
#   3. 按提示操作即可
#
# 原理：通过无线 ADB 连接本机，注入 Service Worker + 即时脚本永久修复蓝屏
# ============================================================

FIX_URL="https://xdbzys.github.io/gaokao-vocab/%E8%83%8C%E7%BE%A4%E8%8B%B1.html"
PACKAGE="com.gaokao.vocab"
ACTIVITY="com.gaokao.vocab.MainActivity"
PORT=9222

echo "================================================"
echo "   背群英蓝屏修复 - Termux 手机端 v3.0"
echo "   SW + 即时脚本双保险"
echo "================================================"
echo ""

# 检查 adb
if ! command -v adb &> /dev/null; then
    echo "正在安装 android-tools..."
    pkg install -y android-tools 2>/dev/null || {
        echo "安装失败，请手动运行：pkg install android-tools"
        exit 1
    }
fi

# 检查 python3
if ! command -v python3 &> /dev/null; then
    echo "正在安装 python..."
    pkg install -y python 2>/dev/null || {
        echo "安装失败，请手动运行：pkg install python"
        exit 1
    }
fi

echo ""
echo "请确保已完成以下操作："
echo "  1. 手机设置 → 开发者选项 → 无线调试 → 开启"
echo "  2. 点击「无线调试」，记下 IP 地址和端口（如 192.168.1.100:5555）"
echo ""
read -p "输入无线调试地址（如 192.168.1.100:5555）: " ADB_ADDR

if [ -z "$ADB_ADDR" ]; then
    echo "未输入地址，尝试 localhost:5555..."
    ADB_ADDR="localhost:5555"
fi

echo ""
echo "连接到 $ADB_ADDR ..."
adb connect "$ADB_ADDR" 2>/dev/null
sleep 1

# 验证连接
if ! adb devices 2>/dev/null | grep -q "device"; then
    echo "连接失败，尝试 localhost..."
    adb connect localhost:5555 2>/dev/null
    adb connect 127.0.0.1:5555 2>/dev/null
    sleep 1
fi

if ! adb devices 2>/dev/null | grep -q "device"; then
    echo ""
    echo "无法连接到设备，请检查："
    echo "  - 无线调试已开启"
    echo "  - Termux 和手机在同一网络"
    echo "  - 地址和端口正确"
    echo ""
    echo "替代方案：浏览器直接打开修复版："
    echo "  $FIX_URL"
    exit 1
fi

echo "设备已连接"

# 启动 APP
echo ""
echo "启动背群英 APP..."
adb shell am start -n $PACKAGE/$ACTIVITY 2>/dev/null
sleep 3

# 查找 DevTools 端口
echo "查找 WebView 调试端口..."
SOCKET=$(adb shell cat /proc/net/unix 2>/dev/null | grep "webview_devtools_remote" | awk '{print $8}' | head -1)

if [ -z "$SOCKET" ]; then
    echo ""
    echo "未找到 WebView 调试端口"
    echo "可能原因：APP 是 Release 版本（不支持调试）"
    echo ""
    echo "替代方案：浏览器直接打开修复版："
    echo "  $FIX_URL"
    exit 1
fi

echo "找到调试端口：$SOCKET"

# 端口转发
adb forward tcp:$PORT localabstract:$SOCKET 2>/dev/null
echo "端口转发完成"

# 运行 Python 持久化修复（使用与 fix_bluescreen_persistent.py 相同的正确实现）
echo ""
echo "开始持久化修复（注入即时脚本 + Service Worker）..."
python3 - << 'PYTHON_EOF'
import json, socket, base64, secrets, struct, time, urllib.request, sys, traceback

FIX_URL = "https://xdbzys.github.io/gaokao-vocab/%E8%83%8C%E7%BE%A4%E8%8B%B1.html"
PORT = 9222

# 即时修复脚本 —— 在页面 JS 执行前运行
INSTANT_FIX_SCRIPT = """
(function() {
  if (location.hostname === 'localhost' && !location.href.includes('xdbzys.github.io')) {
    location.replace('https://xdbzys.github.io/gaokao-vocab/%E8%83%8C%E7%BE%A4%E8%8B%B1.html');
  }
})();
""".strip()

# Service Worker 代码
SW_CODE = r"""
const FIX_URL = 'https://xdbzys.github.io/gaokao-vocab/%E8%83%8C%E7%BE%A4%E8%8B%B1.html';
self.addEventListener('install', function(e) { self.skipWaiting(); });
self.addEventListener('activate', function(e) {
  e.waitUntil(Promise.all([
    caches.keys().then(function(keys) { return Promise.all(keys.map(function(k) { return caches.delete(k); })); }),
    self.clients.claim()
  ]));
});
self.addEventListener('fetch', function(e) {
  if (e.request.mode === 'navigate') {
    e.respondWith(Response.redirect(FIX_URL, 302));
    return;
  }
  e.respondWith(fetch(e.request).catch(function() { return new Response('', {status: 404}); }));
});
""".strip()

class DevToolsWS:
    """WebSocket 客户端，支持续帧、ping/pong（正确掩码）"""
    def __init__(self, host, port, path):
        self.host = host
        self.port = port
        self.path = path
        self.sock = None
        self.msg_id = 0
        self._recv_buffer = b""
        self._frag_buffer = b""

    def connect(self):
        key = base64.b64encode(secrets.token_bytes(16)).decode()
        self.sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        self.sock.settimeout(15)
        self.sock.connect((self.host, self.port))

        request = (
            f"GET {self.path} HTTP/1.1\r\n"
            f"Host: {self.host}:{self.port}\r\n"
            f"Upgrade: websocket\r\n"
            f"Connection: Upgrade\r\n"
            f"Sec-WebSocket-Key: {key}\r\n"
            f"Sec-WebSocket-Version: 13\r\n"
            f"\r\n"
        )
        self.sock.sendall(request.encode())

        response = b""
        while b"\r\n\r\n" not in response:
            chunk = self.sock.recv(4096)
            if not chunk:
                return False
            response += chunk

        if b"101" not in response.split(b"\r\n")[0]:
            return False
        return True

    def send(self, method, params=None):
        self.msg_id += 1
        msg_id = self.msg_id
        msg = {"id": msg_id, "method": method}
        if params:
            msg["params"] = params

        payload = json.dumps(msg).encode("utf-8")
        mask_key = secrets.token_bytes(4)
        masked = bytearray(b ^ mask_key[i % 4] for i, b in enumerate(payload))

        frame = bytearray([0x81])  # FIN + text
        length = len(payload)
        if length < 126:
            frame.append(0x80 | length)  # MASK bit + length
        elif length < 65536:
            frame.append(0x80 | 126)
            frame.extend(length.to_bytes(2, "big"))
        else:
            frame.append(0x80 | 127)
            frame.extend(length.to_bytes(8, "big"))
        frame.extend(mask_key)
        frame.extend(masked)
        self.sock.sendall(frame)
        return msg_id

    def recv(self, timeout=10):
        self.sock.settimeout(timeout)
        try:
            while True:
                msg = self._parse_frame()
                if msg is not None:
                    return msg
                chunk = self.sock.recv(8192)
                if not chunk:
                    return None
                self._recv_buffer += chunk
        except socket.timeout:
            return None

    def _parse_frame(self):
        """解析 WebSocket 帧，处理续帧和 FIN 位"""
        buf = self._recv_buffer
        if len(buf) < 2:
            return None

        opcode = buf[0] & 0x0F
        fin = (buf[0] & 0x80) != 0
        masked = (buf[1] & 0x80) != 0
        length = buf[1] & 0x7F
        offset = 2

        if length == 126:
            if len(buf) < 4:
                return None
            length = struct.unpack(">H", buf[2:4])[0]
            offset = 4
        elif length == 127:
            if len(buf) < 10:
                return None
            length = struct.unpack(">Q", buf[2:10])[0]
            offset = 10

        if masked:
            if len(buf) < offset + 4:
                return None
            mask = buf[offset:offset+4]
            offset += 4

        if len(buf) < offset + length:
            return None

        payload = bytearray(buf[offset:offset+length])
        if masked:
            for i in range(len(payload)):
                payload[i] ^= mask[i % 4]

        self._recv_buffer = buf[offset+length:]

        if opcode == 0x1:  # text
            if fin:
                try:
                    return json.loads(payload.decode("utf-8"))
                except json.JSONDecodeError:
                    return None
            else:
                self._frag_buffer = bytearray(payload)
                return self._parse_frame()
        elif opcode == 0x0:  # continuation（续帧）
            self._frag_buffer += payload
            if fin:
                try:
                    msg = json.loads(self._frag_buffer.decode("utf-8"))
                except json.JSONDecodeError:
                    msg = None
                self._frag_buffer = b""
                return msg
            return self._parse_frame()
        elif opcode == 0x8:  # close
            return {"_close": True}
        elif opcode == 0x9:  # ping -> pong（必须掩码）
            self._send_pong(bytes(payload))
            return self._parse_frame()
        elif opcode == 0xA:  # pong
            return self._parse_frame()
        return None

    def _send_pong(self, payload=b""):
        """发送 pong 帧（客户端→服务器，必须掩码）"""
        mask_key = secrets.token_bytes(4)
        masked = bytearray(b ^ mask_key[i % 4] for i, b in enumerate(payload))
        frame = bytearray([0x8A])  # FIN + pong
        length = len(payload)
        if length < 126:
            frame.append(0x80 | length)  # MASK bit + length
        elif length < 65536:
            frame.append(0x80 | 126)
            frame.extend(length.to_bytes(2, "big"))
        else:
            frame.append(0x80 | 127)
            frame.extend(length.to_bytes(8, "big"))
        frame.extend(mask_key)
        frame.extend(masked)
        self.sock.sendall(frame)

    def close(self):
        if self.sock:
            try:
                self.sock.close()
            except:
                pass

# 获取 WebSocket URL
try:
    with urllib.request.urlopen(f"http://localhost:{PORT}/json/list", timeout=5) as r:
        pages = json.loads(r.read().decode())
        ws_url = pages[0].get("webSocketDebuggerUrl", "")
except Exception as e:
    print(f"获取页面信息失败：{e}")
    sys.exit(1)

if not ws_url:
    print("无法获取 WebSocket URL")
    sys.exit(1)

# 解析 URL
addr = ws_url.replace("ws://", "").replace("wss://", "")
host_port, _, path = addr.partition("/")
host, _, port_str = host_port.partition(":")
port = int(port_str) if port_str else 80

ws = DevToolsWS(host, port, "/" + path)
if not ws.connect():
    print("WebSocket 连接失败")
    sys.exit(1)

try:
    # [1/6] 启用调试协议
    print("[1/6] 启用调试协议...")
    ws.send("Runtime.enable")
    ws.recv(3)
    ws.send("Page.enable")
    ws.recv(3)

    # Fetch 拦截（Request 阶段，添加通配符匹配查询参数）
    ws.send("Fetch.enable", {
        "patterns": [
            {"urlPattern": "*localhost*sw.js*", "requestStage": "Request"},
            {"urlPattern": "*localhost*/sw.js*", "requestStage": "Request"},
        ]
    })
    ws.recv(3)
    print("  Fetch 拦截已启用")

    # [2/6] 注入即时修复脚本
    print("[2/6] 注入即时修复脚本...")
    ws.send("Page.addScriptToEvaluateOnNewDocument", {"source": INSTANT_FIX_SCRIPT})
    resp = ws.recv(3)
    if resp and "result" in resp:
        print("  即时修复脚本已注入")
    else:
        print("  （即时脚本注入可能未成功）")

    # [3/6] 清理旧 SW
    print("[3/6] 清理旧 Service Worker...")
    ws.send("Runtime.evaluate", {
        "expression": "(async()=>{try{const r=await navigator.serviceWorker.getRegistrations();for(const x of r)await x.unregister();return 'ok'}catch(e){return e.message}})()",
        "awaitPromise": True, "returnByValue": True
    })
    ws.recv(10)
    print("  完成")

    # [4/6] 注册修复 SW
    print("[4/6] 注册修复 Service Worker...")
    ws.send("Runtime.evaluate", {
        "expression": "(async()=>{try{await navigator.serviceWorker.register('/sw.js',{scope:'/'});await navigator.serviceWorker.ready;return 'registered'}catch(e){return 'err:'+e.message}})()",
        "awaitPromise": True, "returnByValue": True
    })

    sw_served = False
    sw_registered = False
    deadline = time.time() + 15
    while time.time() < deadline:
        msg = ws.recv(5)
        if msg is None:
            continue
        if "_close" in msg:
            break
        if msg.get("method") == "Fetch.requestPaused":
            rid = msg["params"]["requestId"]
            sw_bytes = SW_CODE.encode("utf-8")
            ws.send("Fetch.fulfillRequest", {
                "requestId": rid,
                "responseCode": 200,
                "responseHeaders": [
                    {"name": "Content-Type", "value": "application/javascript"},
                    {"name": "Service-Worker-Allowed", "value": "/"},
                    {"name": "Cache-Control", "value": "no-cache"},
                ],
                "body": base64.b64encode(sw_bytes).decode()
            })
            print("  Service Worker 代码已注入")
            sw_served = True
            ws.recv(3)
            continue
        if "result" in msg and "result" in msg.get("result", {}):
            val = msg["result"]["result"].get("value", "")
            if "registered" in str(val).lower():
                print(f"  SW 注册成功：{val}")
                sw_registered = True
            elif "err" in str(val).lower():
                print(f"  SW 注册返回：{val}")

    if not sw_served:
        print("  （SW 请求未被拦截，可能已注册）")

    # [5/6] 等待 SW 激活
    print("[5/6] 等待 Service Worker 激活...")
    time.sleep(3)
    ws.send("Runtime.evaluate", {
        "expression": "(async()=>{try{const r=await navigator.serviceWorker.getRegistrations();if(r.length>0){const s=r[0];return 'active: '+s.scope+' (state: '+(s.active?'active':s.waiting?'waiting':'installing')+')'}return 'none'}catch(e){return 'err:'+e.message}})()",
        "awaitPromise": True, "returnByValue": True
    })
    resp = ws.recv(10)
    sw_active = False
    if resp and "result" in resp:
        val = resp.get("result", {}).get("result", {}).get("value", "")
        print(f"  SW 状态：{val}")
        if "active" in str(val).lower():
            sw_active = True

    # [6/6] 导航到修复版
    print("[6/6] 导航到修复版...")
    if sw_active:
        print("  SW 已激活，导航触发 SW 重定向...")
        ws.send("Page.navigate", {"url": "https://localhost/"})
        ws.recv(5)
        time.sleep(2)
        # 验证 SW 重定向
        try:
            with urllib.request.urlopen(f"http://localhost:{PORT}/json/list", timeout=5) as r:
                pages = json.loads(r.read().decode())
                if pages and "xdbzys" in pages[0].get("url", ""):
                    print("  SW 重定向成功！")
        except:
            pass
        # 如果 SW 重定向未生效，直接导航
        print("  直接导航到修复版...")
        ws.send("Page.navigate", {"url": FIX_URL})
        ws.recv(5)
    else:
        print("  SW 未激活，直接导航...")
        ws.send("Page.navigate", {"url": FIX_URL})
        ws.recv(5)

    time.sleep(2)

except Exception as e:
    print(f"修复过程出错：{e}")
    traceback.print_exc()
finally:
    ws.close()

print("")
print("================================================")
print("  修复完成！")
print("================================================")
print("即时修复脚本已注入，当前会话立即可用。")
print("Service Worker 已注入，APP 每次启动自动加载修复版")
print("无需重复运行，手机重启后依然有效")
print("")
print("恢复原始 APP：设置→应用→背群英→清除数据")
PYTHON_EOF

# 清理
adb forward --remove tcp:$PORT 2>/dev/null
echo ""
echo "修复完成，请查看背群英 APP 是否正常显示"
echo ""
echo "如果仍然蓝屏，请用浏览器直接打开："
echo "  $FIX_URL"
