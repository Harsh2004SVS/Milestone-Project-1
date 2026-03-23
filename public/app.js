const loginForm = document.getElementById('loginForm');
const registerForm = document.getElementById('registerForm');
const logoutBtn = document.getElementById('logoutBtn');
const authCard = document.getElementById('authCard');
const sessionCard = document.getElementById('sessionCard');
const sessionInfo = document.getElementById('sessionInfo');
const themeToggleBtn = document.getElementById('themeToggleBtn');
const registerStatus = document.getElementById('registerStatus');

const studentDashboard = document.getElementById('studentDashboard');
const adminDashboard = document.getElementById('adminDashboard');

const examSelect = document.getElementById('examSelect');
const examInfo = document.getElementById('examInfo');
const startExamForm = document.getElementById('startExamForm');
const examSection = document.getElementById('examSection');
const examForm = document.getElementById('examForm');
const examTitle = document.getElementById('examTitle');
const timerEl = document.getElementById('timer');
const submitExamBtn = document.getElementById('submitExamBtn');
const submissionSection = document.getElementById('submissionSection');
const submissionBox = document.getElementById('submissionBox');

const refreshStudentResultsBtn = document.getElementById('refreshStudentResultsBtn');
const studentResultsBox = document.getElementById('studentResultsBox');

const refreshAdminAttemptsBtn = document.getElementById('refreshAdminAttemptsBtn');
const adminAttemptsBox = document.getElementById('adminAttemptsBox');

let authToken = null;
let currentUser = null;

let currentAttemptId = null;
let currentQuestions = [];
let timerInterval = null;
let timeLeftSeconds = 0;
let adminMonitorInterval = null;
const THEME_STORAGE_KEY = 'exam_app_theme';

function getStoredTheme() {
  try {
    const value = localStorage.getItem(THEME_STORAGE_KEY);
    if (value === 'light' || value === 'dark') {
      return value;
    }
  } catch (_) {
    // Ignore storage errors
  }
  return 'dark';
}

function applyTheme(theme) {
  document.body.setAttribute('data-theme', theme);
  if (themeToggleBtn) {
    themeToggleBtn.textContent = theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode';
  }
}

function initializeTheme() {
  applyTheme(getStoredTheme());
}

if (themeToggleBtn) {
  themeToggleBtn.addEventListener('click', () => {
    const current = document.body.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
    const next = current === 'dark' ? 'light' : 'dark';
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch (_) {
      // Ignore storage errors
    }
    applyTheme(next);
  });
}

function resetExamState() {
  currentAttemptId = null;
  currentQuestions = [];
  clearInterval(timerInterval);
  examSection.classList.add('hidden');
}

async function apiRequest(url, options = {}) {
  const headers = {
    ...(options.headers || {})
  };

  if (authToken) {
    headers.Authorization = `Bearer ${authToken}`;
  }

  if (options.body && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  const response = await fetch(url, {
    ...options,
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined
  });

  const text = await response.text();
  let data = {};

  if (text) {
    try {
      data = JSON.parse(text);
    } catch (_) {
      data = { raw: text };
    }
  }

  if (!response.ok) {
    throw new Error(data.error || `Request failed (${response.status})`);
  }

  return data;
}

function formatDateTime(value) {
  return value ? new Date(value).toLocaleString() : '-';
}

function getLifecycleBadge(row) {
  if (row.lifecycle_status === 'IN_PROGRESS') {
    return '<span class="badge badge-progress">In Progress</span>';
  }
  if (row.lifecycle_status === 'SUBMITTED_PENDING_VERIFICATION') {
    return '<span class="badge badge-pending">Pending Verification</span>';
  }
  if (row.lifecycle_status === 'VERIFIED_PENDING_PUBLISH') {
    return '<span class="badge badge-verified">Verified - Not Published</span>';
  }
  return '<span class="badge badge-published">Published</span>';
}

function renderAuthState() {
  const loggedIn = Boolean(currentUser && authToken);

  authCard.classList.toggle('hidden', loggedIn);
  sessionCard.classList.toggle('hidden', !loggedIn);
  studentDashboard.classList.add('hidden');
  adminDashboard.classList.add('hidden');
  resetExamState();

  clearInterval(adminMonitorInterval);

  if (!loggedIn) {
    return;
  }

  sessionInfo.textContent = `${currentUser.fullName} (${currentUser.username}) - ${currentUser.role}`;

  if (currentUser.role === 'STUDENT') {
    studentDashboard.classList.remove('hidden');
    loadExams();
    loadStudentResults();
  } else if (currentUser.role === 'ADMIN') {
    adminDashboard.classList.remove('hidden');
    loadAdminAttempts();
    adminMonitorInterval = setInterval(loadAdminAttempts, 15000);
  }
}

loginForm.addEventListener('submit', async (event) => {
  event.preventDefault();

  const username = document.getElementById('username').value.trim();
  const password = document.getElementById('password').value;

  try {
    const response = await apiRequest('/api/auth/login', {
      method: 'POST',
      body: { username, password }
    });

    authToken = response.token;
    currentUser = response.user;

    loginForm.reset();
    renderAuthState();
  } catch (error) {
    alert(error.message);
  }
});

if (registerForm) {
  registerForm.addEventListener('submit', async (event) => {
    event.preventDefault();

    const fullName = document.getElementById('registerFullName').value.trim();
    const username = document.getElementById('registerUsername').value.trim();
    const password = document.getElementById('registerPassword').value;
    const confirmPassword = document.getElementById('registerConfirmPassword').value;

    if (password !== confirmPassword) {
      registerStatus.textContent = 'Passwords do not match.';
      registerStatus.className = 'warning-text';
      return;
    }

    try {
      const response = await apiRequest('/api/auth/register-student', {
        method: 'POST',
        body: {
          fullName,
          username,
          password
        }
      });

      registerStatus.textContent = response.message;
      registerStatus.className = 'success-text';

      registerForm.reset();
      document.getElementById('username').value = username;
      document.getElementById('password').value = password;
    } catch (error) {
      registerStatus.textContent = error.message;
      registerStatus.className = 'warning-text';
    }
  });
}

logoutBtn.addEventListener('click', async () => {
  try {
    if (authToken) {
      await apiRequest('/api/auth/logout', { method: 'POST' });
    }
  } catch (_) {
    // Ignore logout errors from expired sessions
  }

  authToken = null;
  currentUser = null;
  submissionSection.classList.add('hidden');
  renderAuthState();
});

async function loadExams() {
  try {
    const exams = await apiRequest('/api/exams');

    examSelect.innerHTML = '<option value="">-- Select Exam --</option>';

    exams.forEach((exam) => {
      const option = document.createElement('option');
      option.value = exam.id;
      option.textContent = `${exam.title} (${exam.question_count} questions, ${exam.duration_minutes} min)`;
      option.dataset.description = exam.description || '';
      option.dataset.pass = exam.pass_percentage;
      examSelect.appendChild(option);
    });

    examInfo.textContent = '';
  } catch (error) {
    examInfo.textContent = `Failed to load exams: ${error.message}`;
  }
}

examSelect.addEventListener('change', () => {
  const selected = examSelect.options[examSelect.selectedIndex];
  if (!selected || !selected.value) {
    examInfo.textContent = '';
    return;
  }

  examInfo.textContent = `${selected.dataset.description} | Pass Marks: ${selected.dataset.pass}%`;
});

startExamForm.addEventListener('submit', async (event) => {
  event.preventDefault();

  const examId = Number(examSelect.value);
  if (!examId) {
    alert('Please choose an exam.');
    return;
  }

  try {
    const response = await apiRequest('/api/attempts/start', {
      method: 'POST',
      body: { examId }
    });

    currentAttemptId = response.attemptId;
    currentQuestions = response.questions;

    renderExam(response.exam.title, response.questions);
    startTimer(response.exam.duration_minutes * 60);

    examSection.classList.remove('hidden');
    submissionSection.classList.add('hidden');
  } catch (error) {
    alert(error.message);
  }
});

function renderExam(title, questions) {
  examTitle.textContent = title;
  examForm.innerHTML = '';

  questions.forEach((question) => {
    const wrapper = document.createElement('div');
    wrapper.className = 'question';

    wrapper.innerHTML = `
      <p>Q${question.serial}. ${question.questionText}</p>
      ${['A', 'B', 'C', 'D']
        .map(
          (key) => `
          <label class="option-row">
            <input type="radio" name="question-${question.questionId}" value="${key}">
            <span>${key}. ${question.options[key]}</span>
          </label>
        `
        )
        .join('')}
    `;

    examForm.appendChild(wrapper);
  });
}

function startTimer(seconds) {
  clearInterval(timerInterval);
  timeLeftSeconds = seconds;
  renderTimer();

  timerInterval = setInterval(() => {
    timeLeftSeconds -= 1;
    renderTimer();

    if (timeLeftSeconds <= 0) {
      clearInterval(timerInterval);
      submitExam(true);
    }
  }, 1000);
}

function renderTimer() {
  const min = String(Math.floor(timeLeftSeconds / 60)).padStart(2, '0');
  const sec = String(timeLeftSeconds % 60).padStart(2, '0');
  timerEl.textContent = `${min}:${sec}`;
}

submitExamBtn.addEventListener('click', () => submitExam(false));

async function submitExam(autoSubmit) {
  if (!currentAttemptId) {
    return;
  }

  clearInterval(timerInterval);

  const answers = currentQuestions.map((question) => {
    const selected = document.querySelector(`input[name="question-${question.questionId}"]:checked`);
    return {
      questionId: question.questionId,
      selectedOption: selected ? selected.value : null
    };
  });

  try {
    const response = await apiRequest(`/api/attempts/${currentAttemptId}/submit`, {
      method: 'POST',
      body: { answers }
    });

    examSection.classList.add('hidden');
    submissionSection.classList.remove('hidden');

    submissionBox.innerHTML = `
      <p class="warning-text">${response.message}</p>
      ${autoSubmit ? '<p><em>Auto-submitted because time ended.</em></p>' : ''}
      <p>Result will appear in <strong>Published Results</strong> once admin verifies and publishes it.</p>
    `;

    resetExamState();
    await loadStudentResults();
  } catch (error) {
    alert(error.message);
  }
}

async function loadStudentResults() {
  try {
    const rows = await apiRequest('/api/student/results');

    if (!rows.length) {
      studentResultsBox.innerHTML = '<p>No published results available yet.</p>';
      return;
    }

    const htmlRows = rows
      .map(
        (row) => `
        <tr>
          <td>${row.attempt_id}</td>
          <td>${row.exam_title}</td>
          <td>${row.correct_answers}/${row.total_questions}</td>
          <td>${row.score_percentage}%</td>
          <td>${row.status}</td>
          <td>${formatDateTime(row.published_at)}</td>
          <td>${row.admin_remark || '-'}</td>
        </tr>
      `
      )
      .join('');

    studentResultsBox.innerHTML = `
      <table class="result-table">
        <thead>
          <tr>
            <th>Attempt</th>
            <th>Exam</th>
            <th>Correct</th>
            <th>Score</th>
            <th>Status</th>
            <th>Published At</th>
            <th>Admin Remark</th>
          </tr>
        </thead>
        <tbody>${htmlRows}</tbody>
      </table>
    `;
  } catch (error) {
    studentResultsBox.innerHTML = `<p>${error.message}</p>`;
  }
}

refreshStudentResultsBtn.addEventListener('click', loadStudentResults);

async function loadAdminAttempts() {
  try {
    const rows = await apiRequest('/api/admin/attempts');

    if (!rows.length) {
      adminAttemptsBox.innerHTML = '<p>No attempts available yet.</p>';
      return;
    }

    const htmlRows = rows
      .map((row) => {
        const canVerify = row.end_time && row.verification_status !== 'VERIFIED';
        const canPublish = row.end_time && row.verification_status === 'VERIFIED' && Number(row.is_published) === 0;

        return `
          <tr>
            <td>${row.attempt_id}</td>
            <td>${row.student_username || row.student_name}</td>
            <td>${row.exam_title}</td>
            <td>${row.end_time ? `${row.correct_answers}/${row.total_questions} (${row.score_percentage}%)` : '-'}</td>
            <td>${getLifecycleBadge(row)}</td>
            <td>${formatDateTime(row.start_time)}</td>
            <td>${formatDateTime(row.end_time)}</td>
            <td>${row.admin_remark || '-'}</td>
            <td>
              ${
                canVerify
                  ? `<button class="small-btn" data-action="verify" data-id="${row.attempt_id}">Verify</button>`
                  : 'Done'
              }
            </td>
            <td>
              ${
                canPublish
                  ? `<button class="small-btn" data-action="publish" data-id="${row.attempt_id}">Publish</button>`
                  : Number(row.is_published) === 1
                    ? 'Published'
                    : '-'
              }
            </td>
          </tr>
        `;
      })
      .join('');

    adminAttemptsBox.innerHTML = `
      <table class="result-table">
        <thead>
          <tr>
            <th>Attempt</th>
            <th>Student</th>
            <th>Exam</th>
            <th>Score</th>
            <th>Status</th>
            <th>Started</th>
            <th>Submitted</th>
            <th>Remark</th>
            <th>Verify</th>
            <th>Publish</th>
          </tr>
        </thead>
        <tbody>${htmlRows}</tbody>
      </table>
    `;
  } catch (error) {
    adminAttemptsBox.innerHTML = `<p>${error.message}</p>`;
  }
}

refreshAdminAttemptsBtn.addEventListener('click', loadAdminAttempts);

adminAttemptsBox.addEventListener('click', async (event) => {
  const button = event.target.closest('button[data-action]');
  if (!button) {
    return;
  }

  const attemptId = Number(button.dataset.id);
  const action = button.dataset.action;

  try {
    if (action === 'verify') {
      const remark = prompt('Optional admin remark for student result:', '') || '';
      await apiRequest(`/api/admin/attempts/${attemptId}/verify`, {
        method: 'PATCH',
        body: { remark }
      });
      alert(`Attempt ${attemptId} verified.`);
    }

    if (action === 'publish') {
      await apiRequest(`/api/admin/attempts/${attemptId}/publish`, {
        method: 'PATCH'
      });
      alert(`Attempt ${attemptId} published.`);
    }

    await loadAdminAttempts();
  } catch (error) {
    alert(error.message);
  }
});

initializeTheme();
renderAuthState();
