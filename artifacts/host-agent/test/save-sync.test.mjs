import { test, mock } from "node:test";
import assert from "node:assert/strict";
import Module from "node:module";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import AdmZip from "adm-zip";

const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "host-agent-save-sync-"));

/** @type {{ discoverResult: { paths: string[]; steamAppId: string | null }; candidateResult: { paths: string[]; steamAppId: string | null } }} */
const savePathsMock = {
  discoverResult: { paths: [], steamAppId: null },
  candidateResult: { paths: [], steamAppId: null },
};

/** @type {{ downloadResult: Record<string, unknown>; uploadResult: Record<string, unknown>; confirmResult: Record<string, unknown> }} */
const apiClientMock = {
  downloadResult: { ok: false, status: 404 },
  uploadResult: { ok: false, error: "upload_unavailable" },
  confirmResult: { ok: true },
};

const load = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === "electron") {
    return {
      app: {
        getAppPath: () => tmpRoot,
        getPath: () => tmpRoot,
      },
    };
  }
  if (typeof request === "string" && request.includes("save-paths")) {
    return {
      discoverSavePaths: async () => savePathsMock.discoverResult,
      resolveSavePathCandidates: async () => savePathsMock.candidateResult,
    };
  }
  if (typeof request === "string" && request.includes("api-client")) {
    return {
      requestSaveDownloadUrl: async () => apiClientMock.downloadResult,
      requestSaveUploadUrl: async () => apiClientMock.uploadResult,
      confirmSaveUpload: async () => apiClientMock.confirmResult,
    };
  }
  return load.apply(this, arguments);
};

async function importSaveSync() {
  const url = new URL("../dist/main/main/save-sync.js", import.meta.url);
  url.searchParams.set("v", `${Date.now()}-${Math.random()}`);
  return import(url.href);
}

function resetMocks() {
  savePathsMock.discoverResult = { paths: [], steamAppId: null };
  savePathsMock.candidateResult = { paths: [], steamAppId: null };
  apiClientMock.downloadResult = { ok: false, status: 404 };
  apiClientMock.uploadResult = { ok: false, error: "upload_unavailable" };
  apiClientMock.confirmResult = { ok: true };
}

const baseOpts = {
  hostToken: "host-tok",
  apiBaseUrl: "https://api.example.com/",
  sessionId: "sess-1",
  saveOpts: { appPath: "C:\\Games\\game.exe" },
};

test("clearSavePaths removes files and empties directories", { concurrency: false }, async () => {
  resetMocks();
  const { clearSavePaths } = await importSaveSync();

  const filePath = path.join(tmpRoot, "clear-file.txt");
  fs.writeFileSync(filePath, "payload", "utf8");
  await clearSavePaths([filePath]);
  assert.equal(fs.existsSync(filePath), false);

  const dirPath = path.join(tmpRoot, "clear-dir");
  fs.mkdirSync(path.join(dirPath, "nested"), { recursive: true });
  fs.writeFileSync(path.join(dirPath, "nested", "save.dat"), "x", "utf8");
  await clearSavePaths([dirPath]);
  assert.equal(fs.existsSync(dirPath), true);
  assert.deepEqual(fs.readdirSync(dirPath), []);
});

test("pullSave skips when no save path candidates", { concurrency: false }, async () => {
  resetMocks();
  const { pullSave } = await importSaveSync();
  const result = await pullSave(baseOpts);
  assert.deepEqual(result, { ok: true, skipped: true, reason: "no_save_paths" });
});

test("pullSave skips when cloud save is missing (404)", { concurrency: false }, async () => {
  resetMocks();
  savePathsMock.candidateResult = {
    paths: [path.join(tmpRoot, "restore-target")],
    steamAppId: "123",
  };
  apiClientMock.downloadResult = { ok: false, status: 404 };

  const { pullSave } = await importSaveSync();
  const result = await pullSave(baseOpts);
  assert.deepEqual(result, { ok: true, skipped: true, reason: "no_cloud_save" });
});

test("pullSave skips when download URL unavailable", { concurrency: false }, async () => {
  resetMocks();
  savePathsMock.candidateResult = {
    paths: [path.join(tmpRoot, "restore-missing")],
    steamAppId: "123",
  };
  apiClientMock.downloadResult = { ok: false, status: 503, error: "storage_unavailable" };

  const { pullSave } = await importSaveSync();
  const result = await pullSave(baseOpts);
  assert.deepEqual(result, { ok: true, skipped: true, reason: "storage_unavailable" });
});

test("pullSave restores zip archive into candidate paths", { concurrency: false }, async () => {
  resetMocks();
  const targetDir = path.join(tmpRoot, "pull-restore");
  const restoredFile = path.join(targetDir, "slot1.sav");
  savePathsMock.discoverResult = { paths: [], steamAppId: "570" };
  savePathsMock.candidateResult = { paths: [targetDir], steamAppId: "570" };
  apiClientMock.downloadResult = {
    ok: true,
    downloadURL: "https://cdn.example.com/save.zip",
  };

  const zip = new AdmZip();
  zip.addFile(restoredFile, Buffer.from("save-data", "utf8"));
  const zipBuffer = zip.toBuffer();
  const entryName = zip.getEntries()[0].entryName.replace(/\//g, path.sep);
  const extractedPath = path.isAbsolute(entryName)
    ? path.normalize(entryName)
    : path.normalize(path.join(process.cwd(), entryName));

  const restore = mock.method(globalThis, "fetch", async (url) => {
    assert.equal(url, "https://cdn.example.com/save.zip");
    return {
      ok: true,
      arrayBuffer: async () => zipBuffer,
    };
  });

  try {
    const { pullSave } = await importSaveSync();
    const result = await pullSave(baseOpts);
    assert.deepEqual(result, { ok: true });
    assert.equal(fs.readFileSync(extractedPath, "utf8"), "save-data");
  } finally {
    restore.mock.restore();
    try {
      fs.rmSync(extractedPath, { force: true });
    } catch {
      // ignore cleanup errors
    }
  }
});

test("pullSave returns error when download HTTP fails", { concurrency: false }, async () => {
  resetMocks();
  savePathsMock.candidateResult = {
    paths: [path.join(tmpRoot, "pull-fail")],
    steamAppId: "123",
  };
  apiClientMock.downloadResult = {
    ok: true,
    downloadURL: "https://cdn.example.com/bad.zip",
  };

  const restore = mock.method(globalThis, "fetch", async () => ({
    ok: false,
    status: 502,
  }));

  try {
    const { pullSave } = await importSaveSync();
    const result = await pullSave(baseOpts);
    assert.deepEqual(result, { ok: false, error: "Download failed: HTTP 502" });
  } finally {
    restore.mock.restore();
  }
});

test("pushSave skips when no paths discovered", { concurrency: false }, async () => {
  resetMocks();
  const { pushSave } = await importSaveSync();
  const result = await pushSave(baseOpts);
  assert.deepEqual(result, { ok: true, skipped: true, reason: "no_save_paths" });
});

test("pushSave skips when save archive is empty", { concurrency: false }, async () => {
  resetMocks();
  const emptyDir = path.join(tmpRoot, "push-empty");
  fs.mkdirSync(emptyDir, { recursive: true });
  savePathsMock.discoverResult = { paths: [emptyDir], steamAppId: "123" };
  savePathsMock.candidateResult = { paths: [], steamAppId: "123" };

  const { pushSave } = await importSaveSync();
  const result = await pushSave(baseOpts);
  assert.deepEqual(result, { ok: true, skipped: true, reason: "empty_save" });
});

test("pushSave uploads archive and clears local paths", { concurrency: false }, async () => {
  resetMocks();
  const saveDir = path.join(tmpRoot, "push-upload");
  fs.mkdirSync(saveDir, { recursive: true });
  fs.writeFileSync(path.join(saveDir, "profile.sav"), "profile-bytes", "utf8");
  savePathsMock.discoverResult = { paths: [saveDir], steamAppId: "730" };
  savePathsMock.candidateResult = { paths: [], steamAppId: "730" };
  apiClientMock.uploadResult = {
    ok: true,
    uploadURL: "https://cdn.example.com/upload",
    objectPath: "saves/sess-1",
  };
  apiClientMock.confirmResult = { ok: true };

  const fetchCalls = [];
  const restore = mock.method(globalThis, "fetch", async (url, init) => {
    fetchCalls.push({ url, init });
    return { ok: true };
  });

  try {
    const { pushSave } = await importSaveSync();
    const result = await pushSave(baseOpts);
    assert.deepEqual(result, { ok: true });
    assert.equal(fetchCalls.length, 1);
    assert.equal(fetchCalls[0].url, "https://cdn.example.com/upload");
    assert.equal(fetchCalls[0].init.method, "PUT");
    assert.equal(fetchCalls[0].init.headers["Content-Type"], "application/zip");
    assert.deepEqual(fs.readdirSync(saveDir), []);
  } finally {
    restore.mock.restore();
  }
});

test("pushSave skips when upload URL unavailable", { concurrency: false }, async () => {
  resetMocks();
  const saveDir = path.join(tmpRoot, "push-no-upload");
  fs.mkdirSync(saveDir, { recursive: true });
  fs.writeFileSync(path.join(saveDir, "data.bin"), "1", "utf8");
  savePathsMock.discoverResult = { paths: [saveDir], steamAppId: "440" };
  apiClientMock.uploadResult = { ok: false, error: "storage_unavailable" };

  const { pushSave } = await importSaveSync();
  const result = await pushSave(baseOpts);
  assert.deepEqual(result, { ok: true, skipped: true, reason: "storage_unavailable" });
  assert.equal(fs.existsSync(path.join(saveDir, "data.bin")), true);
});

test("restoreSave and backupSave reject non-Windows platforms", { concurrency: false }, async () => {
  if (process.platform === "win32") return;
  resetMocks();
  const { restoreSave, backupSave } = await importSaveSync();
  const manifest = [{ label: "save", pathTemplate: "%USERPROFILE%/save.dat", provider: "custom" }];
  assert.deepEqual(await restoreSave(manifest, "https://cdn/restore.zip"), {
    ok: false,
    error: "Save sync supported on Windows only",
  });
  assert.deepEqual(await backupSave(manifest, "https://cdn/upload"), {
    ok: false,
    error: "Save sync supported on Windows only",
  });
});
