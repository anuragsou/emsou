const http = require("node:http");
const fs = require("node:fs/promises");
const path = require("node:path");
const crypto = require("node:crypto");

loadDotEnv();

const ROOT_DIR = __dirname;
const DATA_DIR = path.join(ROOT_DIR, "data");
const SESSION_COOKIE = "emsou_session";
const SESSION_TTL_MS = 1000 * 60 * 60 * 12;
const PORT = Number(process.env.PORT || "3000");
const SESSION_SECRET = process.env.SESSION_SECRET || "842a209c2526e92589c5df0022fde3da66da50641f3c908647a1c4da579a511b";
const MAX_BODY_BYTES = 1024 * 1024;

const STATIC_FILES = new Map([
  ["/", { file: "index.html", contentType: "text/html; charset=utf-8" }],
  ["/index.html", { file: "index.html", contentType: "text/html; charset=utf-8" }],
  ["/styles.css", { file: "styles.css", contentType: "text/css; charset=utf-8" }],
  ["/app.js", { file: "app.js", contentType: "application/javascript; charset=utf-8" }]
]);

const FEATURE_ROADMAP = [
  {
    title: "Role-Based Access",
    copy: "Separate admin, HR, finance, and manager permissions so sensitive decisions and salary data stay tightly controlled.",
    tag: "Access Control"
  },
  {
    title: "Payroll and Attendance Sync",
    copy: "Pull leave, attendance, payroll, and shift signals from your real systems so the dashboard stays current automatically.",
    tag: "Integrations"
  },
  {
    title: "AI Review Assistant",
    copy: "Generate balanced quarterly review drafts, talking points, recognition notes, and intervention plans from actual employee data.",
    tag: "Review Intelligence"
  },
  {
    title: "Fairness Audit Trail",
    copy: "Track compensation, promotion, demotion, and termination decisions with policy checks and history for compliance reviews.",
    tag: "Governance"
  }
];

const DEFAULT_USERS = [
  {
    id: "user-admin-001",
    name: "EMSOU Admin",
    email: "admin@emsou.local",
    role: "Admin",
    salt: "6e5aa52287565b2d2685cf52b0125b91",
    passwordHash: "646f282b7111236e888816e17da8a6f8556d849a7a2b1f8638403c8f0bc166280a7cf64373cc82c6478cd1d490be62a6b142e1e5b645520a6157532ce7ddd0f3",
    createdAt: "2026-03-24T08:00:00.000Z"
  }
];

const DEFAULT_AUDIT_LOG = [
  {
    id: "audit-001",
    action: "System seeded",
    detail: "Initial workforce dataset and admin account were created.",
    actor: "EMSOU System",
    createdAt: "2026-03-24T08:00:00.000Z"
  },
  {
    id: "audit-002",
    action: "Review cycle prepared",
    detail: "Quarter review workflows and management scorecards were staged for launch.",
    actor: "EMSOU Admin",
    createdAt: "2026-03-24T12:30:00.000Z"
  }
];

async function ensureDataFiles() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await ensureJsonFile("users.json", DEFAULT_USERS);
  await ensureJsonFile("employees.json", []);
  await ensureJsonFile("audit-log.json", DEFAULT_AUDIT_LOG);
  await ensureSeedData("users.json", DEFAULT_USERS);
  await ensureSeedData("audit-log.json", DEFAULT_AUDIT_LOG);
}

async function ensureJsonFile(fileName, fallback) {
  const filePath = await resolveDataFilePath(fileName);

  try {
    await fs.access(filePath);
  } catch (error) {
    await writeJsonToPath(filePath, fallback);
  }
}

async function ensureSeedData(fileName, fallback) {
  const data = await readJson(fileName);
  if (!Array.isArray(data) || data.length === 0) {
    await writeJson(fileName, fallback);
  }
}

async function readJson(fileName) {
  const filePath = await resolveDataFilePath(fileName);
  const fileContents = await fs.readFile(filePath, "utf8");
  return JSON.parse(fileContents);
}

async function writeJson(fileName, data) {
  const filePath = await resolveDataFilePath(fileName);
  await writeJsonToPath(filePath, data);
}

async function resolveDataFilePath(fileName) {
  const preferredPath = path.join(DATA_DIR, fileName);
  const legacyRootPath = path.join(ROOT_DIR, fileName);

  try {
    await fs.access(preferredPath);
    return preferredPath;
  } catch (error) {}

  try {
    await fs.access(legacyRootPath);
    return legacyRootPath;
  } catch (error) {}

  return preferredPath;
}

async function writeJsonToPath(filePath, data) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const tempFilePath = `${filePath}.tmp`;
  const payload = `${JSON.stringify(data, null, 2)}\n`;

  await fs.writeFile(tempFilePath, payload, "utf8");
  await fs.rename(tempFilePath, filePath);
}

function loadDotEnv() {
  const envPath = path.join(__dirname, ".env");

  try {
    const contents = require("node:fs").readFileSync(envPath, "utf8");
    const lines = contents.split(/\r?\n/);

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line || line.startsWith("#")) {
        continue;
      }

      const equalsIndex = line.indexOf("=");
      if (equalsIndex === -1) {
        continue;
      }

      const key = line.slice(0, equalsIndex).trim();
      const value = line.slice(equalsIndex + 1).trim().replace(/^"(.*)"$/, "$1");
      if (!process.env[key]) {
        process.env[key] = value;
      }
    }
  } catch (error) {
    if (error.code !== "ENOENT") {
      throw error;
    }
  }
}

function sendJson(response, statusCode, payload, extraHeaders = {}) {
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    ...extraHeaders
  });
  response.end(JSON.stringify(payload));
}

async function sendStaticFile(response, filePath, contentType) {
  try {
    const contents = await fs.readFile(filePath);
    response.writeHead(200, {
      "Content-Type": contentType,
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff"
    });
    response.end(contents);
  } catch (error) {
    sendJson(response, 404, { error: "File not found." });
  }
}

function parseCookies(cookieHeader = "") {
  return cookieHeader
    .split(";")
    .map((segment) => segment.trim())
    .filter(Boolean)
    .reduce((cookies, segment) => {
      const separatorIndex = segment.indexOf("=");
      if (separatorIndex === -1) {
        return cookies;
      }

      const name = segment.slice(0, separatorIndex).trim();
      const value = segment.slice(separatorIndex + 1).trim();
      cookies[name] = decodeURIComponent(value);
      return cookies;
    }, {});
}

function base64UrlEncode(value) {
  return Buffer.from(value, "utf8").toString("base64url");
}

function base64UrlDecode(value) {
  return Buffer.from(value, "base64url").toString("utf8");
}

function createSessionToken(userId) {
  const payload = {
    sub: userId,
    exp: Date.now() + SESSION_TTL_MS
  };

  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signature = crypto
    .createHmac("sha256", SESSION_SECRET)
    .update(encodedPayload)
    .digest("base64url");

  return `${encodedPayload}.${signature}`;
}

function verifySessionToken(token) {
  if (!token || !token.includes(".")) {
    return null;
  }

  const [encodedPayload, providedSignature] = token.split(".");
  const expectedSignature = crypto
    .createHmac("sha256", SESSION_SECRET)
    .update(encodedPayload)
    .digest("base64url");

  try {
    if (!crypto.timingSafeEqual(Buffer.from(providedSignature), Buffer.from(expectedSignature))) {
      return null;
    }
  } catch (error) {
    return null;
  }

  try {
    const payload = JSON.parse(base64UrlDecode(encodedPayload));
    if (!payload.sub || !payload.exp || payload.exp < Date.now()) {
      return null;
    }
    return payload;
  } catch (error) {
    return null;
  }
}

function clearSessionCookie() {
  return `${SESSION_COOKIE}=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0`;
}

function createSessionCookie(token) {
  return `${SESSION_COOKIE}=${encodeURIComponent(token)}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${Math.floor(
    SESSION_TTL_MS / 1000
  )}`;
}

async function parseBody(request) {
  const chunks = [];
  let totalBytes = 0;

  for await (const chunk of request) {
    totalBytes += chunk.length;
    if (totalBytes > MAX_BODY_BYTES) {
      throw new Error("Request body is too large.");
    }
    chunks.push(chunk);
  }

  if (!chunks.length) {
    return {};
  }

  const bodyText = Buffer.concat(chunks).toString("utf8");
  return JSON.parse(bodyText);
}

function sanitizeUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role
  };
}

function hashPassword(password, salt) {
  return crypto.scryptSync(password, salt, 64).toString("hex");
}

function verifyPassword(password, user) {
  const computedHash = hashPassword(password, user.salt);
  return crypto.timingSafeEqual(Buffer.from(computedHash), Buffer.from(user.passwordHash));
}

async function getAuthenticatedUser(request) {
  const cookies = parseCookies(request.headers.cookie);
  const token = cookies[SESSION_COOKIE];
  const payload = verifySessionToken(token);

  if (!payload) {
    return null;
  }

  const users = await readJson("users.json");
  return users.find((user) => user.id === payload.sub) || null;
}

function toNumber(value, min, max) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    throw new Error("Numeric fields must contain valid numbers.");
  }

  return Math.max(min, Math.min(max, Math.round(number)));
}

function normalizeString(value, fieldName) {
  const normalized = String(value || "").trim();
  if (!normalized) {
    throw new Error(`${fieldName} is required.`);
  }
  return normalized;
}

function normalizeOptionalString(value, fallback = "") {
  const normalized = String(value || "").trim();
  return normalized || fallback;
}

function defaultEmailFromName(name) {
  return String(name || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ".")
    .replace(/^\.+|\.+$/g, "")
    .concat("@emsou.local");
}

function defaultPhotoFromName(name) {
  return `https://api.dicebear.com/9.x/adventurer/svg?seed=${encodeURIComponent(name || "EMSOU")}`;
}

function toIsoDate(value, fallback = "") {
  const normalized = String(value || "").trim();
  if (!normalized) {
    return fallback;
  }

  const timestamp = new Date(normalized);
  if (Number.isNaN(timestamp.getTime())) {
    return fallback;
  }

  return timestamp.toISOString().slice(0, 10);
}

function shiftIsoDate(value, days) {
  const baseDate = value ? new Date(value) : new Date();
  if (Number.isNaN(baseDate.getTime())) {
    return new Date().toISOString().slice(0, 10);
  }

  baseDate.setUTCDate(baseDate.getUTCDate() + days);
  return baseDate.toISOString().slice(0, 10);
}

function optionalNumber(value, fallback, min, max) {
  if (value === "" || value === null || value === undefined) {
    return fallback;
  }

  const number = Number(value);
  if (!Number.isFinite(number)) {
    return fallback;
  }

  return Math.max(min, Math.min(max, Math.round(number)));
}

function defaultSalaryForEmployee(employee) {
  const departmentBase = {
    Engineering: 1650000,
    Design: 1350000,
    Finance: 1450000,
    Sales: 1250000,
    "People Ops": 1400000,
    Strategy: 1550000,
    Support: 980000,
    Marketing: 1180000,
    Success: 1120000
  };

  const base = departmentBase[employee.department] || 1100000;
  const performanceLift = employee.performance * 4200;
  const scopeLift = employee.criticality * 45000 + employee.achievements * 22000;
  return Math.round(base + performanceLift + scopeLift);
}

function createSalaryHistoryDefaults(employee, salary, lastHikeDate, lastHikePercent) {
  const latestSalary = salary;
  const previousSalary = Math.max(500000, Math.round(latestSalary / (1 + lastHikePercent / 100)));
  const earliestSalary = Math.max(420000, Math.round(previousSalary * 0.92));

  return [
    {
      id: `${employee.id}-salary-current`,
      salary: latestSalary,
      percent: lastHikePercent,
      reason: "Latest salary review applied.",
      effectiveDate: lastHikeDate
    },
    {
      id: `${employee.id}-salary-previous`,
      salary: previousSalary,
      percent: 8,
      reason: "Previous annual compensation revision.",
      effectiveDate: shiftIsoDate(lastHikeDate, -365)
    },
    {
      id: `${employee.id}-salary-earlier`,
      salary: earliestSalary,
      percent: 6,
      reason: "Historical compensation benchmark.",
      effectiveDate: shiftIsoDate(lastHikeDate, -730)
    }
  ];
}

function sanitizeSalaryHistory(salaryHistory, employee, salary, lastHikeDate, lastHikePercent) {
  const normalizedHistory = Array.isArray(salaryHistory)
    ? salaryHistory
        .map((entry, index) => ({
          id: normalizeOptionalString(entry.id, `${employee.id}-salary-${index + 1}`),
          salary: optionalNumber(entry.salary, salary, 0, 50000000),
          percent: optionalNumber(entry.percent, lastHikePercent, -100, 100),
          reason: normalizeOptionalString(entry.reason, "Compensation update recorded."),
          effectiveDate: toIsoDate(entry.effectiveDate, lastHikeDate)
        }))
        .filter((entry) => entry.salary > 0)
    : [];

  return normalizedHistory.length ? normalizedHistory.slice(0, 8) : createSalaryHistoryDefaults(employee, salary, lastHikeDate, lastHikePercent);
}

function buildDefaultLeaveRequests(employee) {
  const leaveRequests = [];

  if (employee.availability === "On Leave") {
    const startDate = shiftIsoDate(employee.updatedAt || new Date().toISOString(), -2);
    const endDate = shiftIsoDate(startDate, 4);
    leaveRequests.push({
      id: `${employee.id}-leave-approved`,
      status: "Approved",
      startDate,
      endDate,
      days: 5,
      reason: "Approved personal leave.",
      requestedAt: `${startDate}T09:00:00.000Z`,
      decidedAt: `${shiftIsoDate(startDate, -1)}T15:30:00.000Z`,
      decidedBy: employee.manager,
      decisionNote: "Coverage confirmed and leave approved.",
      history: [
        {
          id: `${employee.id}-leave-history-approved`,
          label: "Approved",
          actor: employee.manager,
          note: "Coverage confirmed and leave approved.",
          createdAt: `${shiftIsoDate(startDate, -1)}T15:30:00.000Z`
        },
        {
          id: `${employee.id}-leave-history-requested`,
          label: "Requested",
          actor: employee.name,
          note: "Personal leave request submitted.",
          createdAt: `${shiftIsoDate(startDate, -3)}T09:15:00.000Z`
        }
      ]
    });
  }

  if (employee.availability === "Working" && employee.overtimeHours >= 16 && employee.sentiment <= 70) {
    const startDate = shiftIsoDate(employee.updatedAt || new Date().toISOString(), 5);
    const endDate = shiftIsoDate(startDate, 2);
    leaveRequests.push({
      id: `${employee.id}-leave-pending`,
      status: "Pending",
      startDate,
      endDate,
      days: 3,
      reason: "Recovery leave request after sustained overtime.",
      requestedAt: `${shiftIsoDate(startDate, -3)}T10:00:00.000Z`,
      decidedAt: "",
      decidedBy: "",
      decisionNote: "",
      history: [
        {
          id: `${employee.id}-leave-history-pending`,
          label: "Requested",
          actor: employee.name,
          note: "Requested recovery leave after sustained overtime.",
          createdAt: `${shiftIsoDate(startDate, -3)}T10:00:00.000Z`
        }
      ]
    });
  }

  return leaveRequests;
}

function sanitizeLeaveRequests(leaveRequests, employee, useDefaultLeaveRequests = true) {
  const normalizedRequests = Array.isArray(leaveRequests)
    ? leaveRequests
        .map((request, index) => {
          const startDate = toIsoDate(request.startDate, shiftIsoDate(new Date().toISOString(), 3));
          const endDate = toIsoDate(request.endDate, shiftIsoDate(startDate, 1));

          return {
            id: normalizeOptionalString(request.id, `${employee.id}-leave-${index + 1}`),
            status: ["Pending", "Approved", "Rejected"].includes(request.status) ? request.status : "Pending",
            startDate,
            endDate,
            days: optionalNumber(request.days, 1, 1, 90),
            reason: normalizeOptionalString(request.reason, "Leave request submitted."),
            requestedAt: normalizeOptionalString(request.requestedAt, new Date().toISOString()),
            decidedAt: normalizeOptionalString(request.decidedAt, ""),
            decidedBy: normalizeOptionalString(request.decidedBy, ""),
            decisionNote: normalizeOptionalString(request.decisionNote, ""),
            history: Array.isArray(request.history)
              ? request.history.map((entry, historyIndex) => ({
                  id: normalizeOptionalString(entry.id, `${employee.id}-leave-history-${index + 1}-${historyIndex + 1}`),
                  label: normalizeOptionalString(entry.label, "Updated"),
                  actor: normalizeOptionalString(entry.actor, employee.manager || "EMSOU"),
                  note: normalizeOptionalString(entry.note, ""),
                  createdAt: normalizeOptionalString(entry.createdAt, new Date().toISOString())
                }))
              : []
          };
        })
        .slice(0, 8)
    : [];

  if (normalizedRequests.length) {
    return normalizedRequests;
  }

  return useDefaultLeaveRequests ? buildDefaultLeaveRequests(employee) : [];
}

function hydrateEmployeeRecord(employee, options = {}) {
  const useDefaultLeaveRequests = options.useDefaultLeaveRequests !== false;
  const salary = optionalNumber(employee.salary, defaultSalaryForEmployee(employee), 0, 50000000);
  const lastHikePercent = optionalNumber(employee.lastHikePercent, Math.max(6, Math.round(employee.achievements * 1.4 + employee.performance * 0.04)), 0, 60);
  const lastHikeDate = toIsoDate(employee.lastHikeDate, shiftIsoDate(employee.updatedAt || new Date().toISOString(), -120));
  const nextReviewDate = toIsoDate(employee.nextReviewDate, shiftIsoDate(employee.updatedAt || new Date().toISOString(), 45));

  const hydrated = {
    ...employee,
    email: normalizeOptionalString(employee.email, defaultEmailFromName(employee.name)),
    photo: normalizeOptionalString(employee.photo, defaultPhotoFromName(employee.name)),
    salary,
    salaryCurrency: normalizeOptionalString(employee.salaryCurrency, "INR"),
    lastHikePercent,
    lastHikeDate,
    nextReviewDate
  };

  hydrated.salaryHistory = sanitizeSalaryHistory(hydrated.salaryHistory, hydrated, salary, lastHikeDate, lastHikePercent);
  hydrated.leaveRequests = sanitizeLeaveRequests(hydrated.leaveRequests, hydrated, useDefaultLeaveRequests);

  return hydrated;
}

function normalizeEmployeeInput(input, existingEmployee = null) {
  const name = normalizeString(input.name, "Name");
  const availability = normalizeString(input.availability, "Availability");
  const mode = normalizeString(input.mode, "Work mode");

  if (!["Working", "On Leave"].includes(availability)) {
    throw new Error("Availability must be either Working or On Leave.");
  }

  if (!["Remote", "Hybrid", "Onsite", "Away"].includes(mode)) {
    throw new Error("Work mode must be Remote, Hybrid, Onsite, or Away.");
  }

  return hydrateEmployeeRecord({
    ...existingEmployee,
    name,
    role: normalizeString(input.role, "Role"),
    department: normalizeString(input.department, "Department"),
    availability,
    mode,
    performance: toNumber(input.performance, 0, 100),
    submissions: toNumber(input.submissions, 0, 100),
    attendance: toNumber(input.attendance, 0, 100),
    workload: toNumber(input.workload, 0, 100),
    leaveDays: toNumber(input.leaveDays, 0, 365),
    sentiment: toNumber(input.sentiment, 0, 100),
    warnings: toNumber(input.warnings, 0, 10),
    complianceFlags: toNumber(input.complianceFlags, 0, 10),
    overtimeHours: toNumber(input.overtimeHours, 0, 200),
    achievements: toNumber(input.achievements, 0, 20),
    criticality: toNumber(input.criticality, 1, 5),
    manager: normalizeString(input.manager, "Manager"),
    email: normalizeOptionalString(input.email, existingEmployee?.email || defaultEmailFromName(name)),
    photo: normalizeOptionalString(input.photo, existingEmployee?.photo || defaultPhotoFromName(name)),
    salary: optionalNumber(input.salary, existingEmployee?.salary ?? defaultSalaryForEmployee(input), 0, 50000000),
    salaryCurrency: normalizeOptionalString(input.salaryCurrency, existingEmployee?.salaryCurrency || "INR"),
    nextReviewDate: toIsoDate(input.nextReviewDate, existingEmployee?.nextReviewDate || shiftIsoDate(new Date().toISOString(), 45)),
    lastHikePercent: optionalNumber(input.lastHikePercent, existingEmployee?.lastHikePercent ?? 8, 0, 60),
    lastHikeDate: toIsoDate(input.lastHikeDate, existingEmployee?.lastHikeDate || shiftIsoDate(new Date().toISOString(), -120)),
    salaryHistory: Array.isArray(input.salaryHistory) ? input.salaryHistory : existingEmployee?.salaryHistory,
    leaveRequests: Array.isArray(input.leaveRequests) ? input.leaveRequests : existingEmployee?.leaveRequests,
    focus: normalizeString(input.focus, "Current focus"),
    milestone: normalizeString(input.milestone, "Milestone"),
    notes: normalizeString(input.notes, "Notes")
  }, { useDefaultLeaveRequests: false });
}

function average(values) {
  if (!values.length) {
    return 0;
  }

  return values.reduce((total, value) => total + value, 0) / values.length;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function formatRelativeTime(isoString) {
  const timestamp = new Date(isoString).getTime();
  const differenceMinutes = Math.max(1, Math.round((Date.now() - timestamp) / 60000));

  if (differenceMinutes < 60) {
    return `Updated ${differenceMinutes}m ago`;
  }

  const differenceHours = Math.round(differenceMinutes / 60);
  if (differenceHours < 24) {
    return `Updated ${differenceHours}h ago`;
  }

  const differenceDays = Math.round(differenceHours / 24);
  return `Updated ${differenceDays}d ago`;
}

function burnoutRisk(employee) {
  const score =
    employee.workload * 0.42 +
    employee.overtimeHours * 1.5 +
    (100 - employee.sentiment) * 0.28 +
    (employee.leaveDays === 0 ? 8 : 0) +
    (employee.availability === "On Leave" ? -15 : 0);

  return clamp(Math.round(score), 0, 100);
}

function promotionScore(employee) {
  const score =
    employee.performance * 0.38 +
    employee.submissions * 0.24 +
    employee.attendance * 0.18 +
    employee.achievements * 4 +
    employee.criticality * 2 -
    employee.warnings * 8 -
    employee.complianceFlags * 10;

  return clamp(Math.round(score), 0, 100);
}

function disciplineRisk(employee) {
  const score =
    (100 - employee.performance) * 0.28 +
    (100 - employee.submissions) * 0.24 +
    (100 - employee.attendance) * 0.18 +
    employee.warnings * 16 +
    employee.complianceFlags * 12 -
    employee.sentiment * 0.04;

  return clamp(Math.round(score), 0, 100);
}

function hikeScore(employee) {
  const score =
    employee.performance * 0.34 +
    employee.submissions * 0.22 +
    employee.attendance * 0.14 +
    employee.achievements * 4 +
    employee.criticality * 3 -
    burnoutRisk(employee) * 0.08 -
    employee.warnings * 12;

  return clamp(Math.round(score), 0, 100);
}

function getAction(employee) {
  const burnout = burnoutRisk(employee);
  const promotion = promotionScore(employee);
  const discipline = disciplineRisk(employee);
  const hike = hikeScore(employee);

  if (discipline >= 75) {
    return {
      title: "Termination review",
      reason: "Repeated quality and compliance issues are pulling delivery reliability below safe thresholds.",
      tone: "tone-risk",
      priority: 1
    };
  }

  if (discipline >= 58) {
    return {
      title: "Demotion / PIP review",
      reason: "Performance, attendance, and submission discipline are weak enough to justify a formal intervention plan.",
      tone: "tone-leave",
      priority: 2
    };
  }

  if (promotion >= 92) {
    return {
      title: "Promotion + hike",
      reason: "Consistent output, strong attendance, and visible impact suggest readiness for the next level.",
      tone: "tone-strong",
      priority: 5
    };
  }

  if (hike >= 84) {
    return {
      title: "Compensation hike",
      reason: "High-value contribution is strong enough to reward without changing role level yet.",
      tone: "tone-strong",
      priority: 4
    };
  }

  if (burnout >= 76) {
    return {
      title: "Retention support",
      reason: "Workload and overtime are pushing burnout risk higher than healthy operating levels.",
      tone: "tone-leave",
      priority: 3
    };
  }

  if (employee.availability === "On Leave" && employee.criticality >= 4) {
    return {
      title: "Coverage backup",
      reason: "This leave window affects an important workflow and should trigger temporary ownership coverage.",
      tone: "tone-working",
      priority: 3
    };
  }

  return {
    title: "Steady monitoring",
    reason: "No urgent action is needed beyond regular feedback and goal tracking.",
    tone: "tone-working",
    priority: 6
  };
}

function enrichEmployees(employees) {
  return employees.map((employee) => {
    const hydrated = hydrateEmployeeRecord(employee);
    const burnout = burnoutRisk(hydrated);
    const promotion = promotionScore(hydrated);
    const discipline = disciplineRisk(hydrated);
    const hike = hikeScore(hydrated);
    const action = getAction(hydrated);

    return {
      ...hydrated,
      burnout,
      promotion,
      discipline,
      hike,
      action,
      lastUpdate: formatRelativeTime(hydrated.updatedAt)
    };
  });
}

function buildMetrics(enrichedEmployees) {
  const total = enrichedEmployees.length;
  const working = enrichedEmployees.filter((employee) => employee.availability === "Working").length;
  const onLeave = enrichedEmployees.filter((employee) => employee.availability === "On Leave").length;
  const attention = enrichedEmployees.filter((employee) => employee.action.priority <= 3).length;
  const submissionRhythm = Math.round(average(enrichedEmployees.map((employee) => employee.submissions)));
  const promotionReady = enrichedEmployees.filter((employee) => employee.promotion >= 90).length;

  return [
    {
      label: "Headcount",
      value: total,
      detail: "Persistent employee records with performance, leave, and delivery analytics.",
      tone: "blue"
    },
    {
      label: "Working Now",
      value: working,
      detail: "Live roster across remote, onsite, and hybrid employees.",
      tone: "green"
    },
    {
      label: "On Leave",
      value: onLeave,
      detail: "Leave coverage is tracked so managers can prepare backups.",
      tone: "gold"
    },
    {
      label: "High Attention",
      value: attention,
      detail: "Employees who need support, intervention, or workload review.",
      tone: "rose"
    },
    {
      label: "Submission Rhythm",
      value: `${submissionRhythm}%`,
      detail: "Average reporting and delivery discipline across the company.",
      tone: "orange"
    },
    {
      label: "Promotion Ready",
      value: promotionReady,
      detail: "Employees showing strong signals for growth and rewards.",
      tone: "teal"
    }
  ];
}

function buildCapacity(enrichedEmployees) {
  const groups = new Map();

  for (const employee of enrichedEmployees) {
    if (!groups.has(employee.department)) {
      groups.set(employee.department, []);
    }
    groups.get(employee.department).push(employee);
  }

  return [...groups.entries()].map(([department, members]) => {
    const working = members.filter((employee) => employee.availability === "Working").length;
    const onLeave = members.filter((employee) => employee.availability === "On Leave").length;
    const avgWorkload = Math.round(average(members.map((employee) => employee.workload)));
    const avgSubmission = Math.round(average(members.map((employee) => employee.submissions)));
    const capacity = clamp(Math.round((working / members.length) * 100 - avgWorkload * 0.16), 18, 100);

    let label = "Stable";
    if (onLeave > 0 && avgWorkload > 80) {
      label = "Fragile";
    } else if (avgWorkload > 86) {
      label = "Pressure";
    } else if (avgSubmission > 92) {
      label = "High flow";
    }

    return {
      department,
      onLeave,
      avgWorkload,
      avgSubmission,
      capacity,
      label
    };
  });
}

function buildLeaveQueue(enrichedEmployees) {
  return enrichedEmployees
    .flatMap((employee) =>
      employee.leaveRequests.map((request) => ({
        ...request,
        employeeId: employee.id,
        employeeName: employee.name,
        employeeRole: employee.role,
        department: employee.department,
        photo: employee.photo
      }))
    )
    .sort((left, right) => {
      const statusWeight = { Pending: 0, Approved: 1, Rejected: 2 };
      return (
        (statusWeight[left.status] ?? 3) - (statusWeight[right.status] ?? 3) ||
        new Date(right.requestedAt).getTime() - new Date(left.requestedAt).getTime()
      );
    })
    .slice(0, 12);
}

function buildDepartmentCharts(enrichedEmployees) {
  const groups = new Map();

  for (const employee of enrichedEmployees) {
    if (!groups.has(employee.department)) {
      groups.set(employee.department, []);
    }
    groups.get(employee.department).push(employee);
  }

  return [...groups.entries()]
    .map(([department, members]) => ({
      department,
      headcount: members.length,
      working: members.filter((employee) => employee.availability === "Working").length,
      onLeave: members.filter((employee) => employee.availability === "On Leave").length,
      avgPerformance: Math.round(average(members.map((employee) => employee.performance))),
      avgBurnout: Math.round(average(members.map((employee) => employee.burnout))),
      avgSalary: Math.round(average(members.map((employee) => employee.salary))),
      avgHike: Math.round(average(members.map((employee) => employee.lastHikePercent)))
    }))
    .sort((left, right) => right.headcount - left.headcount);
}

function buildSalaryInsights(enrichedEmployees) {
  const payroll = enrichedEmployees.reduce((total, employee) => total + employee.salary, 0);
  const avgSalary = Math.round(average(enrichedEmployees.map((employee) => employee.salary)));
  const topPaid = [...enrichedEmployees]
    .sort((left, right) => right.salary - left.salary)
    .slice(0, 4)
    .map((employee) => ({
      id: employee.id,
      name: employee.name,
      department: employee.department,
      salary: employee.salary,
      currency: employee.salaryCurrency,
      lastHikePercent: employee.lastHikePercent
    }));
  const reviewSoon = [...enrichedEmployees]
    .sort((left, right) => String(left.nextReviewDate).localeCompare(String(right.nextReviewDate)))
    .slice(0, 4)
    .map((employee) => ({
      id: employee.id,
      name: employee.name,
      department: employee.department,
      nextReviewDate: employee.nextReviewDate,
      salary: employee.salary,
      currency: employee.salaryCurrency
    }));

  return {
    payroll,
    avgSalary,
    topPaid,
    reviewSoon
  };
}

function calculateLeaveDays(startDate, endDate) {
  const start = new Date(startDate);
  const end = new Date(endDate);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return 1;
  }

  const difference = Math.round((end.getTime() - start.getTime()) / 86400000) + 1;
  return Math.max(1, difference);
}

function isDateInsideLeaveWindow(dateString, startDate, endDate) {
  const date = new Date(dateString);
  const start = new Date(startDate);
  const end = new Date(endDate);
  return date >= start && date <= end;
}

function listNames(collection) {
  return collection.map((employee) => employee.name).join(", ");
}

function answerWorkforceQuestion(rawQuestion, enrichedEmployees) {
  const query = String(rawQuestion || "").trim().toLowerCase();
  const working = enrichedEmployees.filter((employee) => employee.availability === "Working");
  const onLeave = enrichedEmployees.filter((employee) => employee.availability === "On Leave");
  const topPerformer = [...enrichedEmployees].sort((left, right) => right.performance - left.performance)[0];
  const topRisk = [...enrichedEmployees].sort((left, right) => right.discipline - left.discipline)[0];
  const avgSubmission = Math.round(average(enrichedEmployees.map((employee) => employee.submissions)));

  const summary = `${working.length} employees are working, ${onLeave.length} are on leave, and the average submission rhythm is ${avgSubmission}%. ${topPerformer.name} is leading delivery, while ${topRisk.name} needs the closest management review.`;

  if (!query || query.includes("summary") || query.includes("overview") || query.includes("track")) {
    return summary;
  }

  if (query.includes("leave")) {
    if (!onLeave.length) {
      return "Nobody is currently on leave in this workforce snapshot. Capacity is fully available right now.";
    }

    const highestImpact = [...onLeave].sort((left, right) => right.criticality - left.criticality)[0];
    return `${listNames(onLeave)} are currently on leave. ${highestImpact.name} has the highest leave impact based on role criticality.`;
  }

  if (query.includes("working")) {
    const busiest = [...working].sort((left, right) => right.workload - left.workload).slice(0, 3);
    return `${working.length} people are actively working. The heaviest workloads currently belong to ${listNames(busiest)}.`;
  }

  if (query.includes("submission") || query.includes("delivery")) {
    const leaders = [...enrichedEmployees].sort((left, right) => right.submissions - left.submissions).slice(0, 3);
    const laggards = [...enrichedEmployees].sort((left, right) => left.submissions - right.submissions).slice(0, 2);
    return `Submission leaders are ${listNames(leaders)}. The weakest delivery discipline is showing up around ${listNames(laggards)}, so closer manager review is warranted.`;
  }

  if (query.includes("hike") || query.includes("raise") || query.includes("promotion") || query.includes("promote")) {
    const candidates = enrichedEmployees
      .filter((employee) => employee.action.title === "Promotion + hike" || employee.action.title === "Compensation hike")
      .sort((left, right) => right.hike - left.hike)
      .slice(0, 3);

    if (!candidates.length) {
      return "There are no strong reward candidates in the current data snapshot yet.";
    }

    return `${listNames(candidates)} are the strongest hike or promotion candidates based on output, attendance, and business impact.`;
  }

  if (query.includes("burnout") || query.includes("stress") || query.includes("retention")) {
    const candidates = enrichedEmployees
      .filter((employee) => employee.burnout >= 74)
      .sort((left, right) => right.burnout - left.burnout)
      .slice(0, 3);

    if (!candidates.length) {
      return "Burnout risk looks controlled right now. Nobody is above the alert threshold.";
    }

    return `${listNames(candidates)} are showing the strongest burnout signals through workload, overtime, and sentiment trends.`;
  }

  if (query.includes("fire") || query.includes("terminate") || query.includes("demote") || query.includes("attention")) {
    const candidates = enrichedEmployees
      .filter((employee) => ["Demotion / PIP review", "Termination review"].includes(employee.action.title))
      .sort((left, right) => right.discipline - left.discipline)
      .slice(0, 2);

    if (!candidates.length) {
      return "Nobody currently crosses the threshold for formal demotion or termination review, but regular coaching should continue.";
    }

    return `${listNames(candidates)} require formal performance review. These suggestions are advisory only and should be validated with policy, context, and manager feedback.`;
  }

  return `${summary} Ask about leave, working status, submissions, hikes, burnout, or intervention risk for sharper answers.`;
}

function buildDashboardPayload(user, employees, auditLog) {
  const enrichedEmployees = enrichEmployees(employees);
  const decisions = [...enrichedEmployees]
    .sort((left, right) => left.action.priority - right.action.priority || right.promotion - left.promotion)
    .slice(0, 6);

  return {
    user: sanitizeUser(user),
    executiveSummary: answerWorkforceQuestion("summary", enrichedEmployees),
    employees: enrichedEmployees,
    metrics: buildMetrics(enrichedEmployees),
    decisions,
    capacity: buildCapacity(enrichedEmployees),
    leaveQueue: buildLeaveQueue(enrichedEmployees),
    departmentCharts: buildDepartmentCharts(enrichedEmployees),
    salaryInsights: buildSalaryInsights(enrichedEmployees),
    departments: ["All", ...new Set(enrichedEmployees.map((employee) => employee.department))],
    auditLog: auditLog.slice(0, 8),
    featureRoadmap: FEATURE_ROADMAP
  };
}

async function appendAuditEntry(action, detail, actor) {
  const auditLog = await readJson("audit-log.json");
  auditLog.unshift({
    id: `audit-${crypto.randomUUID()}`,
    action,
    detail,
    actor,
    createdAt: new Date().toISOString()
  });

  await writeJson("audit-log.json", auditLog.slice(0, 50));
}

async function handleApiRequest(request, response, url) {
  if (request.method === "GET" && url.pathname === "/api/auth/session") {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return sendJson(response, 401, { error: "No active session." });
    }

    return sendJson(response, 200, {
      user: sanitizeUser(user)
    });
  }

  if (request.method === "POST" && url.pathname === "/api/auth/login") {
    const body = await parseBody(request);
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");
    const users = await readJson("users.json");
    const user = users.find((candidate) => candidate.email.toLowerCase() === email);

    if (!user || !verifyPassword(password, user)) {
      return sendJson(response, 401, { error: "Invalid email or password." });
    }

    const token = createSessionToken(user.id);
    await appendAuditEntry("Login", `${user.name} signed into EMSOU.`, user.name);

    return sendJson(
      response,
      200,
      {
        user: sanitizeUser(user)
      },
      { "Set-Cookie": createSessionCookie(token) }
    );
  }

  if (request.method === "POST" && url.pathname === "/api/auth/logout") {
    return sendJson(response, 200, { success: true }, { "Set-Cookie": clearSessionCookie() });
  }

  const user = await getAuthenticatedUser(request);
  if (!user) {
    return sendJson(response, 401, { error: "Authentication required." });
  }

  if (request.method === "GET" && url.pathname === "/api/dashboard") {
    const employees = await readJson("employees.json");
    const auditLog = await readJson("audit-log.json");
    return sendJson(response, 200, buildDashboardPayload(user, employees, auditLog));
  }

  if (request.method === "POST" && url.pathname === "/api/employees") {
    const body = await parseBody(request);
    const employees = await readJson("employees.json");
    const employee = normalizeEmployeeInput(body);
    const now = new Date().toISOString();
    const record = {
      id: `emp-${crypto.randomUUID()}`,
      ...employee,
      createdAt: now,
      updatedAt: now
    };

    employees.unshift(record);
    await writeJson("employees.json", employees);
    await appendAuditEntry("Employee created", `${record.name} was added to the workforce database.`, user.name);

    return sendJson(response, 201, { employee: record });
  }

  if (request.method === "POST" && /^\/api\/employees\/[^/]+\/leave-requests$/.test(url.pathname)) {
    const employeeId = url.pathname.split("/")[3];
    const body = await parseBody(request);
    const employees = await readJson("employees.json");
    const employeeIndex = employees.findIndex((employee) => employee.id === employeeId);

    if (employeeIndex === -1) {
      return sendJson(response, 404, { error: "Employee not found." });
    }

    const employee = hydrateEmployeeRecord(employees[employeeIndex]);
    const now = new Date().toISOString();
    const startDate = toIsoDate(body.startDate, shiftIsoDate(now, 7));
    const endDate = toIsoDate(body.endDate, shiftIsoDate(startDate, 1));
    const leaveRequest = {
      id: `leave-${crypto.randomUUID()}`,
      status: "Pending",
      startDate,
      endDate,
      days: optionalNumber(body.days, calculateLeaveDays(startDate, endDate), 1, 90),
      reason: normalizeString(body.reason, "Leave reason"),
      requestedAt: now,
      decidedAt: "",
      decidedBy: "",
      decisionNote: "",
      history: [
        {
          id: `leave-history-${crypto.randomUUID()}`,
          label: "Requested",
          actor: user.name,
          note: normalizeOptionalString(body.reason, "Leave request submitted."),
          createdAt: now
        }
      ]
    };

    const updatedRecord = {
      ...employee,
      leaveRequests: [leaveRequest, ...employee.leaveRequests].slice(0, 8),
      updatedAt: now
    };

    employees[employeeIndex] = updatedRecord;
    await writeJson("employees.json", employees);
    await appendAuditEntry("Leave request created", `${employee.name} leave request was created for ${leaveRequest.startDate} to ${leaveRequest.endDate}.`, user.name);

    return sendJson(response, 201, { employee: updatedRecord, leaveRequest });
  }

  if (request.method === "POST" && /^\/api\/employees\/[^/]+\/leave-requests\/[^/]+\/action$/.test(url.pathname)) {
    const [, , , employeeId, , requestId] = url.pathname.split("/");
    const body = await parseBody(request);
    const employees = await readJson("employees.json");
    const employeeIndex = employees.findIndex((employee) => employee.id === employeeId);

    if (employeeIndex === -1) {
      return sendJson(response, 404, { error: "Employee not found." });
    }

    const employee = hydrateEmployeeRecord(employees[employeeIndex]);
    const requestIndex = employee.leaveRequests.findIndex((request) => request.id === requestId);

    if (requestIndex === -1) {
      return sendJson(response, 404, { error: "Leave request not found." });
    }

    const nextStatus = String(body.status || "").trim();
    if (!["Approved", "Rejected"].includes(nextStatus)) {
      return sendJson(response, 400, { error: "Leave action must be Approved or Rejected." });
    }

    const currentRequest = employee.leaveRequests[requestIndex];
    if (currentRequest.status !== "Pending") {
      return sendJson(response, 400, { error: "Only pending leave requests can be actioned." });
    }

    const now = new Date().toISOString();
    const updatedRequest = {
      ...currentRequest,
      status: nextStatus,
      decidedAt: now,
      decidedBy: user.name,
      decisionNote: normalizeOptionalString(body.note, nextStatus === "Approved" ? "Leave approved." : "Leave rejected."),
      history: [
        {
          id: `leave-history-${crypto.randomUUID()}`,
          label: nextStatus,
          actor: user.name,
          note: normalizeOptionalString(body.note, nextStatus === "Approved" ? "Leave approved." : "Leave rejected."),
          createdAt: now
        },
        ...currentRequest.history
      ].slice(0, 10)
    };

    const nextLeaveDays =
      nextStatus === "Approved"
        ? clamp(employee.leaveDays + updatedRequest.days, 0, 365)
        : employee.leaveDays;

    const updatedRecord = {
      ...employee,
      availability:
        nextStatus === "Approved" && isDateInsideLeaveWindow(now, updatedRequest.startDate, updatedRequest.endDate)
          ? "On Leave"
          : employee.availability,
      leaveDays: nextLeaveDays,
      leaveRequests: employee.leaveRequests.map((request, index) => (index === requestIndex ? updatedRequest : request)),
      updatedAt: now
    };

    employees[employeeIndex] = updatedRecord;
    await writeJson("employees.json", employees);
    await appendAuditEntry(
      `Leave request ${nextStatus.toLowerCase()}`,
      `${employee.name} leave request for ${updatedRequest.startDate} to ${updatedRequest.endDate} was ${nextStatus.toLowerCase()}.`,
      user.name
    );

    return sendJson(response, 200, { employee: updatedRecord, leaveRequest: updatedRequest });
  }

  if (request.method === "PUT" && url.pathname.startsWith("/api/employees/")) {
    const employeeId = url.pathname.slice("/api/employees/".length);
    const body = await parseBody(request);
    const employees = await readJson("employees.json");
    const employeeIndex = employees.findIndex((employee) => employee.id === employeeId);

    if (employeeIndex === -1) {
      return sendJson(response, 404, { error: "Employee not found." });
    }

    const existingEmployee = hydrateEmployeeRecord(employees[employeeIndex]);
    const normalized = normalizeEmployeeInput(body, existingEmployee);
    const previousSalary = existingEmployee.salary;
    const updatedRecord = {
      ...existingEmployee,
      ...normalized,
      updatedAt: new Date().toISOString()
    };

    if (updatedRecord.salary !== previousSalary) {
      const salaryChangePercent = previousSalary
        ? Math.round(((updatedRecord.salary - previousSalary) / previousSalary) * 100)
        : updatedRecord.lastHikePercent;

      updatedRecord.salaryHistory = [
        {
          id: `salary-${crypto.randomUUID()}`,
          salary: updatedRecord.salary,
          percent: salaryChangePercent,
          reason: "Salary updated from the management page.",
          effectiveDate: updatedRecord.lastHikeDate || new Date().toISOString().slice(0, 10)
        },
        ...updatedRecord.salaryHistory.filter((entry) => entry.salary !== updatedRecord.salary)
      ].slice(0, 8);
    }

    employees[employeeIndex] = updatedRecord;
    await writeJson("employees.json", employees);
    await appendAuditEntry("Employee updated", `${updatedRecord.name} was updated in the workforce database.`, user.name);

    return sendJson(response, 200, { employee: updatedRecord });
  }

  if (request.method === "DELETE" && url.pathname.startsWith("/api/employees/")) {
    const employeeId = url.pathname.slice("/api/employees/".length);
    const employees = await readJson("employees.json");
    const employee = employees.find((candidate) => candidate.id === employeeId);

    if (!employee) {
      return sendJson(response, 404, { error: "Employee not found." });
    }

    const remainingEmployees = employees.filter((candidate) => candidate.id !== employeeId);
    await writeJson("employees.json", remainingEmployees);
    await appendAuditEntry("Employee deleted", `${employee.name} was removed from the workforce database.`, user.name);

    return sendJson(response, 200, { success: true });
  }

  return sendJson(response, 404, { error: "Route not found." });
}

function createApp() {
  return http.createServer(async (request, response) => {
    try {
      const url = new URL(request.url, `http://${request.headers.host || "localhost"}`);

      if ((request.method === "GET" || request.method === "HEAD") && url.pathname === "/healthz") {
        return sendJson(response, 200, {
          status: "ok",
          app: "EMSOU"
        });
      }

      if (url.pathname.startsWith("/api/")) {
        return await handleApiRequest(request, response, url);
      }

      if (request.method === "GET" || request.method === "HEAD") {
        const staticFile = STATIC_FILES.get(url.pathname);
        if (staticFile) {
          return await sendStaticFile(response, path.join(ROOT_DIR, staticFile.file), staticFile.contentType);
        }
      }

      return sendJson(response, 404, { error: "Not found." });
    } catch (error) {
      const statusCode = error instanceof SyntaxError ? 400 : 500;
      return sendJson(response, statusCode, {
        error: statusCode === 400 ? "Invalid JSON body." : error.message || "Unexpected server error."
      });
    }
  });
}

async function start() {
  await ensureDataFiles();
  const server = createApp();
  server.listen(PORT, () => {
    console.log(`EMSOU is running at http://localhost:${PORT}`);
    console.log("Browser-local smart summaries are active. No extra AI service is required.");
    console.log("Health check available at /healthz");
  });
}

if (require.main === module) {
  start().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}

module.exports = {
  createApp,
  ensureDataFiles,
  buildDashboardPayload,
  answerWorkforceQuestion
};
