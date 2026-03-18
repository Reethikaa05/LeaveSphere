-- ============================================================
--  LeaveDesk — Full MySQL Database Schema + Seed Data
--  Run this file in MySQL Workbench or via terminal:
--  mysql -u root -p < database.sql
-- ============================================================

CREATE DATABASE IF NOT EXISTS leavedesk;
USE leavedesk;

-- ── DROP ORDER (foreign keys first) ──────────────────────
DROP PROCEDURE IF EXISTS approve_leave;
DROP PROCEDURE IF EXISTS reject_leave;
DROP VIEW IF EXISTS v_leave_summary;
DROP VIEW IF EXISTS v_pending_requests;
DROP TABLE IF EXISTS leave_requests;
DROP TABLE IF EXISTS leave_balances;
DROP TABLE IF EXISTS holidays;
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS departments;
DROP TABLE IF EXISTS leave_types;

-- ============================================================
--  TABLE: departments
-- ============================================================
CREATE TABLE departments (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  name        VARCHAR(100) NOT NULL,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
--  TABLE: leave_types
-- ============================================================
CREATE TABLE leave_types (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  name            VARCHAR(100) NOT NULL,
  code            VARCHAR(30)  NOT NULL UNIQUE,
  default_days    INT          NOT NULL DEFAULT 0,
  description     TEXT,
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
--  TABLE: users
-- ============================================================
CREATE TABLE users (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  name            VARCHAR(150) NOT NULL,
  email           VARCHAR(200) NOT NULL UNIQUE,
  password_hash   VARCHAR(255) NOT NULL,
  role            ENUM('employee','manager','admin') NOT NULL DEFAULT 'employee',
  department_id   INT,
  manager_id      INT,
  joining_date    DATE         NOT NULL DEFAULT (CURRENT_DATE),
  is_active       BOOLEAN      NOT NULL DEFAULT TRUE,
  avatar_initials VARCHAR(3),
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL,
  FOREIGN KEY (manager_id)    REFERENCES users(id) ON DELETE SET NULL
);

-- ============================================================
--  TABLE: leave_balances
-- ============================================================
CREATE TABLE leave_balances (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  user_id         INT NOT NULL,
  leave_type_id   INT NOT NULL,
  year            YEAR NOT NULL,
  total_days      INT NOT NULL DEFAULT 0,
  used_days       INT NOT NULL DEFAULT 0,
  UNIQUE KEY uq_user_type_year (user_id, leave_type_id, year),
  FOREIGN KEY (user_id)       REFERENCES users(id)       ON DELETE CASCADE,
  FOREIGN KEY (leave_type_id) REFERENCES leave_types(id) ON DELETE CASCADE
);

-- ============================================================
--  TABLE: leave_requests
-- ============================================================
CREATE TABLE leave_requests (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  user_id         INT  NOT NULL,
  leave_type_id   INT  NOT NULL,
  start_date      DATE NOT NULL,
  end_date        DATE NOT NULL,
  working_days    INT  NOT NULL DEFAULT 1,
  reason          TEXT NOT NULL,
  emergency_contact VARCHAR(200),
  status          ENUM('pending','approved','rejected','cancelled') NOT NULL DEFAULT 'pending',
  reviewed_by     INT,
  review_comment  TEXT,
  reviewed_at     TIMESTAMP NULL,
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id)       REFERENCES users(id)       ON DELETE CASCADE,
  FOREIGN KEY (leave_type_id) REFERENCES leave_types(id) ON DELETE RESTRICT,
  FOREIGN KEY (reviewed_by)   REFERENCES users(id)       ON DELETE SET NULL
);

-- ============================================================
--  TABLE: holidays
-- ============================================================
CREATE TABLE holidays (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  name        VARCHAR(150) NOT NULL,
  holiday_date DATE        NOT NULL UNIQUE,
  description TEXT,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
--  INDEXES for performance
-- ============================================================
CREATE INDEX idx_leave_requests_user     ON leave_requests(user_id);
CREATE INDEX idx_leave_requests_status   ON leave_requests(status);
CREATE INDEX idx_leave_requests_dates    ON leave_requests(start_date, end_date);
CREATE INDEX idx_leave_balances_user     ON leave_balances(user_id, year);
CREATE INDEX idx_users_department        ON users(department_id);
CREATE INDEX idx_users_manager           ON users(manager_id);

-- ============================================================
--  SEED: departments
-- ============================================================
INSERT INTO departments (name) VALUES
  ('Engineering'),
  ('Marketing'),
  ('Finance'),
  ('Design'),
  ('Human Resources'),
  ('Product'),
  ('Sales'),
  ('Operations');

-- ============================================================
--  SEED: leave_types
-- ============================================================
INSERT INTO leave_types (name, code, default_days, description) VALUES
  ('Vacation',             'vacation',    15, 'Annual paid vacation leave'),
  ('Sick Leave',           'sick',         7, 'Medical illness or injury'),
  ('Personal Leave',       'personal',     3, 'Personal errands or matters'),
  ('Bereavement Leave',    'bereavement',  3, 'Death of a close family member'),
  ('Maternity/Paternity',  'maternity',   90, 'Parental leave after childbirth or adoption');

-- ============================================================
--  SEED: users
--  Passwords stored as plain text for demo.
--  The backend hashes with bcrypt when registering new users.
--  Login route checks bcrypt first, falls back to plain text.
--  All demo passwords: password123
-- ============================================================
INSERT INTO users (id, name, email, password_hash, role, department_id, manager_id, joining_date, avatar_initials) VALUES
  (1,  'Alex Morgan',     'alex@leavedesk.com',    'password123', 'manager',  1, NULL, '2020-01-15', 'AM'),
  (2,  'John Doe',        'john@leavedesk.com',    'password123', 'employee', 1, 1,    '2021-06-01', 'JD'),
  (3,  'Sarah Robinson',  'sarah@leavedesk.com',   'password123', 'employee', 1, 1,    '2021-03-10', 'SR'),
  (4,  'Mike Kim',        'mike@leavedesk.com',    'password123', 'employee', 2, 1,    '2022-01-20', 'MK'),
  (5,  'Lisa Chen',       'lisa@leavedesk.com',    'password123', 'employee', 3, 1,    '2020-11-05', 'LC'),
  (6,  'Tom Wade',        'tom@leavedesk.com',     'password123', 'employee', 4, 1,    '2023-02-14', 'TW'),
  (7,  'Priya Nair',      'priya@leavedesk.com',   'password123', 'employee', 5, 1,    '2019-08-22', 'PN'),
  (8,  'James Wu',        'james@leavedesk.com',   'password123', 'employee', 1, 1,    '2022-09-01', 'JW'),
  (9,  'Ananya Sharma',   'ananya@leavedesk.com',  'password123', 'employee', 6, 1,    '2023-05-15', 'AS'),
  (10, 'David Park',      'david@leavedesk.com',   'password123', 'employee', 7, 1,    '2021-12-01', 'DP');

-- ============================================================
--  SEED: leave_balances (2025)
-- ============================================================
INSERT INTO leave_balances (user_id, leave_type_id, year, total_days, used_days) VALUES
-- Alex Morgan (manager)
(1,1,2025,15,3),(1,2,2025,7,1),(1,3,2025,3,0),(1,4,2025,3,0),(1,5,2025,90,0),
-- John Doe
(2,1,2025,15,8),(2,2,2025,7,2),(2,3,2025,3,1),(2,4,2025,3,0),(2,5,2025,90,0),
-- Sarah Robinson
(3,1,2025,15,8),(3,2,2025,7,3),(3,3,2025,3,1),(3,4,2025,3,0),(3,5,2025,90,0),
-- Mike Kim
(4,1,2025,15,5),(4,2,2025,7,2),(4,3,2025,3,0),(4,4,2025,3,0),(4,5,2025,90,0),
-- Lisa Chen
(5,1,2025,15,10),(5,2,2025,7,0),(5,3,2025,3,2),(5,4,2025,3,0),(5,5,2025,90,0),
-- Tom Wade
(6,1,2025,15,3),(6,2,2025,7,1),(6,3,2025,3,3),(6,4,2025,3,0),(6,5,2025,90,0),
-- Priya Nair
(7,1,2025,15,12),(7,2,2025,7,4),(7,3,2025,3,0),(7,4,2025,3,0),(7,5,2025,90,0),
-- James Wu
(8,1,2025,15,0),(8,2,2025,7,0),(8,3,2025,3,1),(8,4,2025,3,0),(8,5,2025,90,0),
-- Ananya Sharma
(9,1,2025,15,6),(9,2,2025,7,1),(9,3,2025,3,1),(9,4,2025,3,0),(9,5,2025,90,0),
-- David Park
(10,1,2025,15,9),(10,2,2025,7,2),(10,3,2025,3,0),(10,4,2025,3,0),(10,5,2025,90,0);

-- ============================================================
--  SEED: leave_requests
-- ============================================================
INSERT INTO leave_requests (user_id, leave_type_id, start_date, end_date, working_days, reason, status, reviewed_by, reviewed_at) VALUES
(2,1,'2025-03-10','2025-03-14',5,'Family trip to Goa',                    'approved',1,'2025-02-22 10:00:00'),
(2,2,'2025-02-03','2025-02-04',2,'Fever and cold',                        'approved',1,'2025-02-03 09:00:00'),
(2,3,'2025-01-15','2025-01-15',1,'Bank-related work',                     'approved',1,'2025-01-14 14:00:00'),
(2,1,'2025-04-10','2025-04-14',5,'Summer vacation with family',           'pending', NULL, NULL),
(2,2,'2025-04-25','2025-04-25',1,'Doctor appointment',                    'rejected',1,'2025-04-21 11:00:00'),
(2,4,'2024-12-02','2024-12-03',2,'Family emergency',                      'approved',1,'2024-12-01 08:00:00'),
(3,1,'2025-04-05','2025-04-09',5,'Holiday trip to Kerala',                'pending', NULL, NULL),
(4,2,'2025-04-01','2025-04-02',2,'Medical procedure recovery',            'pending', NULL, NULL),
(5,3,'2025-04-22','2025-04-22',1,'Personal errand — government documents','pending', NULL, NULL),
(6,1,'2025-04-28','2025-04-30',3,'Long weekend trip',                     'pending', NULL, NULL),
(7,4,'2025-04-08','2025-04-09',2,'Attend family funeral',                 'pending', NULL, NULL),
(3,2,'2025-03-20','2025-03-20',1,'Flu symptoms',                         'approved',1,'2025-03-20 08:30:00'),
(7,1,'2025-02-17','2025-02-21',5,'Winter vacation',                      'approved',1,'2025-02-10 10:00:00'),
(9,3,'2025-03-05','2025-03-05',1,'Personal appointment',                  'approved',1,'2025-03-04 16:00:00');

-- ============================================================
--  SEED: holidays
-- ============================================================
INSERT INTO holidays (name, holiday_date, description) VALUES
('New Year Day',    '2025-01-01', 'New Year public holiday'),
('Republic Day',    '2025-01-26', 'India Republic Day'),
('Holi',            '2025-03-25', 'Festival of Colours'),
('Good Friday',     '2025-04-18', 'Good Friday public holiday'),
('Labour Day',      '2025-05-01', 'International Workers Day'),
('Independence Day','2025-08-15', 'India Independence Day'),
('Gandhi Jayanti',  '2025-10-02', 'Birth anniversary of Mahatma Gandhi'),
('Diwali',          '2025-10-20', 'Festival of Lights'),
('Christmas Day',   '2025-12-25', 'Christmas public holiday');

-- ============================================================
--  STORED PROCEDURE: approve_leave
-- ============================================================
DELIMITER //
CREATE PROCEDURE approve_leave(
  IN p_request_id   INT,
  IN p_reviewed_by  INT,
  IN p_comment      TEXT
)
BEGIN
  DECLARE v_user_id       INT;
  DECLARE v_leave_type_id INT;
  DECLARE v_working_days  INT;
  DECLARE v_year          YEAR;
  DECLARE v_status        VARCHAR(20);

  SELECT user_id, leave_type_id, working_days, YEAR(start_date), status
  INTO v_user_id, v_leave_type_id, v_working_days, v_year, v_status
  FROM leave_requests WHERE id = p_request_id;

  IF v_status = 'pending' THEN
    UPDATE leave_requests
    SET status = 'approved', reviewed_by = p_reviewed_by,
        review_comment = p_comment, reviewed_at = NOW()
    WHERE id = p_request_id;

    UPDATE leave_balances
    SET used_days = used_days + v_working_days
    WHERE user_id = v_user_id AND leave_type_id = v_leave_type_id AND year = v_year;
  END IF;
END //
DELIMITER ;

-- ============================================================
--  STORED PROCEDURE: reject_leave
-- ============================================================
DELIMITER //
CREATE PROCEDURE reject_leave(
  IN p_request_id   INT,
  IN p_reviewed_by  INT,
  IN p_comment      TEXT
)
BEGIN
  UPDATE leave_requests
  SET status = 'rejected', reviewed_by = p_reviewed_by,
      review_comment = p_comment, reviewed_at = NOW()
  WHERE id = p_request_id AND status = 'pending';
END //
DELIMITER ;

-- ============================================================
--  VIEW: v_leave_summary  (used by reports page)
-- ============================================================
CREATE OR REPLACE VIEW v_leave_summary AS
SELECT
  u.id                         AS user_id,
  u.name                       AS user_name,
  d.name                       AS department,
  lt.name                      AS leave_type,
  lt.code                      AS leave_code,
  lb.total_days,
  lb.used_days,
  (lb.total_days - lb.used_days) AS remaining_days,
  lb.year
FROM users u
JOIN leave_balances lb ON lb.user_id = u.id
JOIN leave_types    lt ON lt.id = lb.leave_type_id
LEFT JOIN departments d ON d.id = u.department_id;

-- ============================================================
--  VIEW: v_pending_requests  (manager approval queue)
-- ============================================================
CREATE OR REPLACE VIEW v_pending_requests AS
SELECT
  lr.id,
  u.name           AS employee_name,
  u.email          AS employee_email,
  u.avatar_initials,
  d.name           AS department,
  lt.name          AS leave_type,
  lt.code          AS leave_code,
  lr.start_date,
  lr.end_date,
  lr.working_days,
  lr.reason,
  lr.status,
  lr.created_at    AS submitted_at
FROM leave_requests lr
JOIN users       u  ON u.id  = lr.user_id
JOIN leave_types lt ON lt.id = lr.leave_type_id
LEFT JOIN departments d ON d.id = u.department_id
WHERE lr.status = 'pending'
ORDER BY lr.created_at ASC;

SELECT 'LeaveDesk database setup complete!' AS message;
