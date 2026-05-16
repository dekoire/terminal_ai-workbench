var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// electron/import-meta-url.js
var __importMetaUrl = require("url").pathToFileURL(__filename).href;

// electron/main.ts
var import_electron = require("electron");
var import_http = require("http");
var import_child_process2 = require("child_process");
var import_path3 = __toESM(require("path"), 1);
var import_express2 = __toESM(require("express"), 1);

// server/routes/api.ts
var import_express = require("express");
var import_child_process = require("child_process");
var import_fs = __toESM(require("fs"), 1);
var import_path = __toESM(require("path"), 1);
var import_os = require("os");

// server/state.ts
var pendingPerms = /* @__PURE__ */ new Map();
var sessionWs = /* @__PURE__ */ new Map();
var claudeSessionIds = /* @__PURE__ */ new Map();
var activePtys = /* @__PURE__ */ new Map();
var pendingPermsBySession = /* @__PURE__ */ new Map();

// server/routes/api.ts
var router = (0, import_express.Router)();
var home = () => process.env.HOME ?? "/Users/" + (process.env.USER ?? "");
var tilde = (p) => p.replace(/^~/, home());
function readBody(req) {
  return new Promise((resolve) => {
    let d = "";
    req.on("data", (c) => {
      d += c.toString();
    });
    req.on("end", () => resolve(d));
  });
}
router.get("/api/home", (_req, res) => {
  res.json({ home: home() });
});
router.get("/api/open", (req, res) => {
  const filePath = tilde(req.query.path ?? "");
  if (!filePath) {
    res.status(400).json({ ok: false });
    return;
  }
  (0, import_child_process.exec)(`open "${filePath}"`, (err) => res.json({ ok: !err, error: err?.message }));
});
router.get("/api/which", (req, res) => {
  const cmd = (req.query.cmd ?? "").replace(/['"\\;|&$`]/g, "");
  if (!cmd) {
    res.json({ ok: false, path: null });
    return;
  }
  (0, import_child_process.exec)(`zsh -i -c "type -a '${cmd}' 2>/dev/null"`, { timeout: 4e3 }, (err, out) => {
    const text = out?.trim() ?? "";
    if (err || !text) {
      res.json({ ok: false, path: null });
      return;
    }
    const m = text.match(/is (\/[^\s]+)/);
    res.json({ ok: true, path: m ? m[1] : text.split("\n")[0] });
  });
});
router.post("/api/zshrc-alias", async (req, res) => {
  try {
    const { aliasName, aliasCmd } = JSON.parse(await readBody(req));
    const zshrcPath = import_path.default.join(home(), ".zshrc");
    const line = `alias ${aliasName}='${aliasCmd}'`;
    let content = "";
    try {
      content = import_fs.default.readFileSync(zshrcPath, "utf-8");
    } catch {
    }
    const filtered = content.split("\n").filter((l) => !l.match(new RegExp(`^\\s*alias\\s+${aliasName}=`))).join("\n");
    import_fs.default.writeFileSync(zshrcPath, filtered.trimEnd() + "\n" + line + "\n", "utf-8");
    const helperDir = import_path.default.join(home(), ".cc-ui-aliases");
    const helperFile = import_path.default.join(helperDir, `${aliasName}.sh`);
    import_fs.default.mkdirSync(helperDir, { recursive: true });
    import_fs.default.writeFileSync(helperFile, `#!/bin/zsh
alias ${aliasName}='${aliasCmd}'
`, "utf-8");
    import_fs.default.chmodSync(helperFile, 493);
    const sourceDir = import_path.default.join(home(), ".zshrc");
    const sourceLine = `[ -d ~/.cc-ui-aliases ] && for f in ~/.cc-ui-aliases/*.sh; do source "$f"; done`;
    const currentZshrc = import_fs.default.readFileSync(sourceDir, "utf-8");
    if (!currentZshrc.includes(".cc-ui-aliases")) {
      import_fs.default.appendFileSync(sourceDir, "\n# Codera AI \u2014 auto-registered aliases\n" + sourceLine + "\n");
    }
    res.json({ ok: true });
  } catch (e) {
    res.json({ ok: false, error: String(e) });
  }
});
router.get("/api/store-read", (_req, res) => {
  const filePath = import_path.default.join(home(), ".cc-ui-data.json");
  try {
    res.send(import_fs.default.readFileSync(filePath, "utf-8") || "null");
  } catch {
    res.send("null");
  }
});
router.post("/api/store-write", async (req, res) => {
  const filePath = import_path.default.join(home(), ".cc-ui-data.json");
  const body = await readBody(req);
  try {
    if (body && body !== "null") import_fs.default.writeFileSync(filePath, body, "utf-8");
    else try {
      import_fs.default.unlinkSync(filePath);
    } catch {
    }
    res.json({ ok: true });
  } catch (e) {
    res.json({ ok: false, error: String(e) });
  }
});
router.get("/api/browse", (req, res) => {
  const dirPath = tilde(req.query.path ?? home());
  try {
    const entries = import_fs.default.readdirSync(dirPath, { withFileTypes: true });
    const items = entries.filter((e) => !e.name.startsWith(".") || e.name === "..").map((e) => ({ name: e.name, path: import_path.default.join(dirPath, e.name), isDir: e.isDirectory() })).sort((a, b) => a.isDir !== b.isDir ? a.isDir ? -1 : 1 : a.name.localeCompare(b.name));
    const withParent = dirPath !== "/" ? [{ name: "..", path: import_path.default.dirname(dirPath), isDir: true }, ...items] : items;
    res.json({ items: withParent, currentPath: dirPath });
  } catch (e) {
    res.json({ items: [], currentPath: dirPath, error: String(e) });
  }
});
router.get("/api/pick-folder", (req, res) => {
  const startPath = tilde(req.query.path ?? home()).replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  const script = `POSIX path of (choose folder with prompt "Projektordner w\xE4hlen:" default location POSIX file "${startPath}")`;
  (0, import_child_process.exec)(`osascript -e '${script.replace(/'/g, "'\\''")}'`, { timeout: 6e4 }, (err, out) => {
    if (err) res.json({ ok: false, path: null, error: err.message });
    else res.json({ ok: true, path: out.trim().replace(/\/$/, "") });
  });
});
router.get("/api/pick-file", (req, res) => {
  const startPath = tilde(req.query.path ?? home()).replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  const script = `POSIX path of (choose file with prompt "Datei ausw\xE4hlen:" default location POSIX file "${startPath}")`;
  (0, import_child_process.exec)(`osascript -e '${script.replace(/'/g, "'\\''")}'`, { timeout: 6e4 }, (err, out) => {
    if (err) res.json({ ok: false, path: null, error: err.message });
    else res.json({ ok: true, path: out.trim() });
  });
});
router.get("/api/git", (req, res) => {
  const cwd = tilde(req.query.path ?? home());
  const run = (cmd) => new Promise(
    (resolve) => (0, import_child_process.exec)(cmd, { cwd }, (_, out, err) => resolve((out || err || "").trim()))
  );
  run("git rev-parse --is-inside-work-tree").then(async (check) => {
    if (check !== "true") {
      res.json({ hasGit: false, status: [], log: [], branches: [], remotes: [], diffStat: "", lastCommit: "" });
      return;
    }
    const [status, log, branches, diffStat, remotes, lastCommit] = await Promise.all([
      run("git status --short"),
      run('git log --oneline -20 --pretty=format:"%h|%s|%an|%ar|%ai"'),
      run('git branch -v --format="%(refname:short)|%(objectname:short)|%(subject)|%(HEAD)"'),
      run("git diff --stat HEAD 2>/dev/null | tail -1"),
      run("git remote -v | head -2"),
      run('git log -1 --format="%ar"')
    ]);
    res.json({
      hasGit: true,
      status: status.split("\n").filter(Boolean).map((l) => ({ flag: l.slice(0, 2).trim(), file: l.slice(3) })),
      log: log.split("\n").filter(Boolean).map((l) => {
        const p = l.split("|");
        return { hash: p[0], msg: p[1], author: p[2], when: p[3], date: p[4] };
      }),
      branches: branches.split("\n").filter(Boolean).map((l) => {
        const p = l.split("|");
        return { name: p[0], hash: p[1], msg: p[2], current: p[3] === "*" };
      }),
      diffStat,
      remotes: [...new Set(remotes.split("\n").filter(Boolean).map((l) => l.split("	")[0]))],
      lastCommit
    });
  }).catch((e) => res.json({ hasGit: false, error: String(e), status: [], log: [], branches: [], remotes: [], diffStat: "", lastCommit: "" }));
});
router.post("/api/git-action", async (req, res) => {
  try {
    const { action, path: cwd, message, remote, branch } = JSON.parse(await readBody(req));
    const resolved = tilde(cwd);
    const run = (cmd) => new Promise(
      (ok) => (0, import_child_process.exec)(cmd, { cwd: resolved }, (err, out, errOut) => ok(err ? errOut || err.message : out.trim()))
    );
    let result = { ok: false, out: "unknown action" };
    if (action === "stage") result = { ok: true, out: await run("git add -A") };
    if (action === "commit") result = { ok: true, out: await run(`git commit -m ${JSON.stringify(message ?? "Update")}`) };
    if (action === "push") result = { ok: true, out: await run(`git push ${remote ?? "origin"} ${branch ?? "HEAD"}`) };
    if (action === "push-u") result = { ok: true, out: await run(`git push -u origin ${JSON.stringify(branch ?? "main")}`) };
    if (action === "pull") result = { ok: true, out: await run("git pull") };
    if (action === "checkout") result = { ok: true, out: await run(`git checkout ${JSON.stringify(branch ?? "")}`) };
    if (action === "new-branch") result = { ok: true, out: await run(`git checkout -b ${JSON.stringify(branch ?? "")}`) };
    if (action === "init") {
      const o1 = await run("git init");
      const o2 = await run(`git checkout -b ${JSON.stringify(branch ?? "main")}`);
      result = { ok: true, out: o1 + "\n" + o2 };
    }
    if (action === "add-remote" && remote) result = { ok: true, out: await run(`git remote add origin ${JSON.stringify(remote)}`) };
    if (action === "clone" && remote) {
      const parentDir = import_path.default.dirname(resolved);
      const folderName = import_path.default.basename(resolved);
      const cloneRun = (cmd) => new Promise(
        (ok) => (0, import_child_process.exec)(cmd, { cwd: parentDir }, (err, out, errOut) => ok(err ? errOut || err.message : out.trim()))
      );
      result = { ok: true, out: await cloneRun(`git clone ${JSON.stringify(remote)} ${JSON.stringify(folderName)}`) };
    }
    if (action === "discard-file" && message) {
      const statusOut = await run(`git status --porcelain -- ${JSON.stringify(message)}`);
      const flag = statusOut.trim().slice(0, 2);
      if (flag === "??" || flag.startsWith("A")) {
        const fullPath = import_path.default.resolve(resolved, message);
        try {
          import_fs.default.unlinkSync(fullPath);
          result = { ok: true, out: "" };
        } catch (e) {
          result = { ok: false, out: String(e) };
        }
      } else {
        const out = await run(`git checkout HEAD -- ${JSON.stringify(message)}`);
        result = { ok: !out.includes("error:"), out };
      }
    }
    res.json(result);
  } catch (e) {
    res.json({ ok: false, out: String(e) });
  }
});
router.get("/api/file-content", (req, res) => {
  const base = tilde(req.query.path ?? "");
  const file = req.query.file ?? "";
  if (!base || !file) {
    res.json({ ok: false, error: "missing params" });
    return;
  }
  const full = import_path.default.resolve(base, file);
  if (!full.startsWith(base)) {
    res.json({ ok: false, error: "forbidden" });
    return;
  }
  import_fs.default.readFile(full, "utf-8", (err, content) => {
    if (err) res.json({ ok: false, error: String(err) });
    else res.json({ ok: true, content });
  });
});
router.get("/api/git-remote", (req, res) => {
  const cwd = tilde(req.query.path ?? "");
  (0, import_child_process.exec)("git remote get-url origin", { cwd }, (err, out) => {
    if (err) res.json({ ok: false, url: null });
    else res.json({ ok: true, url: out.trim() });
  });
});
router.get("/api/scan-project", (req, res) => {
  const projectPath = tilde(req.query.path ?? "");
  if (!projectPath) {
    res.json({ ok: false, error: "no path" });
    return;
  }
  const IGNORE = /* @__PURE__ */ new Set(["node_modules", ".git", "dist", "build", ".next", ".nuxt", "out", "coverage", "__pycache__", ".venv", "venv", "vendor", ".cache", "tmp", "temp", "graphify-out", ".turbo", ".vercel", ".netlify", "storybook-static"]);
  const KEY_FILES = ["package.json", "README.md", "pyproject.toml", "Cargo.toml", "go.mod", "tsconfig.json"];
  const SKIP_EXT = /* @__PURE__ */ new Set([".png", ".jpg", ".jpeg", ".gif", ".svg", ".ico", ".woff", ".woff2", ".ttf", ".eot", ".mp4", ".webm", ".zip", ".gz"]);
  function scanDir(dir, relBase = "", depth = 0) {
    if (depth > 5) return { tree: "", keyFileContents: {} };
    let tree = "";
    const keyFileContents = {};
    try {
      const entries = import_fs.default.readdirSync(dir, { withFileTypes: true }).filter((e) => !IGNORE.has(e.name) && !e.name.startsWith(".")).sort((a, b) => a.isDirectory() !== b.isDirectory() ? a.isDirectory() ? -1 : 1 : a.name.localeCompare(b.name));
      const dirFiles = [];
      for (const entry of entries) {
        const absPath = import_path.default.join(dir, entry.name);
        const relPath = relBase ? `${relBase}/${entry.name}` : entry.name;
        if (entry.isDirectory()) {
          const sub = scanDir(absPath, relPath, depth + 1);
          if (sub.tree) tree += sub.tree;
          Object.assign(keyFileContents, sub.keyFileContents);
        } else {
          if (!SKIP_EXT.has(import_path.default.extname(entry.name).toLowerCase())) dirFiles.push(entry.name);
          if (KEY_FILES.includes(entry.name) && depth <= 1) {
            try {
              keyFileContents[relPath] = import_fs.default.readFileSync(absPath, "utf-8").slice(0, 600);
            } catch {
            }
          }
        }
      }
      if (dirFiles.length > 0) tree += `${relBase || "."}/: ${dirFiles.join(", ")}
`;
    } catch {
    }
    return { tree, keyFileContents };
  }
  try {
    const { tree, keyFileContents } = scanDir(projectPath);
    res.json({ ok: true, tree: tree.trim(), keyFileContents, projectPath });
  } catch (e) {
    res.json({ ok: false, error: String(e) });
  }
});
router.get("/api/orbit/list-chats", (req, res) => {
  const projectId = req.query.projectId ?? "";
  if (!projectId) {
    res.json({ ok: false, chats: [] });
    return;
  }
  const dir = import_path.default.join(process.cwd(), "context", "raw", "chat", projectId);
  try {
    const files = import_fs.default.readdirSync(dir).filter((f) => f.endsWith(".jsonl"));
    const chats = files.map((f) => {
      const chatId = f.slice(0, -6);
      try {
        const lines = import_fs.default.readFileSync(import_path.default.join(dir, f), "utf-8").split("\n").filter((l) => l.trim());
        const msgs = lines.map((l) => {
          try {
            return JSON.parse(l);
          } catch {
            return null;
          }
        }).filter(Boolean);
        const tsList = msgs.map((m) => m?.ts ?? 0).filter(Boolean);
        return { chatId, messageCount: msgs.length, firstTs: Math.min(...tsList), lastTs: Math.max(...tsList) };
      } catch {
        return { chatId, messageCount: 0, firstTs: 0, lastTs: 0 };
      }
    }).sort((a, b) => b.lastTs - a.lastTs);
    res.json({ ok: true, chats });
  } catch {
    res.json({ ok: true, chats: [] });
  }
});
router.get("/api/orbit/load-chat", (req, res) => {
  const projectId = req.query.projectId ?? "";
  const chatId = req.query.chatId ?? "";
  if (!projectId || !chatId) {
    res.json({ ok: false, messages: [] });
    return;
  }
  const file = import_path.default.join(process.cwd(), "context", "raw", "chat", projectId, `${chatId}.jsonl`);
  try {
    const lines = import_fs.default.readFileSync(file, "utf-8").split("\n").filter((l) => l.trim());
    const messages = lines.map((l) => {
      try {
        return JSON.parse(l);
      } catch {
        return null;
      }
    }).filter(Boolean);
    res.json({ ok: true, messages });
  } catch (e) {
    res.json({ ok: false, messages: [], error: String(e) });
  }
});
router.post("/api/orbit/save", async (req, res) => {
  try {
    const { projectId, chatId, message } = JSON.parse(await readBody(req));
    const dir = import_path.default.join(process.cwd(), "context", "raw", "chat", projectId);
    import_fs.default.mkdirSync(dir, { recursive: true });
    import_fs.default.appendFileSync(import_path.default.join(dir, `${chatId}.jsonl`), JSON.stringify(message) + "\n", "utf-8");
    res.json({ ok: true });
  } catch (e) {
    res.json({ ok: false, error: String(e) });
  }
});
router.post("/api/session/save", async (req, res) => {
  try {
    const { projectId, sessionId, message } = JSON.parse(await readBody(req));
    const dir = import_path.default.join(process.cwd(), "context", "raw", "chat", projectId, "sessions");
    import_fs.default.mkdirSync(dir, { recursive: true });
    import_fs.default.appendFileSync(import_path.default.join(dir, `${sessionId}.jsonl`), JSON.stringify(message) + "\n", "utf-8");
    res.json({ ok: true });
  } catch (e) {
    res.json({ ok: false, error: String(e) });
  }
});
router.post("/api/orbit/resolve", async (req, res) => {
  try {
    const body = JSON.parse(await readBody(req));
    const { ref, ctxBefore = 2, ctxAfter = 2, supabaseUrl, supabaseKey, userId } = body;
    const baseDir = import_path.default.join(process.cwd(), "context", "raw", "chat");
    const readJsonl = (filePath) => import_fs.default.readFileSync(filePath, "utf-8").split("\n").filter((l) => l.trim()).map((l) => {
      try {
        return JSON.parse(l);
      } catch {
        return null;
      }
    }).filter(Boolean);
    const scanForChatFile = (matchFn) => {
      try {
        for (const projId of import_fs.default.readdirSync(baseDir)) {
          const projDir = import_path.default.join(baseDir, projId);
          try {
            if (!import_fs.default.statSync(projDir).isDirectory()) continue;
          } catch {
            continue;
          }
          for (const file of import_fs.default.readdirSync(projDir).filter((f) => f.endsWith(".jsonl"))) {
            const chatId = file.slice(0, -6);
            if (matchFn(chatId)) return { filePath: import_path.default.join(projDir, file), chatId };
          }
        }
      } catch {
      }
      return null;
    };
    const colonIdx = ref.indexOf(":");
    if (colonIdx < 0) {
      res.json({ ok: false, error: "Invalid ref format" });
      return;
    }
    const refType = ref.slice(0, colonIdx);
    const refId = ref.slice(colonIdx + 1);
    if (refType === "chat") {
      const found = scanForChatFile((id) => id === refId);
      if (!found) {
        res.json({ ok: false, error: "Chat not found" });
        return;
      }
      res.json({ ok: true, filePath: found.filePath, chatId: found.chatId, msgs: readJsonl(found.filePath).slice(0, 20) });
    } else if (refType === "msg") {
      const chat6 = refId.split("-")[1] ?? "";
      const found = scanForChatFile((id) => chat6 !== "" && id.replace(/-/g, "").includes(chat6));
      if (!found) {
        res.json({ ok: false, error: "Message not found \u2014 chat not located" });
        return;
      }
      const msgs = readJsonl(found.filePath);
      const msgIdx = msgs.findIndex((m) => m.id === refId);
      if (msgIdx < 0) {
        res.json({ ok: false, error: "Message ID not found in file" });
        return;
      }
      res.json({
        ok: true,
        filePath: found.filePath,
        chatId: found.chatId,
        refIdx: msgIdx,
        before: msgs.slice(Math.max(0, msgIdx - ctxBefore), msgIdx),
        target: msgs[msgIdx],
        after: msgs.slice(msgIdx + 1, msgIdx + 1 + ctxAfter)
      });
    } else if (refType === "amsg") {
      if (!supabaseUrl || !supabaseKey || !userId) {
        res.json({ ok: false, error: "Supabase credentials required for amsg: refs" });
        return;
      }
      const { createClient } = await import("@supabase/supabase-js");
      const sb = createClient(supabaseUrl, supabaseKey);
      const { data: target } = await sb.from("agent_messages").select("id,session_id,role,content,ts").eq("id", refId).eq("user_id", userId).maybeSingle();
      if (!target) {
        res.json({ ok: false, error: "Agent message not found" });
        return;
      }
      const { data: sessionMsgs } = await sb.from("agent_messages").select("id,session_id,role,content,ts").eq("session_id", target.session_id).eq("user_id", userId).order("ts", { ascending: true });
      const msgs = sessionMsgs ?? [];
      const msgIdx = msgs.findIndex((m) => m.id === refId);
      res.json({
        ok: true,
        sessionId: target.session_id,
        before: msgs.slice(Math.max(0, msgIdx - ctxBefore), msgIdx),
        target,
        after: msgs.slice(msgIdx + 1, msgIdx + 1 + ctxAfter)
      });
    } else {
      res.json({ ok: false, error: `Unknown ref type: ${refType}` });
    }
  } catch (e) {
    res.json({ ok: false, error: String(e) });
  }
});
router.post("/api/file-write", async (req, res) => {
  try {
    const { path: filePath, content, executable } = JSON.parse(await readBody(req));
    const resolved = tilde(filePath ?? "");
    import_fs.default.mkdirSync(import_path.default.dirname(resolved), { recursive: true });
    import_fs.default.writeFileSync(resolved, content, "utf-8");
    if (executable) import_fs.default.chmodSync(resolved, 493);
    res.json({ ok: true });
  } catch (e) {
    res.json({ ok: false, error: String(e) });
  }
});
router.post("/api/fs-create", async (req, res) => {
  try {
    const { path: target, type } = JSON.parse(await readBody(req));
    const resolved = tilde(target);
    if (type === "dir") import_fs.default.mkdirSync(resolved, { recursive: true });
    else {
      import_fs.default.mkdirSync(import_path.default.dirname(resolved), { recursive: true });
      if (!import_fs.default.existsSync(resolved)) import_fs.default.writeFileSync(resolved, "", "utf-8");
    }
    res.json({ ok: true });
  } catch (e) {
    res.json({ ok: false, error: String(e) });
  }
});
router.post("/api/fs-delete", async (req, res) => {
  try {
    const { path: target } = JSON.parse(await readBody(req));
    import_fs.default.rmSync(tilde(target), { recursive: true, force: true });
    res.json({ ok: true });
  } catch (e) {
    res.json({ ok: false, error: String(e) });
  }
});
router.get("/api/file-read", (req, res) => {
  const filePath = tilde(req.query.path ?? "");
  try {
    const stat = import_fs.default.statSync(filePath);
    if (stat.size > 2 * 1024 * 1024) {
      res.json({ ok: false, error: "File too large (> 2 MB)" });
      return;
    }
    res.json({ ok: true, content: import_fs.default.readFileSync(filePath, "utf-8"), size: stat.size, mtime: stat.mtimeMs });
  } catch (e) {
    res.json({ ok: false, error: String(e) });
  }
});
router.get("/api/read-docs", (req, res) => {
  const projectPath = tilde(req.query.path ?? "");
  if (!projectPath) {
    res.json({ ok: false, error: "missing path", files: [] });
    return;
  }
  const docsDir = import_path.default.join(projectPath, "docs");
  const MAX_TOTAL = 8e4;
  const files = [];
  const totalRef = { n: 0 };
  const readMdRecursive = (dir) => {
    let entries;
    try {
      entries = import_fs.default.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      if (totalRef.n >= MAX_TOTAL) break;
      const full = import_path.default.join(dir, e.name);
      if (e.isDirectory()) readMdRecursive(full);
      else if (e.isFile() && /\.(md|txt)$/i.test(e.name)) {
        try {
          const c = import_fs.default.readFileSync(full, "utf-8").slice(0, 2e4);
          files.push({ filename: full.replace(projectPath + "/", ""), content: c });
          totalRef.n += c.length;
        } catch {
        }
      }
    }
  };
  readMdRecursive(docsDir);
  if (files.length === 0) res.json({ ok: false, error: "Keine Dokumentationsdateien unter docs/ gefunden", files: [] });
  else res.json({ ok: true, files });
});
async function sbFetch(supabaseUrl, serviceRoleKey, path4, init = {}) {
  return fetch(`${supabaseUrl}${path4}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      ...init.headers ?? {}
    }
  });
}
router.get("/api/admin/users", async (req, res) => {
  const { supabaseUrl, serviceRoleKey } = req.query;
  if (!supabaseUrl || !serviceRoleKey) {
    res.json({ ok: false, error: "Missing credentials" });
    return;
  }
  try {
    const [usersR, adminsR] = await Promise.all([
      sbFetch(supabaseUrl, serviceRoleKey, "/auth/v1/admin/users?page=1&per_page=1000"),
      sbFetch(supabaseUrl, serviceRoleKey, "/rest/v1/admin_users?select=user_id")
    ]);
    const usersData = await usersR.json();
    const adminsData = await adminsR.json();
    const adminIds = new Set(Array.isArray(adminsData) ? adminsData.map((a) => a.user_id) : []);
    const users = (usersData.users ?? []).map((u) => ({
      id: u.id,
      email: u.email,
      firstName: u.user_metadata?.firstName ?? u.user_metadata?.first_name ?? "",
      lastName: u.user_metadata?.lastName ?? u.user_metadata?.last_name ?? "",
      createdAt: u.created_at,
      lastSignIn: u.last_sign_in_at,
      isAdmin: adminIds.has(u.id)
    }));
    res.json({ ok: true, users });
  } catch (e) {
    res.json({ ok: false, error: String(e) });
  }
});
router.post("/api/admin/users", async (req, res) => {
  try {
    const { supabaseUrl, serviceRoleKey, email, password, firstName, lastName } = JSON.parse(await readBody(req));
    if (!supabaseUrl || !serviceRoleKey) {
      res.json({ ok: false, error: "Missing credentials" });
      return;
    }
    const r = await sbFetch(supabaseUrl, serviceRoleKey, "/auth/v1/admin/users", {
      method: "POST",
      body: JSON.stringify({ email, password, email_confirm: true, user_metadata: { firstName, lastName } })
    });
    const d = await r.json();
    if (d.id) res.json({ ok: true, user: d });
    else res.json({ ok: false, error: d.msg ?? d.message ?? JSON.stringify(d) });
  } catch (e) {
    res.json({ ok: false, error: String(e) });
  }
});
router.put("/api/admin/users/:id", async (req, res) => {
  try {
    const { supabaseUrl, serviceRoleKey, email, firstName, lastName, password } = JSON.parse(await readBody(req));
    if (!supabaseUrl || !serviceRoleKey) {
      res.json({ ok: false, error: "Missing credentials" });
      return;
    }
    const payload = { user_metadata: { firstName, lastName } };
    if (email) payload.email = email;
    if (password) payload.password = password;
    const r = await sbFetch(supabaseUrl, serviceRoleKey, `/auth/v1/admin/users/${req.params.id}`, {
      method: "PUT",
      body: JSON.stringify(payload)
    });
    const d = await r.json();
    res.json({ ok: !!d.id, error: d.id ? void 0 : d.msg ?? d.message });
  } catch (e) {
    res.json({ ok: false, error: String(e) });
  }
});
router.delete("/api/admin/users/:id", async (req, res) => {
  try {
    const { supabaseUrl, serviceRoleKey } = req.query;
    if (!supabaseUrl || !serviceRoleKey) {
      res.json({ ok: false, error: "Missing credentials" });
      return;
    }
    await sbFetch(supabaseUrl, serviceRoleKey, `/auth/v1/admin/users/${req.params.id}`, { method: "DELETE" });
    res.json({ ok: true });
  } catch (e) {
    res.json({ ok: false, error: String(e) });
  }
});
router.post("/api/admin/users/:id/admin", async (req, res) => {
  try {
    const { supabaseUrl, serviceRoleKey, grantedBy } = JSON.parse(await readBody(req));
    if (!supabaseUrl || !serviceRoleKey) {
      res.json({ ok: false, error: "Missing credentials" });
      return;
    }
    await sbFetch(supabaseUrl, serviceRoleKey, "/rest/v1/admin_users", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates" },
      body: JSON.stringify({ user_id: req.params.id, granted_by: grantedBy })
    });
    res.json({ ok: true });
  } catch (e) {
    res.json({ ok: false, error: String(e) });
  }
});
router.delete("/api/admin/users/:id/admin", async (req, res) => {
  try {
    const { supabaseUrl, serviceRoleKey } = req.query;
    if (!supabaseUrl || !serviceRoleKey) {
      res.json({ ok: false, error: "Missing credentials" });
      return;
    }
    await sbFetch(supabaseUrl, serviceRoleKey, `/rest/v1/admin_users?user_id=eq.${req.params.id}`, { method: "DELETE" });
    res.json({ ok: true });
  } catch (e) {
    res.json({ ok: false, error: String(e) });
  }
});
var _appsCache = null;
var _appsCacheAt = 0;
router.get("/api/installed-apps", (_req, res) => {
  if (_appsCache && Date.now() - _appsCacheAt < 6e4) {
    res.json({ apps: _appsCache });
    return;
  }
  const dirs = ["/Applications", "/System/Applications", "/System/Applications/Utilities", `${process.env.HOME}/Applications`];
  const apps = /* @__PURE__ */ new Set();
  for (const dir of dirs) {
    try {
      for (const e of import_fs.default.readdirSync(dir)) {
        if (e.endsWith(".app")) apps.add(e.slice(0, -4));
      }
    } catch {
    }
  }
  _appsCache = [...apps];
  _appsCacheAt = Date.now();
  res.json({ apps: _appsCache });
});
router.get("/api/open-with", (req, res) => {
  const filePath = tilde(req.query.path ?? "");
  const app2 = req.query.app ?? "";
  if (!app2) {
    res.json({ ok: false });
    return;
  }
  (0, import_child_process.exec)(`open -a ${JSON.stringify(app2)} ${JSON.stringify(filePath)}`, (err) => res.json({ ok: !err, error: err?.message }));
});
router.get("/api/check-port", (req, res) => {
  const port = parseInt(req.query.port ?? "0", 10);
  if (!port) {
    res.json({ ok: false, inUse: false });
    return;
  }
  (0, import_child_process.exec)(`lsof -ti tcp:${port}`, (err, stdout) => {
    if (err || !stdout.trim()) res.json({ ok: true, inUse: false });
    else res.json({ ok: true, inUse: true, pids: stdout.trim().split("\n").map((p) => parseInt(p, 10)).filter(Boolean) });
  });
});
router.post("/api/kill-port", async (req, res) => {
  try {
    const { port } = JSON.parse(await readBody(req));
    (0, import_child_process.exec)(`lsof -ti tcp:${port} | xargs kill -9 2>/dev/null; true`, () => res.json({ ok: true }));
  } catch (e) {
    res.json({ ok: false, error: String(e) });
  }
});
router.post("/api/start-app", async (req, res) => {
  try {
    const { projectPath, port, startCmd, extraPorts = [] } = JSON.parse(await readBody(req));
    const logFile = `/tmp/cc-app-${port ?? "unknown"}.log`;
    const escaped = projectPath.replace(/'/g, "'\\''");
    const killByDir = `ps -eo pid,args | grep -E '(node|npm|yarn|pnpm|python3?|bun|deno|uvicorn|flask|cargo)' | grep '${escaped}' | grep -v grep | awk '{print $1}' | xargs kill -9 2>/dev/null; true`;
    const allPorts = [...new Set([port, ...extraPorts].filter((p) => !!p))];
    const killByPorts = allPorts.length > 0 ? allPorts.map((p) => `lsof -ti tcp:${p} | xargs kill -9 2>/dev/null`).join("; ") : "true";
    const killAll = `${killByDir}; ${killByPorts}`;
    (0, import_child_process.exec)(killAll, () => {
      setTimeout(() => {
        const child = (0, import_child_process.spawn)("bash", ["-c", `cd ${JSON.stringify(projectPath)} && ${startCmd}`], {
          detached: true,
          stdio: ["ignore", import_fs.default.openSync(logFile, "a"), import_fs.default.openSync(logFile, "a")]
        });
        child.unref();
        if (port) setTimeout(() => (0, import_child_process.exec)(`open http://localhost:${port} 2>/dev/null || true`), 2500);
        res.json({ ok: true, pid: child.pid ?? 0, logFile });
      }, 400);
    });
  } catch (e) {
    res.json({ ok: false, error: String(e) });
  }
});
router.post("/api/ai-refine", async (req, res) => {
  try {
    const { provider, apiKey, model, text, systemPrompt } = JSON.parse(await readBody(req));
    const sysMsg = systemPrompt ?? "Verbessere den folgenden Text sprachlich und inhaltlich. Mache ihn klarer, pr\xE4ziser und professioneller. Gib nur den verbesserten Text zur\xFCck, ohne Erkl\xE4rungen oder zus\xE4tzliche Kommentare.";
    console.log("\n[ai-refine] \u25B6 provider:", provider, "| model:", model);
    if (provider === "anthropic") {
      const r = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "content-type": "application/json" },
        body: JSON.stringify({ model, max_tokens: 2048, system: sysMsg, messages: [{ role: "user", content: text }] })
      });
      const d = await r.json();
      if (!r.ok) {
        res.json({ ok: false, error: d?.error?.message ?? "API error" });
        return;
      }
      res.json({ ok: true, text: d.content?.[0]?.text ?? text });
    } else {
      const baseUrl = provider === "deepseek" ? "https://api.deepseek.com/v1" : "https://api.openai.com/v1";
      const r = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model, messages: [{ role: "system", content: sysMsg }, { role: "user", content: text }] })
      });
      const d = await r.json();
      if (!r.ok) {
        res.json({ ok: false, error: d?.error?.message ?? "API error" });
        return;
      }
      res.json({ ok: true, text: d.choices?.[0]?.message?.content ?? text });
    }
  } catch (e) {
    res.json({ ok: false, error: String(e) });
  }
});
router.post("/api/context-search", async (req, res) => {
  try {
    const { query, messages, provider, apiKey, model, systemPromptOverride } = JSON.parse(await readBody(req));
    const historyText = messages.sort((a, b) => a.ts - b.ts).map((m) => {
      const date = new Date(m.ts).toLocaleString("de-DE", { dateStyle: "short", timeStyle: "short" });
      const src = m.source === "agent" ? "AGENT" : "ORBIT";
      const role = m.role === "user" ? "USER" : `AI${m.model ? " (" + m.model + ")" : ""}`;
      return `[${date}][${src}] ${role}:
${m.content.slice(0, 600)}`;
    }).join("\n\n---\n\n");
    const systemPrompt = systemPromptOverride?.trim() || `Du bist ein Kontext-Analyst f\xFCr ein Software-Entwicklungsprojekt. Du bekommst die Chat-Historie und eine Suchanfrage.

Antworte AUSSCHLIESSLICH als g\xFCltiges JSON-Objekt (kein Markdown drumherum, nur reines JSON):
{
  "humanSummary": "2-4 S\xE4tze: Was wurde gemacht, was ist der aktuelle Stand. Knapp und direkt \u2014 keine langen Abs\xE4tze.",
  "detailed": "Stichpunktartige Auflistung (Bullet-Format mit \u2022). Nur was relevant zur Suchanfrage ist. Bei Listen-Anfragen (z.B. 'welche X wurden aufgerufen') einfach alle aufz\xE4hlen. Maximal 15 Punkte.",
  "agentContext": "Englischer Kontext-Block f\xFCr einen KI-Agenten. Format: TOPIC: ... | FILES: ... | HISTORY: ... (kompakt, nur das Wesentliche, max 400 Tokens)"
}`;
    const userMsg = `Suchanfrage: "${query}"

Projekt-Chat-Historie (${messages.length} Nachrichten):

${historyText}`;
    let rawText = "";
    let usage = {};
    if (provider === "anthropic") {
      const r = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "content-type": "application/json" },
        body: JSON.stringify({ model, max_tokens: 4096, system: systemPrompt, messages: [{ role: "user", content: userMsg }] })
      });
      const d = await r.json();
      if (!r.ok) {
        res.json({ ok: false, error: d?.error?.message ?? "API error" });
        return;
      }
      rawText = d.content?.[0]?.text ?? "";
      usage = d.usage ?? {};
    } else {
      const baseUrl = provider === "deepseek" ? "https://api.deepseek.com/v1" : provider === "groq" ? "https://api.groq.com/openai/v1" : "https://api.openai.com/v1";
      const r = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userMsg }],
          max_tokens: 4096,
          response_format: provider === "openai" ? { type: "json_object" } : void 0
        })
      });
      const d = await r.json();
      if (!r.ok) {
        res.json({ ok: false, error: d?.error?.message ?? "API error" });
        return;
      }
      rawText = d.choices?.[0]?.message?.content ?? "";
      usage = d.usage ?? {};
    }
    const jsonStr = rawText.replace(/^```(?:json)?\n?/i, "").replace(/\n?```$/i, "").trim();
    let result;
    try {
      result = JSON.parse(jsonStr);
    } catch {
      res.json({ ok: false, error: "KI hat kein g\xFCltiges JSON zur\xFCckgegeben. Rohtext: " + rawText.slice(0, 200) });
      return;
    }
    const inputTokens = usage.input_tokens ?? usage.prompt_tokens ?? 0;
    const outputTokens = usage.output_tokens ?? usage.completion_tokens ?? (usage.total_tokens ? usage.total_tokens - inputTokens : 0);
    res.json({ ok: true, ...result, inputTokens, outputTokens });
  } catch (e) {
    res.json({ ok: false, error: String(e) });
  }
});
router.post("/api/transcribe", async (req, res) => {
  const chunks = [];
  req.on("data", (c) => chunks.push(c));
  req.on("end", async () => {
    try {
      const apiKey = req.headers["x-api-key"];
      const lang = req.headers["x-language"] || "de";
      if (!apiKey) {
        res.json({ ok: false, error: "no api key" });
        return;
      }
      const provider = req.headers["x-provider"] || "openai";
      const isGroq = provider === "groq";
      const audio = Buffer.concat(chunks);
      const fd = new FormData();
      fd.append("file", new Blob([audio], { type: "audio/webm" }), "recording.webm");
      fd.append("model", isGroq ? "whisper-large-v3-turbo" : "whisper-1");
      fd.append("language", lang);
      const baseUrl = isGroq ? "https://api.groq.com/openai/v1" : "https://api.openai.com/v1";
      const r = await fetch(`${baseUrl}/audio/transcriptions`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${apiKey}` },
        body: fd
      });
      const d = await r.json();
      if (!r.ok) {
        res.json({ ok: false, error: d?.error?.message ?? "Whisper error" });
        return;
      }
      res.json({ ok: true, text: d.text });
    } catch (e) {
      res.json({ ok: false, error: String(e) });
    }
  });
});
router.get("/api/serve-image", (req, res) => {
  const filePath = tilde(req.query.path ?? "");
  if (!filePath) {
    res.status(400).send("missing path");
    return;
  }
  try {
    const stat = import_fs.default.statSync(filePath);
    if (stat.size > 20 * 1024 * 1024) {
      res.status(413).send("too large");
      return;
    }
    const ext = import_path.default.extname(filePath).toLowerCase();
    const mime = { ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".gif": "image/gif", ".webp": "image/webp", ".svg": "image/svg+xml" };
    res.setHeader("Content-Type", mime[ext] ?? "application/octet-stream");
    res.setHeader("Cache-Control", "private, max-age=86400");
    res.send(import_fs.default.readFileSync(filePath));
  } catch {
    res.status(404).send("not found");
  }
});
router.post("/api/write-temp-image", (req, res) => {
  const chunks = [];
  req.on("data", (c) => chunks.push(c));
  req.on("end", () => {
    try {
      const fileName = decodeURIComponent(req.headers["x-file-name"] ?? "image");
      const safeName = import_path.default.basename(fileName).replace(/[^a-zA-Z0-9._-]/g, "_");
      const tmpPath = import_path.default.join((0, import_os.tmpdir)(), `cc-ui-img-${Date.now()}-${safeName}`);
      import_fs.default.writeFileSync(tmpPath, Buffer.concat(chunks));
      res.json({ ok: true, path: tmpPath });
    } catch (e) {
      res.json({ ok: false, error: String(e) });
    }
  });
});
var readStore = () => {
  const storePath = import_path.default.join(home(), ".cc-ui-data.json");
  try {
    return JSON.parse(import_fs.default.readFileSync(storePath, "utf8"))?.state ?? {};
  } catch {
    return {};
  }
};
router.post("/api/r2-upload", (req, res) => {
  const chunks = [];
  req.on("data", (c) => chunks.push(c));
  req.on("end", async () => {
    try {
      const store = readStore();
      const bucket = store["cloudflareR2BucketName"] ?? "";
      const accessKey = store["cloudflareR2AccessKeyId"] ?? "";
      const secretKey = store["cloudflareR2SecretAccessKey"] ?? "";
      const r2Endpoint = store["cloudflareR2Endpoint"] || (store["cloudflareAccountId"] ? `https://${store["cloudflareAccountId"]}.r2.cloudflarestorage.com` : "");
      const publicUrl = (store["cloudflareR2PublicUrl"] ?? "").replace(/\/$/, "");
      if (!r2Endpoint || !bucket || !accessKey || !secretKey) {
        res.status(400).json({ ok: false, error: "Cloudflare R2 nicht konfiguriert." });
        return;
      }
      const { S3Client, PutObjectCommand } = await import("@aws-sdk/client-s3");
      const s3 = new S3Client({ region: "auto", endpoint: r2Endpoint, forcePathStyle: true, credentials: { accessKeyId: accessKey, secretAccessKey: secretKey } });
      const fileName = decodeURIComponent(req.headers["x-file-name"] ?? "file");
      const userId = req.headers["x-user-id"] ?? "anonymous";
      const folder = req.headers["x-folder"] ?? "image-text-context";
      const mimeType = req.headers["content-type"] ?? "application/octet-stream";
      const key = `${userId}/${folder}/${Date.now()}-${import_path.default.basename(fileName).replace(/[^a-zA-Z0-9._-]/g, "_")}`;
      await s3.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: Buffer.concat(chunks), ContentType: mimeType }));
      const fileUrl = publicUrl ? `${publicUrl}/${key}` : `/api/r2-proxy?key=${encodeURIComponent(key)}`;
      res.json({ ok: true, url: fileUrl, key });
    } catch (e) {
      res.status(500).json({ ok: false, error: String(e) });
    }
  });
});
router.get("/api/r2-proxy", async (req, res) => {
  const key = req.query.key ?? "";
  if (!key) {
    res.status(400).send("missing key");
    return;
  }
  try {
    const store = readStore();
    const bucket = store["cloudflareR2BucketName"] ?? "";
    const accessKey = store["cloudflareR2AccessKeyId"] ?? "";
    const secretKey = store["cloudflareR2SecretAccessKey"] ?? "";
    const r2Endpoint = store["cloudflareR2Endpoint"] || (store["cloudflareAccountId"] ? `https://${store["cloudflareAccountId"]}.r2.cloudflarestorage.com` : "");
    if (!r2Endpoint || !bucket || !accessKey || !secretKey) {
      res.status(503).send("R2 not configured");
      return;
    }
    const { S3Client, GetObjectCommand } = await import("@aws-sdk/client-s3");
    const s3 = new S3Client({ region: "auto", endpoint: r2Endpoint, forcePathStyle: true, credentials: { accessKeyId: accessKey, secretAccessKey: secretKey } });
    const result = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
    const ext = key.split(".").pop()?.toLowerCase() ?? "";
    const mimeMap = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif", webp: "image/webp", svg: "image/svg+xml", avif: "image/avif", bmp: "image/bmp", pdf: "application/pdf", json: "application/json", txt: "text/plain", md: "text/plain" };
    const ct = result.ContentType && result.ContentType !== "application/octet-stream" ? result.ContentType : mimeMap[ext] ?? "application/octet-stream";
    res.setHeader("Content-Type", ct);
    res.setHeader("Cache-Control", "public, max-age=3600");
    if (result.ContentLength) res.setHeader("Content-Length", result.ContentLength);
    const body = result.Body;
    if (body && typeof body.pipe === "function") body.pipe(res);
    else if (body && typeof body.transformToByteArray === "function") res.end(Buffer.from(await body.transformToByteArray()));
    else {
      res.status(404).send("empty body");
    }
  } catch (e) {
    res.status(500).send(String(e));
  }
});
router.all("/api/tweakcc/config", async (req, res) => {
  try {
    const { readTweakccConfig, getTweakccConfigPath } = await import("tweakcc");
    if (req.method === "GET") {
      res.json({ ok: true, config: await readTweakccConfig() });
    } else {
      const { config } = JSON.parse(await readBody(req));
      const configPath = getTweakccConfigPath();
      import_fs.default.mkdirSync(import_path.default.dirname(configPath), { recursive: true });
      import_fs.default.writeFileSync(configPath, JSON.stringify(config, null, 2), "utf-8");
      res.json({ ok: true });
    }
  } catch (e) {
    res.json({ ok: false, error: String(e) });
  }
});
router.post("/api/tweakcc/apply", async (_req, res) => {
  try {
    const { execSync } = await import("child_process");
    execSync("npx tweakcc --apply", { cwd: process.cwd(), stdio: "ignore" });
    res.json({ ok: true });
  } catch (e) {
    res.json({ ok: false, error: String(e) });
  }
});
router.all("/api/tweakcc/system-prompt", async (req, res) => {
  try {
    const { getTweakccSystemPromptsDir } = await import("tweakcc");
    const dir = getTweakccSystemPromptsDir();
    const file = import_path.default.join(dir, "codera.md");
    if (req.method === "GET") {
      res.json({ ok: true, content: import_fs.default.existsSync(file) ? import_fs.default.readFileSync(file, "utf-8") : "" });
    } else {
      const { content } = JSON.parse(await readBody(req));
      import_fs.default.mkdirSync(dir, { recursive: true });
      if (content.trim()) import_fs.default.writeFileSync(file, content, "utf-8");
      else if (import_fs.default.existsSync(file)) import_fs.default.unlinkSync(file);
      res.json({ ok: true });
    }
  } catch (e) {
    res.json({ ok: false, error: String(e) });
  }
});
router.get("/api/perm-pending", (req, res) => {
  const sessionId = req.query.sessionId ?? "";
  res.json({ perms: pendingPermsBySession.get(sessionId) ?? [] });
});
router.post("/api/perm-bridge", async (req, res) => {
  try {
    const { sessionId, requestId, toolName, input } = JSON.parse(await readBody(req));
    const payload = JSON.stringify({ type: "permission_request", requestId, toolName, input, toolUseId: "" });
    const sessionPerms = pendingPermsBySession.get(sessionId) ?? [];
    sessionPerms.push({ requestId, toolName, input });
    pendingPermsBySession.set(sessionId, sessionPerms);
    const tryNotify = () => {
      const ws = sessionWs.get(sessionId);
      if (ws?.readyState === 1) ws.send(payload);
    };
    tryNotify();
    const retryInterval = setInterval(() => {
      if (!pendingPerms.has(requestId)) {
        clearInterval(retryInterval);
        return;
      }
      tryNotify();
    }, 2e3);
    const timer = setTimeout(() => {
      clearInterval(retryInterval);
      pendingPerms.delete(requestId);
      const remaining = (pendingPermsBySession.get(sessionId) ?? []).filter((p) => p.requestId !== requestId);
      if (remaining.length) pendingPermsBySession.set(sessionId, remaining);
      else pendingPermsBySession.delete(sessionId);
      res.json({ allow: false, message: "Timeout" });
    }, 3e5);
    pendingPerms.set(requestId, (decision) => {
      clearTimeout(timer);
      clearInterval(retryInterval);
      pendingPerms.delete(requestId);
      const remaining = (pendingPermsBySession.get(sessionId) ?? []).filter((p) => p.requestId !== requestId);
      if (remaining.length) pendingPermsBySession.set(sessionId, remaining);
      else pendingPermsBySession.delete(sessionId);
      res.json(decision);
    });
  } catch {
    res.status(400).end();
  }
});
router.post("/api/screenshot", async (req, res) => {
  const body = await readBody(req);
  let url = "", width = 1280, height = 800;
  try {
    const parsed = JSON.parse(body);
    url = String(parsed.url ?? "");
    width = Math.round(Number(parsed.width) || 1280);
    height = Math.round(Number(parsed.height) || 800);
  } catch {
    res.status(400).json({ ok: false, error: "Invalid JSON" });
    return;
  }
  if (!url) {
    res.status(400).json({ ok: false, error: "url required" });
    return;
  }
  try {
    const { chromium } = await import("playwright");
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      viewport: { width, height },
      // Bypass CSP so localhost pages with strict CSP still render
      bypassCSP: true
    });
    const page = await context.newPage();
    await page.goto(url, { waitUntil: "load", timeout: 15e3 });
    await page.waitForTimeout(600);
    const buffer = await page.screenshot({ type: "png", fullPage: false });
    await browser.close();
    res.json({ ok: true, dataUrl: "data:image/png;base64," + buffer.toString("base64") });
  } catch (err) {
    const msg = String(err);
    const needsInstall = msg.includes("Executable doesn't exist") || msg.includes("browserType.launch");
    res.status(500).json({
      ok: false,
      error: needsInstall ? "Playwright-Browser fehlt \u2014 bitte im Terminal ausf\xFChren: npx playwright install chromium" : msg
    });
  }
});
router.get("/api/git-diff", (req, res) => {
  const cwd = tilde(req.query.path ?? "");
  const file = req.query.file ?? "";
  const commit = req.query.commit ?? "";
  if (!cwd || !file) {
    res.json({ ok: false, diff: "" });
    return;
  }
  const run = (cmd) => new Promise(
    (ok) => (0, import_child_process.exec)(cmd, { cwd }, (err, out, errOut) => ok(err ? errOut || err.message : out))
  );
  (async () => {
    try {
      let diff = "";
      if (commit) {
        diff = await run(`git diff ${commit}^..${commit} -- ${JSON.stringify(file)} 2>/dev/null`);
      } else {
        const statusOut = await run(`git status --porcelain -- ${JSON.stringify(file)}`);
        const flag = statusOut.trim().slice(0, 2);
        const isNew = flag === "??" || flag.startsWith("A");
        if (isNew) {
          const fullPath = import_path.default.resolve(cwd, file);
          const content = import_fs.default.existsSync(fullPath) ? import_fs.default.readFileSync(fullPath, "utf-8") : "";
          const lines = content.split("\n");
          diff = `--- /dev/null
+++ b/${file}
@@ -0,0 +1,${lines.length} @@
` + lines.map((l) => "+" + l).join("\n");
        } else {
          diff = await run(`git diff HEAD -- ${JSON.stringify(file)}`);
          if (!diff.trim()) diff = await run(`git diff --cached -- ${JSON.stringify(file)}`);
        }
      }
      res.json({ ok: true, diff });
    } catch (e) {
      res.json({ ok: false, diff: "", error: String(e) });
    }
  })();
});
var api_default = router;

// server/routes/ws.ts
var import_module = require("module");
var import_fs2 = __toESM(require("fs"), 1);
var import_path2 = __toESM(require("path"), 1);
var import_ws = require("ws");
var _require = (0, import_module.createRequire)(__importMetaUrl);
var PROJECT_ROOT = process.env.APP_ROOT ?? process.cwd();
var MCP_SCRIPT = import_path2.default.join(PROJECT_ROOT, "permission-mcp.cjs");
var BACKEND_PORT = 2003;
var PTY_SCROLLBACK = 5e4;
var sessions = /* @__PURE__ */ new Map();
var terminalWss = new import_ws.WebSocketServer({ noServer: true });
terminalWss.on("connection", (ws, req) => {
  const url = new URL(req.url ?? "/", "http://localhost");
  const sessionId = url.searchParams.get("sessionId") ?? "default";
  const existing = sessions.get(sessionId);
  if (existing) {
    existing.clients.add(ws);
    if (existing.scrollback) {
      ws.send(JSON.stringify({ type: "data", data: existing.scrollback }));
    }
    ws.on("message", (raw) => {
      try {
        const msg = JSON.parse(raw.toString());
        if (msg.type === "input") existing.pty.write(String(msg.data));
        if (msg.type === "resize") existing.pty.resize(Number(msg.cols) || 80, Number(msg.rows) || 24);
      } catch {
      }
    });
    ws.on("close", () => existing.clients.delete(ws));
    return;
  }
  ws.once("message", (raw) => {
    try {
      const msg = JSON.parse(raw.toString());
      if (msg.type !== "init") return;
      const cmd = String(msg.cmd ?? "zsh");
      const args = String(msg.args ?? "").trim();
      const cwd = String(msg.cwd ?? process.env.HOME ?? "~").replace(/^~/, process.env.HOME ?? "/");
      const cols = Number(msg.cols) || 120;
      const rows = Number(msg.rows) || 36;
      const safePath = [
        "/opt/homebrew/bin",
        "/opt/homebrew/sbin",
        "/usr/local/bin",
        "/usr/bin",
        "/bin",
        "/usr/sbin",
        "/sbin",
        process.env.PATH ?? ""
      ].filter(Boolean).join(":");
      const pty = _require("node-pty");
      const ptyEnv = {
        ...process.env,
        PATH: safePath,
        TERM: "xterm-256color",
        TERM_PROGRAM: "Apple_Terminal",
        COLORTERM: "truecolor",
        PYTHONUNBUFFERED: "1",
        PYTHONIOENCODING: "utf-8"
      };
      const ptyProc = pty.spawn("/bin/zsh", ["-li"], {
        name: "xterm-256color",
        cols,
        rows,
        cwd,
        env: ptyEnv
      });
      const session = { pty: ptyProc, clients: /* @__PURE__ */ new Set([ws]), scrollback: "" };
      sessions.set(sessionId, session);
      if (!(cmd === "zsh" && !args)) {
        const fullCmd = args ? `${cmd} ${args}` : cmd;
        setTimeout(() => {
          try {
            ptyProc.write(`${fullCmd}\r`);
          } catch {
          }
        }, 600);
      }
      const broadcast = (data) => {
        session.scrollback = (session.scrollback + data).slice(-PTY_SCROLLBACK);
        const payload = JSON.stringify({ type: "data", data });
        for (const c of session.clients) {
          if (c.readyState === 1) c.send(payload);
        }
      };
      ptyProc.onData(broadcast);
      ptyProc.onExit(({ exitCode }) => {
        const payload = JSON.stringify({ type: "exit", exitCode });
        for (const c of session.clients) {
          if (c.readyState === 1) c.send(payload);
        }
        sessions.delete(sessionId);
      });
      ws.on("message", (raw2) => {
        try {
          const m = JSON.parse(raw2.toString());
          if (m.type === "input") ptyProc.write(String(m.data));
          if (m.type === "resize") ptyProc.resize(Number(m.cols) || 80, Number(m.rows) || 24);
        } catch {
        }
      });
      ws.on("close", () => {
        session.clients.delete(ws);
        if (session.clients.size === 0) {
          try {
            ptyProc.kill();
          } catch {
          }
          sessions.delete(sessionId);
        }
      });
    } catch (e) {
      console.error("[pty] init error", e);
    }
  });
});
var agentWss = new import_ws.WebSocketServer({ noServer: true });
agentWss.on("connection", (ws, req) => {
  const url = new URL(req.url ?? "/", "http://localhost");
  const sessionId = url.searchParams.get("sessionId") ?? "default";
  sessionWs.set(sessionId, ws);
  ws.on("close", () => sessionWs.delete(sessionId));
  ws.on("message", (raw) => {
    try {
      const msg = JSON.parse(raw.toString());
      if (msg.type === "input") {
        activePtys.get(sessionId)?.write(String(msg.data));
        return;
      }
      if (msg.type === "permission_response") {
        const requestId = String(msg.requestId ?? "");
        const allow = String(msg.allow) === "true";
        const resolve = pendingPerms.get(requestId);
        if (resolve) {
          resolve({
            allow,
            updatedInput: msg.updatedInput,
            message: msg.message ? String(msg.message) : void 0
          });
        } else {
          const ap = activePtys.get(sessionId);
          if (ap) ap.write(allow ? "y\n" : "n\n");
        }
        return;
      }
      if (msg.type === "clear_session") {
        claudeSessionIds.delete(sessionId);
        return;
      }
      if (msg.type === "cancel") {
        const ap = activePtys.get(sessionId);
        if (ap) {
          try {
            ap.kill();
          } catch {
          }
          activePtys.delete(sessionId);
        }
        ws.send(JSON.stringify({ type: "exit", exitCode: -1 }));
        return;
      }
      if (msg.type !== "message") return;
      const text = String(msg.text ?? "");
      const cwd = String(msg.cwd ?? process.env.HOME ?? "~").replace(/^~/, process.env.HOME ?? "/");
      const orModel = msg.orModel ? String(msg.orModel) : null;
      const orKey = msg.orKey ? String(msg.orKey) : null;
      const providerSettingsJson = msg.providerSettingsJson ? String(msg.providerSettingsJson) : null;
      const resume = claudeSessionIds.get(sessionId);
      const safePath = [
        "/opt/homebrew/bin",
        "/opt/homebrew/sbin",
        "/usr/local/bin",
        "/usr/bin",
        "/bin",
        process.env.PATH ?? ""
      ].filter(Boolean).join(":");
      const baseEnv = {
        ...process.env,
        PATH: safePath
      };
      let settingsFile = null;
      if (providerSettingsJson) {
        try {
          const ps = JSON.parse(providerSettingsJson);
          if (ps.env && typeof ps.env === "object") {
            for (const [k, v] of Object.entries(ps.env)) {
              if (typeof v === "string") baseEnv[k] = v;
            }
          }
        } catch {
        }
        if (baseEnv["ANTHROPIC_API_KEY"] && !baseEnv["ANTHROPIC_AUTH_TOKEN"]) {
          baseEnv["ANTHROPIC_AUTH_TOKEN"] = baseEnv["ANTHROPIC_API_KEY"];
        }
        baseEnv["ANTHROPIC_API_KEY"] = "";
        try {
          const ps = JSON.parse(providerSettingsJson);
          if (ps.env) {
            if (ps.env["ANTHROPIC_API_KEY"] && !ps.env["ANTHROPIC_AUTH_TOKEN"]) {
              ps.env["ANTHROPIC_AUTH_TOKEN"] = ps.env["ANTHROPIC_API_KEY"];
            }
            ps.env["ANTHROPIC_API_KEY"] = "";
            settingsFile = import_path2.default.join(process.env.HOME ?? "/tmp", `.cc-ui-provider-${sessionId}.json`);
            import_fs2.default.writeFileSync(settingsFile, JSON.stringify(ps), "utf8");
          } else {
            settingsFile = import_path2.default.join(process.env.HOME ?? "/tmp", `.cc-ui-provider-${sessionId}.json`);
            import_fs2.default.writeFileSync(settingsFile, providerSettingsJson, "utf8");
          }
        } catch {
          settingsFile = import_path2.default.join(process.env.HOME ?? "/tmp", `.cc-ui-provider-${sessionId}.json`);
          import_fs2.default.writeFileSync(settingsFile, providerSettingsJson, "utf8");
        }
      } else if (orModel && orKey) {
        baseEnv["ANTHROPIC_BASE_URL"] = "https://openrouter.ai/api/v1";
        baseEnv["ANTHROPIC_API_KEY"] = orKey;
        baseEnv["OPENROUTER_API_KEY"] = orKey;
      }
      const mcpConfigFile = import_path2.default.join(process.env.HOME ?? "/tmp", `.cc-ui-mcp-${sessionId}.json`);
      import_fs2.default.writeFileSync(mcpConfigFile, JSON.stringify({
        mcpServers: {
          perm: {
            command: "node",
            args: [MCP_SCRIPT],
            env: { PERM_SESSION: sessionId, PERM_PORT: String(BACKEND_PORT) }
          }
        }
      }), "utf8");
      const pty = _require("node-pty");
      const isCustomProvider = !!settingsFile || !!baseEnv["ANTHROPIC_BASE_URL"];
      const claudeArgs = [
        "--output-format",
        "stream-json",
        "--verbose",
        // --bare disables MCP tool use, so permission bridge only works for Anthropic sessions
        ...isCustomProvider ? ["--dangerously-skip-permissions", "--bare", "--add-dir", cwd] : ["--mcp-config", mcpConfigFile, "--permission-prompt-tool", "mcp__perm__permission_prompt"],
        ...settingsFile ? ["--settings", settingsFile] : [],
        ...!settingsFile && orModel ? ["--model", orModel] : [],
        "--print",
        text,
        ...resume ? ["--resume", resume] : []
      ];
      const ptyProc = pty.spawn("claude", claudeArgs, {
        name: "xterm-color",
        cols: 220,
        rows: 50,
        cwd,
        env: baseEnv
      });
      let lineBuf = "";
      const stripAnsi = (s) => s.replace(/\x1b\[[0-9;?]*[a-zA-Z]/g, "").replace(/\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)/g, "").replace(/\x1b[>=<()][0-9A-Za-z]*/g, "").replace(/\x1b./g, "").replace(/[\x00-\x09\x0b-\x0c\x0e-\x1f\x7f]/g, "").replace(/\r/g, "");
      let lastToolUse = null;
      const sendLine = (line) => {
        const clean = stripAnsi(line).trim();
        if (!clean) return;
        if (clean[0] !== "{") {
          if (/allow|permission|do you want|y\/n|\[y\/n\]|proceed\?/i.test(clean)) {
            ws.send(JSON.stringify({ type: "permission_request", text: clean, tool: lastToolUse }));
          }
          return;
        }
        ws.send(JSON.stringify({ type: "data", data: clean + "\n" }));
        try {
          const ev = JSON.parse(clean);
          if (ev.type === "system" && ev.subtype === "init" && ev.session_id) {
            claudeSessionIds.set(sessionId, String(ev.session_id));
            ws.send(JSON.stringify({ type: "session_id", id: ev.session_id }));
          }
          if (ev.type === "assistant") {
            const content = ev.message?.content;
            if (Array.isArray(content)) {
              for (const block of content) {
                const b = block;
                if (b.type === "tool_use" && b.name) {
                  let toolName = String(b.name);
                  let toolInput = b.input ?? {};
                  if (toolName === "mcp__perm__permission_prompt" && toolInput.tool_name) {
                    toolName = String(toolInput.tool_name);
                    toolInput = toolInput.tool_input ?? {};
                  }
                  lastToolUse = { tool: toolName, input: toolInput };
                }
              }
            }
          }
        } catch {
        }
      };
      let permDebounce = null;
      const flushPermBuf = () => {
        if (pendingPerms.size > 0) {
          lineBuf = "";
          return;
        }
        const cleanBuf = stripAnsi(lineBuf).trim();
        if (!cleanBuf || cleanBuf[0] === "{" || cleanBuf.length < 8) {
          lineBuf = "";
          return;
        }
        ws.send(JSON.stringify({ type: "permission_request", text: cleanBuf, tool: lastToolUse }));
        lineBuf = "";
      };
      ptyProc.onData((data) => {
        lineBuf += data;
        const lines = lineBuf.split("\n");
        lineBuf = lines.pop() ?? "";
        lines.forEach(sendLine);
        if (permDebounce) {
          clearTimeout(permDebounce);
          permDebounce = null;
        }
        const cleanBuf = stripAnsi(lineBuf).trim();
        if (cleanBuf && cleanBuf[0] !== "{" && cleanBuf.length >= 8 && pendingPerms.size === 0) {
          permDebounce = setTimeout(flushPermBuf, 600);
        }
      });
      activePtys.set(sessionId, { write: (d) => ptyProc.write(d), kill: () => ptyProc.kill() });
      ptyProc.onExit(({ exitCode }) => {
        if (lineBuf.trim()) sendLine(lineBuf);
        activePtys.delete(sessionId);
        ws.send(JSON.stringify({ type: "exit", exitCode: exitCode ?? 0 }));
        if (settingsFile) {
          try {
            import_fs2.default.unlinkSync(settingsFile);
          } catch {
          }
        }
        try {
          import_fs2.default.unlinkSync(mcpConfigFile);
        } catch {
        }
      });
    } catch (e) {
      console.error("[ws/agent] error:", e);
    }
  });
});
function attachWsUpgrade(httpServer) {
  httpServer.on("upgrade", (req, socket, head) => {
    if (req.url?.startsWith("/ws/terminal")) {
      terminalWss.handleUpgrade(req, socket, head, (ws) => {
        terminalWss.emit("connection", ws, req);
      });
    } else if (req.url?.startsWith("/ws/agent")) {
      agentWss.handleUpgrade(req, socket, head, (ws) => {
        agentWss.emit("connection", ws, req);
      });
    } else {
      socket.destroy();
    }
  });
}

// electron/main.ts
var isDev = !import_electron.app.isPackaged;
process.env.APP_ROOT = import_electron.app.getAppPath();
var BACKEND_PORT2 = 2003;
var VITE_PORT = 2002;
function listenWithRetry(server, port) {
  return new Promise((resolve, reject) => {
    const tryListen = () => {
      server.listen(port, resolve);
    };
    server.once("error", (err) => {
      if (err.code === "EADDRINUSE") {
        (0, import_child_process2.exec)(`lsof -ti tcp:${port} | xargs kill -9 2>/dev/null; true`, () => {
          setTimeout(tryListen, 400);
        });
      } else {
        reject(err);
      }
    });
    tryListen();
  });
}
async function startBackend() {
  const expressApp = (0, import_express2.default)();
  expressApp.use(api_default);
  if (!isDev) {
    const distPath = import_path3.default.join(import_electron.app.getAppPath(), "dist");
    expressApp.use(import_express2.default.static(distPath));
    expressApp.use(
      (_req, res) => res.sendFile(import_path3.default.join(distPath, "index.html"))
    );
  }
  const server = (0, import_http.createServer)(expressApp);
  attachWsUpgrade(server);
  await listenWithRetry(server, BACKEND_PORT2);
  console.log(`[backend] \u2713 http://localhost:${BACKEND_PORT2}`);
}
function createWindow() {
  const win = new import_electron.BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    titleBarStyle: "hiddenInset",
    trafficLightPosition: { x: 14, y: 18 },
    backgroundColor: import_electron.nativeTheme.shouldUseDarkColors ? "#111111" : "#f5f5f5",
    webPreferences: {
      preload: import_path3.default.join(__dirname, "preload.cjs"),
      nodeIntegration: false,
      contextIsolation: true
    }
  });
  const url = isDev ? `http://localhost:${VITE_PORT}` : `http://localhost:${BACKEND_PORT2}`;
  win.loadURL(url);
  win.webContents.setWindowOpenHandler(({ url: u }) => {
    import_electron.shell.openExternal(u);
    return { action: "deny" };
  });
  return win;
}
import_electron.app.whenReady().then(async () => {
  if (!isDev) {
    try {
      await startBackend();
    } catch (err) {
      console.error("[backend] failed to start:", err);
    }
  }
  createWindow();
  import_electron.app.on("activate", () => {
    if (import_electron.BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});
import_electron.app.on("window-all-closed", () => {
  if (process.platform !== "darwin") import_electron.app.quit();
});
