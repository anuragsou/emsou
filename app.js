const quickPrompts = [
  "Give me the workforce summary",
  "Who is on leave?",
  "Who deserves a hike?",
  "Who needs attention?",
  "Show submission status",
  "Who is at burnout risk?"
];

const PAGE_NAMES = ["dashboard", "employees", "management", "signals"];

const state = {
  session: null,
  dashboard: null,
  activeDepartment: "All",
  searchQuery: "",
  sortKey: "priority",
  currentRosterPage: 1,
  rosterPageSize: 6,
  selectedEmployeeId: null,
  editorMode: "edit",
  draftEmployee: createBlankEmployee(),
  currentPage: "dashboard",
  aiResponse: "",
  aiProviderLabel: "Built-in intelligence",
  emailDraft: {
    subject: "",
    body: ""
  }
};

const elements = {};

document.addEventListener("DOMContentLoaded", () => {
  cacheElements();
  bindEvents();
  syncPageFromHash();
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
  elements.primaryNav = document.getElementById("primary-nav");
  elements.navPills = [...document.querySelectorAll("[data-page]")];
  elements.pageViews = [...document.querySelectorAll("[data-page-view]")];
  elements.logoutButton = document.getElementById("logout-button");
  elements.refreshButton = document.getElementById("refresh-button");
  elements.newEmployeeButton = document.getElementById("new-employee-button");
  elements.employeesCreateButton = document.getElementById("employees-create-button");
  elements.employeesViewButton = document.getElementById("employees-view-button");
  elements.employeesEditButton = document.getElementById("employees-edit-button");
  elements.employeesDeleteButton = document.getElementById("employees-delete-button");
  elements.employeesSelectionText = document.getElementById("employees-selection-text");
  elements.managementCreateButton = document.getElementById("management-create-button");
  elements.managementBackButton = document.getElementById("management-back-button");
  elements.signalsSummaryButton = document.getElementById("signals-summary-button");
  elements.focusRetentionButton = document.getElementById("focus-retention");
  elements.focusDeliveryButton = document.getElementById("focus-delivery");
  elements.flashMessage = document.getElementById("flash-message");
  elements.metricsGrid = document.getElementById("metrics-grid");
  elements.departmentFilters = document.getElementById("department-filters");
  elements.employeeSearch = document.getElementById("employee-search");
  elements.employeeSort = document.getElementById("employee-sort");
  elements.exportCsvButton = document.getElementById("export-csv-button");
  elements.exportPdfButton = document.getElementById("export-pdf-button");
  elements.employeeGrid = document.getElementById("employee-grid");
  elements.paginationPrev = document.getElementById("pagination-prev");
  elements.paginationNext = document.getElementById("pagination-next");
  elements.paginationStatus = document.getElementById("pagination-status");
  elements.employeeDetail = document.getElementById("employee-detail");
  elements.decisionQueue = document.getElementById("decision-queue");
  elements.departmentCharts = document.getElementById("department-charts");
  elements.capacityMatrix = document.getElementById("capacity-matrix");
  elements.salaryInsights = document.getElementById("salary-insights");
  elements.featureGrid = document.getElementById("feature-grid");
  elements.emailForm = document.getElementById("email-form");
  elements.emailEmployee = document.getElementById("email-employee");
  elements.emailTemplate = document.getElementById("email-template");
  elements.emailContext = document.getElementById("email-context");
  elements.emailGenerateButton = document.getElementById("email-generate-button");
  elements.emailOpenButton = document.getElementById("email-open-button");
  elements.emailSubject = document.getElementById("email-subject");
  elements.emailBody = document.getElementById("email-body");
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
  elements.primaryNav.addEventListener("click", handlePageNavClick);
  elements.logoutButton.addEventListener("click", handleLogout);
  elements.refreshButton.addEventListener("click", async () => {
    await loadDashboard("Dashboard refreshed.");
  });
  elements.newEmployeeButton.addEventListener("click", () => activateCreateMode("management"));
  elements.employeesCreateButton.addEventListener("click", () => activateCreateMode("management"));
  elements.employeesViewButton.addEventListener("click", () => openSelectedProfile());
  elements.employeesEditButton.addEventListener("click", () => openSelectedEditor());
  elements.employeesDeleteButton.addEventListener("click", () => handleEmployeeDelete());
  elements.managementCreateButton.addEventListener("click", () => activateCreateMode("management"));
  elements.managementBackButton.addEventListener("click", () => setCurrentPage("employees"));
  elements.signalsSummaryButton.addEventListener("click", () => {
    setCurrentPage("dashboard");
    runAiQuery("Give me the workforce summary");
  });
  elements.focusRetentionButton.addEventListener("click", () => runAiQuery("Who is at burnout risk?"));
  elements.focusDeliveryButton.addEventListener("click", () => runAiQuery("Show submission status"));
  elements.aiForm.addEventListener("submit", handleAiSubmit);
  elements.employeeSearch.addEventListener("input", handleEmployeeSearchInput);
  elements.employeeSort.addEventListener("change", handleEmployeeSortChange);
  elements.exportCsvButton.addEventListener("click", exportEmployeesCsv);
  elements.exportPdfButton.addEventListener("click", exportEmployeesPdf);
  elements.paginationPrev.addEventListener("click", () => changeRosterPage(-1));
  elements.paginationNext.addEventListener("click", () => changeRosterPage(1));
  elements.employeeGrid.addEventListener("click", handleEmployeeCardClick);
  elements.employeeDetail.addEventListener("click", handleProfileActionClick);
  elements.departmentFilters.addEventListener("click", handleDepartmentFilterClick);
  elements.employeeForm.addEventListener("submit", handleEmployeeSave);
  elements.resetEditorButton.addEventListener("click", handleEditorReset);
  elements.deleteEmployeeButton.addEventListener("click", handleEmployeeDelete);
  elements.emailForm.addEventListener("submit", handleEmailDraftGenerate);
  elements.emailOpenButton.addEventListener("click", openDraftInMailClient);
  elements.suggestionRow.addEventListener("click", handleSuggestionClick);
  window.addEventListener("hashchange", syncPageFromHash);
}

function createBlankEmployee() {
  const today = new Date().toISOString().slice(0, 10);
  const reviewDate = new Date(Date.now() + 1000 * 60 * 60 * 24 * 45).toISOString().slice(0, 10);

  return {
    name: "",
    role: "",
    department: "Engineering",
    manager: "",
    email: "",
    photo: "",
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
    salary: 1200000,
    salaryCurrency: "INR",
    lastHikePercent: 8,
    lastHikeDate: today,
    nextReviewDate: reviewDate,
    leaveRequests: [],
    salaryHistory: [],
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

function renderAvatar(employee, large = false) {
  const avatarClass = large ? "avatar avatar-photo avatar-large" : "avatar avatar-photo";
  return `<div class="${avatarClass}"><img src="${escapeHtml(employee.photo)}" alt="${escapeHtml(employee.name)}"></div>`;
}

function formatDateTime(isoString) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(new Date(isoString));
}

function formatDate(value) {
  if (!value) {
    return "Not set";
  }

  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric"
  }).format(new Date(value));
}

function formatCurrency(value, currency = "INR") {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    maximumFractionDigits: 0
  }).format(Number(value || 0));
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
  renderPageState();
}

function getPageFromHash() {
  const page = window.location.hash.replace(/^#/, "").trim().toLowerCase();
  return PAGE_NAMES.includes(page) ? page : "dashboard";
}

function syncPageFromHash() {
  state.currentPage = getPageFromHash();
  renderPageState();
}

function setCurrentPage(page, updateHash = true) {
  const nextPage = PAGE_NAMES.includes(page) ? page : "dashboard";
  state.currentPage = nextPage;

  if (updateHash && window.location.hash !== `#${nextPage}`) {
    window.location.hash = nextPage;
    return;
  }

  renderPageState();
}

function renderPageState() {
  if (elements.pageViews) {
    elements.pageViews.forEach((pageView) => {
      const isActive = pageView.dataset.pageView === state.currentPage;
      pageView.classList.toggle("hidden", !isActive);
    });
  }

  if (elements.navPills) {
    elements.navPills.forEach((pill) => {
      const isActive = pill.dataset.page === state.currentPage;
      pill.classList.toggle("active", isActive);
      pill.setAttribute("aria-pressed", String(isActive));
    });
  }
}

function handlePageNavClick(event) {
  const button = event.target.closest("[data-page]");
  if (!button) {
    return;
  }

  setCurrentPage(button.dataset.page);
}

function renderCrudToolbar() {
  const employee = state.editorMode === "create" ? null : getSelectedEmployee();
  const hasEmployee = Boolean(employee);

  if (elements.employeesSelectionText) {
    elements.employeesSelectionText.textContent = state.editorMode === "create"
      ? "Create mode is active. Finish the form on the management page to add a new employee record."
      : hasEmployee
        ? `${employee.name} is selected. Use View to inspect, Edit to open the management page, or Delete to remove the record.`
        : "No employee is currently selected. Choose one from the roster or create a new record.";
  }

  [elements.employeesViewButton, elements.employeesEditButton, elements.employeesDeleteButton].forEach((button) => {
    if (!button) {
      return;
    }
    button.disabled = !hasEmployee;
  });
}

function openSelectedProfile() {
  const employee = getSelectedEmployee();
  if (!employee) {
    showFlash("Select an employee first.", true);
    return;
  }

  state.editorMode = "edit";
  setEditorStatus("");
  renderEmployeeGrid();
  renderEmployeeDetail();
  renderEditor();
  renderCrudToolbar();
  setCurrentPage("employees");
}

function openSelectedEditor() {
  const employee = getSelectedEmployee();
  if (!employee) {
    showFlash("Select an employee first.", true);
    return;
  }

  state.editorMode = "edit";
  setEditorStatus(`${employee.name} is ready for editing.`);
  renderEmployeeGrid();
  renderEmployeeDetail();
  renderEditor();
  renderCrudToolbar();
  setCurrentPage("management");
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

  renderPageState();
  syncSelectedEmployeeToCurrentRoster();
  elements.sessionUserName.textContent = state.dashboard.user.name;
  elements.sessionUserRole.textContent = `${state.dashboard.user.role} · ${state.dashboard.user.email}`;
  elements.localAiPill.textContent = "Built in";
  elements.aiProviderLabel.textContent = state.aiProviderLabel;
  elements.aiResponse.textContent = state.aiResponse;
  elements.employeeSearch.value = state.searchQuery;
  elements.employeeSort.value = state.sortKey;

  renderMetrics();
  renderFilters();
  renderEmployeeGrid();
  renderPagination();
  renderEmployeeDetail();
  renderDecisionQueue();
  renderEmployeePickers();
  renderDepartmentCharts();
  renderCapacity();
  renderSalaryInsights();
  renderFeatureRoadmap();
  renderAuditLog();
  renderEditor();
  renderCrudToolbar();
  renderEmailDraft();
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

function getFilteredRosterEmployees() {
  const query = state.searchQuery.trim().toLowerCase();
  let employees = getVisibleEmployees();

  if (query) {
    employees = employees.filter((employee) =>
      [employee.name, employee.role, employee.department, employee.manager, employee.email]
        .join(" ")
        .toLowerCase()
        .includes(query)
    );
  }

  const sortedEmployees = [...employees];
  switch (state.sortKey) {
    case "name-asc":
      sortedEmployees.sort((left, right) => left.name.localeCompare(right.name));
      break;
    case "performance-desc":
      sortedEmployees.sort((left, right) => right.performance - left.performance || left.name.localeCompare(right.name));
      break;
    case "burnout-desc":
      sortedEmployees.sort((left, right) => right.burnout - left.burnout || left.name.localeCompare(right.name));
      break;
    case "salary-desc":
      sortedEmployees.sort((left, right) => right.salary - left.salary || left.name.localeCompare(right.name));
      break;
    case "priority":
    default:
      sortedEmployees.sort(
        (left, right) => left.action.priority - right.action.priority || right.performance - left.performance
      );
      break;
  }

  return sortedEmployees;
}

function getRosterPageCount() {
  return Math.max(1, Math.ceil(getFilteredRosterEmployees().length / state.rosterPageSize));
}

function getPaginatedRosterEmployees() {
  const employees = getFilteredRosterEmployees();
  const totalPages = getRosterPageCount();
  state.currentRosterPage = Math.min(totalPages, Math.max(1, state.currentRosterPage));

  const start = (state.currentRosterPage - 1) * state.rosterPageSize;
  return employees.slice(start, start + state.rosterPageSize);
}

function syncSelectedEmployeeToCurrentRoster() {
  const filteredEmployees = getFilteredRosterEmployees();

  if (!filteredEmployees.length) {
    if (state.editorMode !== "create") {
      state.selectedEmployeeId = null;
    }
    return;
  }

  if (state.editorMode !== "create" && !filteredEmployees.some((employee) => employee.id === state.selectedEmployeeId)) {
    state.selectedEmployeeId = filteredEmployees[0].id;
  }
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
  const pendingLeaveRequests = allEmployees.flatMap((employee) =>
    employee.leaveRequests
      .filter((request) => request.status === "Pending")
      .map((request) => ({ ...request, employeeName: employee.name }))
  );
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
    if (query.includes("pending") || query.includes("approval") || query.includes("approve")) {
      return {
        answer: pendingLeaveRequests.length
          ? `${pendingLeaveRequests.map((request) => request.employeeName).join(", ")} currently have pending leave approvals. The newest request window starts on ${formatDate(pendingLeaveRequests[0].startDate)}.`
          : "There are no pending leave approvals right now.",
        flash: "EMSOU checked pending leave approvals."
      };
    }

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

  if (query.includes("salary") || query.includes("compensation")) {
    const highestPaid = [...contextEmployees].sort((left, right) => right.salary - left.salary)[0];
    return {
      answer: `${highestPaid.name} is currently the highest-paid employee in this view at ${formatCurrency(highestPaid.salary, highestPaid.salaryCurrency)}. The next compensation reviews coming up are ${state.dashboard.salaryInsights.reviewSoon.map((employee) => employee.name).join(", ")}.`,
      flash: "EMSOU reviewed salary and compensation history."
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

function renderPagination() {
  const totalItems = getFilteredRosterEmployees().length;
  const totalPages = getRosterPageCount();
  const start = totalItems ? (state.currentRosterPage - 1) * state.rosterPageSize + 1 : 0;
  const end = Math.min(totalItems, state.currentRosterPage * state.rosterPageSize);

  elements.paginationStatus.textContent =
    totalItems === 0
      ? "No results"
      : `Page ${state.currentRosterPage} of ${totalPages} · Showing ${start}-${end} of ${totalItems}`;
  elements.paginationPrev.disabled = state.currentRosterPage <= 1;
  elements.paginationNext.disabled = state.currentRosterPage >= totalPages;
}

function renderEmployeeGrid() {
  const employees = getPaginatedRosterEmployees();

  if (!employees.length) {
    elements.employeeGrid.innerHTML = '<div class="empty-state">No employees match the current search and department filters.</div>';
    return;
  }

  elements.employeeGrid.innerHTML = employees
    .map(
      (employee) => `
        <article class="employee-card ${state.selectedEmployeeId === employee.id && state.editorMode !== "create" ? "active" : ""}" data-employee-id="${escapeHtml(employee.id)}">
          <div class="employee-top">
            ${renderAvatar(employee)}
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
            <div class="meta-block">
              <span>Salary</span>
              <strong>${escapeHtml(formatCurrency(employee.salary, employee.salaryCurrency))}</strong>
            </div>
            <div class="meta-block">
              <span>Leave Queue</span>
              <strong>${escapeHtml(`${employee.leaveRequests.filter((request) => request.status === "Pending").length} pending`)}</strong>
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

          <div class="employee-card-actions">
            <button class="ghost-btn" type="button" data-card-action="view">View</button>
            <button class="primary-btn" type="button" data-card-action="edit">Edit</button>
          </div>
        </article>
      `
    )
    .join("");
}

function renderEmployeeDetail() {
  const employee = state.editorMode === "create" ? null : getSelectedEmployee();

  if (!employee) {
    elements.employeeDetail.innerHTML = '<div class="empty-state">Select an employee to read the profile, or open the management page to create a fresh record.</div>';
    return;
  }

  elements.employeeDetail.innerHTML = `
    <div class="focus-identity">
      ${renderAvatar(employee, true)}
      <div class="focus-copy">
        <h4>${escapeHtml(employee.name)}</h4>
        <p>${escapeHtml(`${employee.role} · ${employee.department} · ${employee.mode}`)}</p>
        <p>${escapeHtml(employee.email)}</p>
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
      <div class="detail-pill">
        <span class="eyebrow">Current Salary</span>
        <strong>${escapeHtml(formatCurrency(employee.salary, employee.salaryCurrency))}</strong>
      </div>
      <div class="detail-pill">
        <span class="eyebrow">Next Review</span>
        <strong>${escapeHtml(formatDate(employee.nextReviewDate))}</strong>
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

    <div class="detail-history-grid">
      <div class="detail-history-card">
        <span class="eyebrow">Salary / Hike History</span>
        ${employee.salaryHistory
          .slice(0, 3)
          .map(
            (entry) => `
              <div class="history-row">
                <strong>${escapeHtml(formatCurrency(entry.salary, employee.salaryCurrency))}</strong>
                <span>${escapeHtml(`${entry.percent >= 0 ? "+" : ""}${entry.percent}% · ${formatDate(entry.effectiveDate)}`)}</span>
                <p>${escapeHtml(entry.reason)}</p>
              </div>
            `
          )
          .join("")}
      </div>

      <div class="detail-history-card">
        <span class="eyebrow">Leave Status History</span>
        ${
          employee.leaveRequests.length
            ? employee.leaveRequests
                .slice(0, 3)
                .map(
                  (request) => `
                    <div class="history-row">
                      <strong>${escapeHtml(request.status)}</strong>
                      <span>${escapeHtml(`${formatDate(request.startDate)} to ${formatDate(request.endDate)} · ${request.days} days`)}</span>
                      <p>${escapeHtml(request.reason)}</p>
                    </div>
                  `
                )
                .join("")
            : '<p class="micro-note">No leave requests recorded yet.</p>'
        }
      </div>
    </div>

    <div class="detail-actions">
      <button class="primary-btn" type="button" data-profile-action="edit">Edit Employee</button>
      <button class="ghost-btn" type="button" data-profile-action="summary">Ask AI About ${escapeHtml(employee.name)}</button>
      <button class="danger-btn" type="button" data-profile-action="delete">Delete Employee</button>
    </div>
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

function renderEmployeePickers() {
  const options = getEmployees()
    .map(
      (employee) => `
        <option value="${escapeHtml(employee.id)}">${escapeHtml(`${employee.name} · ${employee.role}`)}</option>
      `
    )
    .join("");

  elements.emailEmployee.innerHTML = options;

  const selectedId = state.selectedEmployeeId || getEmployees()[0]?.id || "";
  elements.emailEmployee.value = selectedId;
}

function renderDepartmentCharts() {
  elements.departmentCharts.innerHTML = state.dashboard.departmentCharts
    .map(
      (item) => `
        <article class="chart-card">
          <div class="chart-top">
            <div>
              <h4>${escapeHtml(item.department)}</h4>
              <p>${escapeHtml(`${item.headcount} people · ${item.working} working · ${item.onLeave} on leave`)}</p>
            </div>
            <strong>${escapeHtml(formatCurrency(item.avgSalary, "INR"))}</strong>
          </div>

          <div class="chart-metric">
            <span>Performance</span>
            <strong>${item.avgPerformance}%</strong>
            <div class="mini-bar"><i style="width:${item.avgPerformance}%"></i></div>
          </div>
          <div class="chart-metric">
            <span>Burnout</span>
            <strong>${item.avgBurnout}%</strong>
            <div class="mini-bar"><i style="width:${item.avgBurnout}%"></i></div>
          </div>
          <div class="chart-metric">
            <span>Avg Hike</span>
            <strong>${item.avgHike}%</strong>
            <div class="mini-bar"><i style="width:${Math.min(100, item.avgHike * 4)}%"></i></div>
          </div>
        </article>
      `
    )
    .join("");
}

function renderSalaryInsights() {
  const insights = state.dashboard.salaryInsights;
  const reviewSoonMarkup = insights.reviewSoon
    .map(
      (employee) => `
        <div class="salary-item">
          <strong>${escapeHtml(employee.name)}</strong>
          <span>${escapeHtml(`${employee.department} · ${formatDate(employee.nextReviewDate)}`)}</span>
        </div>
      `
    )
    .join("");
  const topPaidMarkup = insights.topPaid
    .map(
      (employee) => `
        <div class="salary-item">
          <strong>${escapeHtml(employee.name)}</strong>
          <span>${escapeHtml(`${formatCurrency(employee.salary, employee.currency)} · last hike ${employee.lastHikePercent}%`)}</span>
        </div>
      `
    )
    .join("");

  elements.salaryInsights.innerHTML = `
    <article class="salary-summary-card">
      <span class="eyebrow">Payroll</span>
      <h4>${escapeHtml(formatCurrency(insights.payroll, "INR"))}</h4>
      <p>${escapeHtml(`Average salary is ${formatCurrency(insights.avgSalary, "INR")} across the current workforce.`)}</p>
    </article>
    <article class="salary-summary-card">
      <span class="eyebrow">Upcoming Reviews</span>
      ${reviewSoonMarkup}
    </article>
    <article class="salary-summary-card">
      <span class="eyebrow">Top Compensation</span>
      ${topPaidMarkup}
    </article>
  `;
}

function renderEmailDraft() {
  elements.emailSubject.textContent = state.emailDraft.subject || "Generate a draft to see the subject line.";
  elements.emailBody.textContent = state.emailDraft.body || "The generated draft will appear here.";
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
  elements.saveEmployeeButton.textContent = state.editorMode === "create" ? "Create Employee" : "Save Employee";
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
  const action = event.target.closest("[data-card-action]")?.dataset.cardAction;

  if (action === "edit") {
    return openSelectedEditor();
  }

  setEditorStatus("");
  renderEmployeeGrid();
  renderEmployeeDetail();
  renderEditor();
  renderCrudToolbar();
}

function handleProfileActionClick(event) {
  const action = event.target.closest("[data-profile-action]")?.dataset.profileAction;
  if (!action) {
    return;
  }

  if (action === "edit") {
    openSelectedEditor();
    return;
  }

  if (action === "summary") {
    const employee = getSelectedEmployee();
    if (!employee) {
      return;
    }

    setCurrentPage("dashboard");
    runAiQuery(employee.name);
    return;
  }

  if (action === "delete") {
    handleEmployeeDelete();
  }
}

function handleDepartmentFilterClick(event) {
  const button = event.target.closest("[data-filter]");
  if (!button) {
    return;
  }

  state.activeDepartment = button.dataset.filter;
  state.currentRosterPage = 1;
  syncSelectedEmployeeToCurrentRoster();

  renderFilters();
  renderEmployeeGrid();
  renderPagination();
  renderEmployeeDetail();
  renderEditor();
  renderCrudToolbar();
}

function handleEmployeeSearchInput(event) {
  state.searchQuery = event.target.value;
  state.currentRosterPage = 1;
  syncSelectedEmployeeToCurrentRoster();
  renderEmployeeGrid();
  renderPagination();
  renderEmployeeDetail();
  renderCrudToolbar();
}

function handleEmployeeSortChange(event) {
  state.sortKey = event.target.value;
  state.currentRosterPage = 1;
  syncSelectedEmployeeToCurrentRoster();
  renderEmployeeGrid();
  renderPagination();
  renderEmployeeDetail();
  renderCrudToolbar();
}

function changeRosterPage(direction) {
  const totalPages = getRosterPageCount();
  state.currentRosterPage = Math.min(totalPages, Math.max(1, state.currentRosterPage + direction));
  renderEmployeeGrid();
  renderPagination();
}

function downloadBlob(filename, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function exportEmployeesCsv() {
  const employees = getFilteredRosterEmployees();
  if (!employees.length) {
    showFlash("There are no employees to export in the current filter.", true);
    return;
  }

  const headers = [
    "Name",
    "Role",
    "Department",
    "Email",
    "Availability",
    "Performance",
    "Submissions",
    "Burnout",
    "Salary",
    "Last Hike %",
    "Next Review"
  ];
  const rows = employees.map((employee) => [
    employee.name,
    employee.role,
    employee.department,
    employee.email,
    employee.availability,
    employee.performance,
    employee.submissions,
    employee.burnout,
    employee.salary,
    employee.lastHikePercent,
    employee.nextReviewDate
  ]);
  const csv = [headers, ...rows]
    .map((row) =>
      row
        .map((value) => `"${String(value ?? "").replace(/"/g, '""')}"`)
        .join(",")
    )
    .join("\n");

  downloadBlob("emsou-employees.csv", csv, "text/csv;charset=utf-8");
  showFlash("Filtered employees exported as CSV.");
}

function exportEmployeesPdf() {
  const employees = getFilteredRosterEmployees();
  if (!employees.length) {
    showFlash("There are no employees to export in the current filter.", true);
    return;
  }

  const reportWindow = window.open("", "_blank", "width=1100,height=800");
  if (!reportWindow) {
    showFlash("Popup blocked. Allow popups to export the PDF view.", true);
    return;
  }

  reportWindow.document.write(`
    <html>
      <head>
        <title>EMSOU Employee Report</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 28px; color: #0f172a; }
          h1 { margin-bottom: 8px; }
          p { color: #475569; }
          table { width: 100%; border-collapse: collapse; margin-top: 18px; }
          th, td { border: 1px solid #cbd5e1; padding: 10px; text-align: left; font-size: 13px; }
          th { background: #e2e8f0; }
        </style>
      </head>
      <body>
        <h1>EMSOU Employee Report</h1>
        <p>Filtered export generated on ${new Date().toLocaleString()}.</p>
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Role</th>
              <th>Department</th>
              <th>Status</th>
              <th>Performance</th>
              <th>Burnout</th>
              <th>Salary</th>
            </tr>
          </thead>
          <tbody>
            ${employees
              .map(
                (employee) => `
                  <tr>
                    <td>${escapeHtml(employee.name)}</td>
                    <td>${escapeHtml(employee.role)}</td>
                    <td>${escapeHtml(employee.department)}</td>
                    <td>${escapeHtml(employee.availability)}</td>
                    <td>${employee.performance}%</td>
                    <td>${employee.burnout}%</td>
                    <td>${escapeHtml(formatCurrency(employee.salary, employee.salaryCurrency))}</td>
                  </tr>
                `
              )
              .join("")}
          </tbody>
        </table>
      </body>
    </html>
  `);
  reportWindow.document.close();
  reportWindow.focus();
  reportWindow.print();
  showFlash("PDF view opened. Save it as PDF from the print dialog.");
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

function activateCreateMode(targetPage = "management") {
  state.editorMode = "create";
  state.draftEmployee = createBlankEmployee();
  setEditorStatus("Create mode enabled. Fill out the form and save the new employee.");
  renderEmployeeGrid();
  renderEmployeeDetail();
  renderEditor();
  renderCrudToolbar();
  setCurrentPage(targetPage);
}

function handleEditorReset() {
  if (state.editorMode === "create") {
    state.draftEmployee = createBlankEmployee();
  }

  setEditorStatus("Editor reset.");
  renderEditor();
  renderCrudToolbar();
}

function serializeEmployeeForm() {
  const formData = new FormData(elements.employeeForm);
  const existingRecord = state.editorMode === "create" ? state.draftEmployee : getSelectedEmployee();

  return {
    name: formData.get("name"),
    role: formData.get("role"),
    department: formData.get("department"),
    manager: formData.get("manager"),
    email: formData.get("email"),
    photo: formData.get("photo"),
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
    salary: Number(formData.get("salary")),
    salaryCurrency: formData.get("salaryCurrency"),
    lastHikePercent: Number(formData.get("lastHikePercent")),
    lastHikeDate: formData.get("lastHikeDate"),
    nextReviewDate: formData.get("nextReviewDate"),
    leaveRequests: existingRecord?.leaveRequests || [],
    salaryHistory: existingRecord?.salaryHistory || [],
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

  if (elements.employeesDeleteButton && elements.employeesDeleteButton !== elements.deleteEmployeeButton) {
    setButtonBusy(elements.employeesDeleteButton, "Deleting...");
  }
  setButtonBusy(elements.deleteEmployeeButton, "Deleting...");
  setEditorStatus(`Deleting ${employee.name}...`);

  try {
    await requestJson(`/api/employees/${employee.id}`, {
      method: "DELETE"
    });

    state.selectedEmployeeId = null;
    state.editorMode = "edit";
    setCurrentPage("employees");
    await loadDashboard(`${employee.name} deleted successfully.`);
  } catch (error) {
    setEditorStatus(error.message, true);
  } finally {
    resetButton(elements.deleteEmployeeButton);
    if (elements.employeesDeleteButton && elements.employeesDeleteButton !== elements.deleteEmployeeButton) {
      resetButton(elements.employeesDeleteButton);
    }
  }
}

function buildEmailDraft(employee, template, context) {
  const lowerContext = String(context || "").trim();
  const intro = lowerContext ? `Additional context: ${lowerContext}` : "";

  if (template === "leave_approval") {
    const latestLeave = employee.leaveRequests[0];
    return {
      subject: `Leave decision for ${employee.name}`,
      body: `Hi ${employee.name},\n\nYour leave request for ${latestLeave ? `${formatDate(latestLeave.startDate)} to ${formatDate(latestLeave.endDate)}` : "the requested dates"} has been reviewed. The request is aligned with coverage planning and current team needs. Please coordinate handoff notes with ${employee.manager} before the leave window begins.\n\n${intro}\n\nRegards,\n${state.session?.name || "EMSOU"}`
    };
  }

  if (template === "salary_review") {
    return {
      subject: `Compensation review discussion for ${employee.name}`,
      body: `Hi ${employee.name},\n\nWe are preparing for your compensation review. Your current salary is ${formatCurrency(employee.salary, employee.salaryCurrency)}, the most recent hike was ${employee.lastHikePercent}%, and the next formal review is planned for ${formatDate(employee.nextReviewDate)}. Please come prepared with impact highlights, delivery wins, and growth goals so we can have a balanced discussion.\n\n${intro}\n\nRegards,\n${state.session?.name || "EMSOU"}`
    };
  }

  if (template === "performance_followup") {
    return {
      subject: `Performance follow-up and support plan`,
      body: `Hi ${employee.name},\n\nI wanted to follow up on your recent delivery and performance signals. We are seeing ${employee.performance}% performance, ${employee.submissions}% submissions, and ${employee.burnout}% burnout risk. Let us use the next check-in to clarify blockers, support needed, and the most important outcomes for the next review window.\n\n${intro}\n\nRegards,\n${state.session?.name || "EMSOU"}`
    };
  }

  if (template === "return_to_work") {
    return {
      subject: `Welcome back and return-to-work plan`,
      body: `Hi ${employee.name},\n\nWelcome back. Before you fully ramp in, please reconnect with ${employee.manager} to review handoffs, current priorities, and the next milestone: ${employee.milestone}. We want your return to feel smooth, supported, and realistic based on current workload.\n\n${intro}\n\nRegards,\n${state.session?.name || "EMSOU"}`
    };
  }

  return {
    subject: `Recognition for your recent impact`,
    body: `Hi ${employee.name},\n\nI wanted to recognize the work you have been doing as ${employee.role}. Your recent performance is ${employee.performance}%, submissions are ${employee.submissions}%, and your current focus on ${employee.focus} is making a visible difference. Thank you for the consistency and ownership you are showing.\n\n${intro}\n\nRegards,\n${state.session?.name || "EMSOU"}`
  };
}

function handleEmailDraftGenerate(event) {
  event.preventDefault();
  const formData = new FormData(elements.emailForm);
  const employee = getEmployees().find((candidate) => candidate.id === formData.get("employeeId"));

  if (!employee) {
    showFlash("Choose an employee before generating an email draft.", true);
    return;
  }

  state.emailDraft = buildEmailDraft(employee, formData.get("template"), formData.get("context"));
  renderEmailDraft();
  showFlash(`Draft generated for ${employee.name}.`);
}

function openDraftInMailClient() {
  const employee = getEmployees().find((candidate) => candidate.id === elements.emailEmployee.value);
  if (!employee || !state.emailDraft.subject || !state.emailDraft.body) {
    showFlash("Generate a draft first, then open it in your mail app.", true);
    return;
  }

  const mailto = `mailto:${encodeURIComponent(employee.email)}?subject=${encodeURIComponent(state.emailDraft.subject)}&body=${encodeURIComponent(state.emailDraft.body)}`;
  window.location.href = mailto;
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
