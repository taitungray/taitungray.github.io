/**
 * Firebase Analytics wrapper（對齊 IncenseAshes GameAnalytics）
 * measurementId 未設定或 SDK 未就緒時安全略過。
 */

const META_KEY = "idiom-analytics-meta";

let analyticsInstance = null;
let logEventFn = null;
let setUserIdFn = null;
let warnedMissing = false;

function readMeta() {
  try {
    const raw = localStorage.getItem(META_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch (_error) {
    return {};
  }
}

function writeMeta(meta) {
  try {
    localStorage.setItem(META_KEY, JSON.stringify(meta));
  } catch (_error) {
    /* ignore quota / private mode */
  }
}

function analyticsReady() {
  return Boolean(analyticsInstance && typeof logEventFn === "function");
}

function todayKey() {
  const d = new Date();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${month}-${day}`;
}

function sanitizeEventName(name) {
  return String(name || "event")
    .replace(/[^a-zA-Z0-9_]/g, "_")
    .slice(0, 40) || "event";
}

function sanitizeParams(data) {
  const out = {};
  if (!data || typeof data !== "object") return out;
  Object.keys(data).forEach((key) => {
    const value = data[key];
    if (value == null) return;
    const safeKey = String(key).replace(/[^a-zA-Z0-9_]/g, "_").slice(0, 40);
    if (!safeKey) return;
    if (typeof value === "number" && Number.isFinite(value)) {
      out[safeKey] = value;
      return;
    }
    if (typeof value === "boolean") {
      out[safeKey] = value ? 1 : 0;
      return;
    }
    if (typeof value === "string") {
      out[safeKey] = value.slice(0, 100);
    }
  });
  return out;
}

export function bindFirebaseAnalytics(instance, analyticsModule) {
  analyticsInstance = instance || null;
  logEventFn = analyticsModule?.logEvent || null;
  setUserIdFn = analyticsModule?.setUserId || null;
  if (typeof window !== "undefined") {
    window.fbAnalytics = analyticsInstance;
  }
}

function log(name, params) {
  if (!analyticsReady()) {
    if (!warnedMissing) {
      warnedMissing = true;
    }
    return false;
  }
  try {
    logEventFn(analyticsInstance, sanitizeEventName(name), sanitizeParams(params));
    return true;
  } catch (error) {
    console.warn("[Analytics] logEvent 失敗", error);
    return false;
  }
}

function identify(uid) {
  if (!analyticsReady() || typeof setUserIdFn !== "function") return false;
  try {
    if (uid) {
      setUserIdFn(analyticsInstance, String(uid).slice(0, 256));
    } else {
      setUserIdFn(analyticsInstance, null);
    }
    return true;
  } catch (error) {
    console.warn("[Analytics] setUserId 失敗", error);
    return false;
  }
}

function noteAppOpen() {
  const meta = readMeta();
  const today = todayKey();
  let changed = false;

  if (!meta.firstLaunchAt) {
    meta.firstLaunchAt = Date.now();
    log("first_launch", { date: today });
    changed = true;
  }

  if (meta.lastDailyActiveDate !== today) {
    meta.lastDailyActiveDate = today;
    log("daily_active", { date: today });
    changed = true;
  }

  if (changed) writeMeta(meta);
  return true;
}

export const GameAnalytics = {
  log,
  identify,
  noteAppOpen
};

if (typeof window !== "undefined") {
  window.GameAnalytics = GameAnalytics;
}
