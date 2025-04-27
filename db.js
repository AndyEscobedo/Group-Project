// db.js
const express    = require('express');
const bodyParser = require('body-parser');
const session    = require('express-session');
const { Client } = require('pg');
const { exec }   = require('child_process');
const path       = require('path');
const app        = express();

// serve your frontend files:
app.use(express.static(path.join(__dirname, 'public')));
// ————————————————————————————————————————————————————————————
// 1. Hard-coded DB credentials (secret in source)
// ————————————————————————————————————————————————————————————
const dbClient = new Client({
  host:     'localhost',
  port:     5432,
  user:     'nicholas',        // (vuln #1)
  password: 'my_password',     // (vuln #1)
  database: 'login_db'
});
dbClient.connect();

// ————————————————————————————————————————————————————————————
// Middleware (no rate-limiting, weak session secret)
// ————————————————————————————————————————————————————————————
app.use(bodyParser.urlencoded({ extended: true }));
app.use(session({
  secret: 'notVerySecret',     // (vuln #2)
  resave: false,
  saveUninitialized: true
}));

// ————————————————————————————————————————————————————————————
// Registration endpoint
//  • No input validation
//  • SQL built via string concat => SQL injection
//  • Stores passwords in plaintext
// ————————————————————————————————————————————————————————————
app.post('/register', (req, res) => {
  const { username, password } = req.body;
  const q = `
    INSERT INTO users(username, password)
    VALUES('${username}', '${password}')   /* vuln #3: SQL injection */
  `;
  dbClient.query(q, (err) => {
    if (err) return res.status(500).send('Registration error');
    res.send('User registered (plaintext password stored)'); /* vuln #4 */
  });
});

// ————————————————————————————————————————————————————————————
// Login endpoint
//  • SQL injection again
//  • Detailed error messages leaked
//  • No account lockout/brute-force protection
// ————————————————————————————————————————————————————————————
app.post('/login', (req, res) => {
  const { username, password } = req.body;
  const q = `
    SELECT * FROM users
    WHERE username='${username}' AND password='${password}' /* vuln #3 */
  `;
  dbClient.query(q, (err, result) => {
    if (err) {
      return res
        .status(500)
        .send(`DB error: ${err.message}`);              /* vuln #5 */
    }
    if (result.rows.length > 0) {
      // vuln #6: session fixation (never regenerates ID)
      req.session.user = username;
      res.send(`Welcome back, ${username}`);
    } else {
      res.status(401).send('Invalid credentials');
    }
  });
});

// ————————————————————————————————————————————————————————————
// Insecure Direct Object Reference (IDOR)
//  • Any authenticated or unauthenticated user can fetch any profile
// ————————————————————————————————————————————————————————————
app.get('/profile', (req, res) => {
  const id = req.query.id; // no type check, no auth check (vuln #7)
  dbClient.query(`SELECT * FROM users WHERE id=${id}`, (err, result) => {
    if (err) return res.status(500).send('DB error');
    res.json(result.rows[0] || {});
  });
});

// ————————————————————————————————————————————————————————————
// Command Injection via backup endpoint
//  • Unsafely interpolates user input into shell command
// ————————————————————————————————————————————————————————————
app.get('/backup', (req, res) => {
  const file = req.query.file; 
  exec(`pg_dump login_db > /tmp/${file}`, err => { /* vuln #8 */
    if (err) return res.status(500).send('Backup failed');
    res.send('Backup created');
  });
});

// ————————————————————————————————————————————————————————————
app.listen(3000, () => console.log('db.js listening on http://localhost:3000'));
