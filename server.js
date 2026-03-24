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

function normalizeEmployeeInput(input) {
  const availability = normalizeString(input.availability, "Availability");
  const mode = normalizeString(input.mode, "Work mode");

  if (!["Working", "On Leave"].includes(availability)) {
    throw new Error("Availability must be either Working or On Leave.");
  }

  if (!["Remote", "Hybrid", "Onsite", "Away"].includes(mode)) {
    throw new Error("Work mode must be Remote, Hybrid, Onsite, or Away.");
  }

  return {
    name: normalizeString(input.name, "Name"),
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
    focus: normalizeString(input.focus, "Current focus"),
    milestone: normalizeString(input.milestone, "Milestone"),
    notes: normalizeString(input.notes, "Notes")
  };
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
    const burnout = burnoutRisk(employee);
    const promotion = promotionScore(employee);
    const discipline = disciplineRisk(employee);
    const hike = hikeScore(employee);
    const action = getAction(employee);

    return {
      ...employee,
      burnout,
      promotion,
      discipline,
      hike,
      action,
      lastUpdate: formatRelativeTime(employee.updatedAt)
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

  if (request.method === "PUT" && url.pathname.startsWith("/api/employees/")) {
    const employeeId = url.pathname.slice("/api/employees/".length);
    const body = await parseBody(request);
    const employees = await readJson("employees.json");
    const employeeIndex = employees.findIndex((employee) => employee.id === employeeId);

    if (employeeIndex === -1) {
      return sendJson(response, 404, { error: "Employee not found." });
    }

    const normalized = normalizeEmployeeInput(body);
    const updatedRecord = {
      ...employees[employeeIndex],
      ...normalized,
      updatedAt: new Date().toISOString()
    };

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
