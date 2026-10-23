// C:/Users/86189/.cache/3d-editor/7735fd1ed8fb7299d1af1eeaa70127521e162c7435f574b84a9106f9b93fbc1a/node_modules/@edit3d/cli/dist/service-entry.js
import { readFile as readFile3 } from "node:fs/promises";
import { parseArgs } from "node:util";

// C:/Users/86189/.cache/3d-editor/7735fd1ed8fb7299d1af1eeaa70127521e162c7435f574b84a9106f9b93fbc1a/node_modules/@edit3d/cli/dist/state-server.js
import { createHash, randomUUID } from "node:crypto";
import { readFile as readFile2, mkdir as mkdir2, writeFile, rename, rm, realpath as realpath2, stat as stat2 } from "node:fs/promises";
import { resolve as resolve2, join as join3, relative as relative2, sep as sep2, extname, isAbsolute as isAbsolute2, dirname as dirname2, basename } from "node:path";
import { createServer } from "node:http";

// C:/Users/86189/.cache/3d-editor/7735fd1ed8fb7299d1af1eeaa70127521e162c7435f574b84a9106f9b93fbc1a/node_modules/@edit3d/cli/dist/model-runtime.js
import { copyFile, cp, mkdir, readFile, realpath, stat } from "node:fs/promises";
import { dirname, isAbsolute, join as join2, relative, resolve, sep } from "node:path";

// C:/Users/86189/.cache/3d-editor/7735fd1ed8fb7299d1af1eeaa70127521e162c7435f574b84a9106f9b93fbc1a/node_modules/@edit3d/cli/dist/model-import-service.js
import { join } from "node:path";

// C:/Users/86189/.cache/3d-editor/7735fd1ed8fb7299d1af1eeaa70127521e162c7435f574b84a9106f9b93fbc1a/node_modules/@edit3d/cli/dist/model-import-process.js
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
var MAX_BYTES = 256 * 1024 * 1024;
var TIMEOUT_MS = 12e4;
var worker = fileURLToPath(new URL("./model-import-worker.cjs", import.meta.url));
function readStepInProcess(directory, bytes, signal) {
  return new Promise((resolve4, reject) => {
    signal?.throwIfAborted();
    const flags = process.platform === "win32" && process.arch === "x64" && process.versions.electron ? ["--liftoff-only"] : [];
    const child = spawn(process.execPath, [...flags, worker, directory], {
      env: { ...process.env, ...process.versions.electron ? { ELECTRON_RUN_AS_NODE: "1" } : {} },
      stdio: ["pipe", "pipe", "pipe"],
      windowsHide: true
    });
    const chunks = [];
    let size = 0;
    let failed = false;
    let memoryFailure = false;
    const failure = (reason, exitCode = null) => Object.assign(new Error("MODEL_LOAD_FAILED"), {
      stepParserFailure: { reason, exitCode, memoryFailure }
    });
    const stop = () => {
      failed = true;
      child.kill();
    };
    const timer = setTimeout(stop, TIMEOUT_MS);
    timer.unref();
    signal?.addEventListener("abort", stop, { once: true });
    const cleanup = () => {
      clearTimeout(timer);
      signal?.removeEventListener("abort", stop);
    };
    child.stdout.on("data", (chunk) => {
      size += chunk.length;
      if (size > MAX_BYTES) {
        stop();
      } else {
        chunks.push(chunk);
      }
    });
    child.stderr.on("data", (chunk) => {
      memoryFailure ||= chunk.toString().includes("Fatal process out of memory");
    });
    child.stdin.on("error", stop);
    child.stdout.on("error", stop);
    child.once("error", () => {
      cleanup();
      reject(failure("spawn"));
    });
    child.once("close", (code) => {
      cleanup();
      if (failed || code !== 0) {
        return reject(failure(failed ? "stopped" : "exit", code));
      }
      try {
        resolve4(JSON.parse(Buffer.concat(chunks).toString("utf8")));
      } catch {
        reject(failure("protocol", code));
      }
    });
    child.stdin.end(bytes);
  });
}

// C:/Users/86189/.cache/3d-editor/7735fd1ed8fb7299d1af1eeaa70127521e162c7435f574b84a9106f9b93fbc1a/node_modules/@edit3d/cli/dist/model-import-service.js
var MODEL_STEP_PATH = "/__edit3d/model-import/step";
var MAX_STEP_BYTES = 256 * 1024 * 1024;
function modelImportMiddleware(runtimeDirectory) {
  let previous = Promise.resolve();
  return async (req, res, next) => {
    if (req.url?.split("?")[0] !== MODEL_STEP_PATH) {
      return next();
    }
    const reply = (status, body) => {
      if (res.destroyed || res.writableEnded) {
        return;
      }
      res.writeHead(status, { "Content-Type": "application/json", "Cache-Control": "no-store" });
      res.end(JSON.stringify(body));
    };
    const host = req.headers.host ?? "";
    if (req.method !== "POST" || !/^(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/.test(host) || req.headers.origin !== `http://${host}` || req.headers["x-edit3d-request"] !== "1") {
      req.resume();
      return reply(403, { ok: false, error: "MODEL_LOAD_FAILED" });
    }
    if (Number(req.headers["content-length"]) > MAX_STEP_BYTES) {
      req.resume();
      return reply(413, { ok: false, error: "MODEL_LOAD_FAILED" });
    }
    try {
      const chunks = [];
      let size = 0;
      for await (const chunk of req) {
        size += chunk.length;
        if (size > MAX_STEP_BYTES) {
          req.resume();
          return reply(413, { ok: false, error: "MODEL_LOAD_FAILED" });
        }
        chunks.push(chunk);
      }
      if (!size) {
        return reply(400, { ok: false, error: "MODEL_LOAD_FAILED" });
      }
      if (!runtimeDirectory || res.destroyed) {
        throw new Error("MODEL_LOAD_FAILED");
      }
      const controller = new AbortController();
      const abort = () => controller.abort();
      res.once("close", abort);
      const pending = previous.then(
        () => readStepInProcess(join(runtimeDirectory, "occt"), Buffer.concat(chunks), controller.signal)
      );
      previous = pending.then(
        () => void 0,
        () => void 0
      );
      let result;
      try {
        result = await pending;
      } finally {
        res.off("close", abort);
      }
      reply(
        result.success ? 200 : 422,
        result.success ? { ok: true, result } : { ok: false, error: "MODEL_LOAD_FAILED" }
      );
    } catch (error) {
      if (error?.stepParserFailure) {
        console.error("[edit3d:step-parser]", JSON.stringify(error.stepParserFailure));
      }
      reply(422, { ok: false, error: "MODEL_LOAD_FAILED" });
    }
  };
}

// C:/Users/86189/.cache/3d-editor/7735fd1ed8fb7299d1af1eeaa70127521e162c7435f574b84a9106f9b93fbc1a/node_modules/@edit3d/cli/dist/model-runtime.js
var MODEL_RUNTIME_PATH = "/__edit3d/model-runtime/";
var MODEL_RUNTIME_FILES = Object.freeze([
  "draco/draco_decoder.js",
  "draco/draco_wasm_wrapper.js",
  "draco/draco_decoder.wasm",
  "basis/basis_transcoder.js",
  "basis/basis_transcoder.wasm",
  "rhino3dm/rhino3dm.js",
  "rhino3dm/rhino3dm.wasm",
  "occt/occt-import-js.js",
  "occt/occt-import-js.wasm",
  "occt/package.json",
  "occt/import-params.json"
]);
var allowed = new Set(MODEL_RUNTIME_FILES);
var MIME_TYPES = { wasm: "application/wasm", json: "application/json", js: "text/javascript; charset=utf-8" };
async function runtimeFile(directory, name) {
  const base = await realpath(directory);
  const file = await realpath(join2(base, name));
  const path = relative(base, file);
  if (isAbsolute(path) || path === ".." || path.startsWith(`..${sep}`) || !(await stat(file)).isFile()) {
    throw new Error("MODEL_RUNTIME_MISSING");
  }
  return file;
}
function modelRuntimeMiddleware(directory) {
  return async (req, res, next) => {
    if (!req.url?.startsWith(MODEL_RUNTIME_PATH)) {
      return next();
    }
    const reply = (status) => {
      res.writeHead(status, { "Cache-Control": "no-store" });
      res.end();
    };
    if (req.method !== "GET" && req.method !== "HEAD") {
      return reply(405);
    }
    const name = req.url.slice(MODEL_RUNTIME_PATH.length).split("?")[0];
    if (!directory || !allowed.has(name)) {
      return reply(404);
    }
    try {
      const file = await runtimeFile(directory, name);
      const content = await readFile(file);
      res.writeHead(200, {
        "Content-Type": MIME_TYPES[name.split(".").at(-1)],
        "Content-Length": content.byteLength,
        "Cache-Control": "no-cache",
        "X-Content-Type-Options": "nosniff"
      });
      res.end(req.method === "HEAD" ? void 0 : content);
    } catch {
      reply(404);
    }
  };
}

// C:/Users/86189/.cache/3d-editor/7735fd1ed8fb7299d1af1eeaa70127521e162c7435f574b84a9106f9b93fbc1a/node_modules/@edit3d/cli/dist/persistence.js
function parseFont(font) {
  const match = typeof font === "string" && font.match(/^(?:(normal|italic) )?(?:(normal|bold|[1-9]00) )?(\d+(?:\.\d+)?)px (.+)$/);
  if (!match || Number(match[3]) <= 0 || !match[4].split(",").every((f) => /^(?:[\w -]+|"[^"\n]+"|'[^'\n]+')$/.test(f.trim())))
    throw new Error("INVALID_TEXT_FONT");
  return { italic: match[1] === "italic", weight: match[2] ?? "normal", size: Number(match[3]), family: match[4] };
}
function validateTextField(key2, value) {
  let valid = true;
  if (["name", "text"].includes(key2)) valid = typeof value === "string";
  else if (key2 === "visible") valid = typeof value === "boolean";
  else if (key2 === "position")
    valid = Array.isArray(value) && value.length === 2 && value.every((n) => Number.isFinite(n) && n >= 0 && n <= 1);
  else if (key2 === "font") {
    parseFont(value);
    return;
  } else if (["color", "strokeColor", "backgroundColor"].includes(key2))
    valid = typeof value === "string" && /^#[\da-f]{6}(?:[\da-f]{2})?$/i.test(value);
  else if (key2 === "align") valid = ["left", "center", "right"].includes(value);
  else if (["strokeWidth", "padding", "opacity", "lineHeight", "maxWidth"].includes(key2))
    valid = Number.isFinite(value) && value >= 0 && (!["lineHeight", "maxWidth"].includes(key2) || value > 0) && (!["opacity", "maxWidth"].includes(key2) || value <= 1);
  else valid = false;
  if (!valid) throw new Error(`INVALID_TEXT_FIELD: ${key2}`);
}
var vector = (size) => (value) => Array.isArray(value) && value.length === size && value.every(Number.isFinite);
var PARAM_VALIDATORS = {
  boolean: (v) => typeof v === "boolean",
  number: Number.isFinite,
  integer: Number.isSafeInteger,
  string: (v) => typeof v === "string",
  color: (v) => typeof v === "string" && /^#[\da-f]{6}$/i.test(v),
  vector2: vector(2),
  vector3: vector(3),
  rotation: vector(4),
  enum: (v) => typeof v === "string",
  asset_reference: (v) => typeof v === "string"
};
var copy = (value) => structuredClone(value);
function validateValue(binding, value, context) {
  if (!binding) throw new Error(`UNKNOWN_PARAM: ${context}`);
  if (!PARAM_VALIDATORS[binding.type]?.(value)) throw new Error(`INVALID_PARAMETER_TYPE: ${context}`);
  const values2 = Array.isArray(value) ? value : [value];
  if (values2.some(
    (value2) => typeof value2 === "number" && (binding.min !== void 0 && value2 < binding.min || binding.max !== void 0 && value2 > binding.max)
  )) {
    throw new Error(`PARAMETER_OUT_OF_RANGE: ${context}`);
  }
}
function shotChannelFrames(shot, channel) {
  if (!["position", "lookAt"].includes(channel)) throw new Error(`INVALID_SHOT_CHANNEL: ${channel}`);
  const frames = shot[`${channel}Keyframes`] ?? (shot.keyframes ?? []).map((frame) => ({ time: frame.time, value: frame[channel] }));
  return frames.map((frame) => ({ time: frame.time, value: [...frame.value] })).sort((a, b) => a.time - b.time);
}
function shotSamplingFrames(shot, channel) {
  const frames = shotChannelFrames(shot, channel);
  return frames.length ? frames : [{ time: 0, value: [...shot[channel]] }];
}
function sampleShotChannel(frames, time) {
  const right = frames.find((frame) => frame.time >= time) ?? frames.at(-1);
  const left = [...frames].reverse().find((frame) => frame.time <= time) ?? frames[0];
  const amount = right.time === left.time ? 0 : (time - left.time) / (right.time - left.time);
  return left.value.map((value, i) => value + (right.value[i] - value) * amount);
}
function validateFrames(shot, frames, keys) {
  if (!Array.isArray(frames)) throw new Error(`EMPTY_KEYFRAMES: ${shot.id}`);
  const times = /* @__PURE__ */ new Set();
  for (const frame of frames) {
    if (!frame || !Number.isFinite(frame.time) || frame.time < 0 || frame.time > shot.duration || times.has(frame.time))
      throw new Error(`INVALID_KEYFRAME_TIME: ${shot.id}`);
    times.add(frame.time);
    if (keys.some((key2) => !PARAM_VALIDATORS.vector3(frame[key2])))
      throw new Error(`INVALID_KEYFRAME_VECTOR: ${shot.id}`);
  }
}
function validateShotChannels(shot) {
  if (shot.keyframes !== void 0) validateFrames(shot, shot.keyframes, ["position", "lookAt"]);
  for (const channel of ["position", "lookAt"]) {
    if (shot[`${channel}Keyframes`] !== void 0) validateFrames(shot, shot[`${channel}Keyframes`], ["value"]);
    const frames = shot[`${channel}Keyframes`] ?? shot.keyframes;
    if (!frames?.length && !PARAM_VALIDATORS.vector3(shot[channel]))
      throw new Error(`EMPTY_KEYFRAMES: ${shot.id}.${channel}`);
  }
  const position = shotSamplingFrames(shot, "position"), lookAt = shotSamplingFrames(shot, "lookAt");
  const times = [.../* @__PURE__ */ new Set([0, shot.duration, ...position.map((f) => f.time), ...lookAt.map((f) => f.time)])].sort(
    (a, b) => a - b
  );
  let previous;
  for (const time of times) {
    const target = sampleShotChannel(lookAt, time);
    const difference = sampleShotChannel(position, time).map((value, i) => value - target[i]);
    if (difference.every((value) => value === 0)) throw new Error(`INVALID_LOOK_AT: ${shot.id}`);
    if (previous) {
      const axis = difference.findIndex((value, i) => value !== previous[i]);
      const amount = axis < 0 ? -1 : -previous[axis] / (difference[axis] - previous[axis]);
      if (amount > 0 && amount < 1 && difference.every((value, i) => Math.abs(previous[i] + (value - previous[i]) * amount) < 1e-10))
        throw new Error(`INVALID_LOOK_AT: ${shot.id}`);
    }
    previous = difference;
  }
}
function validateDirector(director, getEntity, getAudio = () => null, getAnimation = () => null, _animations = [], getText = () => null) {
  if (!director || !Array.isArray(director.shots) || !Array.isArray(director.tracks))
    throw new Error("INVALID_DIRECTOR: shots and tracks must be arrays");
  const ids = /* @__PURE__ */ new Set();
  for (const shot of director.shots) {
    if (!shot || typeof shot.id !== "string" || !shot.id.trim() || ids.has(shot.id))
      throw new Error(`INVALID_SHOT_ID: ${shot?.id}`);
    ids.add(shot.id);
    if (typeof shot.name !== "string") throw new Error(`INVALID_SHOT_NAME: ${shot.id}`);
    const camera = getEntity(shot.camera)?.object;
    if (!(camera?.isPerspectiveCamera || camera?.isOrthographicCamera))
      throw new Error(`SHOT_CAMERA_NOT_FOUND: ${shot.id} \u2192 ${shot.camera}`);
    if (!Number.isFinite(shot.duration) || shot.duration <= 0) throw new Error(`INVALID_SHOT_DURATION: ${shot.id}`);
    if (shot.start !== void 0 && (!Number.isFinite(shot.start) || shot.start < 0))
      throw new Error(`INVALID_SHOT_START: ${shot.id}`);
    validateShotChannels(shot);
  }
  const textTargets = /* @__PURE__ */ new Set();
  const animationIds = /* @__PURE__ */ new Set();
  const trackIds = /* @__PURE__ */ new Set(), clipIds = /* @__PURE__ */ new Set();
  if (director.tracks.filter((t) => t.type === "shot").length > 1) throw new Error("MULTIPLE_TRACKS_UNSUPPORTED");
  for (const track of director.tracks) {
    if (!track || typeof track.id !== "string" || !track.id.trim() || trackIds.has(track.id) || !["shot", "audio", "animation", "subtitle"].includes(track.type) || !Array.isArray(track.clips))
      throw new Error("INVALID_TRACK");
    trackIds.add(track.id);
    if (track.hidden !== void 0 && typeof track.hidden !== "boolean")
      throw new Error(`INVALID_TRACK_VISIBILITY: ${track.id}`);
    for (const order of ["rowOrder", "editorRowOrder"])
      if (track[order] !== void 0 && (!Number.isSafeInteger(track[order]) || track[order] < 0))
        throw new Error(`INVALID_TRACK_ORDER: ${track.id}`);
    if (track.type === "subtitle") {
      if (!getText(track.targetId) || textTargets.has(track.targetId))
        throw new Error(`INVALID_SUBTITLE_TARGET: ${track.targetId}`);
      textTargets.add(track.targetId);
      const sorted = [...track.clips].sort((a, b) => a.start - b.start);
      for (let i = 1; i < sorted.length; i++)
        if (sorted[i].start < sorted[i - 1].start + sorted[i - 1].duration)
          throw new Error(`OVERLAPPING_SUBTITLES: ${track.id}`);
    }
    if (track.type === "animation" && track.clips.length !== 1) throw new Error(`INVALID_ANIMATION_TRACK: ${track.id}`);
    for (const clip of track.clips) {
      for (const order of ["rowOrder", "editorRowOrder"])
        if (clip?.[order] !== void 0 && (!Number.isSafeInteger(clip[order]) || clip[order] < 0))
          throw new Error(`INVALID_CLIP_ORDER: ${clip.id}`);
      if (track.type === "shot") {
        if (!ids.has(clip?.shotId)) throw new Error(`SHOT_NOT_FOUND: ${clip?.shotId}`);
        if (clip.start !== void 0 && (!Number.isFinite(clip.start) || clip.start < 0))
          throw new Error(`INVALID_SHOT_START: ${clip.shotId}`);
        if (clip.hidden !== void 0 && typeof clip.hidden !== "boolean")
          throw new Error(`INVALID_CLIP_VISIBILITY: ${clip.shotId}`);
      } else if (track.type === "subtitle") {
        if (!clip || typeof clip.id !== "string" || !clip.id.trim() || clipIds.has(clip.id))
          throw new Error("INVALID_SUBTITLE_CLIP_ID");
        clipIds.add(clip.id);
        if (!Number.isFinite(clip.start) || clip.start < 0 || !Number.isFinite(clip.duration) || clip.duration <= 0 || typeof clip.text !== "string")
          throw new Error(`INVALID_SUBTITLE_CLIP: ${clip.id}`);
      } else if (track.type === "animation") {
        if (!clip || typeof clip.id !== "string" || !clip.id.trim() || clipIds.has(clip.id))
          throw new Error(`INVALID_ANIMATION_CLIP_ID: ${clip?.id}`);
        clipIds.add(clip.id);
        if (!getAnimation(clip.animationId)) throw new Error(`ANIMATION_NOT_FOUND: ${clip.id} \u2192 ${clip.animationId}`);
        if (animationIds.has(clip.animationId)) throw new Error(`DUPLICATE_ANIMATION_CLIP: ${clip.animationId}`);
        animationIds.add(clip.animationId);
        if (track.id !== `animation:${clip.animationId}` || clip.id !== `animation:${clip.animationId}:clip`)
          throw new Error(`INVALID_ANIMATION_TRACK: ${track.id}`);
        if (!Number.isFinite(clip.start) || clip.start < 0 || !Number.isFinite(clip.duration) || clip.duration <= 0 || clip.offset !== void 0 && (!Number.isFinite(clip.offset) || clip.offset < 0) || typeof clip.enabled !== "boolean")
          throw new Error(`INVALID_ANIMATION_CLIP: ${clip.id}`);
      } else {
        if (!clip || typeof clip.id !== "string" || !clip.id.trim() || clipIds.has(clip.id))
          throw new Error(`INVALID_AUDIO_CLIP_ID: ${clip?.id}`);
        clipIds.add(clip.id);
        if (!getAudio(clip.audioId)) throw new Error(`AUDIO_NOT_FOUND: ${clip.id} \u2192 ${clip.audioId}`);
        for (const key2 of ["start", "offset", "duration", "volume"]) {
          if (!Number.isFinite(clip[key2]) || clip[key2] < 0 || key2 === "duration" && clip[key2] === 0 || key2 === "volume" && clip[key2] > 1)
            throw new Error(`INVALID_AUDIO_CLIP: ${clip.id}.${key2}`);
        }
      }
    }
  }
}
var isObject = (value) => !!value && typeof value === "object" && !Array.isArray(value);
var same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
var uniqueId = (bindingId) => `unique:${bindingId}`;
var ambiguousIdentity = "\u6750\u8D28\u7ED1\u5B9A\u65E0\u6CD5\u552F\u4E00\u8BC6\u522B\uFF0C\u91C7\u7528\u4EE3\u7801\u503C\uFF1B\u8BF7\u4E3A\u5BF9\u8C61\u6CE8\u518C\u7A33\u5B9A ID\uFF0C\u6216\u4E3A\u5BF9\u8C61\u53CA\u5176\u7236\u7EA7\u8BBE\u7F6E\u552F\u4E00\u540D\u79F0";
var specs = {
  color: { type: "color", label: "\u989C\u8272" },
  opacity: { type: "number", label: "\u900F\u660E\u5EA6", min: 0, max: 1, step: 0.01 },
  roughness: { type: "number", label: "\u7C97\u7CD9\u5EA6", min: 0, max: 1, step: 0.01 },
  metalness: { type: "number", label: "\u91D1\u5C5E\u5EA6", min: 0, max: 1, step: 0.01 }
};
function validateMaterialState(state, description) {
  if (!isObject(state) || state.version !== 1 || !Array.isArray(state.resources) || !Array.isArray(state.bindings)) {
    throw new Error("INCOMPATIBLE_MATERIAL_STATE");
  }
  const originals = new Map(description.state.resources.map((resource) => [resource.id, resource]));
  const expected = new Map(description.state.bindings.map((binding) => [binding.id, binding.materialId]));
  if (state.bindings.length !== expected.size) {
    throw new Error("STATE_MATERIAL_BINDING_MISMATCH");
  }
  const resources = /* @__PURE__ */ new Map();
  for (const resource of state.resources) {
    if (!isObject(resource) || typeof resource.id !== "string" || resources.has(resource.id)) {
      throw new Error("INVALID_MATERIAL_RESOURCE");
    }
    const source = resource.sourceId ?? resource.id;
    if (!originals.has(source) || resource.sourceId !== void 0 && ![...expected.keys()].some((id) => resource.id === uniqueId(id)) || resource.sourceId !== void 0 && originals.has(resource.id) || typeof resource.transparent !== "boolean" || !isObject(resource.params)) {
      throw new Error("STATE_MATERIAL_RESOURCE_MISMATCH");
    }
    const schema = description.schemas[source];
    if (!same(Object.keys(schema).sort(), Object.keys(resource.params).sort())) {
      throw new Error("STATE_MATERIAL_SCHEMA_MISMATCH");
    }
    for (const [key2, value] of Object.entries(resource.params)) {
      validateValue(schema[key2], value, `${resource.id}.${key2}`);
    }
    resources.set(resource.id, resource);
  }
  const identities = new Map(description.state.bindings.map((binding) => [binding.id, binding.identity]));
  const seen = /* @__PURE__ */ new Set();
  for (const binding of state.bindings) {
    if (!isObject(binding) || !expected.has(binding.id) || seen.has(binding.id)) {
      throw new Error("STATE_MATERIAL_BINDING_MISMATCH");
    }
    if (binding.identity !== void 0 && (!isObject(binding.identity) || typeof binding.identity.path !== "string" || typeof binding.identity.stable !== "boolean" || !same(binding.identity, identities.get(binding.id)))) {
      throw new Error("STATE_MATERIAL_BINDING_MISMATCH");
    }
    seen.add(binding.id);
    const resource = resources.get(binding.materialId);
    if (!resource || (resource.sourceId ?? resource.id) !== expected.get(binding.id) || resource.sourceId !== void 0 && resource.id !== uniqueId(binding.id)) {
      throw new Error("STATE_MATERIAL_REFERENCE_MISMATCH");
    }
  }
  const referenced = new Set(state.bindings.map((binding) => binding.materialId));
  for (const resource of state.resources) {
    if (resource.sourceId) {
      referenced.add(resource.sourceId);
    }
    if (resource.sourceId && !resources.has(resource.sourceId)) {
      throw new Error("STATE_MATERIAL_REFERENCE_MISMATCH");
    }
  }
  if (state.resources.some((resource) => !referenced.has(resource.id))) {
    throw new Error("UNUSED_MATERIAL_RESOURCE");
  }
  return state;
}
function materialMatches(base, current, sameSource) {
  const sourceIds = (state) => {
    const resources2 = new Map(state.resources.map((resource) => [resource.id, resource]));
    return new Map(
      state.bindings.map((binding) => {
        const resource = resources2.get(binding.materialId);
        return [binding.id, resource.sourceId ?? resource.id];
      })
    );
  };
  const graph = (state) => state.bindings.map((binding) => ({ id: binding.id, materialId: binding.materialId }));
  const sameBindings = sameSource && same(graph(base), graph(current));
  const key2 = (binding) => {
    if (sameBindings) {
      return binding.id;
    }
    if (binding.identity) {
      return binding.identity.stable ? binding.identity.path : null;
    }
    return /^entity:[^/]+\/slot:\d+$/.test(binding.id) ? binding.id : null;
  };
  const oldSources = sourceIds(base);
  const nextSources = sourceIds(current);
  const candidates = /* @__PURE__ */ new Map();
  const currentPaths = new Set(current.bindings.map((binding) => binding.identity?.path ?? binding.id));
  for (const binding of current.bindings) {
    const path = key2(binding);
    if (path) {
      candidates.set(path, binding);
    }
  }
  const bindings = /* @__PURE__ */ new Map();
  const resources = /* @__PURE__ */ new Map();
  const ambiguous = /* @__PURE__ */ new Set();
  const ambiguousBindings = /* @__PURE__ */ new Set();
  const targets = /* @__PURE__ */ new Map();
  for (const binding of base.bindings) {
    const source = oldSources.get(binding.id);
    const path = key2(binding);
    if (!path) {
      ambiguous.add(source);
      ambiguousBindings.add(binding.id);
      continue;
    }
    const candidate = candidates.get(path);
    if (!candidate) {
      if (currentPaths.has(path)) {
        ambiguous.add(source);
        ambiguousBindings.add(binding.id);
      }
      continue;
    }
    bindings.set(binding.id, candidate.id);
    if (!targets.has(source)) {
      targets.set(source, /* @__PURE__ */ new Set());
    }
    targets.get(source).add(nextSources.get(candidate.id));
  }
  const owners = /* @__PURE__ */ new Map();
  for (const [source, ids] of targets) {
    if (ids.size !== 1) {
      ambiguous.add(source);
      continue;
    }
    const id = [...ids][0];
    if (!owners.has(id)) {
      owners.set(id, []);
    }
    owners.get(id).push(source);
  }
  for (const [id, sources] of owners) {
    if (sources.length === 1) {
      resources.set(sources[0], id);
    } else {
      for (const source of sources) {
        ambiguous.add(source);
      }
    }
  }
  return { bindings, resources, ambiguous, ambiguousBindings };
}
function reconcileMaterialState(current, base, saved, description, { sameSource = false } = {}) {
  if (!isObject(base) || base.version !== 1 || !Array.isArray(base.resources) || !Array.isArray(base.bindings)) {
    throw new Error("INCOMPATIBLE_MATERIAL_STATE");
  }
  const oldResources = new Map(base.resources.map((resource) => [resource.id, resource]));
  const oldDescription = {
    state: {
      resources: base.resources.filter((resource) => resource.sourceId === void 0),
      bindings: base.bindings.map((binding) => {
        const resource = oldResources.get(binding.materialId);
        return { ...binding, materialId: resource?.sourceId ?? resource?.id };
      })
    },
    schemas: Object.fromEntries(
      base.resources.filter((resource) => resource.sourceId === void 0).map((resource) => [
        resource.id,
        Object.fromEntries(
          Object.keys(resource.params).map((key2) => {
            if (!Object.hasOwn(specs, key2)) {
              throw new Error("STATE_MATERIAL_SCHEMA_MISMATCH");
            }
            return [key2, specs[key2]];
          })
        )
      ])
    )
  };
  validateMaterialState(base, oldDescription);
  validateMaterialState(saved, oldDescription);
  const matches = materialMatches(base, current, sameSource);
  const state = copy(current);
  const currentResources = new Map(current.resources.map((resource) => [resource.id, resource]));
  const resources = new Map(state.resources.map((resource) => [resource.id, resource]));
  const savedResources = new Map(saved.resources.map((resource) => [resource.id, resource]));
  const currentBindings = new Map(current.bindings.map((binding) => [binding.id, binding]));
  const bindings = new Map(state.bindings.map((binding) => [binding.id, binding]));
  const savedBindings = new Map(saved.bindings.map((binding) => [binding.id, binding]));
  const issues = [];
  const deleted = "\u5BF9\u8C61\u6216\u5B57\u6BB5\u5DF2\u5220\u9664";
  const changed = "\u4EE3\u7801\u9ED8\u8BA4\u503C\u5DF2\u6539\u53D8\uFF0C\u91C7\u7528\u4EE3\u7801\u503C";
  const mergeValues = (before, value, next, path, missingReason = deleted) => {
    const opacityConflict = !same(before.params.opacity, value.params.opacity) && (!next || !same(before.params.opacity, next.params.opacity));
    for (const key2 of [...Object.keys(before.params), "transparent"]) {
      const from = key2 === "transparent" ? before.transparent : before.params[key2];
      const to = key2 === "transparent" ? value.transparent : value.params[key2];
      if (same(from, to)) {
        continue;
      }
      const exists = next && (key2 === "transparent" || Object.hasOwn(next.params, key2));
      const initial = key2 === "transparent" ? next?.transparent : next?.params[key2];
      if (!exists || !same(initial, from) || key2 === "transparent" && opacityConflict) {
        issues.push({ path: [...path, key2], reason: exists ? changed : missingReason });
      } else if (key2 === "transparent") {
        next.transparent = to;
      } else {
        next.params[key2] = copy(to);
      }
    }
  };
  for (const before of base.resources.filter((resource) => resource.sourceId === void 0)) {
    mergeValues(
      before,
      savedResources.get(before.id),
      resources.get(matches.resources.get(before.id)),
      ["resource", before.id],
      matches.ambiguous.has(before.id) ? ambiguousIdentity : deleted
    );
  }
  for (const beforeBinding of base.bindings) {
    const before = oldResources.get(beforeBinding.materialId);
    const value = savedResources.get(savedBindings.get(beforeBinding.id).materialId);
    const privateChange = value.sourceId !== void 0 && (before.sourceId === void 0 || !same(before.params, value.params) || before.transparent !== value.transparent);
    const join4 = before.sourceId !== void 0 && value.sourceId === void 0;
    if (!privateChange && !join4) {
      continue;
    }
    const target = currentBindings.get(matches.bindings.get(beforeBinding.id));
    const initial = target && currentResources.get(target.materialId);
    const sourceId = initial?.sourceId ?? initial?.id;
    const path = ["binding", beforeBinding.id];
    if (!initial || sourceId !== matches.resources.get(before.sourceId ?? before.id)) {
      const missingReason = matches.ambiguousBindings.has(beforeBinding.id) ? ambiguousIdentity : deleted;
      issues.push({ path, reason: initial ? changed : missingReason });
      continue;
    }
    if (join4) {
      bindings.get(target.id).materialId = sourceId;
    } else {
      const resource = { ...copy(initial), id: uniqueId(target.id), sourceId };
      mergeValues(before, value, resource, path);
      resources.set(resource.id, resource);
      bindings.get(target.id).materialId = resource.id;
    }
  }
  const referenced = new Set(state.bindings.map((binding) => binding.materialId));
  for (const id of referenced) {
    const sourceId = resources.get(id).sourceId;
    if (sourceId) {
      referenced.add(sourceId);
    }
  }
  state.resources = [...resources.values()].filter((resource) => referenced.has(resource.id));
  validateMaterialState(state, description);
  return { state, issues };
}
function migrateLegacyMaterials(initial, entities, links) {
  const state = copy(initial);
  const resources = new Map(state.resources.map((resource) => [resource.id, resource]));
  const bindings = new Map(state.bindings.map((binding) => [binding.id, binding]));
  for (const link of links) {
    const params = entities.find((entity) => entity.id === link.entityId)?.params;
    if (!params || !Object.hasOwn(params, link.key)) {
      continue;
    }
    const binding = bindings.get(link.bindingId);
    const source = resources.get(binding.materialId);
    if (same(source.params[link.param], params[link.key])) {
      continue;
    }
    const id = uniqueId(binding.id);
    let resource = resources.get(id);
    if (!resource) {
      resource = { ...copy(source), id, sourceId: source.sourceId ?? source.id };
      resources.set(id, resource);
      state.resources.push(resource);
      binding.materialId = id;
    }
    resource.params[link.param] = copy(params[link.key]);
    if (link.param === "opacity") {
      resource.transparent = source.transparent || params[link.key] < 1;
    }
  }
  return state;
}
function syncMaterialAliases(state, links) {
  const resources = new Map(state.materials.resources.map((resource) => [resource.id, resource]));
  const bindings = new Map(state.materials.bindings.map((binding) => [binding.id, binding]));
  for (const link of links) {
    const entity = state.entities.find((item) => item.id === link.entityId);
    if (entity) {
      entity.params[link.key] = copy(resources.get(bindings.get(link.bindingId).materialId).params[link.param]);
    }
  }
}
function same2(a, b) {
  if (Object.is(a, b)) {
    return true;
  }
  if (!a || !b || typeof a !== "object" || typeof b !== "object" || Array.isArray(a) !== Array.isArray(b)) {
    return false;
  }
  const keys = Object.keys(a);
  return keys.length === Object.keys(b).length && keys.every((key2) => Object.hasOwn(b, key2) && same2(a[key2], b[key2]));
}
var key = (path) => JSON.stringify(path);
var clone = (x) => structuredClone(x);
var baselineSessions = /* @__PURE__ */ new WeakMap();
var nextBaselineSession = 0;
var sessionScope = Math.random().toString(36).slice(2);
function emptyEdits(id) {
  return { format: "edit3d-edits", version: 2, id, overrides: [] };
}
function location(state, path) {
  if (path[0] === "project") {
    return [state, path[1]];
  }
  const scene = state.scenes.find((x) => x.id === path[1]);
  if (path[2] === "name") {
    return [scene, "name"];
  }
  if (path[2] === "text") {
    const text = scene.state.texts?.find((t) => t.id === path[3]);
    return [path.length === 6 ? text?.style : text, path.at(-1)];
  }
  if (path[2] === "director") {
    return [scene.state, "director"];
  }
  if (path[2] === "materials") return [scene.state, "materials"];
  const group = path[2] === "entity" ? scene.state.entities.find((x) => x.id === path[3])?.params : scene.state.paramGroups.find((x) => x.id === path[3])?.values;
  return [group, path[4]];
}
function validateEdits(edits, id) {
  if (!edits || edits.format !== "edit3d-edits" || ![1, 2].includes(edits.version) || edits.id !== id || !Array.isArray(edits.overrides)) {
    throw new Error("INVALID_EDIT_STATE");
  }
  const seen = /* @__PURE__ */ new Set();
  for (const record of edits.overrides) {
    if (!record || !Array.isArray(record.path) || !record.path.every((x) => typeof x === "string") || !Object.hasOwn(record, "base") || !Object.hasOwn(record, "value") || seen.has(key(record.path))) {
      throw new Error("INVALID_OVERRIDE");
    }
    seen.add(key(record.path));
  }
}
function validateField(field, value) {
  const m = field.meta;
  if (m.type === "materials") {
    validateMaterialState(value, m.description);
  } else if (m.type === "text-field") {
    validateTextField(m.field, value);
  } else if (m.type === "director") {
    if (m.interactive && (value?.shots?.length || value?.tracks?.length)) {
      throw new Error("INTERACTIVE_DIRECTOR_CONFLICT");
    }
    validateDirector(
      value,
      (id) => m.cameras.includes(id) ? { object: { isPerspectiveCamera: true } } : null,
      (id) => m.audios.includes(id) ? {} : null,
      (id) => m.animations?.find((a) => a.id === id),
      m.animations ?? [],
      (id) => m.texts?.includes(id) ? {} : null
    );
  } else {
    validateValue(m, value, key(field.path));
    if (m.nonempty && !value.trim()) {
      throw new Error("EMPTY_NAME");
    }
    if (m.choices && !m.choices.includes(value) || m.options && !m.options.some((option) => option.value === value)) {
      throw new Error("INVALID_REFERENCE");
    }
  }
}
function createEdits(baseline, state) {
  const edits = emptyEdits(baseline.id);
  if (typeof baseline.sourceRevision === "string" && baseline.sourceRevision) {
    edits.sourceRevision = baseline.sourceRevision;
  } else {
    if (!baselineSessions.has(baseline)) {
      baselineSessions.set(
        baseline,
        globalThis.crypto?.randomUUID?.() ?? `baseline-${sessionScope}-${++nextBaselineSession}`
      );
    }
    edits.baselineSession = baselineSessions.get(baseline);
  }
  for (const field of baseline.fields) {
    if (field.meta.legacyMaterialAlias) continue;
    const [object, param] = location(state, field.path), value = object[param];
    if (!same2(value, field.value)) {
      validateField(field, value);
      edits.overrides.push({ path: field.path, base: clone(field.value), value: clone(value) });
    }
  }
  return edits;
}
function reconcileEdits(baseline, input) {
  const edits = input ?? emptyEdits(baseline.id);
  validateEdits(edits, baseline.id);
  const fields = new Map(baseline.fields.map((f) => [key(f.path), f]));
  const state = clone(baseline.state), issues = [];
  for (const record of edits.overrides) {
    const field = fields.get(key(record.path));
    if (field?.meta.type === "materials" && edits.version === 2) {
      try {
        const result = reconcileMaterialState(field.value, record.base, record.value, field.meta.description, {
          sameSource: typeof baseline.sourceRevision === "string" && !!baseline.sourceRevision && baseline.sourceRevision === edits.sourceRevision || !baseline.sourceRevision && !edits.sourceRevision && baselineSessions.has(baseline) && baselineSessions.get(baseline) === edits.baselineSession
        });
        const [object, param] = location(state, record.path);
        object[param] = result.state;
        issues.push(...result.issues.map((issue) => ({ ...issue, path: [...record.path, ...issue.path] })));
      } catch (error) {
        issues.push({ path: record.path, reason: error.message });
      }
      continue;
    }
    let reason;
    if (!field) {
      reason = "\u5BF9\u8C61\u6216\u5B57\u6BB5\u5DF2\u5220\u9664";
    } else if (!same2(field.value, record.base)) {
      reason = "\u4EE3\u7801\u9ED8\u8BA4\u503C\u5DF2\u6539\u53D8\uFF0C\u91C7\u7528\u4EE3\u7801\u503C";
    } else if (edits.version === 2 && field.meta.legacyMaterialAlias && !same2(record.base, record.value)) {
      reason = "LEGACY_MATERIAL_ALIAS_REQUIRES_V1";
    } else if (edits.version === 1 && field.meta.type === "materials" && !same2(record.base, record.value)) {
      reason = "MATERIAL_STATE_REQUIRES_V2";
    } else {
      try {
        validateField(field, record.value);
      } catch (error) {
        reason = error.message;
      }
    }
    if (reason) {
      issues.push({ path: record.path, reason });
      continue;
    }
    if (!same2(field.value, record.value)) {
      const [object, param] = location(state, record.path);
      Object.defineProperty(object, param, {
        value: clone(record.value),
        writable: true,
        enumerable: true,
        configurable: true
      });
    }
  }
  for (const scene of state.scenes) {
    const materialField = fields.get(key(["scene", scene.id, "materials"]));
    if (materialField) {
      const { links } = materialField.meta.description;
      if (edits.version === 1)
        scene.state.materials = migrateLegacyMaterials(scene.state.materials, scene.state.entities, links);
      syncMaterialAliases(scene.state, links);
    }
    for (const entity of scene.state.entities) {
      if (entity.params.near !== void 0 && entity.params.far <= entity.params.near) {
        for (const param of ["near", "far"]) {
          const path = ["scene", scene.id, "entity", entity.id, param], field = fields.get(key(path));
          entity.params[param] = clone(field.value);
          issues.push({ path, reason: "\u76F8\u673A\u88C1\u526A\u9762\u8303\u56F4\u65E0\u6548" });
        }
      }
    }
  }
  return { state, edits: createEdits(baseline, state), issues };
}

// C:/Users/86189/.cache/3d-editor/7735fd1ed8fb7299d1af1eeaa70127521e162c7435f574b84a9106f9b93fbc1a/node_modules/@edit3d/cli/dist/state-server.js
var LIMIT = 5 * 1024 * 1024;
var revision = (text) => createHash("sha256").update(text).digest("hex");
function sameBaseline(left, right) {
  if (left === right) {
    return true;
  }
  if (typeof left === "number" && typeof right === "number") {
    return Number.isFinite(left) && Number.isFinite(right) && Math.abs(left - right) <= Number.EPSILON * 8 * Math.max(1, Math.abs(left), Math.abs(right));
  }
  if (!left || !right || typeof left !== "object" || typeof right !== "object" || Array.isArray(left) !== Array.isArray(right)) {
    return false;
  }
  const keys = Object.keys(left);
  return keys.length === Object.keys(right).length && keys.every((key2) => Object.hasOwn(right, key2) && sameBaseline(left[key2], right[key2]));
}
function createBrowserBaseline(codeRevision2) {
  let baseline, fingerprint;
  const previous = /* @__PURE__ */ new Map();
  return {
    get revision() {
      return codeRevision2;
    },
    reset(next) {
      if (baseline) previous.set(codeRevision2, { baseline, fingerprint });
      while (previous.size > 16) previous.delete(previous.keys().next().value);
      codeRevision2 = next;
      baseline = fingerprint = void 0;
    },
    forSave(requestRevision, baselineRevision) {
      const source = requestRevision === codeRevision2 ? { baseline, fingerprint } : previous.get(requestRevision);
      if (!source?.baseline || source.fingerprint !== baselineRevision)
        throw Object.assign(new Error("CODE_CHANGED: \u8BF7\u5237\u65B0\u9875\u9762"), { status: 409 });
      return baseline ?? source.baseline;
    },
    get: async () => {
      if (!baseline) throw Object.assign(new Error("BASELINE_NOT_READY"), { status: 409 });
      return baseline;
    },
    initialize(input) {
      if (input.codeRevision !== codeRevision2)
        throw Object.assign(new Error("CODE_CHANGED: \u8BF7\u5237\u65B0\u9875\u9762"), { status: 409 });
      const candidate = { ...input.baseline, sourceRevision: codeRevision2 };
      try {
        if (candidate?.format !== "edit3d-baseline" || ![1, 2].includes(candidate.version) || typeof candidate.id !== "string" || !Array.isArray(candidate.fields) || candidate.state?.id !== candidate.id)
          throw new Error("INVALID_BASELINE");
        createEdits(candidate, candidate.state);
        const records = candidate.fields.map((f) => ({ path: f.path, base: f.value, value: f.value }));
        const result = reconcileEdits(candidate, { ...emptyEdits(candidate.id), overrides: records });
        if (result.issues.length) throw new Error("INVALID_BASELINE_FIELDS");
      } catch (error) {
        throw Object.assign(error, { status: 422 });
      }
      const hash = revision(JSON.stringify(candidate));
      if (fingerprint && fingerprint !== hash && !sameBaseline(baseline, candidate)) {
        throw Object.assign(new Error("BASELINE_MISMATCH: \u573A\u666F\u9ED8\u8BA4\u503C\u4E0D\u4E00\u81F4"), { status: 409 });
      }
      if (!baseline) {
        baseline = structuredClone(candidate);
        fingerprint = hash;
      }
    }
  };
}
function createStateStore(directory, getBaseline) {
  const dataRoot = resolve2(directory);
  const file = join3(dataRoot, "edit3d.state.json");
  let queue = Promise.resolve();
  const schemas = /* @__PURE__ */ new Map();
  async function read(resolveBaseline = getBaseline) {
    const baseline = await resolveBaseline();
    let text = "", exists = true;
    try {
      if ((await stat2(file)).size > LIMIT) throw new Error("STATE_TOO_LARGE");
      text = await readFile2(file, "utf8");
    } catch (error) {
      if (error.code !== "ENOENT") {
        throw error;
      }
      exists = false;
    }
    if (Buffer.byteLength(text) > LIMIT) {
      throw new Error("STATE_TOO_LARGE");
    }
    const raw = exists ? JSON.parse(text) : emptyEdits(baseline.id);
    const result = reconcileEdits(baseline, raw);
    const baselineRevision = revision(JSON.stringify(baseline));
    schemas.set(baselineRevision, baseline);
    if (schemas.size > 16) schemas.delete(schemas.keys().next().value);
    return { revision: revision(text), baselineRevision, baseline, ...result };
  }
  function save(expected, input, baselineRevision, resolveBaseline = getBaseline) {
    const operation = queue.catch(() => {
    }).then(async () => {
      const previous = await read(resolveBaseline);
      if (expected !== previous.revision) {
        throw Object.assign(new Error("STATE_CONFLICT"), { status: 409 });
      }
      try {
        validateEdits(input, previous.baseline.id);
      } catch (error) {
        throw Object.assign(error, { status: 422 });
      }
      const source = baselineRevision === void 0 ? previous.baseline : schemas.get(baselineRevision);
      if (!source) throw Object.assign(new Error("BASELINE_CHANGED: \u8BF7\u91CD\u65B0\u52A0\u8F7D\u78C1\u76D8\u72B6\u6001"), { status: 409 });
      const submitted = reconcileEdits(source, input);
      const invalid = submitted.issues.filter(
        (i) => !["\u5BF9\u8C61\u6216\u5B57\u6BB5\u5DF2\u5220\u9664", "\u4EE3\u7801\u9ED8\u8BA4\u503C\u5DF2\u6539\u53D8\uFF0C\u91C7\u7528\u4EE3\u7801\u503C"].includes(i.reason)
      );
      if (invalid.length) {
        throw Object.assign(new Error(invalid.map((i) => i.reason).join("; ")), { status: 422 });
      }
      const result = reconcileEdits(previous.baseline, submitted.edits);
      result.issues = [...submitted.issues, ...result.issues];
      const text = JSON.stringify(result.edits, null, 2) + "\n";
      if (Buffer.byteLength(text) > LIMIT) {
        throw Object.assign(new Error("STATE_TOO_LARGE"), { status: 413 });
      }
      await mkdir2(dataRoot, { recursive: true });
      const temporary = `${file}.${randomUUID()}.tmp`;
      try {
        await writeFile(temporary, text, "utf8");
        if ((await read(resolveBaseline)).revision !== expected) {
          throw Object.assign(new Error("STATE_CONFLICT"), { status: 409 });
        }
        await rename(temporary, file);
      } finally {
        await rm(temporary, { force: true });
      }
      return { revision: revision(text), edits: result.edits, issues: result.issues };
    });
    queue = operation;
    return operation;
  }
  return { read, save, file };
}
function stateMiddleware(store, browserBaseline) {
  return async (req, res, next = () => {
    res.writeHead(404);
    res.end();
  }) => {
    if (!req.url?.startsWith("/__edit3d/")) {
      return next();
    }
    const json = (status, value) => {
      res.writeHead(status, { "Content-Type": "application/json", "Cache-Control": "no-store" });
      res.end(JSON.stringify(value));
    };
    try {
      const host = req.headers.host ?? "";
      if (!/^(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/.test(host)) {
        return json(403, { error: "INVALID_HOST" });
      }
      if (req.url === "/__edit3d/state" && req.method === "GET") {
        return json(200, await store.read());
      }
      if (!(req.url === "/__edit3d/state" && req.method === "PUT" || browserBaseline && req.url === "/__edit3d/initialize" && req.method === "POST")) {
        return json(404, { error: "NOT_FOUND" });
      }
      if (req.headers.origin !== `http://${host}` || req.headers["x-edit3d-request"] !== "1" || !req.headers["content-type"]?.startsWith("application/json")) {
        return json(403, { error: "SAME_ORIGIN_REQUIRED" });
      }
      if (Number(req.headers["content-length"]) > LIMIT) {
        req.resume();
        return json(413, { error: "STATE_TOO_LARGE" });
      }
      const chunks = [];
      let size = 0;
      for await (const chunk of req) {
        size += chunk.length;
        if (size > LIMIT) {
          return json(413, { error: "STATE_TOO_LARGE" });
        }
        chunks.push(chunk);
      }
      const input = JSON.parse(Buffer.concat(chunks).toString("utf8"));
      if (req.url === "/__edit3d/initialize") {
        browserBaseline.initialize(input);
        return json(200, await store.read());
      }
      return json(
        200,
        await store.save(
          input.revision,
          input.edits,
          input.baselineRevision,
          browserBaseline ? () => browserBaseline.forSave(input.codeRevision, input.baselineRevision) : void 0
        )
      );
    } catch (error) {
      json(error.status ?? (error instanceof SyntaxError ? 422 : 500), { error: error.message });
    }
  };
}
var mime = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".woff2": "font/woff2"
};
async function canonicalDirectory(directory) {
  let parent = resolve2(directory);
  const suffix = [];
  while (true) {
    try {
      return join3(await realpath2(parent), ...suffix.reverse());
    } catch (error) {
      if (error.code !== "ENOENT" || dirname2(parent) === parent) throw error;
      suffix.push(basename(parent));
      parent = dirname2(parent);
    }
  }
}
async function serveProject({ publicDir, dataDir, baseline, codeRevision: codeRevision2, port: port2 = 0 }) {
  const browserBaseline = codeRevision2 ? createBrowserBaseline(codeRevision2) : null;
  const base = await realpath2(publicDir), dataRoot = await canonicalDirectory(dataDir), store = createStateStore(dataRoot, browserBaseline ? browserBaseline.get : async () => baseline), api = stateMiddleware(store, browserBaseline), runtimeDirectory = join3(base, MODEL_RUNTIME_PATH.slice(1)), runtime = modelRuntimeMiddleware(runtimeDirectory), modelImport = modelImportMiddleware(runtimeDirectory);
  const dataPath = relative2(base, dataRoot);
  if (!isAbsolute2(dataPath) && dataPath !== ".." && !dataPath.startsWith(".." + sep2)) {
    throw new Error("DATA_DIRECTORY_MUST_BE_OUTSIDE_PUBLIC");
  }
  const middleware = (req, res, next) => runtime(req, res, () => modelImport(req, res, () => api(req, res, next)));
  const server2 = createServer((req, res) => {
    middleware(req, res, async () => {
      try {
        if (!["GET", "HEAD"].includes(req.method)) {
          res.writeHead(405);
          res.end();
          return;
        }
        const pathname = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
        const file = await realpath2(resolve2(base, "." + (pathname === "/" ? "/index.html" : pathname)));
        const rel = relative2(base, file);
        if (isAbsolute2(rel) || rel === ".." || rel.startsWith(".." + sep2) || !(await stat2(file)).isFile()) {
          res.writeHead(403);
          res.end();
          return;
        }
        const content = req.method === "HEAD" ? void 0 : await readFile2(file);
        res.writeHead(200, {
          "Content-Type": mime[extname(file)] ?? "application/octet-stream",
          "Cache-Control": "no-cache"
        });
        res.end(content);
      } catch {
        res.writeHead(404);
        res.end("Not found");
      }
    });
  });
  await new Promise((done, reject) => {
    server2.once("error", reject);
    server2.listen(port2, "127.0.0.1", done);
  });
  console.log(`Edit3D: http://localhost:${server2.address().port}/`);
  return { server: server2, store };
}

// C:/Users/86189/.cache/3d-editor/7735fd1ed8fb7299d1af1eeaa70127521e162c7435f574b84a9106f9b93fbc1a/node_modules/@edit3d/cli/dist/service-paths.js
import { dirname as dirname3, resolve as resolve3 } from "node:path";
import { fileURLToPath as fileURLToPath2 } from "node:url";
function servicePaths(entryUrl, dataDirectory) {
  const root = dirname3(fileURLToPath2(entryUrl));
  return {
    publicDir: resolve3(root, "public"),
    runtimeFile: resolve3(root, "project-runtime.json"),
    dataDir: dataDirectory ? resolve3(dataDirectory) : resolve3(root, "data")
  };
}

// C:/Users/86189/.cache/3d-editor/7735fd1ed8fb7299d1af1eeaa70127521e162c7435f574b84a9106f9b93fbc1a/node_modules/@edit3d/cli/dist/service-entry.js
var { values } = parseArgs({ options: { port: { type: "string" }, "data-dir": { type: "string" } } });
var port = values.port === void 0 ? 0 : Number(values.port);
if (values.port !== void 0 && (!/^\d+$/.test(values.port) || !Number.isInteger(port) || port < 1 || port > 65535)) {
  throw new Error("INVALID_PORT");
}
var paths = servicePaths(import.meta.url, values["data-dir"]);
var { codeRevision } = JSON.parse(await readFile3(paths.runtimeFile, "utf8"));
var { server } = await serveProject({ ...paths, codeRevision, port });
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.once(signal, () => {
    server.close();
    server.closeAllConnections();
  });
}
