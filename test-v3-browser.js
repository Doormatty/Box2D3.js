const assert = require("assert");
const fs = require("fs");
const http = require("http");
const os = require("os");
const path = require("path");
const { spawn } = require("child_process");

const root = __dirname;
const page = process.argv[2] || "test-v3-browser.html";
const expectedText = process.argv[3] || "Box2D v3 browser smoke test passed";

function browserCandidates() {
  const candidates = [];

  if (process.env.BROWSER) {
    candidates.push(process.env.BROWSER);
  }

  candidates.push(
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    "google-chrome",
    "chromium",
    "chromium-browser",
    "msedge"
  );

  return candidates;
}

function findBrowser() {
  for (const candidate of browserCandidates()) {
    if (candidate.includes("\\") || candidate.includes("/")) {
      if (fs.existsSync(candidate)) {
        return candidate;
      }
    } else if (executableOnPath(candidate)) {
      return candidate;
    }
  }

  throw new Error("No Chrome, Chromium, or Edge browser binary found");
}

function executableOnPath(command) {
  const pathEntries = (process.env.PATH || "").split(path.delimiter);
  const extensions = process.platform === "win32"
    ? (process.env.PATHEXT || ".EXE;.CMD;.BAT;.COM").split(";")
    : [""];

  for (const entry of pathEntries) {
    for (const extension of extensions) {
      const executable = path.join(entry, command + extension.toLowerCase());
      const executableUpper = path.join(entry, command + extension.toUpperCase());

      if (fs.existsSync(executable) || fs.existsSync(executableUpper)) {
        return true;
      }
    }
  }

  return false;
}

function contentType(filePath) {
  switch (path.extname(filePath)) {
    case ".html":
      return "text/html; charset=utf-8";
    case ".js":
      return "text/javascript; charset=utf-8";
    case ".wasm":
      return "application/wasm";
    default:
      return "application/octet-stream";
  }
}

function safePath(urlPath) {
  const decodedPath = decodeURIComponent(new URL(urlPath, "http://127.0.0.1").pathname);
  const normalizedPath = path.normalize(decodedPath).replace(/^([/\\])+/, "");
  const filePath = path.join(root, normalizedPath || page);
  const relative = path.relative(root, filePath);

  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    return null;
  }

  return filePath;
}

function createServer() {
  return http.createServer((request, response) => {
    const filePath = safePath(request.url);

    if (!filePath) {
      response.writeHead(403);
      response.end("Forbidden");
      return;
    }

    fs.readFile(filePath, (error, content) => {
      if (error) {
        response.writeHead(error.code === "ENOENT" ? 404 : 500);
        response.end(error.message);
        return;
      }

      response.writeHead(200, { "Content-Type": contentType(filePath) });
      response.end(content);
    });
  });
}

function runBrowser(browser, url) {
  return new Promise((resolve, reject) => {
    const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), "box2d-v3-browser-"));
    const args = [
      "--headless=new",
      "--disable-gpu",
      "--no-sandbox",
      "--dump-dom",
      "--virtual-time-budget=5000",
      `--user-data-dir=${userDataDir}`,
      url,
    ];
    const child = spawn(browser, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", reject);
    child.on("close", (code) => {
      fs.rmSync(userDataDir, { recursive: true, force: true });

      if (code !== 0) {
        reject(new Error(`Browser exited with code ${code}\n${stderr}`));
        return;
      }

      resolve({ stdout, stderr });
    });
  });
}

(async function main() {
  const browser = findBrowser();
  const server = createServer();

  await new Promise((resolve) => {
    server.listen(0, "127.0.0.1", resolve);
  });

  try {
    const { port } = server.address();
    const result = await runBrowser(browser, `http://127.0.0.1:${port}/${page}`);

    assert(
      result.stdout.includes(expectedText),
      "browser smoke test did not report success"
    );

    console.log(expectedText);
  } finally {
    server.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
