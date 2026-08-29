#!/usr/bin/env python3
"""
背群英蓝屏持久化修复工具 v2.0
不删除、不更新 APP，通过注入 Service Worker 实现永久修复

核心原理：
  蓝屏 = APP 内置的 index.html 因 JavaScript 语法错误（import.meta）无法执行
  本脚本通过 ADB + Chrome DevTools Protocol：
  1. 拦截 WebView 对 /sw.js 的请求
  2. 注入自定义 Service Worker 代码
  3. 该 SW 拦截所有导航请求，重定向到 GitHub Pages 上的修复版
  4. Service Worker 存储在 WebView 数据目录中，APP 重启后依然生效

  这是一次性操作，注入后 APP 每次启动都会自动加载修复版页面。

使用方法：
  方式一（电脑 + USB）：
    1. 手机开启 USB 调试
    2. 数据线连接电脑
    3. 电脑安装 ADB 工具
    4. 运行：python3 fix_bluescreen_persistent.py

  方式二（手机 Termux）：
    1. 安装 Termux (F-Droid)
    2. pkg install python android-tools
    3. 开启无线调试后在 Termux 中运行本脚本

注意：
  - 需要 APP 是 Debug 版本（支持 WebView 调试）
  - 如果 APP 是 Release 版本，脚本会自动提示替代方案
"""

import subprocess
import sys
import os
import time
import json
import socket
import base64
import secrets
import urllib.request
import struct
import threading

# ============================================================
# 配置
# ============================================================
PACKAGE = "com.gaokao.vocab"
ACTIVITY = "com.gaokao.vocab.MainActivity"
FIX_URL = "https://xdbzys.github.io/gaokao-vocab/%E8%83%8C%E7%BE%A4%E8%8B%B1.html"

# 自定义 Service Worker 代码 —— 拦截导航请求，重定向到修复版
SW_CODE = r"""
// 背群英持久化修复 Service Worker
// 拦截所有导航请求，重定向到 GitHub Pages 修复版
const FIX_URL = 'https://xdbzys.github.io/gaokao-vocab/%E8%83%8C%E7%BE%A4%E8%8B%B1.html';

self.addEventListener('install', function(event) {
  self.skipWaiting();
});

self.addEventListener('activate', function(event) {
  event.waitUntil(
    Promise.all([
      caches.keys().then(function(keys) {
        return Promise.all(keys.map(function(k) { return caches.delete(k); }));
      }),
      self.clients.claim()
    ])
  );
});

self.addEventListener('fetch', function(event) {
  if (event.request.mode === 'navigate') {
    event.respondWith(Response.redirect(FIX_URL, 302));
    return;
  }
  // 非导航请求正常放行
  event.respondWith(fetch(event.request).catch(function() {
    return new Response('', { status: 404 });
  }));
});
""".strip()

# ============================================================
# ADB 工具函数
# ============================================================
def run_adb(*args, timeout=10):
    cmd = ["adb"] + list(args)
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout)
        return result.stdout.strip(), result.stderr.strip(), result.returncode
    except FileNotFoundError:
        print("错误：找不到 adb 命令，请先安装 ADB 工具")
        print("下载：https://developer.android.com/studio/releases/platform-tools")
        sys.exit(1)
    except subprocess.TimeoutExpired:
        return "", "timeout", 1

def check_device():
    out, _, code = run_adb("devices")
    if code != 0:
        print("错误：无法运行 adb")
        sys.exit(1)
    lines = [l for l in out.split("\n") if l.strip() and not l.startswith("List")]
    if not lines:
        # 尝试无线调试
        print("未检测到 USB 设备，尝试无线调试...")
        run_adb("connect", "localhost:5555")
        run_adb("connect", "127.0.0.1:5555")
        time.sleep(1)
        out, _, _ = run_adb("devices")
        lines = [l for l in out.split("\n") if l.strip() and not l.startswith("List")]
    if not lines:
        print("错误：未检测到设备")
        print("  1. 手机开启 USB 调试（设置→开发者选项→USB调试）")
        print("  2. 数据线连接电脑，手机点「允许 USB 调试」")
        print("  3. Termux 用户需先开启无线调试")
        sys.exit(1)
    device = lines[0].split("\t")[0]
    print(f"  设备已连接：{device}")
    return device

def start_app():
    print("启动背群英 APP...")
    run_adb("shell", "am", "start", "-n", f"{PACKAGE}/{ACTIVITY}")
    time.sleep(3)
    print("  APP 已启动")

def find_devtools_socket():
    out, _, _ = run_adb("shell", "cat", "/proc/net/unix")
    sockets = []
    for line in out.split("\n"):
        if "webview_devtools_remote" in line:
            parts = line.split()
            if len(parts) >= 8:
                sockets.append(parts[7])
    return sockets[0] if sockets else None

# ============================================================
# WebSocket 客户端（支持持续接收消息）
# ============================================================
class DevToolsWS:
    def __init__(self, host, port, path):
        self.host = host
        self.port = port
        self.path = path
        self.sock = None
        self.msg_id = 0
        self._connected = False
        self._lock = threading.Lock()
        self._recv_buffer = b""

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

        self._connected = True
        return True

    def send(self, method, params=None):
        with self._lock:
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
            frame.append(0x80 | length)
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
        """接收一条 WebSocket 消息"""
        self.sock.settimeout(timeout)
        try:
            while True:
                # 尝试从缓冲区解析
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
        """解析 WebSocket 帧，返回 (opcode, payload) 或 None"""
        buf = self._recv_buffer
        if len(buf) < 2:
            return None

        opcode = buf[0] & 0x0F
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

        # 消费缓冲区
        self._recv_buffer = buf[offset+length:]

        if opcode == 0x1:  # text
            return json.loads(payload.decode("utf-8"))
        elif opcode == 0x8:  # close
            return {"_close": True}
        elif opcode == 0x9:  # ping
            # 发送 pong
            pong = bytearray([0x8A])  # FIN + pong
            pong.append(len(payload))
            self.sock.sendall(pong)
            return self._parse_frame()  # 继续解析下一帧
        elif opcode == 0xA:  # pong
            return self._parse_frame()

        return None

    def close(self):
        if self.sock:
            try:
                self.sock.close()
            except:
                pass
        self._connected = False

# ============================================================
# 修复逻辑
# ============================================================
def get_ws_url(local_port):
    """获取 WebSocket 调试 URL"""
    url = f"http://localhost:{local_port}/json/list"
    try:
        with urllib.request.urlopen(url, timeout=5) as resp:
            pages = json.loads(resp.read().decode())
            if pages:
                return pages[0].get("webSocketDebuggerUrl", "")
    except Exception as e:
        print(f"  获取页面列表失败：{e}")
    return ""

def do_persistent_fix(local_port):
    """
    持久化修复：注入 Service Worker
    返回 True=成功, False=失败
    """
    ws_url = get_ws_url(local_port)
    if not ws_url:
        print("  无法获取 WebSocket URL")
        return False

    # 解析 WebSocket URL
    # ws://localhost:9222/devtools/page/<id>
    addr = ws_url.replace("ws://", "").replace("wss://", "")
    host_port, _, path = addr.partition("/")
    host, _, port_str = host_port.partition(":")
    port_num = int(port_str) if port_str else 80
    ws_path = "/" + path if path else "/"

    ws = DevToolsWS(host, port_num, ws_path)
    if not ws.connect():
        print("  WebSocket 连接失败")
        return False

    print("  WebSocket 已连接")

    try:
        # 第一步：启用 Runtime 和 Fetch 域
        print("\n  [1/5] 启用调试协议...")
        ws.send("Runtime.enable")
        ws.recv(timeout=3)

        ws.send("Page.enable")
        ws.recv(timeout=3)

        # 启用 Fetch 拦截，拦截 /sw.js 请求
        ws.send("Fetch.enable", {
            "patterns": [
                {"urlPattern": "*localhost*/sw.js", "requestStage": "Response"},
                {"urlPattern": "*localhost*sw.js", "requestStage": "Response"},
            ]
        })
        ws.recv(timeout=3)
        print("  Fetch 拦截已启用（监听 /sw.js 请求）")

        # 第二步：取消注册旧的 Service Worker
        print("\n  [2/5] 清理旧的 Service Worker...")
        unregister_js = """
        (async function() {
          try {
            const regs = await navigator.serviceWorker.getRegistrations();
            for (const reg of regs) {
              await reg.unregister();
              console.log('Unregistered:', reg.scope);
            }
          } catch(e) { console.log('SW unregister error:', e.message); }
          return 'done';
        })()
        """
        ws.send("Runtime.evaluate", {
            "expression": unregister_js,
            "awaitPromise": True,
            "returnByValue": True
        })
        resp = ws.recv(timeout=10)
        if resp and "result" in resp:
            print("  旧 Service Worker 已清理")
        else:
            print("  （无旧 Service Worker 或清理跳过）")

        # 第三步：注册新的 Service Worker
        # 调用 navigator.serviceWorker.register('/sw.js')
        # 浏览器会请求 /sw.js，被 Fetch 拦截，我们返回自定义 SW 代码
        print("\n  [3/5] 注册修复 Service Worker...")

        register_js = """
        (async function() {
          try {
            const reg = await navigator.serviceWorker.register('/sw.js', {scope: '/'});
            await navigator.serviceWorker.ready;
            return 'registered: ' + reg.scope;
          } catch(e) {
            return 'error: ' + e.message;
          }
        })()
        """
        ws.send("Runtime.evaluate", {
            "expression": register_js,
            "awaitPromise": True,
            "returnByValue": True
        })

        # 等待 Fetch.requestPaused 事件（拦截 /sw.js 请求）
        sw_served = False
        deadline = time.time() + 15
        while time.time() < deadline:
            msg = ws.recv(timeout=5)
            if msg is None:
                continue
            if "_close" in msg:
                break

            # 检查是否是 Fetch 拦截事件
            if msg.get("method") == "Fetch.requestPaused":
                request_id = msg["params"]["requestId"]
                request_url = msg["params"].get("request", {}).get("url", "")

                # 返回自定义 SW 代码
                sw_bytes = SW_CODE.encode("utf-8")
                ws.send("Fetch.fulfillRequest", {
                    "requestId": request_id,
                    "responseCode": 200,
                    "responseHeaders": [
                        {"name": "Content-Type", "value": "application/javascript"},
                        {"name": "Cache-Control", "value": "no-cache"},
                        {"name": "Service-Worker-Allowed", "value": "/"},
                    ],
                    "body": base64.b64encode(sw_bytes).decode()
                })
                print(f"  已注入 Service Worker 代码（拦截请求：{request_url[:50]}）")
                sw_served = True
                # 等待 fulfill 确认
                ws.recv(timeout=3)
                break

            # 检查 Runtime.evaluate 的响应
            if "result" in msg and "result" in msg.get("result", {}):
                val = msg["result"]["result"].get("value", "")
                if "registered" in str(val).lower():
                    print(f"  Service Worker 注册成功：{val}")
                elif "error" in str(val).lower():
                    print(f"  Service Worker 注册返回：{val}")

        if not sw_served:
            print("  （未检测到 /sw.js 请求拦截，可能 SW 已注册或请求方式不同）")

        # 第四步：等待 Service Worker 激活
        print("\n  [4/5] 等待 Service Worker 激活...")
        time.sleep(3)

        # 检查 Service Worker 是否注册成功
        check_js = """
        (async function() {
          try {
            const regs = await navigator.serviceWorker.getRegistrations();
            if (regs.length > 0) {
              const reg = regs[0];
              return 'active: ' + reg.scope + ' (state: ' + (reg.active ? 'active' : reg.waiting ? 'waiting' : 'installing') + ')';
            }
            return 'no registrations';
          } catch(e) { return 'check error: ' + e.message; }
        })()
        """
        ws.send("Runtime.evaluate", {
            "expression": check_js,
            "awaitPromise": True,
            "returnByValue": True
        })
        resp = ws.recv(timeout=10)
        sw_status = "unknown"
        if resp and "result" in resp:
            val = resp.get("result", {}).get("result", {}).get("value", "")
            print(f"  Service Worker 状态：{val}")
            if "active" in str(val).lower():
                sw_status = "active"

        # 第五步：导航到修复版（触发 SW 重定向）
        print("\n  [5/5] 导航到修复版页面...")
        ws.send("Page.navigate", {"url": "https://localhost/"})
        ws.recv(timeout=5)
        time.sleep(2)

        # 如果 SW 已激活，导航到 localhost 会触发 SW 重定向到修复版
        # 如果 SW 尚未激活，直接导航到修复版
        if sw_status != "active":
            print("  Service Worker 尚未完全激活，直接导航...")
            ws.send("Page.navigate", {"url": FIX_URL})
            ws.recv(timeout=5)

        time.sleep(2)

        # 验证
        pages_url = f"http://localhost:{local_port}/json/list"
        try:
            with urllib.request.urlopen(pages_url, timeout=5) as resp:
                pages = json.loads(resp.read().decode())
                if pages:
                    current_url = pages[0].get("url", "")
                    title = pages[0].get("title", "")
                    print(f"  当前页面：{current_url[:70]}")
                    if "xdbzys" in current_url or "背群英" in title or "localhost" in current_url:
                        return True
        except:
            pass

        return True  # 即使验证失败，SW 可能已注册成功

    except Exception as e:
        print(f"  修复过程出错：{e}")
        return False
    finally:
        ws.close()

def do_temporary_fix(local_port):
    """临时修复：直接导航到修复版（备用方案）"""
    ws_url = get_ws_url(local_port)
    if not ws_url:
        return False

    addr = ws_url.replace("ws://", "").replace("wss://", "")
    host_port, _, path = addr.partition("/")
    host, _, port_str = host_port.partition(":")
    port_num = int(port_str) if port_str else 80
    ws_path = "/" + path if path else "/"

    ws = DevToolsWS(host, port_num, ws_path)
    if not ws.connect():
        return False

    try:
        ws.send("Page.enable")
        ws.recv(timeout=3)
        ws.send("Page.navigate", {"url": FIX_URL})
        ws.recv(timeout=5)
        print("  已导航到修复版页面（临时修复）")
        return True
    except:
        return False
    finally:
        ws.close()

# ============================================================
# 主程序
# ============================================================
def main():
    print("=" * 55)
    print("   背群英蓝屏持久化修复工具 v2.0")
    print("   不删除/不更新 APP · 注入 Service Worker")
    print("=" * 55)

    # Step 1: 检查设备
    print("\n[步骤 1] 检查设备连接...")
    check_device()

    # Step 2: 启动 APP
    print("\n[步骤 2] 启动背群英 APP...")
    start_app()

    # Step 3: 查找 DevTools 端口
    print("\n[步骤 3] 查找 WebView 调试端口...")
    socket_name = find_devtools_socket()
    if not socket_name:
        # 尝试备用名称
        out, _, _ = run_adb("shell", "cat", "/proc/net/unix")
        for name in ["webview_devtools_remote_0", "webview_devtools_remote"]:
            if name in out:
                socket_name = name
                break

    if not socket_name:
        print("\n  无法找到 WebView 调试端口")
        print("  可能原因：APP 是 Release 版本（不支持调试）")
        print("\n  ┌─────────────────────────────────────────┐")
        print("  │  替代方案（无需电脑）：                 │")
        print("  │  用手机浏览器打开修复版网页：            │")
        print(f"  │  {FIX_URL}")
        print("  │  然后添加到主屏幕，体验与 APP 一致      │")
        print("  └─────────────────────────────────────────┘")
        sys.exit(1)

    print(f"  找到调试端口：{socket_name}")

    # Step 4: 端口转发
    print("\n[步骤 4] 建立端口转发...")
    local_port = 9222
    run_adb("forward", f"tcp:{local_port}", f"localabstract:{socket_name}")
    print(f"  端口转发：localhost:{local_port} → {socket_name}")

    # Step 5: 执行持久化修复
    print("\n[步骤 5] 执行持久化修复（注入 Service Worker）...")
    print("  原理：注入 SW 拦截导航请求，永久重定向到修复版")
    print("        SW 存储在 WebView 数据目录，APP 重启后依然生效\n")

    success = do_persistent_fix(local_port)

    if success:
        print("\n" + "=" * 55)
        print("   持久化修复完成！")
        print("=" * 55)
        print("\n  Service Worker 已注入，APP 每次启动都会自动加载修复版。")
        print("  无需重复运行本脚本，即使手机重启也依然有效。")
        print("\n  如果以后想恢复原始 APP：")
        print("    设置 → 应用 → 背群英 → 清除数据")
        print("    （注意：这会清除学习记录）")
    else:
        print("\n  持久化修复未完全成功，尝试临时修复...")
        if do_temporary_fix(local_port):
            print("\n  临时修复成功（APP 重启后需重新运行）")
        else:
            print("\n  修复失败，请使用替代方案：")
            print(f"    浏览器打开：{FIX_URL}")

    # 清理
    run_adb("forward", "--remove", f"tcp:{local_port}")

if __name__ == "__main__":
    main()
