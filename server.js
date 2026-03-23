const express = require('express');
const path = require('path');
const fs = require('fs/promises');
const crypto = require('crypto');
const sqlite3 = require('sqlite3');
const { open } = require('sqlite');

const app = express();
const PORT = 3000;
const DB_FILE = path.join(__dirname, 'db', 'exam_system.db');

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

let db;
const sessions = new Map();

function generateToken() {
  return crypto.randomBytes(24).toString('hex');
}

async function hasColumn(table, columnName) {
  const columns = await db.all(`PRAGMA table_info(${table})`);
  return columns.some((column) => column.name === columnName);
}

async function ensureColumn(table, columnName, definition) {
  if (!(await hasColumn(table, columnName))) {
    await db.exec(`ALTER TABLE ${table} ADD COLUMN ${definition}`);
  }
}

async function runMigrations() {
  await ensureColumn('students', 'user_id', 'user_id INTEGER');

  await ensureColumn(
    'attempts',
    'verification_status',
    "verification_status TEXT NOT NULL DEFAULT 'PENDING' CHECK (verification_status IN ('PENDING', 'VERIFIED'))"
  );
  await ensureColumn('attempts', 'verified_by', 'verified_by INTEGER');
  await ensureColumn('attempts', 'verified_at', 'verified_at DATETIME');
  await ensureColumn('attempts', 'is_published', 'is_published INTEGER NOT NULL DEFAULT 0 CHECK (is_published IN (0, 1))');
  await ensureColumn('attempts', 'published_by', 'published_by INTEGER');
  await ensureColumn('attempts', 'published_at', 'published_at DATETIME');
  await ensureColumn('attempts', 'admin_remark', 'admin_remark TEXT');

  await db.exec("UPDATE attempts SET verification_status = 'PENDING' WHERE verification_status IS NULL");
  await db.exec('UPDATE attempts SET is_published = 0 WHERE is_published IS NULL');
}

async function initializeDatabase() {
  db = await open({
    filename: DB_FILE,
    driver: sqlite3.Database
  });

  const schema = await fs.readFile(path.join(__dirname, 'db', 'schema.sql'), 'utf-8');
  const seed = await fs.readFile(path.join(__dirname, 'db', 'seed.sql'), 'utf-8');

  await db.exec(schema);
  await runMigrations();
  await db.exec(seed);
}

function authenticate(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token || !sessions.has(token)) {
    return res.status(401).json({ error: 'Unauthorized. Please login first.' });
  }

  req.token = token;
  req.user = sessions.get(token);
  next();
}

function requireRole(role) {
  return (req, res, next) => {
    if (!req.user || req.user.role !== role) {
      return res.status(403).json({ error: 'Forbidden for this role.' });
    }
    next();
  };
}

async function getOrCreateStudentForUser(user) {
  let student = await db.get('SELECT id, name FROM students WHERE user_id = ?', [user.id]);

  if (!student) {
    const legacyStudent = await db.get('SELECT id, name, user_id FROM students WHERE name = ?', [
      user.username
    ]);

    if (legacyStudent) {
      if (legacyStudent.user_id && legacyStudent.user_id !== user.id) {
        throw new Error('Student profile already linked to another user');
      }

      await db.run('UPDATE students SET user_id = ? WHERE id = ?', [user.id, legacyStudent.id]);
      student = { id: legacyStudent.id, name: legacyStudent.name };
    } else {
      const result = await db.run('INSERT INTO students (user_id, name) VALUES (?, ?)', [
        user.id,
        user.username
      ]);
      student = { id: result.lastID, name: user.username };
    }
  }

  return student;
}

app.post('/api/auth/register-student', async (req, res) => {
  try {
    const fullName = (req.body.fullName || '').trim();
    const username = (req.body.username || '').trim();
    const password = req.body.password || '';

    if (!fullName || !username || !password) {
      return res.status(400).json({ error: 'fullName, username, and password are required' });
    }

    if (!/^[a-zA-Z0-9_]{3,30}$/.test(username)) {
      return res.status(400).json({
        error: 'Username must be 3-30 characters and use only letters, numbers, or underscore'
      });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    const existing = await db.get('SELECT id FROM users WHERE username = ?', [username]);
    if (existing) {
      return res.status(409).json({ error: 'Username already exists' });
    }

    await db.run('BEGIN TRANSACTION');

    const userResult = await db.run(
      'INSERT INTO users (username, password, role, full_name) VALUES (?, ?, ?, ?)',
      [username, password, 'STUDENT', fullName]
    );

    await getOrCreateStudentForUser({
      id: userResult.lastID,
      username
    });

    await db.run('COMMIT');

    res.status(201).json({
      message: 'Student account created successfully. Please login.',
      user: {
        username,
        role: 'STUDENT',
        fullName
      }
    });
  } catch (error) {
    try {
      await db.run('ROLLBACK');
    } catch (_) {
      // Ignore rollback errors
    }
    if (error.message === 'Student profile already linked to another user') {
      return res.status(409).json({ error: 'Username already exists' });
    }
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'username and password are required' });
    }

    const user = await db.get(
      'SELECT id, username, password, role, full_name FROM users WHERE username = ?',
      [username.trim()]
    );

    if (!user || user.password !== password) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const safeUser = {
      id: user.id,
      username: user.username,
      role: user.role,
      fullName: user.full_name
    };

    if (safeUser.role === 'STUDENT') {
      await getOrCreateStudentForUser(safeUser);
    }

    const token = generateToken();
    sessions.set(token, safeUser);

    res.json({ token, user: safeUser });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/auth/logout', authenticate, (req, res) => {
  sessions.delete(req.token);
  res.json({ message: 'Logged out successfully' });
});

app.get('/api/auth/me', authenticate, (req, res) => {
  res.json({ user: req.user });
});

app.get('/api/exams', authenticate, async (_req, res) => {
  try {
    const exams = await db.all(
      `SELECT e.id, e.title, e.description, e.duration_minutes, e.pass_percentage,
              COUNT(q.id) AS question_count
       FROM exams e
       LEFT JOIN questions q ON q.exam_id = e.id
       GROUP BY e.id
       ORDER BY e.id`
    );
    res.json(exams);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/attempts/start', authenticate, requireRole('STUDENT'), async (req, res) => {
  try {
    const examId = Number(req.body.examId);

    if (!Number.isInteger(examId)) {
      return res.status(400).json({ error: 'Valid examId is required' });
    }

    const exam = await db.get('SELECT * FROM exams WHERE id = ?', [examId]);
    if (!exam) {
      return res.status(404).json({ error: 'Exam not found' });
    }

    const questions = await db.all(
      `SELECT id, question_text, option_a, option_b, option_c, option_d, marks
       FROM questions
       WHERE exam_id = ?
       ORDER BY id`,
      [examId]
    );

    if (!questions.length) {
      return res.status(400).json({ error: 'No questions available for this exam' });
    }

    const student = await getOrCreateStudentForUser(req.user);

    const attemptResult = await db.run(
      'INSERT INTO attempts (student_id, exam_id, total_questions) VALUES (?, ?, ?)',
      [student.id, examId, questions.length]
    );

    res.status(201).json({
      attemptId: attemptResult.lastID,
      student: { id: student.id, name: student.name },
      exam: {
        id: exam.id,
        title: exam.title,
        description: exam.description,
        duration_minutes: exam.duration_minutes,
        pass_percentage: exam.pass_percentage
      },
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
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/attempts/:attemptId/submit', authenticate, requireRole('STUDENT'), async (req, res) => {
  try {
    const attemptId = Number(req.params.attemptId);
    const answers = Array.isArray(req.body.answers) ? req.body.answers : [];

    const attempt = await db.get(
      `SELECT a.*
       FROM attempts a
       JOIN students s ON s.id = a.student_id
       WHERE a.id = ? AND s.user_id = ?`,
      [attemptId, req.user.id]
    );

    if (!attempt) {
      return res.status(404).json({ error: 'Attempt not found for this student' });
    }

    if (attempt.end_time) {
      return res.status(400).json({ error: 'This attempt is already submitted' });
    }

    const exam = await db.get('SELECT * FROM exams WHERE id = ?', [attempt.exam_id]);
    const questions = await db.all(
      'SELECT id, correct_option FROM questions WHERE exam_id = ? ORDER BY id',
      [attempt.exam_id]
    );

    const answersByQuestion = new Map(
      answers
        .filter((item) => item && Number.isInteger(Number(item.questionId)))
        .map((item) => [Number(item.questionId), item.selectedOption || null])
    );

    let correctAnswers = 0;

    await db.run('BEGIN TRANSACTION');

    await db.run('DELETE FROM attempt_answers WHERE attempt_id = ?', [attemptId]);

    for (const question of questions) {
      const selectedOption = answersByQuestion.get(question.id) || null;
      const isCorrect = selectedOption === question.correct_option ? 1 : 0;

      if (isCorrect) {
        correctAnswers += 1;
      }

      await db.run(
        `INSERT INTO attempt_answers (attempt_id, question_id, selected_option, is_correct)
         VALUES (?, ?, ?, ?)`,
        [attemptId, question.id, selectedOption, isCorrect]
      );
    }

    const totalQuestions = questions.length;
    const scorePercentage = totalQuestions ? (correctAnswers / totalQuestions) * 100 : 0;
    const status = scorePercentage >= exam.pass_percentage ? 'PASS' : 'FAIL';

    await db.run(
      `UPDATE attempts
       SET end_time = CURRENT_TIMESTAMP,
           total_questions = ?,
           correct_answers = ?,
           score_percentage = ?,
           status = ?,
           verification_status = 'PENDING',
           verified_by = NULL,
           verified_at = NULL,
           is_published = 0,
           published_by = NULL,
           published_at = NULL,
           admin_remark = NULL
       WHERE id = ?`,
      [totalQuestions, correctAnswers, scorePercentage, status, attemptId]
    );

    await db.run('COMMIT');

    res.json({
      message: 'Exam submitted. Result is pending admin verification and publication.'
    });
  } catch (error) {
    try {
      await db.run('ROLLBACK');
    } catch (_) {
      // Ignore rollback errors
    }
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/student/results', authenticate, requireRole('STUDENT'), async (req, res) => {
  try {
    const rows = await db.all(
      `SELECT a.id AS attempt_id,
              e.title AS exam_title,
              a.total_questions,
              a.correct_answers,
              ROUND(a.score_percentage, 2) AS score_percentage,
              a.status,
              a.verified_at,
              a.published_at,
              a.admin_remark
       FROM attempts a
       JOIN students s ON s.id = a.student_id
       JOIN exams e ON e.id = a.exam_id
       WHERE s.user_id = ?
         AND a.end_time IS NOT NULL
         AND a.verification_status = 'VERIFIED'
         AND a.is_published = 1
       ORDER BY a.id DESC`,
      [req.user.id]
    );

    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/admin/attempts', authenticate, requireRole('ADMIN'), async (_req, res) => {
  try {
    const rows = await db.all(
      `SELECT a.id AS attempt_id,
              s.name AS student_name,
              u.username AS student_username,
              e.title AS exam_title,
              a.start_time,
              a.end_time,
              a.total_questions,
              a.correct_answers,
              ROUND(a.score_percentage, 2) AS score_percentage,
              a.status,
              a.verification_status,
              a.is_published,
              a.admin_remark,
              verifier.username AS verified_by_username,
              a.verified_at,
              publisher.username AS published_by_username,
              a.published_at,
              CASE
                WHEN a.end_time IS NULL THEN 'IN_PROGRESS'
                WHEN a.is_published = 1 THEN 'PUBLISHED'
                WHEN a.verification_status = 'VERIFIED' THEN 'VERIFIED_PENDING_PUBLISH'
                ELSE 'SUBMITTED_PENDING_VERIFICATION'
              END AS lifecycle_status
       FROM attempts a
       JOIN students s ON s.id = a.student_id
       LEFT JOIN users u ON u.id = s.user_id
       JOIN exams e ON e.id = a.exam_id
       LEFT JOIN users verifier ON verifier.id = a.verified_by
       LEFT JOIN users publisher ON publisher.id = a.published_by
       ORDER BY a.id DESC`
    );

    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.patch('/api/admin/attempts/:attemptId/verify', authenticate, requireRole('ADMIN'), async (req, res) => {
  try {
    const attemptId = Number(req.params.attemptId);
    const remark = (req.body.remark || '').trim();

    const attempt = await db.get('SELECT * FROM attempts WHERE id = ?', [attemptId]);
    if (!attempt) {
      return res.status(404).json({ error: 'Attempt not found' });
    }

    if (!attempt.end_time) {
      return res.status(400).json({ error: 'Cannot verify an in-progress attempt' });
    }

    await db.run(
      `UPDATE attempts
       SET verification_status = 'VERIFIED',
           verified_by = ?,
           verified_at = CURRENT_TIMESTAMP,
           admin_remark = ?
       WHERE id = ?`,
      [req.user.id, remark || null, attemptId]
    );

    res.json({ message: 'Attempt verified successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.patch('/api/admin/attempts/:attemptId/publish', authenticate, requireRole('ADMIN'), async (req, res) => {
  try {
    const attemptId = Number(req.params.attemptId);

    const attempt = await db.get('SELECT * FROM attempts WHERE id = ?', [attemptId]);
    if (!attempt) {
      return res.status(404).json({ error: 'Attempt not found' });
    }

    if (!attempt.end_time) {
      return res.status(400).json({ error: 'Cannot publish an in-progress attempt' });
    }

    if (attempt.verification_status !== 'VERIFIED') {
      return res.status(400).json({ error: 'Verify attempt before publishing' });
    }

    await db.run(
      `UPDATE attempts
       SET is_published = 1,
           published_by = ?,
           published_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [req.user.id, attemptId]
    );

    res.json({ message: 'Result published successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

initializeDatabase()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  })
  .catch((error) => {
    console.error('Failed to initialize database:', error);
    process.exit(1);
  });
