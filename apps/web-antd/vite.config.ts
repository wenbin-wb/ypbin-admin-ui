import { defineConfig } from '@vben/vite-config';

export default defineConfig(async () => {
  return {
    application: {},
    vite: {
      server: {
        proxy: {
          '/api': {
            changeOrigin: true,
            rewrite: (path) => path.replace(/^\/api/, ''),
            // ypbin-admin 后端地址（去掉 /api 前缀转发）
            target: 'http://localhost:8080',
            ws: true,
            configure: (proxy) => {
              // SSE 长连接（AI 对话流式输出）：Node 会因请求带 Connection: close
              // 而给响应同样标记 close，Chrome 收到后会在首帧前的空闲期中止连接；
              // 强制响应保持连接，保证流式输出稳定送达
              proxy.on('proxyRes', (proxyRes) => {
                proxyRes.headers.connection = 'keep-alive';
              });
            },
          },
          // 接口文档（knife4j/swagger）：页面与其相对资源都在后端，不 rewrite 原样转发，
          // 否则 /webjars、/v3/api-docs 等资源在前端端口 404 导致文档页白屏
          ...Object.fromEntries(
            [
              '/doc.html',
              '/webjars',
              '/v3/api-docs',
              '/swagger-ui',
              '/swagger-resources',
            ].map((p) => [
              p,
              { changeOrigin: true, target: 'http://localhost:8080' },
            ]),
          ),
        },
      },
    },
  };
});
