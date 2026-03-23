INSERT OR IGNORE INTO users (username, password, role, full_name)
VALUES
  ('admin', 'admin123', 'ADMIN', 'System Administrator'),
  ('student1', 'student123', 'STUDENT', 'Student One'),
  ('student2', 'student123', 'STUDENT', 'Student Two');

INSERT OR IGNORE INTO students (user_id, name)
SELECT id, 'student1' FROM users WHERE username = 'student1';

INSERT OR IGNORE INTO students (user_id, name)
SELECT id, 'student2' FROM users WHERE username = 'student2';

INSERT OR IGNORE INTO exams (id, title, description, duration_minutes, pass_percentage)
VALUES
  (1, 'Web Development Basics', 'HTML, CSS, and JavaScript fundamentals', 15, 50),
  (2, 'SQL Fundamentals', 'Database and SQL query basics', 15, 50);

INSERT OR IGNORE INTO questions (id, exam_id, question_text, option_a, option_b, option_c, option_d, correct_option, marks)
VALUES
  (1, 1, 'What does HTML stand for?', 'HyperText Markup Language', 'HighText Machine Language', 'Hyperlink and Text Markup Language', 'Home Tool Markup Language', 'A', 1),
  (2, 1, 'Which CSS property controls text size?', 'font-style', 'text-size', 'font-size', 'text-style', 'C', 1),
  (3, 1, 'Which method adds an element to the end of an array in JavaScript?', 'push()', 'add()', 'append()', 'insert()', 'A', 1),
  (4, 1, 'Which symbol is used for single-line comments in JavaScript?', '<!-- -->', '#', '//', '/* */', 'C', 1),
  (5, 1, 'Which HTML tag is used for the largest heading?', '<h6>', '<heading>', '<h1>', '<head>', 'C', 1),

  (6, 2, 'Which SQL statement is used to fetch data from a database?', 'GET', 'SELECT', 'PULL', 'FETCH', 'B', 1),
  (7, 2, 'Which clause is used to filter records in SQL?', 'ORDER BY', 'GROUP BY', 'WHERE', 'FILTER', 'C', 1),
  (8, 2, 'Which SQL command is used to remove a table?', 'DROP TABLE', 'DELETE TABLE', 'REMOVE TABLE', 'CLEAR TABLE', 'A', 1),
  (9, 2, 'Which aggregate function returns the number of rows?', 'SUM()', 'TOTAL()', 'COUNT()', 'ROWS()', 'C', 1),
  (10, 2, 'Which keyword is used to sort results ascending?', 'SORT ASC', 'ASC', 'ORDER ASC', 'UP', 'B', 1);
