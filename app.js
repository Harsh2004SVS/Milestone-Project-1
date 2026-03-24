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
const IS_GITHUB_PAGES = window.location.hostname.endsWith('github.io');
const MOCK_DB_STORAGE_KEY = 'exam_pro_mock_db_v1';
const mockSessions = new Map();

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

function getDefaultMockDb() {
  return {
    users: [
      { id: 1, username: 'admin', password: 'admin123', role: 'ADMIN', full_name: 'System Administrator' },
      { id: 2, username: 'student1', password: 'student123', role: 'STUDENT', full_name: 'Student One' },
      { id: 3, username: 'student2', password: 'student123', role: 'STUDENT', full_name: 'Student Two' }
    ],
    students: [
      { id: 1, user_id: 2, name: 'student1' },
      { id: 2, user_id: 3, name: 'student2' }
    ],
    exams: [
      { id: 1, title: 'Web Development Basics', description: 'HTML, CSS, and JavaScript fundamentals', duration_minutes: 15, pass_percentage: 50 },
      { id: 2, title: 'SQL Fundamentals', description: 'Database and SQL query basics', duration_minutes: 15, pass_percentage: 50 }
    ],
    questions: [
      { id: 1, exam_id: 1, question_text: 'What does HTML stand for?', option_a: 'HyperText Markup Language', option_b: 'HighText Machine Language', option_c: 'Hyperlink and Text Markup Language', option_d: 'Home Tool Markup Language', correct_option: 'A', marks: 1 },
      { id: 2, exam_id: 1, question_text: 'Which CSS property controls text size?', option_a: 'font-style', option_b: 'text-size', option_c: 'font-size', option_d: 'text-style', correct_option: 'C', marks: 1 },
      { id: 3, exam_id: 1, question_text: 'Which method adds an element to the end of an array in JavaScript?', option_a: 'push()', option_b: 'add()', option_c: 'append()', option_d: 'insert()', correct_option: 'A', marks: 1 },
      { id: 4, exam_id: 1, question_text: 'Which symbol is used for single-line comments in JavaScript?', option_a: '<!-- -->', option_b: '#', option_c: '//', option_d: '/* */', correct_option: 'C', marks: 1 },
      { id: 5, exam_id: 1, question_text: 'Which HTML tag is used for the largest heading?', option_a: '<h6>', option_b: '<heading>', option_c: '<h1>', option_d: '<head>', correct_option: 'C', marks: 1 },
      { id: 6, exam_id: 2, question_text: 'Which SQL statement is used to fetch data from a database?', option_a: 'GET', option_b: 'SELECT', option_c: 'PULL', option_d: 'FETCH', correct_option: 'B', marks: 1 },
      { id: 7, exam_id: 2, question_text: 'Which clause is used to filter records in SQL?', option_a: 'ORDER BY', option_b: 'GROUP BY', option_c: 'WHERE', option_d: 'FILTER', correct_option: 'C', marks: 1 },
      { id: 8, exam_id: 2, question_text: 'Which SQL command is used to remove a table?', option_a: 'DROP TABLE', option_b: 'DELETE TABLE', option_c: 'REMOVE TABLE', option_d: 'CLEAR TABLE', correct_option: 'A', marks: 1 },
      { id: 9, exam_id: 2, question_text: 'Which aggregate function returns the number of rows?', option_a: 'SUM()', option_b: 'TOTAL()', option_c: 'COUNT()', option_d: 'ROWS()', correct_option: 'C', marks: 1 },
      { id: 10, exam_id: 2, question_text: 'Which keyword is used to sort results ascending?', option_a: 'SORT ASC', option_b: 'ASC', option_c: 'ORDER ASC', option_d: 'UP', correct_option: 'B', marks: 1 }
    ],
    attempts: [],
    attempt_answers: []
  };
}

function getMockDb() {
  try {
    const raw = localStorage.getItem(MOCK_DB_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.users && parsed.exams) {
        return parsed;
      }
    }
  } catch (_) {
    // Ignore parsing errors and reset mock DB
  }

  const defaults = getDefaultMockDb();
  localStorage.setItem(MOCK_DB_STORAGE_KEY, JSON.stringify(defaults));
  return defaults;
}

function saveMockDb(db) {
  localStorage.setItem(MOCK_DB_STORAGE_KEY, JSON.stringify(db));
}

function nextId(rows) {
  return rows.length ? Math.max(...rows.map((row) => row.id)) + 1 : 1;
}

function getAuthUserFromHeaders(headers) {
  const authHeader = headers?.Authorization || headers?.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  return token && mockSessions.has(token) ? mockSessions.get(token) : null;
}

function toSafeUser(user) {
  return {
    id: user.id,
    username: user.username,
    role: user.role,
    fullName: user.full_name
  };
}

function findOrCreateStudentForUser(db, user) {
  let student = db.students.find((row) => row.user_id === user.id);
  if (!student) {
    student = {
      id: nextId(db.students),
      user_id: user.id,
      name: user.username
    };
    db.students.push(student);
  }
  return student;
}

function mockError(status, message) {
  const error = new Error(message);
  error.status = status;
  throw error;
}

function parseRoutePath(url) {
  return new URL(url, window.location.origin).pathname;
}

async function mockApiRequest(url, request = {}) {
  const db = getMockDb();
  const method = (request.method || 'GET').toUpperCase();
  const path = parseRoutePath(url);
  const body = request.body || {};
  const user = getAuthUserFromHeaders(request.headers || {});

  if (method === 'POST' && path === '/api/auth/register-student') {
    const fullName = (body.fullName || '').trim();
    const username = (body.username || '').trim();
    const password = body.password || '';

    if (!fullName || !username || !password) {
      mockError(400, 'fullName, username, and password are required');
    }
    if (!/^[a-zA-Z0-9_]{3,30}$/.test(username)) {
      mockError(400, 'Username must be 3-30 characters and use only letters, numbers, or underscore');
    }
    if (password.length < 6) {
      mockError(400, 'Password must be at least 6 characters');
    }
    if (db.users.some((row) => row.username === username)) {
      mockError(409, 'Username already exists');
    }

    const newUser = {
      id: nextId(db.users),
      username,
      password,
      role: 'STUDENT',
      full_name: fullName
    };
    db.users.push(newUser);
    findOrCreateStudentForUser(db, newUser);
    saveMockDb(db);

    return {
      message: 'Student account created successfully. Please login.',
      user: {
        username,
        role: 'STUDENT',
        fullName
      }
    };
  }

  if (method === 'POST' && path === '/api/auth/login') {
    const username = (body.username || '').trim();
    const password = body.password || '';
    const found = db.users.find((row) => row.username === username && row.password === password);

    if (!found) {
      mockError(401, 'Invalid credentials');
    }

    const safeUser = toSafeUser(found);
    if (safeUser.role === 'STUDENT') {
      findOrCreateStudentForUser(db, safeUser);
      saveMockDb(db);
    }

    const token = `${Date.now()}_${Math.random().toString(16).slice(2)}`;
    mockSessions.set(token, safeUser);
    return { token, user: safeUser };
  }

  if (!user) {
    mockError(401, 'Unauthorized. Please login first.');
  }

  if (method === 'POST' && path === '/api/auth/logout') {
    const authHeader = request.headers?.Authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (token) {
      mockSessions.delete(token);
    }
    return { message: 'Logged out successfully' };
  }

  if (method === 'GET' && path === '/api/auth/me') {
    return { user };
  }

  if (method === 'GET' && path === '/api/exams') {
    return db.exams.map((exam) => ({
      ...exam,
      question_count: db.questions.filter((q) => q.exam_id === exam.id).length
    }));
  }

  if (method === 'POST' && path === '/api/attempts/start') {
    if (user.role !== 'STUDENT') {
      mockError(403, 'Forbidden for this role.');
    }

    const examId = Number(body.examId);
    const exam = db.exams.find((row) => row.id === examId);
    if (!exam) {
      mockError(404, 'Exam not found');
    }

    const student = findOrCreateStudentForUser(db, user);
    const questions = db.questions.filter((q) => q.exam_id === exam.id);
    const attempt = {
      id: nextId(db.attempts),
      student_id: student.id,
      exam_id: exam.id,
      start_time: new Date().toISOString(),
      end_time: null,
      total_questions: questions.length,
      correct_answers: null,
      score_percentage: null,
      status: null,
      verification_status: 'PENDING',
      verified_by: null,
      verified_at: null,
      is_published: 0,
      published_by: null,
      published_at: null,
      admin_remark: null
    };
    db.attempts.push(attempt);
    saveMockDb(db);

    return {
      attemptId: attempt.id,
      student: { id: student.id, name: student.name },
      exam,
      questions: questions.map((question, index) => ({
        serial: index + 1,
        questionId: question.id,
        questionText: question.question_text,
        options: {
          A: question.option_a,
          B: question.option_b,
          C: question.option_c,
          D: question.option_d
        },
        marks: question.marks
      }))
    };
  }

  const submitMatch = path.match(/^\/api\/attempts\/(\d+)\/submit$/);
  if (method === 'POST' && submitMatch) {
    if (user.role !== 'STUDENT') {
      mockError(403, 'Forbidden for this role.');
    }

    const attemptId = Number(submitMatch[1]);
    const attempt = db.attempts.find((row) => row.id === attemptId);
    const student = db.students.find((row) => row.id === attempt?.student_id);
    if (!attempt || !student || student.user_id !== user.id) {
      mockError(404, 'Attempt not found for this student');
    }
    if (attempt.end_time) {
      mockError(400, 'This attempt is already submitted');
    }

    const exam = db.exams.find((row) => row.id === attempt.exam_id);
    const questions = db.questions.filter((row) => row.exam_id === attempt.exam_id);
    const answers = Array.isArray(body.answers) ? body.answers : [];
    const answerMap = new Map(answers.map((row) => [Number(row.questionId), row.selectedOption || null]));

    db.attempt_answers = db.attempt_answers.filter((row) => row.attempt_id !== attempt.id);
    let correct = 0;

    questions.forEach((question) => {
      const selected = answerMap.get(question.id) || null;
      const isCorrect = selected === question.correct_option ? 1 : 0;
      if (isCorrect) correct += 1;

      db.attempt_answers.push({
        id: nextId(db.attempt_answers),
        attempt_id: attempt.id,
        question_id: question.id,
        selected_option: selected,
        is_correct: isCorrect
      });
    });

    const score = questions.length ? (correct / questions.length) * 100 : 0;
    attempt.end_time = new Date().toISOString();
    attempt.total_questions = questions.length;
    attempt.correct_answers = correct;
    attempt.score_percentage = Number(score.toFixed(2));
    attempt.status = score >= exam.pass_percentage ? 'PASS' : 'FAIL';
    attempt.verification_status = 'PENDING';
    attempt.verified_by = null;
    attempt.verified_at = null;
    attempt.is_published = 0;
    attempt.published_by = null;
    attempt.published_at = null;
    attempt.admin_remark = null;
    saveMockDb(db);

    return { message: 'Exam submitted. Result is pending admin verification and publication.' };
  }

  if (method === 'GET' && path === '/api/student/results') {
    if (user.role !== 'STUDENT') {
      mockError(403, 'Forbidden for this role.');
    }

    const student = findOrCreateStudentForUser(db, user);
    const rows = db.attempts
      .filter((row) => row.student_id === student.id && row.end_time && row.verification_status === 'VERIFIED' && row.is_published === 1)
      .sort((a, b) => b.id - a.id)
      .map((row) => ({
        attempt_id: row.id,
        exam_title: db.exams.find((e) => e.id === row.exam_id)?.title || 'Exam',
        total_questions: row.total_questions,
        correct_answers: row.correct_answers,
        score_percentage: row.score_percentage,
        status: row.status,
        verified_at: row.verified_at,
        published_at: row.published_at,
        admin_remark: row.admin_remark
      }));
    return rows;
  }

  if (method === 'GET' && path === '/api/admin/attempts') {
    if (user.role !== 'ADMIN') {
      mockError(403, 'Forbidden for this role.');
    }

    return db.attempts
      .slice()
      .sort((a, b) => b.id - a.id)
      .map((row) => {
        const student = db.students.find((s) => s.id === row.student_id);
        const studentUser = db.users.find((u) => u.id === student?.user_id);
        const exam = db.exams.find((e) => e.id === row.exam_id);
        const verifiedBy = db.users.find((u) => u.id === row.verified_by);
        const publishedBy = db.users.find((u) => u.id === row.published_by);

        return {
          attempt_id: row.id,
          student_name: student?.name || '',
          student_username: studentUser?.username || '',
          exam_title: exam?.title || 'Exam',
          start_time: row.start_time,
          end_time: row.end_time,
          total_questions: row.total_questions,
          correct_answers: row.correct_answers,
          score_percentage: row.score_percentage,
          status: row.status,
          verification_status: row.verification_status,
          is_published: row.is_published,
          admin_remark: row.admin_remark,
          verified_by_username: verifiedBy?.username || null,
          verified_at: row.verified_at,
          published_by_username: publishedBy?.username || null,
          published_at: row.published_at,
          lifecycle_status: !row.end_time
            ? 'IN_PROGRESS'
            : row.is_published
              ? 'PUBLISHED'
              : row.verification_status === 'VERIFIED'
                ? 'VERIFIED_PENDING_PUBLISH'
                : 'SUBMITTED_PENDING_VERIFICATION'
        };
      });
  }

  const verifyMatch = path.match(/^\/api\/admin\/attempts\/(\d+)\/verify$/);
  if (method === 'PATCH' && verifyMatch) {
    if (user.role !== 'ADMIN') {
      mockError(403, 'Forbidden for this role.');
    }

    const attempt = db.attempts.find((row) => row.id === Number(verifyMatch[1]));
    if (!attempt) {
      mockError(404, 'Attempt not found');
    }
    if (!attempt.end_time) {
      mockError(400, 'Cannot verify an in-progress attempt');
    }

    attempt.verification_status = 'VERIFIED';
    attempt.verified_by = user.id;
    attempt.verified_at = new Date().toISOString();
    attempt.admin_remark = (body.remark || '').trim() || null;
    saveMockDb(db);
    return { message: 'Attempt verified successfully' };
  }

  const publishMatch = path.match(/^\/api\/admin\/attempts\/(\d+)\/publish$/);
  if (method === 'PATCH' && publishMatch) {
    if (user.role !== 'ADMIN') {
      mockError(403, 'Forbidden for this role.');
    }

    const attempt = db.attempts.find((row) => row.id === Number(publishMatch[1]));
    if (!attempt) {
      mockError(404, 'Attempt not found');
    }
    if (!attempt.end_time) {
      mockError(400, 'Cannot publish an in-progress attempt');
    }
    if (attempt.verification_status !== 'VERIFIED') {
      mockError(400, 'Verify attempt before publishing');
    }

    attempt.is_published = 1;
    attempt.published_by = user.id;
    attempt.published_at = new Date().toISOString();
    saveMockDb(db);
    return { message: 'Result published successfully' };
  }

  mockError(405, `Route not supported in static mode: ${method} ${path}`);
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

  if (IS_GITHUB_PAGES) {
    try {
      return await mockApiRequest(url, {
        ...options,
        headers
      });
    } catch (error) {
      throw new Error(error.message || 'Static mode request failed');
    }
  }

  let response;
  try {
    response = await fetch(url, {
      ...options,
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined
    });
  } catch (_) {
    const isApiRoute = parseRoutePath(url).startsWith('/api/');
    const canFallback = isApiRoute && !window.location.hostname.includes('localhost') && !window.location.hostname.startsWith('127.');
    if (canFallback) {
      return mockApiRequest(url, {
        ...options,
        headers
      });
    }
    throw new Error('Network error while contacting server');
  }

  const isApiRoute = parseRoutePath(url).startsWith('/api/');
  if ((response.status === 404 || response.status === 405) && isApiRoute) {
    const canFallback = !window.location.hostname.includes('localhost') && !window.location.hostname.startsWith('127.');
    if (canFallback) {
      return mockApiRequest(url, {
        ...options,
        headers
      });
    }
  }

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
if (IS_GITHUB_PAGES && registerStatus) {
  registerStatus.textContent = 'GitHub Pages demo mode active (browser-only data storage).';
  registerStatus.className = 'info';
}
renderAuthState();
