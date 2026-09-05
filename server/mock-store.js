const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

let cache;

function getMockDb() {
  if (cache) return structuredClone(cache);
  const source = fs.readFileSync(path.join(__dirname, "..", "mock.js"), "utf8");
  const sandbox = { window: {} };
  vm.runInNewContext(source, sandbox, { filename: "mock.js" });
  cache = sandbox.window.MOCK_DB;
  return structuredClone(cache);
}

module.exports = { getMockDb };
