import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';
import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

// 自定义插件：viteSingleFile 之后做两件事：
// 1) 替换 import.meta.* 为安全兜底（非 module 脚本中 import.meta 不可用 → 蓝屏闪退）
// 2) 用 Babel 将内联 JS 转译为 ES5，兼容安卓 5.0.2 (Chromium 37-43)
function postProcessForLegacyWebView() {
  return {
    name: 'post-process-for-legacy-webview',
    enforce: 'post',
    closeBundle() {
      const distDir = path.resolve(__dirname, 'dist');
      const htmlPath = path.join(distDir, 'index.html');
      if (!fs.existsSync(htmlPath)) return;
      let html = fs.readFileSync(htmlPath, 'utf8');

      // 1) 替换 import.meta
      const before = (html.match(/import\.meta/g) || []).length;
      html = html.replace(/import\.meta\.url/g, '""');
      html = html.replace(/import\.meta\.resolve/g, 'undefined');
      html = html.replace(/import\.meta\.env\.[A-Za-z0-9_]+/g, 'undefined');
      html = html.replace(/import\.meta\.env/g, '{}');
      html = html.replace(/import\.meta\.glob[^\n;]*/g, '{}');
      html = html.replace(/import\.meta/g, '{}');
      if (before > 0) {
        console.log(`[post] Replaced ${before} import.meta occurrences`);
      }

      // 1.5) 剥离 <script type="module" ...> 的 module/crossorigin 属性
      // 安卓 5.0.2 WebView (Chromium ~37) 不支持 ES modules (需 Chrome 61+)，
      // 若保留 type="module"，整个内联脚本不会执行 → 白屏。
      // viteSingleFile 已将所有依赖内联进单 <script>，无 import 留存，转经典脚本安全。
      const moduleBefore = (html.match(/<script[^>]*type=["']module["'][^>]*>/gi) || []).length;
      html = html.replace(/(<script\b[^>]*?)\s+type=["']module["']/gi, '$1');
      html = html.replace(/(<script\b[^>]*?)\s+crossorigin(?!["'\w-])/gi, '$1');
      if (moduleBefore > 0) {
        console.log(`[post] Stripped type=module from ${moduleBefore} script tag(s)`);
      }

      // 2) 用 Babel 将内联 <script> 转译为 ES5（兼容 Chromium 37+）
      try {
        const babel = require('@babel/core');
        const scriptRegex = /<script([^>]*)>([\s\S]*?)<\/script>/gi;
        let changed = false;
        html = html.replace(scriptRegex, (match, attrs, code) => {
          if (!code || !code.trim()) return match;
          try {
            const result = babel.transformSync(code, {
              presets: [
                [require('@babel/preset-env'), {
                  targets: { chrome: '37' },
                  loose: true,
                  modules: false,
                }],
              ],
              compact: false,
              sourceMaps: false,
            });
            changed = true;
            return `<script${attrs}>${result.code}</script>`;
          } catch (e) {
            console.warn('[post] Babel transform skipped for a script block:', e.message);
            return match;
          }
        });
        if (changed) {
          console.log('[post] Babel ES5 transpile applied to inline scripts');
        }
      } catch (e) {
        console.warn('[post] Babel not available, skipping ES5 transpile:', e.message);
      }

      fs.writeFileSync(htmlPath, html);
    },
  };
}

export default defineConfig({
  base: './',
  plugins: [react(), viteSingleFile(), postProcessForLegacyWebView()],
  define: {
    'import.meta.url': JSON.stringify(''),
  },
  build: {
    // es2015：esbuild 可完整支持；后续 Babel 再降级到 ES5
    target: 'es2015',
    cssCodeSplit: false,
  },
});
