const quickPrompts = [
  "Give me the workforce summary",
  "Who is on leave?",
  "Who deserves a hike?",
  "Who needs attention?",
  "Show submission status",
  "Who is at burnout risk?"
];

const state = {
  session: null,
  dashboard: null,
  activeDepartment: "All",
  selectedEmployeeId: null,
  editorMode: "edit",
  draftEmployee: createBlankEmployee(),
  aiResponse: "",
  aiProviderLabel: "Built-in intelligence"
};

const elements = {};

document.addEventListener("DOMContentLoaded", () => {
  cacheElements();
  bindEvents();
  renderSuggestions();
  setAuthStatus("Use the demo credentials to enter the dashboard.");
  elements.loginLocalAiPill.textContent = "Private smart summaries";
  restoreSession();
});

function cacheElements() {
  elements.authShell = document.getElementById("auth-shell");
  elements.appShell = document.getElementById("app-shell");
  elements.loginForm = document.getElementById("login-form");
  elements.loginSubmit = document.getElementById("login-submit");
  elements.authStatus = document.getElementById("auth-status");
  elements.loginLocalAiPill = document.getElementById("login-local-ai-pill");
  elements.sessionUserName = document.getElementById("session-user-name");
  elements.sessionUserRole = document.getElementById("session-user-role");
  elements.logoutButton = document.getElementById("logout-button");
  elements.refreshButton = document.getElementById("refresh-button");
  elements.newEmployeeButton = document.getElementById("new-employee-button");
  elements.focusRetentionButton = document.getElementById("focus-retention");
  elements.focusDeliveryButton = document.getElementById("focus-delivery");
  elements.flashMessage = document.getElementById("flash-message");
  elements.metricsGrid = document.getElementById("metrics-grid");
  elements.departmentFilters = document.getElementById("department-filters");
  elements.employeeGrid = document.getElementById("employee-grid");
  elements.employeeDetail = document.getElementById("employee-detail");
  elements.decisionQueue = document.getElementById("decision-queue");
  elements.capacityMatrix = document.getElementById("capacity-matrix");
  elements.featureGrid = document.getElementById("feature-grid");
  elements.auditList = document.getElementById("audit-list");
  elements.employeeForm = document.getElementById("employee-form");
  elements.editorTitle = document.getElementById("editor-title");
  elements.editorModePill = document.getElementById("editor-mode-pill");
  elements.editorStatus = document.getElementById("editor-status");
  elements.resetEditorButton = document.getElementById("reset-editor-button");
  elements.deleteEmployeeButton = document.getElementById("delete-employee-button");
  elements.saveEmployeeButton = document.getElementById("save-employee-button");
  elements.aiForm = document.getElementById("ai-form");
  elements.aiQuery = document.getElementById("ai-query");
  elements.aiSubmit = document.getElementById("ai-submit");
  elements.aiResponse = document.getElementById("ai-response");
  elements.aiProviderLabel = document.getElementById("ai-provider-label");
  elements.localAiPill = document.getElementById("local-ai-pill");
  elements.suggestionRow = document.getElementById("suggestion-row");
}

function bindEvents() {
  elements.loginForm.addEventListener("submit", handleLoginSubmit);
  elements.logoutButton.addEventListener("click", handleLogout);
  elements.refreshButton.addEventListener("click", async () => {
    await loadDashboard("Dashboard refreshed.");
  });
  elements.newEmployeeButton.addEventListener("click", activateCreateMode);
  elements.focusRetentionButton.addEventListener("click", () => runAiQuery("Who is at burnout risk?"));
  elements.focusDeliveryButton.addEventListener("click", () => runAiQuery("Show submission status"));
  elements.aiForm.addEventListener("submit", handleAiSubmit);
  elements.employeeGrid.addEventListener("click", handleEmployeeCardClick);
  elements.departmentFilters.addEventListener("click", handleDepartmentFilterClick);
  elements.employeeForm.addEventListener("submit", handleEmployeeSave);
  elements.resetEditorButton.addEventListener("click", handleEditorReset);
  elements.deleteEmployeeButton.addEventListener("click", handleEmployeeDelete);
  elements.suggestionRow.addEventListener("click", handleSuggestionClick);
}

function createBlankEmployee() {
  return {
    name: "",
    role: "",
    department: "Engineering",
    availability: "Working",
    mode: "Hybrid",
    performance: 80,
    submissions: 80,
    attendance: 95,
    workload: 65,
    leaveDays: 0,
    sentiment: 75,
    warnings: 0,
    complianceFlags: 0,
    overtimeHours: 0,
    achievements: 0,
    criticality: 3,
    manager: "",
    focus: "",
    milestone: "",
    notes: ""
  };
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => {
    const replacements = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    };
    return replacements[character];
  });
}

function initials(name) {
  return String(name || "")
    .split(" ")
    .map((segment) => segment[0] || "")
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function formatDateTime(isoString) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(new Date(isoString));
}

function setAuthStatus(message, isError = false) {
  elements.authStatus.textContent = message;
  elements.authStatus.style.color = isError ? "var(--rose)" : "var(--muted)";
}

function setEditorStatus(message, isError = false) {
  elements.editorStatus.textContent = message;
  elements.editorStatus.style.color = isError ? "var(--rose)" : "var(--muted)";
}

function showFlash(message, isError = false) {
  elements.flashMessage.textContent = message;
  elements.flashMessage.style.color = isError ? "var(--rose)" : "var(--text)";
}

function setButtonBusy(button, busyText) {
  button.dataset.originalText = button.textContent;
  button.textContent = busyText;
  button.disabled = true;
}

function resetButton(button) {
  button.textContent = button.dataset.originalText || button.textContent;
  button.disabled = false;
}

async function requestJson(url, options = {}) {
  const requestOptions = {
    method: options.method || "GET",
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(options.headers || {})
    },
    credentials: "same-origin"
  };

  if (options.body) {
    requestOptions.body = JSON.stringify(options.body);
  }

  const response = await fetch(url, requestOptions);
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload.error || "Request failed.");
  }

  return payload;
}

async function restoreSession() {
  try {
    const session = await requestJson("/api/auth/session");
    state.session = session.user;
    showApp();
    await loadDashboard("Welcome back.");
  } catch (error) {
    showAuth();
  }
}

function showAuth() {
  elements.authShell.classList.remove("hidden");
  elements.appShell.classList.add("hidden");
}

function showApp() {
  elements.authShell.classList.add("hidden");
  elements.appShell.classList.remove("hidden");
}

async function handleLoginSubmit(event) {
  event.preventDefault();
  const formData = new FormData(elements.loginForm);

  setButtonBusy(elements.loginSubmit, "Signing In...");
  setAuthStatus("Authenticating...");

  try {
    const payload = await requestJson("/api/auth/login", {
      method: "POST",
      body: {
        email: formData.get("email"),
        password: formData.get("password")
      }
    });

    state.session = payload.user;
    showApp();
    await loadDashboard(`Signed in as ${payload.user.name}.`);
  } catch (error) {
    setAuthStatus(error.message, true);
  } finally {
    resetButton(elements.loginSubmit);
  }
}

async function handleLogout() {
  try {
    await requestJson("/api/auth/logout", { method: "POST" });
  } catch (error) {
    // Keep local logout behavior even if the request fails.
  }

  state.session = null;
  state.dashboard = null;
  state.selectedEmployeeId = null;
  state.editorMode = "edit";
  state.draftEmployee = createBlankEmployee();
  showAuth();
  setAuthStatus("Signed out. Use the demo credentials to enter the dashboard.");
}

async function loadDashboard(message) {
  const payload = await requestJson("/api/dashboard");
  state.dashboard = payload;

  if (!payload.departments.includes(state.activeDepartment)) {
    state.activeDepartment = "All";
  }

  if (!payload.employees.length) {
    state.editorMode = "create";
    state.selectedEmployeeId = null;
  } else if (!payload.employees.some((employee) => employee.id === state.selectedEmployeeId)) {
    state.selectedEmployeeId = payload.employees[0].id;
    state.editorMode = "edit";
  }

  if (
    state.activeDepartment !== "All" &&
    !payload.employees.some(
      (employee) => employee.id === state.selectedEmployeeId && employee.department === state.activeDepartment
    )
  ) {
    state.activeDepartment = "All";
  }

  state.aiResponse = buildLocalAiAnswer("Give me the workforce summary").answer;
  state.aiProviderLabel = "Built-in intelligence";

  renderDashboard();
  showFlash(message || "Dashboard ready.");
}

function renderDashboard() {
  if (!state.dashboard) {
    return;
  }

  elements.sessionUserName.textContent = state.dashboard.user.name;
  elements.sessionUserRole.textContent = `${state.dashboard.user.role} · ${state.dashboard.user.email}`;
  elements.localAiPill.textContent = "Built in";
  elements.aiProviderLabel.textContent = state.aiProviderLabel;
  elements.aiResponse.textContent = state.aiResponse;

  renderMetrics();
  renderFilters();
  renderEmployeeGrid();
  renderEmployeeDetail();
  renderDecisionQueue();
  renderCapacity();
  renderFeatureRoadmap();
  renderAuditLog();
  renderEditor();
}

function getEmployees() {
  return state.dashboard?.employees || [];
}

function getVisibleEmployees() {
  if (state.activeDepartment === "All") {
    return getEmployees();
  }

  return getEmployees().filter((employee) => employee.department === state.activeDepartment);
}

function getSelectedEmployee() {
  return getEmployees().find((employee) => employee.id === state.selectedEmployeeId) || null;
}

function average(values) {
  if (!values.length) {
    return 0;
  }

  return values.reduce((total, value) => total + value, 0) / values.length;
}

function humanJoin(values) {
  if (!values.length) {
    return "";
  }

  if (values.length === 1) {
    return values[0];
  }

  if (values.length === 2) {
    return `${values[0]} and ${values[1]}`;
  }

  return `${values.slice(0, -1).join(", ")}, and ${values[values.length - 1]}`;
}

function listEmployeeNames(employees, limit = employees.length) {
  return humanJoin(employees.slice(0, limit).map((employee) => employee.name));
}

function findMatchedDepartment(query) {
  const departments = (state.dashboard?.departments || []).filter((department) => department !== "All");
  return departments.find((department) => query.includes(department.toLowerCase())) || null;
}

function findMatchedEmployee(query) {
  return (
    getEmployees().find((employee) => {
      const loweredName = employee.name.toLowerCase();
      const [firstName] = loweredName.split(" ");
      return query.includes(loweredName) || (firstName.length > 2 && query.includes(firstName));
    }) || null
  );
}

function summarizeEmployeeFocus(employee) {
  return `${employee.name} is ${employee.availability === "On Leave" ? "currently on leave" : "actively working"} as ${employee.role} in ${employee.department}. Performance is ${employee.performance}%, submissions are ${employee.submissions}%, attendance is ${employee.attendance}%, burnout risk is ${employee.burnout}%, and the current management recommendation is ${employee.action.title.toLowerCase()}. Focus area: ${employee.focus}. Next milestone: ${employee.milestone}. Human review and policy checks are required before any compensation or termination action.`;
}

function summarizeDepartmentFocus(department, employees) {
  if (!employees.length) {
    return `No employees are currently available in ${department}.`;
  }

  const working = employees.filter((employee) => employee.availability === "Working");
  const onLeave = employees.filter((employee) => employee.availability === "On Leave");
  const avgSubmission = Math.round(average(employees.map((employee) => employee.submissions)));
  const avgWorkload = Math.round(average(employees.map((employee) => employee.workload)));
  const pressure = [...employees].sort((left, right) => right.burnout - left.burnout)[0];

  return `${department} has ${employees.length} employees in view, with ${working.length} working and ${onLeave.length} on leave. Average submission rhythm is ${avgSubmission}% and average workload is ${avgWorkload}%. ${pressure.name} is carrying the sharpest pressure signal in this department.`;
}

function buildLocalAiAnswer(question) {
  const allEmployees = getEmployees();
  const visibleEmployees = getVisibleEmployees();
  const normalizedQuestion = String(question || "").trim();
  const query = normalizedQuestion.toLowerCase();
  const contextDepartment = findMatchedDepartment(query);
  const contextEmployees = contextDepartment
    ? allEmployees.filter((employee) => employee.department === contextDepartment)
    : visibleEmployees;
  const matchedEmployee = findMatchedEmployee(query);
  const working = contextEmployees.filter((employee) => employee.availability === "Working");
  const onLeave = contextEmployees.filter((employee) => employee.availability === "On Leave");
  const rewardCandidates = [...contextEmployees]
    .filter((employee) => ["Promotion + hike", "Compensation hike"].includes(employee.action.title))
    .sort((left, right) => right.hike - left.hike);
  const reviewCandidates = [...contextEmployees]
    .filter((employee) => ["Demotion / PIP review", "Termination review"].includes(employee.action.title))
    .sort((left, right) => right.discipline - left.discipline);
  const burnoutCandidates = [...contextEmployees]
    .filter((employee) => employee.burnout >= 65)
    .sort((left, right) => right.burnout - left.burnout);
  const submissionLeaders = [...contextEmployees].sort((left, right) => right.submissions - left.submissions);
  const submissionLaggards = [...contextEmployees].sort((left, right) => left.submissions - right.submissions);
  const topPerformer = [...contextEmployees].sort((left, right) => right.performance - left.performance)[0];
  const highestRisk = [...contextEmployees].sort((left, right) => right.discipline - left.discipline)[0];
  const highestPressure = [...contextEmployees].sort((left, right) => right.burnout - left.burnout)[0];
  const avgSubmission = Math.round(average(contextEmployees.map((employee) => employee.submissions)));
  const activeAudit = state.dashboard?.auditLog?.[0];
  const scopeLabel = contextDepartment || state.activeDepartment;

  if (!contextEmployees.length) {
    return {
      answer: "There are no employees in the current filtered view, so EMSOU does not have enough workforce data to summarize yet.",
      flash: "No employee data is available in the current view."
    };
  }

  if (matchedEmployee) {
    return {
      answer: summarizeEmployeeFocus(matchedEmployee),
      flash: `EMSOU generated a profile summary for ${matchedEmployee.name}.`
    };
  }

  if (!query || query.includes("summary") || query.includes("overview") || query.includes("track")) {
    return {
      answer: `${contextEmployees.length} employees are in the ${scopeLabel === "All" ? "full organization" : `${scopeLabel} view`}. ${working.length} are working and ${onLeave.length} are on leave. Average submission rhythm is ${avgSubmission}%. ${topPerformer.name} is leading overall performance, ${highestPressure.name} has the strongest burnout signal, and ${highestRisk.name} needs the closest management review. Reward candidates right now are ${rewardCandidates.length ? listEmployeeNames(rewardCandidates, 3) : "not yet clearly above threshold"}. Human review and policy checks are required before any compensation, demotion, or termination action.`,
      flash: "EMSOU generated an executive workforce summary."
    };
  }

  if (query.includes("leave")) {
    return {
      answer: onLeave.length
        ? `${listEmployeeNames(onLeave)} ${onLeave.length === 1 ? "is" : "are"} currently on leave in the ${scopeLabel === "All" ? "full organization" : `${scopeLabel} view`}. The highest coverage impact is ${[...onLeave].sort((left, right) => right.criticality - left.criticality)[0].name}, so backup ownership should stay in place until return.`
        : `Nobody is currently on leave in the ${scopeLabel === "All" ? "full organization" : `${scopeLabel} view`}. Capacity is fully available right now.`,
      flash: "EMSOU checked the current leave situation."
    };
  }

  if (query.includes("working") || query.includes("available")) {
    return {
      answer: `${working.length} people are actively working in the ${scopeLabel === "All" ? "full organization" : `${scopeLabel} view`}. The heaviest workloads currently belong to ${listEmployeeNames([...working].sort((left, right) => right.workload - left.workload), 3)}.`,
      flash: "EMSOU checked active workforce availability."
    };
  }

  if (query.includes("submission") || query.includes("delivery") || query.includes("report") || query.includes("sla")) {
    return {
      answer: `Submission leaders are ${listEmployeeNames(submissionLeaders, 3)}. The weakest submission discipline is showing up around ${listEmployeeNames(submissionLaggards, 2)}, so managers should follow up on delivery rhythm, reporting quality, and blockers.`,
      flash: "EMSOU reviewed submission and delivery signals."
    };
  }

  if (query.includes("hike") || query.includes("promotion") || query.includes("promote") || query.includes("raise") || query.includes("increment")) {
    return {
      answer: rewardCandidates.length
        ? `${listEmployeeNames(rewardCandidates, 3)} are the strongest current hike or promotion candidates. They are standing out on performance, submission consistency, attendance, and visible impact. Human review and policy checks are required before any compensation decision.`
        : "No one is clearly above the reward threshold right now. Managers should keep tracking performance trend, submissions, and business impact before making a hike recommendation.",
      flash: "EMSOU reviewed hike and promotion candidates."
    };
  }

  if (
    query.includes("fire") ||
    query.includes("terminate") ||
    query.includes("demote") ||
    query.includes("pip") ||
    query.includes("underperform") ||
    query.includes("attention")
  ) {
    return {
      answer: reviewCandidates.length
        ? `${listEmployeeNames(reviewCandidates, 2)} currently require the strongest formal review attention because their discipline, performance, attendance, or compliance signals are weakest. Human review, documentation, and policy checks are required before any demotion or termination action.`
        : "No one currently crosses the threshold for formal demotion or termination review. Regular coaching and performance follow-up should continue.",
      flash: "EMSOU reviewed intervention and performance-risk signals."
    };
  }

  if (query.includes("burnout") || query.includes("retention") || query.includes("stress") || query.includes("attrition")) {
    return {
      answer: burnoutCandidates.length
        ? `${listEmployeeNames(burnoutCandidates, 3)} are showing the strongest burnout or retention risk through workload, overtime, and sentiment trends. Managers should rebalance workload, check morale, and protect coverage before performance drops.`
        : "Burnout risk looks controlled right now. Nobody is above the current alert threshold in this view.",
      flash: "EMSOU checked burnout and retention risk."
    };
  }

  if (query.includes("department") || query.includes("team") || query.includes("capacity") || query.includes("workload")) {
    const departmentToUse = contextDepartment || highestPressure.department;
    const departmentEmployees = allEmployees.filter((employee) => employee.department === departmentToUse);
    return {
      answer: summarizeDepartmentFocus(departmentToUse, departmentEmployees),
      flash: `EMSOU reviewed ${departmentToUse} capacity.`
    };
  }

  if (query.includes("audit") || query.includes("recent") || query.includes("history") || query.includes("activity")) {
    return {
      answer: activeAudit
        ? `Most recent recorded activity: ${activeAudit.action} by ${activeAudit.actor} on ${formatDateTime(activeAudit.createdAt)}. Detail: ${activeAudit.detail}`
        : "No audit activity is available yet.",
      flash: "EMSOU reviewed recent audit activity."
    };
  }

  return {
    answer: `${contextEmployees.length} employees are currently in the active AI scope. ${working.length} are working, ${onLeave.length} are on leave, average submission rhythm is ${avgSubmission}%, and the biggest attention signals are around ${highestRisk.name} and ${highestPressure.name}. Ask about leave, working status, submissions, burnout, department pressure, rewards, or a specific employee name for a sharper answer.`,
    flash: "EMSOU generated a workforce guidance summary."
  };
}

function renderMetrics() {
  elements.metricsGrid.innerHTML = state.dashboard.metrics
    .map(
      (metric) => `
        <article class="glass-panel metric-card ${escapeHtml(metric.tone)}">
          <span class="metric-label">${escapeHtml(metric.label)}</span>
          <strong class="metric-value">${escapeHtml(metric.value)}</strong>
          <span class="metric-detail">${escapeHtml(metric.detail)}</span>
        </article>
      `
    )
    .join("");
}

function renderFilters() {
  elements.departmentFilters.innerHTML = state.dashboard.departments
    .map(
      (department) => `
        <button class="filter-btn ${state.activeDepartment === department ? "active" : ""}" type="button" data-filter="${escapeHtml(department)}">
          ${escapeHtml(department)}
        </button>
      `
    )
    .join("");
}

function renderEmployeeGrid() {
  const employees = getVisibleEmployees();

  if (!employees.length) {
    elements.employeeGrid.innerHTML = '<div class="empty-state">No employees match the current department filter.</div>';
    return;
  }

  elements.employeeGrid.innerHTML = employees
    .map(
      (employee) => `
        <button class="employee-card ${state.selectedEmployeeId === employee.id && state.editorMode !== "create" ? "active" : ""}" type="button" data-employee-id="${escapeHtml(employee.id)}">
          <div class="employee-top">
            <div class="avatar">${escapeHtml(initials(employee.name))}</div>
            <div>
              <h4 class="employee-name">${escapeHtml(employee.name)}</h4>
              <p class="employee-role">${escapeHtml(employee.role)}</p>
            </div>
            <span class="status-chip ${escapeHtml(employee.action.tone)}">${escapeHtml(employee.availability === "On Leave" ? "On Leave" : employee.action.title)}</span>
          </div>

          <div class="employee-meta">
            <div class="meta-block">
              <span>Department</span>
              <strong>${escapeHtml(employee.department)}</strong>
            </div>
            <div class="meta-block">
              <span>Mode</span>
              <strong>${escapeHtml(employee.mode)}</strong>
            </div>
          </div>

          <div class="employee-stats">
            <div class="stat-line">
              <span>Performance</span>
              <strong>${employee.performance}%</strong>
              <div class="mini-bar"><i style="width:${employee.performance}%"></i></div>
            </div>
            <div class="stat-line">
              <span>Submission</span>
              <strong>${employee.submissions}%</strong>
              <div class="mini-bar"><i style="width:${employee.submissions}%"></i></div>
            </div>
            <div class="stat-line">
              <span>Burnout Risk</span>
              <strong>${employee.burnout}%</strong>
              <div class="mini-bar"><i style="width:${employee.burnout}%"></i></div>
            </div>
          </div>

          <div class="employee-footer">
            <span>${escapeHtml(employee.lastUpdate)}</span>
            <strong>${escapeHtml(employee.action.title)}</strong>
          </div>
        </button>
      `
    )
    .join("");
}

function renderEmployeeDetail() {
  const employee = state.editorMode === "create" ? null : getSelectedEmployee();

  if (!employee) {
    elements.employeeDetail.innerHTML = '<div class="empty-state">Create a new employee record or select an existing employee to see their profile intelligence.</div>';
    return;
  }

  elements.employeeDetail.innerHTML = `
    <div class="focus-identity">
      <div class="avatar">${escapeHtml(initials(employee.name))}</div>
      <div class="focus-copy">
        <h4>${escapeHtml(employee.name)}</h4>
        <p>${escapeHtml(`${employee.role} · ${employee.department} · ${employee.mode}`)}</p>
      </div>
    </div>

    <div class="detail-highlights">
      <div class="detail-pill">
        <span class="eyebrow">Recommended Action</span>
        <strong>${escapeHtml(employee.action.title)}</strong>
      </div>
      <div class="detail-pill">
        <span class="eyebrow">Manager</span>
        <strong>${escapeHtml(employee.manager)}</strong>
      </div>
    </div>

    <div class="detail-stats">
      <div class="detail-stat">
        <span>Promotion Score</span>
        <strong>${employee.promotion}%</strong>
      </div>
      <div class="detail-stat">
        <span>Hike Score</span>
        <strong>${employee.hike}%</strong>
      </div>
      <div class="detail-stat">
        <span>Discipline Risk</span>
        <strong>${employee.discipline}%</strong>
      </div>
      <div class="detail-stat">
        <span>Burnout Risk</span>
        <strong>${employee.burnout}%</strong>
      </div>
      <div class="detail-stat">
        <span>Attendance</span>
        <strong>${employee.attendance}%</strong>
      </div>
      <div class="detail-stat">
        <span>Leave Days Used</span>
        <strong>${employee.leaveDays} days</strong>
      </div>
    </div>

    <div class="detail-highlights">
      <div class="detail-pill">
        <span class="eyebrow">Current Focus</span>
        <strong>${escapeHtml(employee.focus)}</strong>
      </div>
      <div class="detail-pill">
        <span class="eyebrow">Next Milestone</span>
        <strong>${escapeHtml(employee.milestone)}</strong>
      </div>
    </div>

    <p class="detail-note">${escapeHtml(employee.action.reason)} ${escapeHtml(employee.notes)}</p>
  `;
}

function renderDecisionQueue() {
  elements.decisionQueue.innerHTML = state.dashboard.decisions
    .map(
      (employee) => `
        <article class="decision-item">
          <div class="decision-row">
            <div>
              <div class="decision-tag">${escapeHtml(employee.department)}</div>
              <h4>${escapeHtml(employee.name)}</h4>
            </div>
            <span class="status-chip ${escapeHtml(employee.action.tone)}">${escapeHtml(employee.action.title)}</span>
          </div>
          <p>${escapeHtml(employee.action.reason)}</p>
        </article>
      `
    )
    .join("");
}

function renderCapacity() {
  elements.capacityMatrix.innerHTML = state.dashboard.capacity
    .map(
      (item) => `
        <article class="capacity-item">
          <div class="capacity-top">
            <div>
              <h4>${escapeHtml(item.department)}</h4>
              <p>${escapeHtml(`${item.onLeave} on leave · ${item.avgSubmission}% submission rhythm · ${item.avgWorkload}% workload`)}</p>
            </div>
            <span class="status-chip ${escapeHtml(item.label === "Fragile" ? "tone-risk" : item.label === "Pressure" ? "tone-leave" : "tone-working")}">${escapeHtml(item.label)}</span>
          </div>
          <div class="capacity-bar"><i style="width:${item.capacity}%"></i></div>
        </article>
      `
    )
    .join("");
}

function renderFeatureRoadmap() {
  elements.featureGrid.innerHTML = state.dashboard.featureRoadmap
    .map(
      (item) => `
        <article class="feature-card">
          <span>${escapeHtml(item.tag)}</span>
          <h4>${escapeHtml(item.title)}</h4>
          <p>${escapeHtml(item.copy)}</p>
        </article>
      `
    )
    .join("");
}

function renderAuditLog() {
  elements.auditList.innerHTML = state.dashboard.auditLog
    .map(
      (entry) => `
        <article class="audit-item">
          <div class="audit-row">
            <h4>${escapeHtml(entry.action)}</h4>
            <time>${escapeHtml(formatDateTime(entry.createdAt))}</time>
          </div>
          <span>${escapeHtml(entry.actor)}</span>
          <p>${escapeHtml(entry.detail)}</p>
        </article>
      `
    )
    .join("");
}

function renderEditor() {
  const employee = state.editorMode === "create" ? state.draftEmployee : getSelectedEmployee();

  if (!employee) {
    state.editorMode = "create";
    state.draftEmployee = createBlankEmployee();
    return renderEditor();
  }

  elements.editorTitle.textContent = state.editorMode === "create" ? "Create employee record" : `Update ${employee.name}`;
  elements.editorModePill.textContent = state.editorMode === "create" ? "Create mode" : "Edit mode";
  elements.deleteEmployeeButton.disabled = state.editorMode === "create";
  elements.deleteEmployeeButton.style.opacity = state.editorMode === "create" ? "0.5" : "1";

  for (const [key, value] of Object.entries(employee)) {
    if (elements.employeeForm.elements.namedItem(key)) {
      elements.employeeForm.elements.namedItem(key).value = value;
    }
  }
}

function handleEmployeeCardClick(event) {
  const card = event.target.closest("[data-employee-id]");
  if (!card) {
    return;
  }

  state.selectedEmployeeId = card.dataset.employeeId;
  state.editorMode = "edit";
  setEditorStatus("");
  renderEmployeeGrid();
  renderEmployeeDetail();
  renderEditor();
}

function handleDepartmentFilterClick(event) {
  const button = event.target.closest("[data-filter]");
  if (!button) {
    return;
  }

  state.activeDepartment = button.dataset.filter;
  const visibleEmployees = getVisibleEmployees();

  if (state.editorMode !== "create" && visibleEmployees.length && !visibleEmployees.some((employee) => employee.id === state.selectedEmployeeId)) {
    state.selectedEmployeeId = visibleEmployees[0].id;
  }

  renderFilters();
  renderEmployeeGrid();
  renderEmployeeDetail();
  renderEditor();
}

function renderSuggestions() {
  elements.suggestionRow.innerHTML = quickPrompts
    .map(
      (prompt) => `
        <button class="suggestion-btn" type="button" data-prompt="${escapeHtml(prompt)}">${escapeHtml(prompt)}</button>
      `
    )
    .join("");
}

function handleSuggestionClick(event) {
  const button = event.target.closest("[data-prompt]");
  if (!button) {
    return;
  }

  runAiQuery(button.dataset.prompt);
}

function activateCreateMode() {
  state.editorMode = "create";
  state.draftEmployee = createBlankEmployee();
  setEditorStatus("Create mode enabled. Fill out the form and save the new employee.");
  renderEmployeeGrid();
  renderEmployeeDetail();
  renderEditor();
}

function handleEditorReset() {
  if (state.editorMode === "create") {
    state.draftEmployee = createBlankEmployee();
  }

  setEditorStatus("Editor reset.");
  renderEditor();
}

function serializeEmployeeForm() {
  const formData = new FormData(elements.employeeForm);

  return {
    name: formData.get("name"),
    role: formData.get("role"),
    department: formData.get("department"),
    manager: formData.get("manager"),
    availability: formData.get("availability"),
    mode: formData.get("mode"),
    performance: Number(formData.get("performance")),
    submissions: Number(formData.get("submissions")),
    attendance: Number(formData.get("attendance")),
    workload: Number(formData.get("workload")),
    leaveDays: Number(formData.get("leaveDays")),
    sentiment: Number(formData.get("sentiment")),
    warnings: Number(formData.get("warnings")),
    complianceFlags: Number(formData.get("complianceFlags")),
    overtimeHours: Number(formData.get("overtimeHours")),
    achievements: Number(formData.get("achievements")),
    criticality: Number(formData.get("criticality")),
    focus: formData.get("focus"),
    milestone: formData.get("milestone"),
    notes: formData.get("notes")
  };
}

async function handleEmployeeSave(event) {
  event.preventDefault();
  const payload = serializeEmployeeForm();

  setButtonBusy(elements.saveEmployeeButton, state.editorMode === "create" ? "Creating..." : "Saving...");
  setEditorStatus(state.editorMode === "create" ? "Creating employee..." : "Saving employee...");

  try {
    if (state.editorMode === "create") {
      const result = await requestJson("/api/employees", {
        method: "POST",
        body: payload
      });
      state.selectedEmployeeId = result.employee.id;
      state.editorMode = "edit";
      state.activeDepartment = "All";
      await loadDashboard(`${result.employee.name} created successfully.`);
    } else {
      const employee = getSelectedEmployee();
      const result = await requestJson(`/api/employees/${employee.id}`, {
        method: "PUT",
        body: payload
      });
      state.selectedEmployeeId = result.employee.id;
      state.activeDepartment = "All";
      await loadDashboard(`${result.employee.name} updated successfully.`);
    }

    setEditorStatus("Employee saved.");
  } catch (error) {
    setEditorStatus(error.message, true);
  } finally {
    resetButton(elements.saveEmployeeButton);
  }
}

async function handleEmployeeDelete() {
  if (state.editorMode === "create") {
    return;
  }

  const employee = getSelectedEmployee();
  if (!employee) {
    return;
  }

  const confirmed = window.confirm(`Delete ${employee.name} from the employee database?`);
  if (!confirmed) {
    return;
  }

  setButtonBusy(elements.deleteEmployeeButton, "Deleting...");
  setEditorStatus(`Deleting ${employee.name}...`);

  try {
    await requestJson(`/api/employees/${employee.id}`, {
      method: "DELETE"
    });

    state.selectedEmployeeId = null;
    state.editorMode = "edit";
    await loadDashboard(`${employee.name} deleted successfully.`);
  } catch (error) {
    setEditorStatus(error.message, true);
  } finally {
    resetButton(elements.deleteEmployeeButton);
  }
}

async function handleAiSubmit(event) {
  event.preventDefault();
  await runAiQuery(elements.aiQuery.value);
}

async function runAiQuery(question) {
  const normalizedQuestion = String(question || "").trim();
  if (!normalizedQuestion) {
    showFlash("Enter a question for the AI console.", true);
    return;
  }

  elements.aiQuery.value = normalizedQuestion;
  setButtonBusy(elements.aiSubmit, "Thinking...");
  showFlash("Analyzing workforce signals locally in your browser...");

  try {
    const result = buildLocalAiAnswer(normalizedQuestion);

    state.aiResponse = result.answer;
    state.aiProviderLabel = "Built-in intelligence";
    elements.aiResponse.textContent = state.aiResponse;
    elements.aiProviderLabel.textContent = state.aiProviderLabel;
    showFlash(result.flash || "EMSOU summary ready.");
  } catch (error) {
    state.aiResponse = error.message;
    state.aiProviderLabel = "AI error";
    elements.aiResponse.textContent = state.aiResponse;
    elements.aiProviderLabel.textContent = state.aiProviderLabel;
    showFlash(error.message, true);
  } finally {
    resetButton(elements.aiSubmit);
  }
}
