#!/usr/bin/env python3
"""
背群英蓝屏修复工具
不删除、不更新 APP，通过 ADB 让 APP 远程加载修复后的网页版

使用方法：
  1. 手机开启 USB 调试（设置→开发者选项→USB调试）
  2. 用数据线连接电脑
  3. 电脑安装 ADB 工具
  4. 运行：python3 fix_bluescreen.py

原理：
  蓝屏的 APP 因为 JavaScript 语法错误（import.meta）完全无法执行，
  导致页面空白只显示 CSS 背景色。
  本脚本通过 ADB + Chrome DevTools Protocol 让 APP 的 WebView
  跳转到 GitHub Pages 上修复后的网页版，APP 即可正常使用。

注意：
  这是临时修复，每次 APP 被杀进程后需要重新运行本脚本。
  永久修复需要安装新版 APK（不影响学习记录）。
"""

import subprocess
import sys
import os
import time
import json
import socket
import hashlib
import base64
import secrets
import urllib.request

PACKAGE = "com.gaokao.vocab"
ACTIVITY = "com.gaokao.vocab.MainActivity"
FIX_URL = "https://xdbzys.github.io/gaokao-vocab/%E8%83%8C%E7%BE%A4%E8%8B%B1.html"

def run_adb(*args, timeout=10):
    """Run an adb command and return output."""
    cmd = ["adb"] + list(args)
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout)
        return result.stdout.strip(), result.stderr.strip(), result.returncode
    except FileNotFoundError:
        print("错误：找不到 adb 命令，请先安装 ADB 工具")
        print("下载地址：https://developer.android.com/studio/releases/platform-tools")
        sys.exit(1)
    except subprocess.TimeoutExpired:
        return "", "timeout", 1

def check_device():
    """Check if a device is connected."""
    out, err, code = run_adb("devices")
    if code != 0:
        print("错误：无法运行 adb，请检查安装")
        sys.exit(1)
    lines = [l for l in out.split("\n") if l.strip() and not l.startswith("List")]
    if not lines:
        print("错误：未检测到设备，请：")
        print("  1. 确认手机已开启 USB 调试")
        print("  2. 确认数据线已连接")
        print("  3. 手机上点击「允许 USB 调试」")
        sys.exit(1)
    device = lines[0].split("\t")[0]
    print(f"✅ 已连接设备：{device}")
    return device

def start_app():
    """Start the app."""
    print("\n启动背群英 APP...")
    run_adb("shell", "am", "start", "-n", f"{PACKAGE}/{ACTIVITY}")
    time.sleep(3)
    print("✅ APP 已启动")

def find_devtools_socket():
    """Find the WebView DevTools socket."""
    out, _, _ = run_adb("shell", "cat", "/proc/net/unix")
    sockets = []
    for line in out.split("\n"):
        if "webview_devtools_remote" in line:
            parts = line.split()
            if len(parts) >= 8:
                socket_name = parts[7]
                sockets.append(socket_name)
    if not sockets:
        return None
    return sockets[0]

def forward_port(local_port, socket_name):
    """Forward a local port to the DevTools socket."""
    run_adb("forward", f"tcp:{local_port}", f"localabstract:{socket_name}")
    print(f"✅ 端口转发：localhost:{local_port} → {socket_name}")

def get_page_list(port):
    """Get the list of WebView pages."""
    url = f"http://localhost:{port}/json/list"
    try:
        with urllib.request.urlopen(url, timeout=5) as resp:
            return json.loads(resp.read().decode())
    except Exception as e:
        print(f"获取页面列表失败：{e}")
        return []

def navigate_via_new_tab(port, target_url):
    """Try to create a new tab with the target URL (simpler approach)."""
    url = f"http://localhost:{port}/json/new?{target_url}"
    try:
        with urllib.request.urlopen(url, timeout=10) as resp:
            data = json.loads(resp.read().decode())
            print(f"✅ 新页面已创建：{data.get('url', 'unknown')}")
            return data
    except Exception as e:
        print(f"创建新页面失败：{e}")
        return None

def navigate_via_websocket(port, ws_url, target_url):
    """Navigate the existing page via WebSocket."""
    # Parse WebSocket URL
    # ws://localhost:9222/devtools/page/<id>
    parts = ws_url.replace("ws://", "").replace("wss://", "").split("/", 1)
    host_port = parts[0]
    path = "/" + parts[1] if len(parts) > 1 else "/"
    
    host, _, port_str = host_port.partition(":")
    if not port_str:
        port_str = "80"
    port_num = int(port_str)

    # WebSocket handshake
    key = base64.b64encode(secrets.token_bytes(16)).decode()
    
    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    sock.settimeout(10)
    sock.connect((host, port_num))
    
    # Send upgrade request
    request = (
        f"GET {path} HTTP/1.1\r\n"
        f"Host: {host}:{port_num}\r\n"
        f"Upgrade: websocket\r\n"
        f"Connection: Upgrade\r\n"
        f"Sec-WebSocket-Key: {key}\r\n"
        f"Sec-WebSocket-Version: 13\r\n"
        f"\r\n"
    )
    sock.sendall(request.encode())
    
    # Receive upgrade response
    response = b""
    while b"\r\n\r\n" not in response:
        chunk = sock.recv(4096)
        if not chunk:
            break
        response += chunk
    
    if b"101" not in response.split(b"\r\n")[0]:
        print(f"WebSocket 握手失败：{response[:200]}")
        sock.close()
        return False
    
    print("✅ WebSocket 连接已建立")
    
    # Send Page.navigate command
    msg = json.dumps({
        "id": 1,
        "method": "Page.navigate",
        "params": {"url": target_url}
    })
    
    # WebSocket frame: client must mask
    payload = msg.encode("utf-8")
    mask_key = secrets.token_bytes(4)
    masked = bytearray()
    for i, b in enumerate(payload):
        masked.append(b ^ mask_key[i % 4])
    
    # Frame header
    frame = bytearray()
    frame.append(0x81)  # FIN + text opcode
    length = len(payload)
    if length < 126:
        frame.append(0x80 | length)  # MASK bit + length
    elif length < 65536:
        frame.append(0x80 | 126)  # MASK + extended length
        frame.extend(length.to_bytes(2, "big"))
    else:
        frame.append(0x80 | 127)
        frame.extend(length.to_bytes(8, "big"))
    frame.extend(mask_key)
    frame.extend(masked)
    
    sock.sendall(frame)
    print(f"✅ 已发送导航命令：{target_url[:60]}...")
    
    # Wait for response
    time.sleep(3)
    
    try:
        resp_data = sock.recv(4096)
        print(f"✅ 收到响应（{len(resp_data)} 字节）")
    except socket.timeout:
        print("⚠ 等待响应超时（可能仍在加载，属正常）")
    
    sock.close()
    return True

def verify_page(port):
    """Verify the page has content."""
    pages = get_page_list(port)
    for page in pages:
        if "xdbzys" in page.get("url", "") or "背群英" in page.get("title", ""):
            print(f"✅ 页面已加载修复版：{page.get('url', '')[:60]}...")
            return True
    return False

def main():
    print("=" * 50)
    print("  背群英蓝屏修复工具 v1.0")
    print("  无需删除/更新 APP，远程加载修复版")
    print("=" * 50)
    
    # Step 1: Check device
    check_device()
    
    # Step 2: Start app
    start_app()
    
    # Step 3: Find DevTools socket
    print("\n查找 WebView 调试端口...")
    socket_name = find_devtools_socket()
    if not socket_name:
        print("⚠ 未找到 WebView 调试端口，尝试备用方式...")
        # Try common socket names
        for name in ["webview_devtools_remote_0", "webview_devtools_remote"]:
            out, _, _ = run_adb("shell", "cat", "/proc/net/unix")
            if name in out:
                socket_name = name
                break
    
    if not socket_name:
        print("❌ 无法找到 WebView 调试端口")
        print("可能原因：")
        print("  1. APP 是 Release 版本（不支持调试）")
        print("  2. APP 未完全启动")
        print("\n替代方案：")
        print(f"  用手机浏览器打开以下链接使用网页版：")
        print(f"  {FIX_URL}")
        print("  并添加到桌面，体验与 APP 基本一致")
        sys.exit(1)
    
    print(f"✅ 找到调试端口：{socket_name}")
    
    # Step 4: Forward port
    local_port = 9222
    forward_port(local_port, socket_name)
    
    # Step 5: Get page list
    print("\n获取 WebView 页面信息...")
    pages = get_page_list(local_port)
    
    if not pages:
        print("❌ 未找到 WebView 页面")
        sys.exit(1)
    
    target_page = pages[0]
    ws_url = target_page.get("webSocketDebuggerUrl", "")
    print(f"✅ 当前页面：{target_page.get('url', '')[:60]}...")
    
    # Step 6: Navigate to fixed URL
    print(f"\n正在加载修复版网页...")
    
    # Try WebSocket navigation first (more reliable)
    if ws_url:
        success = navigate_via_websocket(local_port, ws_url, FIX_URL)
        if not success:
            # Fall back to creating a new tab
            print("WebSocket 方式失败，尝试新标签页方式...")
            navigate_via_new_tab(local_port, FIX_URL)
    else:
        navigate_via_new_tab(local_port, FIX_URL)
    
    # Step 7: Verify
    print("\n验证修复结果...")
    time.sleep(3)
    
    if verify_page(local_port):
        print("\n" + "=" * 50)
        print("  ✅ 蓝屏已修复！APP 现在可以正常使用了")
        print("=" * 50)
        print("\n注意：")
        print("  1. 这是临时修复，APP 被杀进程后需要重新运行本脚本")
        print("  2. 永久修复请安装新版 APK（不影响学习记录）")
        print("  3. 下载新版 APK：https://github.com/xdbzys/gaokao-vocab/releases/latest/download/app-debug.apk")
    else:
        print("\n⚠ 无法自动验证，请查看手机上的 APP 是否正常显示")
        print("如果仍然蓝屏，请尝试用手机浏览器直接访问：")
        print(f"  {FIX_URL}")
    
    # Clean up port forwarding
    run_adb("forward", "--remove", f"tcp:{local_port}")

if __name__ == "__main__":
    main()
