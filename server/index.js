require("dotenv").config();
const tls = require("node:tls");
const { createApp } = require("./app");

// Node 的内置 CA 不一定包含 macOS 钥匙串中的企业证书。
// 合并系统 CA，避免关闭 TLS 校验。
if (typeof tls.getCACertificates === "function" && typeof tls.setDefaultCACertificates === "function") {
  tls.setDefaultCACertificates([
    ...tls.getCACertificates("default"),
    ...tls.getCACertificates("system")
  ]);
}

const port = Number(process.env.PORT) || 18765;
const app = createApp();

if (require.main === module) {
  app.listen(port, () => {
    console.log(`乐乐的 AI Trading Agent 已启动：http://localhost:${port}`);
  });
}

module.exports = app;
