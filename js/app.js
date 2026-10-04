/* Library Management System - plain JS, data kept in localStorage */
const KEY = 'lms_v1', PAY = ['Cash', 'GPay', 'UPI', 'Debit / Credit Card'];
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const inr = n => '₹' + Number(n || 0).toLocaleString('en-IN');
const today = () => new Date().toISOString().slice(0, 10);
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x.toISOString().slice(0, 10); };
const fdate = d => d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

/* ---------- data ---------- */
function seed() {
  const d = today();
  const books = [['Atomic Habits', 'James Clear', '9780735211292', 'Self-Help', 499, 50, 4], ['Clean Code', 'Robert C. Martin', '9780132350884', 'Technology', 650, 60, 3],
    ['The Alchemist', 'Paulo Coelho', '9780062315007', 'Fiction', 350, 30, 5], ['Python Basics', 'David Amos', '9781775093329', 'Technology', 550, 45, 3],
    ['Sapiens', 'Yuval Noah Harari', '9780062316097', 'History', 599, 55, 2], ['Wings of Fire', 'A. P. J. Abdul Kalam', '9788173711466', 'Biography', 250, 25, 6],
    ['Deep Work', 'Cal Newport', '9781455586691', 'Self-Help', 450, 40, 1], ['Ponniyin Selvan', 'Kalki Krishnamurthy', '9788184930017', 'Fiction', 700, 60, 2]]
    .map((b, i) => ({ id: 'B' + (i + 1), title: b[0], author: b[1], isbn: b[2], category: b[3], price: b[4], rent: b[5], copies: b[6], cover: '', desc: `A popular title from our ${b[3].toLowerCase()} shelf.` }));
  const members = [['Arun Kumar', 'Student', 'B.Sc Computer Science'], ['Divya S', 'Staff', 'Administration'], ['Rohan P', 'Student', 'B.Com'], ['Sneha R', 'Faculty', 'English'], ['Kavin M', 'Student', 'MBA']]
    .map((m, i) => ({ id: 'M00' + (i + 1), name: m[0], email: m[0].split(' ')[0].toLowerCase() + '@lib.com', phone: '98765432' + (10 + i), type: m[1], dept: m[2], status: 'Active' }));
  const txns = []; let n = 0;
  const T = o => txns.push({ id: 'T' + String(++n).padStart(4, '0'), qty: 1, amount: 0, method: '', pay: '', cust: '', returnDate: '', ...o });
  for (let i = 5; i >= 1; i--) { // older activity for the reports chart
    for (let j = 0; j <= (i + 1) % 4; j++) T({ type: 'Issue', bookId: 'B' + (j + 2), memberId: 'M00' + (j + 1), date: addDays(d, -30 * i - j), due: addDays(d, -30 * i + 7), returnDate: addDays(d, -30 * i + 3) });
    T({ type: 'Sale', bookId: 'B' + (i + 1), memberId: 'M002', date: addDays(d, -30 * i), amount: [350, 250, 599, 550, 650][i - 1], method: 'UPI', pay: 'Paid' });
  }
  T({ type: 'Rent', bookId: 'B1', memberId: 'M001', date: d, due: addDays(d, 14), amount: 50, method: 'GPay', pay: 'Paid' });
  T({ type: 'Sale', bookId: 'B2', memberId: 'M002', date: d, amount: 650, method: 'Cash', pay: 'Paid' });
  T({ type: 'Issue', bookId: 'B3', memberId: 'M003', date: d, due: addDays(d, 7) });
  T({ type: 'Issue', bookId: 'B5', memberId: 'M001', date: addDays(d, -20), due: addDays(d, -6) });
  T({ type: 'Rent', bookId: 'B7', memberId: 'M005', date: addDays(d, -3), due: addDays(d, 11), amount: 40, method: 'UPI', pay: 'Pending' });
  T({ type: 'Issue', bookId: 'B4', memberId: 'M004', date: addDays(d, -8), due: addDays(d, -1), returnDate: d });
  T({ type: 'Return', bookId: 'B4', memberId: 'M004', date: d });
  return { n, books, members, txns, log: [], settings: { name: 'City Central Library', email: 'hello@library.in', phone: '0431 2234567', address: 'Pudukkottai, Tamil Nadu', notify: true }, nb: 8, nm: 5 };
}
let S = seed();
const api = async (url, options = {}) => {
  const r = await fetch(url, { credentials: 'same-origin', headers: { 'Content-Type': 'application/json', ...(options.headers || {}) }, ...options });
  const body = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(body.error || 'Request failed');
  return body;
};
const save = () => { if (U && U.role !== 'member') api('/api/state', { method: 'PUT', body: JSON.stringify({ data: S }) }).catch(e => toast(e.message)); };
let U = null, authMode = 'login', tab = 'issue', Q = { b: '', c: '', m: '', t: '' }, bellOpen = false;
async function loadCloudState() {
  const r = await api('/api/state');
  if (r.data) S = r.data;
  else if (U && U.role !== 'member') await api('/api/state', { method: 'PUT', body: JSON.stringify({ data: S }) });
}
async function bootstrap() {
  try { const me = await api('/api/auth/me'); U = me.user; await loadCloudState(); } catch { U = null; }
  render();
}

const bk = id => S.books.find(b => b.id === id) || { title: '(deleted)', price: 0, rent: 0 };
const mem = id => S.members.find(m => m.id === id);
const who = t => (mem(t.memberId) || {}).name || t.cust || 'Walk-in';
const active = t => (t.type === 'Issue' || t.type === 'Rent') && !t.returnDate;
const tstat = t => t.type === 'Sale' ? 'Sold' : t.type === 'Return' ? 'Returned' : t.returnDate ? 'Returned' : t.due < today() ? 'Overdue' : t.type === 'Rent' ? 'Active' : 'Issued';
const avail = b => b.copies - S.txns.filter(t => t.bookId === b.id && active(t)).length;
const bstat = b => b.copies <= 0 ? 'Out of Stock' : avail(b) > 0 ? 'Available' : S.txns.some(t => t.bookId === b.id && active(t) && t.type === 'Rent') ? 'Rented' : 'Issued';
const badge = s => s ? `<span class="badge ${s.replace(/[ /]/g, '')}">${s}</span>` : '—';
const sum = (l, f) => l.reduce((a, x) => a + f(x), 0);
const note = m => { S.log.push(m); S.log = S.log.slice(-20); };
const color = s => `hsl(${[...s].reduce((a, c) => a + c.charCodeAt(0), 0) * 37 % 360} 55% 45%)`;
const cover = b => b.cover ? `<img class="cover" src="${esc(b.cover)}" alt="">` : `<div class="cover" style="background:${color(b.title)}">${esc(b.title[0])}</div>`;
const bcell = b => `<div class="bk">${cover(b)}<div><b>${esc(b.title)}</b><small>${esc(b.author)}</small></div></div>`;
const toast = m => { const t = $('#toast'); t.textContent = m; t.className = 'on'; setTimeout(() => t.className = '', 2200); };

/* ---------- form helpers ---------- */
const fld = (n, l, v = '', t = 'text', o) => o
  ? `<label>${l}<select name="${n}">${o.map(x => { const [a, b] = Array.isArray(x) ? x : [x, x]; return `<option value="${esc(a)}" ${a == v ? 'selected' : ''}>${esc(b)}</option>`; }).join('')}</select></label>`
  : `<label>${l}<input name="${n}" type="${t}" value="${esc(v)}" ${t === 'number' ? 'min="0"' : ''}></label>`;
function modal(title, body, cb, btn = 'Save changes') {
  $('#modal').innerHTML = `<div class="ov"><form class="box"><h2>${title}</h2>${body}<div class="bar" style="margin:8px 0 0"><span class="sp"></span><button type="button" class="btn ghost" data-a="close">Close</button>${cb ? `<button class="btn">${btn}</button>` : ''}</div></form></div>`;
  $('#modal form').onsubmit = e => { e.preventDefault(); const err = cb(Object.fromEntries(new FormData(e.target))); if (err) toast(err); else { $('#modal').innerHTML = ''; render(); } };
}
const table = (head, rows, empty = 'Nothing here yet.') => `<div class="wrap"><table><tr>${head.map(h => `<th>${h}</th>`).join('')}</tr>${rows.length ? rows.join('') : `<tr><td colspan="${head.length}" class="hint">${empty}</td></tr>`}</table></div>`;
const txRow = (t, adm) => `<tr><td>${t.id}</td><td>${esc(bk(t.bookId).title)}</td><td>${esc(who(t))}</td><td>${badge(t.type)}</td><td>${t.amount ? inr(t.amount) : '—'}</td><td>${t.method || '—'}</td><td>${badge(t.pay)}</td><td>${fdate(t.date)}</td><td>${badge(tstat(t))}</td>${adm ? `<td>${t.pay === 'Pending' ? `<button class="btn sm" data-a="paid" data-id="${t.id}">Mark paid</button>` : t.pay === 'Paid' ? `<button class="btn sm red" data-a="refund" data-id="${t.id}">Refund</button>` : ''}</td>` : ''}</tr>`;
const TH = ['ID', 'Book', 'Customer / Member', 'Type', 'Amount', 'Payment', 'Payment status', 'Date', 'Status'];

/* ---------- notifications ---------- */
function notes() {
  const t = today(), tm = addDays(t, 1), n = [], mine = U.role === 'member' ? S.txns.filter(x => x.memberId === U.mid) : S.txns;
  mine.filter(active).forEach(x => { const b = bk(x.bookId).title; if (x.due === tm) n.push(`${b} is due tomorrow (${who(x)})`); if (x.due < t) n.push(`${x.type === 'Rent' ? 'Rental' : 'Book'} overdue: ${b} (${who(x)})`); });
  mine.filter(x => x.pay === 'Pending').forEach(x => n.push(`Payment pending: ${who(x)}, ${inr(x.amount)}`));
  if (U.role !== 'member') S.books.filter(b => avail(b) <= 1).forEach(b => n.push(`Low stock: ${b.title}`));
  return [...(U.role === 'member' ? [] : S.log.slice().reverse().slice(0, 4)), ...n];
}

/* ---------- pages ---------- */
const NAV = { admin: [['dashboard', 'Dashboard', '▦'], ['books', 'Books', '▤'], ['members', 'Members', '☺'], ['desk', 'Sales & Rentals', '⇄'], ['txns', 'Transactions', '≡'], ['reports', 'Reports', '▥'], ['settings', 'Settings', '⚙']],
  member: [['home', 'Home', '⌂'], ['explore', 'Explore', '⌕'], ['mybooks', 'My Books', '▤'], ['history', 'History', '≡'], ['profile', 'Profile', '☺']] };
NAV.librarian = NAV.admin.filter(n => n[0] !== 'settings');
const head = (t, s) => `<h1>${t}</h1><p class="sub">${s}</p>`;
const stat = (l, v) => `<div class="stat"><span>${l}</span><b>${v}</b></div>`;

function dashboard() {
  const T = S.txns, paid = t => t.pay === 'Paid';
  return head('Dashboard', `Overview of ${esc(S.settings.name)}`) + `<div class="grid">${[
    ['Total Books', sum(S.books, b => b.copies)], ['Available Books', sum(S.books, avail)], ['Issued Books', T.filter(t => t.type === 'Issue' && active(t)).length], ['Total Members', S.members.length],
    ['Overdue Books', T.filter(t => active(t) && t.due < today()).length], ['Books Sold', sum(T.filter(t => t.type === 'Sale'), t => t.qty)], ['Active Rentals', T.filter(t => t.type === 'Rent' && active(t)).length],
    ['Sales Revenue', inr(sum(T.filter(t => t.type === 'Sale' && paid(t)), t => t.amount))], ['Rental Revenue', inr(sum(T.filter(t => t.type === 'Rent' && paid(t)), t => t.amount))]].map(x => stat(...x)).join('')}</div>
  <div class="card"><h2>Recent transactions</h2>${table(TH.slice(0, 9), T.slice(-6).reverse().map(t => txRow(t)))}</div>`;
}

function books() {
  const q = Q.b.toLowerCase(), cats = [...new Set(S.books.map(b => b.category))];
  const list = S.books.filter(b => (!Q.c || b.category === Q.c) && (b.title + b.author + b.isbn).toLowerCase().includes(q));
  const cnt = (b, ty) => S.txns.filter(t => t.bookId === b.id && t.type === ty && active(t)).length;
  return head('Books', 'Manage every title in the library.') + `<div class="card"><div class="bar"><input id="bq" placeholder="Search title, author or ISBN" value="${esc(Q.b)}">
  <select id="bc"><option value="">All categories</option>${cats.map(c => `<option ${c === Q.c ? 'selected' : ''}>${c}</option>`).join('')}</select><span class="sp"></span><button class="btn" data-a="editBook">Add book</button></div>
  ${table(['Book', 'ISBN', 'Category', 'Price / Rent', 'Copies', 'Available', 'Issued', 'Rented', 'Sold', 'Status', ''], list.map(b => `<tr><td>${bcell(b)}</td><td>${b.isbn}</td><td>${b.category}</td><td>${inr(b.price)} / ${inr(b.rent)}</td><td>${b.copies}</td><td>${avail(b)}</td><td>${cnt(b, 'Issue')}</td><td>${cnt(b, 'Rent')}</td><td>${sum(S.txns.filter(t => t.bookId === b.id && t.type === 'Sale'), t => t.qty)}</td><td>${badge(bstat(b))}</td>
  <td style="white-space:nowrap"><button class="btn sm ghost" data-a="viewBook" data-id="${b.id}">View</button> <button class="btn sm ghost" data-a="editBook" data-id="${b.id}">Edit</button> <button class="btn sm red" data-a="delBook" data-id="${b.id}">Delete</button></td></tr>`), 'No books match your search.')}</div>`;
}
function bookForm(id) {
  const b = S.books.find(x => x.id === id) || { title: '', author: '', isbn: '', category: '', price: '', rent: '', copies: 1, cover: '', desc: '' };
  modal(id ? 'Edit book' : 'Add new book', `<div class="two">${fld('title', 'Book title', b.title)}${fld('author', 'Author', b.author)}${fld('isbn', 'ISBN', b.isbn)}${fld('category', 'Category', b.category)}${fld('price', 'Price (₹)', b.price, 'number')}${fld('rent', 'Rental price (₹)', b.rent, 'number')}${fld('copies', 'Number of copies', b.copies, 'number')}${fld('cover', 'Cover image URL (optional)', b.cover)}</div><label>Description<textarea name="desc" rows="3">${esc(b.desc)}</textarea></label>`, d => {
    if (!d.title.trim() || !d.author.trim()) return 'Enter the title and author.';
    const o = { ...d, price: +d.price || 0, rent: +d.rent || 0, copies: +d.copies || 0 };
    if (id) Object.assign(b, o); else S.books.push({ id: 'B' + (++S.nb), ...o });
    note(`Book ${id ? 'updated' : 'added'}: ${d.title}`); save(); toast('Book saved');
  });
}

function members() {
  const q = Q.m.toLowerCase(), list = S.members.filter(m => (m.name + m.id + m.email).toLowerCase().includes(q));
  return head('Members', 'Students, faculty and staff registered with the library.') + `<div class="card"><div class="bar"><input id="mq" placeholder="Search by name, ID or email" value="${esc(Q.m)}"><span class="sp"></span><button class="btn" data-a="editMember">Add member</button></div>
  ${table(['Member ID', 'Name', 'Email', 'Phone', 'Type', 'Department / Course', 'Status', ''], list.map(m => `<tr><td>${m.id}</td><td><b>${esc(m.name)}</b></td><td>${esc(m.email)}</td><td>${esc(m.phone)}</td><td>${m.type}</td><td>${esc(m.dept)}</td><td>${badge(m.status)}</td>
  <td style="white-space:nowrap"><button class="btn sm ghost" data-a="mHist" data-id="${m.id}">History</button> <button class="btn sm ghost" data-a="editMember" data-id="${m.id}">Edit</button> <button class="btn sm ghost" data-a="toggleM" data-id="${m.id}">${m.status === 'Active' ? 'Deactivate' : 'Activate'}</button> <button class="btn sm red" data-a="delMember" data-id="${m.id}">Delete</button></td></tr>`), 'No members found.')}</div>`;
}
function memberForm(id) {
  const m = S.members.find(x => x.id === id) || { name: '', email: '', phone: '', type: 'Student', dept: '', status: 'Active' };
  modal(id ? 'Edit member' : 'Add member', `<div class="two">${fld('name', 'Full name', m.name)}${fld('email', 'Email', m.email, 'email')}${fld('phone', 'Phone number', m.phone)}${fld('type', 'Member type', m.type, '', ['Student', 'Faculty', 'Staff'])}${fld('dept', 'Department / Course', m.dept)}${fld('status', 'Status', m.status, '', ['Active', 'Inactive'])}</div>`, d => {
    if (!d.name.trim() || !d.email.trim()) return 'Enter the name and email.';
    if (id) Object.assign(m, d); else S.members.push({ id: 'M' + String(++S.nm).padStart(3, '0'), ...d });
    note(`${id ? 'Member updated' : 'New member added'}: ${d.name}`); save(); toast('Member saved');
  });
}

function desk() {
  const mo = S.members.filter(m => m.status === 'Active').map(m => [m.id, `${m.name} (${m.id})`]), bo = S.books.filter(b => avail(b) > 0).map(b => [b.id, `${b.title} (${avail(b)} left)`]);
  const f0 = bk((bo[0] || [])[0]), tabs = [['issue', 'Issue book'], ['return', 'Return book'], ['rent', 'Rent book'], ['sell', 'Sell book']];
  const dates = (a, b) => fld('date', a, today(), 'date') + fld('due', b, addDays(today(), 14), 'date'), pay = fld('method', 'Payment method', 'Cash', '', PAY) + fld('pay', 'Payment status', 'Paid', '', ['Paid', 'Pending']);
  const forms = {
    issue: `<form data-f="issue" class="two">${fld('member', 'Member', '', '', mo)}${fld('book', 'Book', '', '', bo)}${dates('Issue date', 'Due date')}<div><button class="btn">Issue book</button></div></form>`,
    return: `<form data-f="return">${fld('txn', 'Borrowed book', '', '', S.txns.filter(active).map(t => [t.id, `${bk(t.bookId).title} - ${who(t)}`]))}${fld('rdate', 'Return date', today(), 'date')}<div id="rprev" class="card" style="background:var(--bg);box-shadow:none"></div><button class="btn">Confirm return</button></form>`,
    rent: `<form data-f="rent" class="two">${fld('member', 'Member', '', '', mo)}${fld('book', 'Book', '', '', bo)}${dates('Rental date', 'Due date')}${fld('fee', 'Rental fee (₹)', f0.rent, 'number')}${pay}<div><button class="btn">Confirm rental</button></div></form>`,
    sell: `<form data-f="sell" class="two">${fld('member', 'Customer / Member', '', '', [['', 'Walk-in customer'], ...S.members.map(m => [m.id, m.name])])}${fld('cust', 'Walk-in customer name', '')}${fld('book', 'Book', '', '', S.books.filter(b => b.copies > 0).map(b => [b.id, `${b.title} (${b.copies} in stock)`]))}${fld('qty', 'Quantity', 1, 'number')}${fld('price', 'Book price (₹)', f0.price, 'number')}${fld('total', 'Total amount (₹)', f0.price, 'number')}${pay}<div><button class="btn">Complete sale</button></div></form>`
  };
  return head('Sales & Rentals', 'Issue, return, rent and sell books from one place.') + `<div class="tabs">${tabs.map(t => `<button class="${tab === t[0] ? 'on' : ''}" data-a="tab" data-id="${t[0]}">${t[1]}</button>`).join('')}</div><div class="card" style="max-width:760px">${forms[tab]}</div>`;
}
function retPrev() {
  const f = $('form[data-f=return]'); if (!f) return; const t = S.txns.find(x => x.id === f.txn?.value), box = $('#rprev');
  if (!t) { box.innerHTML = 'No books are currently out.'; return; }
  const late = f.rdate.value > t.due;
  box.innerHTML = `<b>${esc(bk(t.bookId).title)}</b> · ${esc(who(t))}<br>Issued ${fdate(t.date)} · Due ${fdate(t.due)} · Returning ${fdate(f.rdate.value)}<br>Return status: ${badge(late ? 'Overdue' : 'Returned')}`;
}
const handlers = {
  issue(d) { const b = S.books.find(x => x.id === d.book); if (!b || avail(b) < 1) return toast('This book is not available.'); if (d.due < d.date) return toast('Due date must be after the issue date.');
    S.txns.push(mk({ type: 'Issue', bookId: d.book, memberId: d.member, date: d.date, due: d.due })); note(`${b.title} issued to ${mem(d.member).name}`); done('Book issued'); },
  return(d) { const t = S.txns.find(x => x.id === d.txn); if (!t) return toast('Choose a book to return.'); t.returnDate = d.rdate;
    S.txns.push(mk({ type: 'Return', bookId: t.bookId, memberId: t.memberId, date: d.rdate })); note(`Book returned successfully: ${bk(t.bookId).title}`); done('Book returned'); },
  rent(d) { const b = S.books.find(x => x.id === d.book); if (!b || avail(b) < 1) return toast('This book is not available.');
    S.txns.push(mk({ type: 'Rent', bookId: d.book, memberId: d.member, date: d.date, due: d.due, amount: +d.fee, method: d.method, pay: d.pay })); note(`${b.title} rented to ${mem(d.member).name}`); done('Rental recorded'); },
  sell(d) { const b = S.books.find(x => x.id === d.book), q = +d.qty; if (!b || q < 1 || q > avail(b)) return toast('Not enough copies in stock.'); if (!d.member && !d.cust.trim()) return toast('Enter the customer name.');
    b.copies -= q; S.txns.push(mk({ type: 'Sale', bookId: b.id, memberId: d.member, cust: d.cust, qty: q, date: today(), amount: +d.total, method: d.method, pay: d.pay })); note(`${q} × ${b.title} sold`); done('Sale completed'); }
};
const mk = o => ({ id: 'T' + String(++S.n).padStart(4, '0'), qty: 1, amount: 0, method: '', pay: '', cust: '', returnDate: '', ...o });
const done = m => { save(); toast(m); render(); };

function txns() {
  const list = S.txns.filter(t => !Q.t || t.type === Q.t).slice().reverse();
  return head('Transactions', 'Every issue, return, rental and sale, with payment status.') + `<div class="card"><div class="bar"><select id="tf"><option value="">All types</option>${['Issue', 'Return', 'Rent', 'Sale'].map(t => `<option ${Q.t === t ? 'selected' : ''}>${t}</option>`).join('')}</select></div>${table([...TH, ''], list.map(t => txRow(t, true)))}</div>`;
}

function reports() {
  const T = S.txns, top = ty => { const c = {}; T.filter(t => t.type === ty || (ty === 'Issue' && t.type === 'Rent' && 0)).forEach(t => c[t.bookId] = (c[t.bookId] || 0) + t.qty); const k = Object.keys(c).sort((a, b) => c[b] - c[a])[0]; return k ? `${bk(k).title} (${c[k]})` : '—'; };
  const months = [...Array(6)].map((_, i) => { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - 5 + i); return d.toISOString().slice(0, 7); });
  const iss = months.map(m => T.filter(t => (t.type === 'Issue' || t.type === 'Rent') && t.date.startsWith(m)).length), sal = months.map(m => sum(T.filter(t => t.type === 'Sale' && t.pay === 'Paid' && t.date.startsWith(m)), t => t.amount));
  const line = (v, mx, c) => v.map((y, i) => `${60 + i * 100},${170 - (y / (mx || 1)) * 140}`).join(' ') && `<polyline fill="none" stroke="${c}" stroke-width="3" points="${v.map((y, i) => `${60 + i * 100},${170 - (y / (mx || 1)) * 140}`).join(' ')}"/>${v.map((y, i) => `<circle cx="${60 + i * 100}" cy="${170 - (y / (mx || 1)) * 140}" r="4" fill="${c}"/>`).join('')}`;
  const pm = PAY.map(p => `<tr><td>${p}</td><td>${T.filter(t => t.method === p && t.pay === 'Paid').length}</td><td>${inr(sum(T.filter(t => t.method === p && t.pay === 'Paid'), t => t.amount))}</td></tr>`);
  return head('Reports', 'How the library is performing.') + `<div class="grid">${[['Total Books', sum(S.books, b => b.copies)], ['Total Members', S.members.length], ['Available Books', sum(S.books, avail)], ['Issued Books', T.filter(t => t.type === 'Issue' && active(t)).length], ['Overdue Books', T.filter(t => active(t) && t.due < today()).length],
    ['Most Issued Book', top('Issue')], ['Most Rented Book', top('Rent')], ['Most Sold Book', top('Sale')], ['Rental Revenue', inr(sum(T.filter(t => t.type === 'Rent' && t.pay === 'Paid'), t => t.amount))], ['Sales Revenue', inr(sum(T.filter(t => t.type === 'Sale' && t.pay === 'Paid'), t => t.amount))]].map(([l, v]) => `<div class="stat"><span>${l}</span><b style="font-size:${String(v).length > 12 ? 16 : 26}px">${v}</b></div>`).join('')}</div>
  <div class="card"><h2>Monthly activity</h2><p class="hint"><span style="color:#2563eb">●</span> Issues &amp; rentals &nbsp; <span style="color:#16a34a">●</span> Sales revenue (scaled)</p><div class="wrap"><svg viewBox="0 0 620 200" style="min-width:520px;width:100%"><line x1="40" y1="170" x2="600" y2="170" stroke="#e6eaf0"/>${line(iss, Math.max(...iss), '#2563eb')}${line(sal, Math.max(...sal), '#16a34a')}${months.map((m, i) => `<text x="${60 + i * 100}" y="190" font-size="11" fill="#6b7788" text-anchor="middle">${m}</text>`).join('')}</svg></div>
  <div class="two"><div><h2>Monthly book issues</h2>${iss.map((v, i) => `${months[i]}: <b>${v}</b>`).join(' · ')}</div><div><h2>Monthly sales</h2>${sal.map((v, i) => `${months[i]}: <b>${inr(v)}</b>`).join(' · ')}</div></div></div>
  <div class="card"><h2>Payment method summary</h2>${table(['Method', 'Paid transactions', 'Amount'], pm)}</div>`;
}

function settings() {
  const s = S.settings;
  return head('Settings', 'Basic library information and data tools.') + `<div class="card" style="max-width:700px"><form data-f="settings" class="two">${fld('name', 'Library name', s.name)}${fld('email', 'Library email', s.email)}${fld('phone', 'Phone number', s.phone)}${fld('address', 'Address', s.address)}${fld('notify', 'Notifications', s.notify ? 'on' : 'off', '', ['on', 'off'])}<div><button class="btn">Save settings</button></div></form></div>
  <div class="card" style="max-width:700px"><h2>User management</h2>${table(['Role', 'Login', 'Password'], [['Admin', 'admin', 'admin123'], ['Librarian', 'librarian', 'lib123'], ['Member', 'any member email, e.g. arun@lib.com', 'member123']].map(r => `<tr>${r.map(c => `<td>${c}</td>`).join('')}</tr>`))}</div>
  <div class="card" style="max-width:700px"><h2>Backup</h2><div class="bar"><button class="btn" data-a="backup">Download backup</button><label class="btn ghost" style="margin:0">Restore backup<input type="file" accept=".json" id="restore" hidden></label><button class="btn red" data-a="reset">Reset demo data</button></div></div>`;
}

/* member side */
const myTx = () => S.txns.filter(t => t.memberId === U.mid);
const bookCards = list => `<div class="cards">${list.map(b => `<div class="card">${bcell(b)}<div class="hint">${b.category} · Buy ${inr(b.price)} · Rent ${inr(b.rent)}</div><div>${badge(bstat(b))} <span class="hint">${avail(b)} of ${b.copies} available</span></div><button class="btn sm ghost" data-a="viewBook" data-id="${b.id}">View details</button></div>`).join('') || '<p class="hint">No books match your search.</p>'}</div>`;
function home() {
  const m = mem(U.mid), mine = myTx().filter(active);
  return head(`Hello, ${esc(m.name.split(' ')[0])}`, 'Here is what you have on loan.') + `<div class="grid">${stat('Borrowed books', mine.filter(t => t.type === 'Issue').length)}${stat('Rented books', mine.filter(t => t.type === 'Rent').length)}${stat('Due this week', mine.filter(t => t.due <= addDays(today(), 7) && t.due >= today()).length)}${stat('Overdue', mine.filter(t => t.due < today()).length)}</div><h2>Recently added</h2>${bookCards(S.books.slice(-4).reverse())}`;
}
const explore = () => head('Explore', 'Search the catalogue and check availability.') + `<div class="bar"><input id="bq" placeholder="Search books" value="${esc(Q.b)}"><select id="bc"><option value="">All categories</option>${[...new Set(S.books.map(b => b.category))].map(c => `<option ${c === Q.c ? 'selected' : ''}>${c}</option>`).join('')}</select></div>` + bookCards(S.books.filter(b => (!Q.c || b.category === Q.c) && (b.title + b.author + b.isbn).toLowerCase().includes(Q.b.toLowerCase())));
const mybooks = () => head('My Books', 'Books you have borrowed or rented.') + `<div class="card">${table(['Book', 'Type', 'Issued', 'Due', 'Status'], myTx().filter(active).map(t => `<tr><td>${esc(bk(t.bookId).title)}</td><td>${badge(t.type)}</td><td>${fdate(t.date)}</td><td>${fdate(t.due)}</td><td>${badge(tstat(t))}</td></tr>`), 'You have no books on loan.')}</div>`;
const history = () => head('History', 'Your transactions and payments.') + `<div class="card">${table(TH, myTx().slice().reverse().map(t => txRow(t)))}</div>`;
function profile() {
  const m = mem(U.mid);
  return head('Profile', 'Keep your contact details up to date.') + `<div class="card" style="max-width:600px"><form data-f="profile" class="two">${fld('name', 'Full name', m.name)}${fld('phone', 'Phone number', m.phone)}<label>Member ID<input value="${m.id}" disabled></label><label>Email<input value="${esc(m.email)}" disabled></label><label>Member type<input value="${m.type}" disabled></label>${fld('dept', 'Department / Course', m.dept)}<div><button class="btn">Save profile</button></div></form></div><div class="card" style="max-width:600px;margin-top:18px"><h2>Security</h2><form data-f="password" class="two"><label>Current password<input name="current" type="password" required></label><span></span><label>New password<input name="next" type="password" minlength="8" required></label><label>Confirm new password<input name="confirm" type="password" minlength="8" required></label><div><button class="btn">Change password</button></div></form></div>`;
}
function search() {
  const q = decodeURIComponent(location.hash.split('/')[1] || ''), l = q.toLowerCase(), staff = U.role !== 'member';
  const ms = staff ? S.members.filter(m => (m.name + m.id).toLowerCase().includes(l)) : [];
  return head(`Results for “${esc(q)}”`, 'Books' + (staff ? ' and members' : '') + ' matching your search.') + bookCards(S.books.filter(b => (b.title + b.author + b.isbn).toLowerCase().includes(l)))
    + (staff ? `<div class="card" style="margin-top:20px"><h2>Members</h2>${table(['ID', 'Name', 'Type', 'Status'], ms.map(m => `<tr><td>${m.id}</td><td>${esc(m.name)}</td><td>${m.type}</td><td>${badge(m.status)}</td></tr>`), 'No members found.')}</div>` : '');
}

/* ---------- shell, login, router ---------- */
const PAGES = { dashboard, books, members, desk, txns, reports, settings, home, explore, mybooks, history, profile, search };
function login() {
  const loginBox = `<div class="auth-head"><div class="brand" style="padding:0">📚 City Central Library</div><h1>Welcome back</h1><p class="sub">Sign in securely to continue.</p></div><form data-f="login">${fld('user', 'Username or email')}<label>Password<div class="passbox"><input name="pass" type="password" required><button type="button" class="eye" data-a="eye" aria-label="Show password"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z"/><circle cx="12" cy="12" r="2.7"/></svg></button></div></label><button class="btn auth-btn">Log in</button></form><div class="auth-links"><button class="link" data-a="auth" data-id="forgot">Forgot password?</button><span>New member? <button class="link" data-a="auth" data-id="signup">Create account</button></span></div>`;
  const signupBox = `<div class="auth-head"><div class="brand" style="padding:0">📚 City Central Library</div><h1>Create member account</h1><p class="sub">Register to browse books and view your library activity.</p></div><form data-f="signup" class="auth-form">${fld('name','Full name')}${fld('email','Email address')} ${fld('phone','Phone number')}${fld('dept','Department / Course')}<label>Password<div class="passbox"><input name="pass" type="password" minlength="8" required><button type="button" class="eye" data-a="eye" aria-label="Show password"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z"/><circle cx="12" cy="12" r="2.7"/></svg></button></div></label><button class="btn auth-btn">Create account</button></form><div class="auth-links"><span>Already registered? <button class="link" data-a="auth" data-id="login">Sign in</button></span></div>`;
  const forgotBox = `<div class="auth-head"><div class="brand" style="padding:0">📚 City Central Library</div><h1>Forgot password</h1><p class="sub">Submit a reset request for your registered account.</p></div><form data-f="forgot">${fld('email','Registered email')}<button class="btn auth-btn">Request password reset</button></form><div class="auth-links"><button class="link" data-a="auth" data-id="login">← Back to sign in</button></div>`;
  $('#app').innerHTML = `<div class="login"><div class="wallpaper-particles" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i></div><div class="card auth-card">${authMode==='signup'?signupBox:authMode==='forgot'?forgotBox:loginBox}</div><div class="auth-caption">Books • Members • Lending • Rentals • Payments</div></div>`;
}
function render() {
  if (!U) return login();
  const nav = NAV[U.role], r = location.hash.slice(2).split('/')[0], page = PAGES[r] && (r === 'search' || nav.some(n => n[0] === r)) ? r : nav[0][0], nt = S.settings.notify ? notes() : [];
  $('#app').innerHTML = `<aside><div class="brand">📚 ${esc(S.settings.name)}</div>${nav.map(n => `<a href="#/${n[0]}" class="${page === n[0] ? 'on' : ''}"><span>${n[2]}</span>${n[1]}</a>`).join('')}</aside>
  <div class="top"><input id="gs" placeholder="Search books, members..." value="${page === 'search' ? esc(decodeURIComponent(location.hash.split('/')[1] || '')) : ''}"><span class="sp"></span><button class="bell" data-a="bell" aria-label="Notifications">🔔${nt.length ? `<i>${nt.length}</i>` : ''}</button><b>${U.role === 'member' ? esc(mem(U.mid).name) : U.role[0].toUpperCase() + U.role.slice(1)}</b><button class="btn sm ghost" data-a="logout">Log out</button></div>
  ${bellOpen ? `<div class="pop">${nt.map(n => `<p>${esc(n)}</p>`).join('') || '<p class="hint">You are all caught up.</p>'}</div>` : ''}<main>${PAGES[page]()}</main>`;
  retPrev();
}

/* ---------- events ---------- */
const actions = {
  close() { $('#modal').innerHTML = ''; },
  tab(id) { tab = id; render(); },
  bell() { bellOpen = !bellOpen; render(); },
  async logout() { try { await api('/api/auth/logout', { method: 'POST' }); } catch {} U = null; location.hash = ''; render(); },
  auth(id) { authMode=id; render(); },
  eye(_id,a) { const box=a.closest('.passbox'), input=box.querySelector('input'); input.type=input.type==='password'?'text':'password'; a.textContent=input.type==='password'?'Show':'Hide'; },
  editBook: bookForm, editMember: memberForm,
  viewBook(id) { const b = bk(id); modal(esc(b.title), `<div class="bk" style="align-items:flex-start;margin-bottom:12px">${cover(S.books.find(x => x.id === id))}<div>${esc(b.author)}<br><span class="hint">ISBN ${b.isbn} · ${b.category}</span></div></div><p>${esc(b.desc)}</p><p>Price <b>${inr(b.price)}</b> · Rental <b>${inr(b.rent)}</b></p><p>${badge(bstat(b))} ${avail(b)} of ${b.copies} copies available</p>`); },
  delBook(id) { if (S.txns.some(t => t.bookId === id && active(t))) return toast('This book is currently out and cannot be deleted.'); if (confirm('Delete this book?')) { S.books = S.books.filter(b => b.id !== id); save(); render(); } },
  delMember(id) { if (S.txns.some(t => t.memberId === id && active(t))) return toast('This member still has books on loan.'); if (confirm('Delete this member?')) { S.members = S.members.filter(m => m.id !== id); save(); render(); } },
  toggleM(id) { const m = mem(id); m.status = m.status === 'Active' ? 'Inactive' : 'Active'; save(); render(); },
  mHist(id) { modal(`${esc(mem(id).name)} · history`, table(['Book', 'Type', 'Amount', 'Date', 'Status'], S.txns.filter(t => t.memberId === id).reverse().map(t => `<tr><td>${esc(bk(t.bookId).title)}</td><td>${badge(t.type)}</td><td>${t.amount ? inr(t.amount) : '—'}</td><td>${fdate(t.date)}</td><td>${badge(tstat(t))}</td></tr>`), 'No transactions yet.')); },
  paid(id) { S.txns.find(t => t.id === id).pay = 'Paid'; save(); render(); },
  refund(id) { S.txns.find(t => t.id === id).pay = 'Refunded'; save(); render(); },
  backup() { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(S)], { type: 'application/json' })); a.download = 'library-backup.json'; a.click(); },
  reset() { if (confirm('Reset all data to the demo set?')) { S = seed(); save(); render(); toast('Demo data restored'); } }
};
document.addEventListener('click', e => {
  const a = e.target.closest('[data-a]'); if (a && actions[a.dataset.a]) { if (a.dataset.a !== 'bell') bellOpen = false; actions[a.dataset.a](a.dataset.id, a); }
  else if (bellOpen && !e.target.closest('.pop')) { bellOpen = false; render(); }
});
document.addEventListener('submit', async e => {
  const f = e.target.dataset.f; if (!f) return; e.preventDefault(); const d = Object.fromEntries(new FormData(e.target));
  if (f === 'login') {
    try { const r = await api('/api/auth/login', { method: 'POST', body: JSON.stringify({ user: d.user, pass: d.pass }) }); U = r.user; await loadCloudState(); location.hash = ''; render(); }
    catch (err) { toast(err.message); }
  } else if (f === 'signup') {
    try { const r=await api('/api/auth/signup',{method:'POST',body:JSON.stringify(d)}); toast(r.message); authMode='login'; render(); } catch(err){ toast(err.message); }
  } else if (f === 'forgot') {
    try { const r=await api('/api/auth/forgot',{method:'POST',body:JSON.stringify(d)}); toast(r.message); authMode='login'; render(); } catch(err){ toast(err.message); }
  } else if (f === 'password') {
    if(d.next!==d.confirm) return toast('New passwords do not match.');
    try { const r=await api('/api/auth/change-password',{method:'POST',body:JSON.stringify({current:d.current,next:d.next})}); toast(r.message); e.target.reset(); } catch(err){ toast(err.message); }
  } else if (f === 'settings') { Object.assign(S.settings, d, { notify: d.notify === 'on' }); save(); toast('Settings saved'); render(); }
  else if (f === 'profile') {
    try { const r = await api('/api/profile', { method: 'PATCH', body: JSON.stringify({ name:d.name, phone:d.phone, dept:d.dept }) }); S = r.data; toast('Profile saved'); render(); }
    catch (err) { toast(err.message); }
  }
  else handlers[f](d);
});
document.addEventListener('input', e => {
  const t = e.target, f = t.form?.dataset.f;
  const set = (k, v) => { Q[k] = v; render(); const el = $('#' + (k === 'b' ? 'bq' : 'mq')); if (el) { el.focus(); el.setSelectionRange(v.length, v.length); } };
  if (t.id === 'bq') set('b', t.value); else if (t.id === 'mq') set('m', t.value);
  else if (t.id === 'bc') { Q.c = t.value; render(); } else if (t.id === 'tf') { Q.t = t.value; render(); }
  else if (f === 'return') retPrev();
  else if ((f === 'rent' || f === 'sell') && t.name === 'book') { const b = bk(t.value); if (f === 'rent') t.form.fee.value = b.rent; else { t.form.price.value = b.price; t.form.total.value = b.price * t.form.qty.value; } }
  else if (f === 'sell' && (t.name === 'qty' || t.name === 'price')) t.form.total.value = t.form.qty.value * t.form.price.value;
  else if (t.id === 'restore') { const r = new FileReader(); r.onload = () => { try { S = JSON.parse(r.result); save(); render(); toast('Backup restored'); } catch { toast('That file is not a valid backup.'); } }; r.readAsText(t.files[0]); }
});
document.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.id === 'gs' && e.target.value.trim()) location.hash = '#/search/' + encodeURIComponent(e.target.value.trim()); });
addEventListener('hashchange', render);
bootstrap();
