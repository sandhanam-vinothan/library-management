require('dotenv').config();
const express = require('express');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const path = require('path');
const { neon } = require('@neondatabase/serverless');

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');
if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET is required');
const sql = neon(process.env.DATABASE_URL);
const app = express();
app.use(express.json({ limit: '5mb' }));
app.use(cookieParser());

async function initDb() {
  await sql`CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY, username TEXT UNIQUE, email TEXT UNIQUE, password_hash TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('admin','librarian','member')), member_id TEXT, active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;
  await sql`CREATE TABLE IF NOT EXISTS password_reset_requests (
    id SERIAL PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), resolved_at TIMESTAMPTZ
  )`;
  await sql`CREATE TABLE IF NOT EXISTS app_state (
    id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1), data JSONB NOT NULL, updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;
  const count = await sql`SELECT COUNT(*)::int AS n FROM users`;
  if (count[0].n === 0) {
    const admin = await bcrypt.hash('admin123', 12), librarian = await bcrypt.hash('lib123', 12), member = await bcrypt.hash('member123', 12);
    await sql`INSERT INTO users (username,email,password_hash,role,member_id) VALUES
      ('admin','admin@library.local',${admin},'admin',NULL),
      ('librarian','librarian@library.local',${librarian},'librarian',NULL),
      ('arun@lib.com','arun@lib.com',${member},'member','M001'),
      ('divya@lib.com','divya@lib.com',${member},'member','M002'),
      ('rohan@lib.com','rohan@lib.com',${member},'member','M003'),
      ('sneha@lib.com','sneha@lib.com',${member},'member','M004'),
      ('kavin@lib.com','kavin@lib.com',${member},'member','M005')`;
  }
}
function tokenFor(u) { return jwt.sign({ id:u.id, role:u.role, mid:u.member_id || null }, process.env.JWT_SECRET, { expiresIn:'12h' }); }
function auth(req,res,next) {
  try { req.user = jwt.verify(req.cookies.lms_token || '', process.env.JWT_SECRET); next(); }
  catch { res.status(401).json({ error:'Authentication required' }); }
}
app.get('/api/health', async (_req,res) => { try { await sql`SELECT 1`; res.json({ok:true}); } catch(e) { res.status(500).json({ok:false}); } });
app.post('/api/auth/login', async (req,res) => {
  const login = String(req.body.user || '').trim().toLowerCase(), pass = String(req.body.pass || '');
  const rows = await sql`SELECT * FROM users WHERE active = TRUE AND (LOWER(username)=${login} OR LOWER(email)=${login}) LIMIT 1`;
  const u = rows[0]; if (!u || !(await bcrypt.compare(pass,u.password_hash))) return res.status(401).json({error:'Wrong username or password.'});
  res.cookie('lms_token', tokenFor(u), { httpOnly:true, sameSite:'lax', secure:process.env.NODE_ENV==='production', maxAge:12*60*60*1000 });
  res.json({ user:{role:u.role, mid:u.member_id || undefined} });
});

app.post('/api/auth/signup', async (req,res) => {
  try {
    const name=String(req.body.name||'').trim(), email=String(req.body.email||'').trim().toLowerCase();
    const pass=String(req.body.pass||''), phone=String(req.body.phone||'').trim(), dept=String(req.body.dept||'').trim();
    if (name.length < 2) return res.status(400).json({error:'Enter your full name.'});
    if (!/^\S+@\S+\.\S+$/.test(email)) return res.status(400).json({error:'Enter a valid email address.'});
    if (pass.length < 8) return res.status(400).json({error:'Password must be at least 8 characters.'});
    const exists=await sql`SELECT 1 FROM users WHERE LOWER(email)=${email} OR LOWER(username)=${email} LIMIT 1`;
    if (exists.length) return res.status(409).json({error:'An account already exists for this email.'});
    const stateRows=await sql`SELECT data FROM app_state WHERE id=1`;
    if (!stateRows[0]?.data) return res.status(503).json({error:'Library data is not ready yet. Please contact the administrator.'});
    const state=stateRows[0].data, nums=(state.members||[]).map(m=>Number(String(m.id||'').replace(/\D/g,''))||0);
    const mid='M'+String(Math.max(0,...nums)+1).padStart(3,'0');
    const hash=await bcrypt.hash(pass,12);
    await sql`INSERT INTO users(username,email,password_hash,role,member_id) VALUES(${email},${email},${hash},'member',${mid})`;
    state.members=state.members||[]; state.members.push({id:mid,name,email,phone,type:'Member',dept,status:'Active'});
    await sql`UPDATE app_state SET data=${JSON.stringify(state)}::jsonb, updated_at=NOW() WHERE id=1`;
    res.status(201).json({ok:true,message:'Account created. You can now sign in.'});
  } catch(e) { console.error(e); res.status(500).json({error:'Could not create account.'}); }
});
app.post('/api/auth/forgot', async (req,res) => {
  const email=String(req.body.email||'').trim().toLowerCase();
  const rows=await sql`SELECT id FROM users WHERE active=TRUE AND LOWER(email)=${email} LIMIT 1`;
  if (rows[0]) await sql`INSERT INTO password_reset_requests(user_id) VALUES(${rows[0].id})`;
  res.json({ok:true,message:'If that account exists, a password-reset request has been recorded. Please contact the library administrator.'});
});
app.post('/api/auth/change-password', auth, async (req,res) => {
  const current=String(req.body.current||''), next=String(req.body.next||'');
  if (next.length < 8) return res.status(400).json({error:'New password must be at least 8 characters.'});
  const rows=await sql`SELECT password_hash FROM users WHERE id=${req.user.id} LIMIT 1`;
  if (!rows[0] || !(await bcrypt.compare(current,rows[0].password_hash))) return res.status(400).json({error:'Current password is incorrect.'});
  const hash=await bcrypt.hash(next,12); await sql`UPDATE users SET password_hash=${hash} WHERE id=${req.user.id}`;
  res.json({ok:true,message:'Password changed successfully.'});
});

app.post('/api/auth/logout', (_req,res) => { res.clearCookie('lms_token'); res.json({ok:true}); });
app.get('/api/auth/me', auth, (req,res) => res.json({user:{role:req.user.role, mid:req.user.mid || undefined}}));
app.get('/api/state', auth, async (_req,res) => { const rows=await sql`SELECT data FROM app_state WHERE id=1`; res.json({data:rows[0]?.data || null}); });
app.put('/api/state', auth, async (req,res) => {
  if (req.user.role === 'member') return res.status(403).json({error:'Staff access required'});
  const data=req.body.data; if (!data || typeof data !== 'object') return res.status(400).json({error:'Invalid state'});
  await sql`INSERT INTO app_state(id,data,updated_at) VALUES(1,${JSON.stringify(data)}::jsonb,NOW()) ON CONFLICT(id) DO UPDATE SET data=EXCLUDED.data,updated_at=NOW()`;
  res.json({ok:true});
});
app.patch('/api/profile', auth, async (req,res) => {
  if (req.user.role !== 'member' || !req.user.mid) return res.status(403).json({error:'Member access required'});
  const rows=await sql`SELECT data FROM app_state WHERE id=1`; const state=rows[0]?.data; if(!state) return res.status(404).json({error:'Library data not initialized'});
  const m=state.members.find(x=>x.id===req.user.mid); if(!m) return res.status(404).json({error:'Member not found'});
  m.name=String(req.body.name||m.name); m.phone=String(req.body.phone||m.phone); m.dept=String(req.body.dept||m.dept);
  await sql`UPDATE app_state SET data=${JSON.stringify(state)}::jsonb, updated_at=NOW() WHERE id=1`; res.json({ok:true,data:state});
});
app.use(express.static(path.join(__dirname)));
app.get(/.*/, (_req,res)=>res.sendFile(path.join(__dirname,'index.html')));
const port=process.env.PORT || 3000;
initDb().then(()=>app.listen(port,()=>console.log(`Library app running on port ${port}`))).catch(e=>{console.error(e);process.exit(1)});
