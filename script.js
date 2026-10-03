(function(){
  const STORE_KEY = "gradebook_v1";
  let state = { students: [], assessments: [] };

  function load() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (raw) state = JSON.parse(raw);
    } catch (e) { console.warn("Could not load saved data", e); }
  }
  function save() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); }
    catch (e) { console.warn("Could not save data", e); }
  }

  function grade(pct) {
    if (pct >= 90) return "A+";
    if (pct >= 75) return "A";
    if (pct >= 60) return "B";
    if (pct >= 40) return "C";
    return "F";
  }
  function studentStats(id) {
    const rows = state.assessments.filter(a => a.studentId === id);
    const obtained = rows.reduce((s, a) => s + a.marks, 0);
    const max = rows.reduce((s, a) => s + a.max, 0);
    const pct = max ? (obtained / max) * 100 : 0;
    let weakest = null, weakestPct = Infinity;
    rows.forEach(a => { const p = (a.marks / a.max) * 100; if (p < weakestPct) { weakestPct = p; weakest = a.subject; } });
    return { rows, obtained, max, pct, grade: grade(pct), pass: pct >= 40, weakest };
  }

  // ---- Tabs ----
  const tabButtons = document.querySelectorAll("nav.tabs button");
  tabButtons.forEach(btn => btn.addEventListener("click", () => {
    tabButtons.forEach(b => b.classList.toggle("active", b === btn));
    document.querySelectorAll("section[id^='tab-']").forEach(s => s.hidden = true);
    document.getElementById("tab-" + btn.dataset.tab).hidden = false;
    if (btn.dataset.tab === "report") renderReport();
    if (btn.dataset.tab === "rank") renderRank();
  }));

  // ---- Students ----
  const studentForm = document.getElementById("studentForm");
  const studentMsg = document.getElementById("studentMsg");
  studentForm.addEventListener("submit", e => {
    e.preventDefault();
    const id = document.getElementById("sId").value.trim();
    const name = document.getElementById("sName").value.trim();
    const cls = document.getElementById("sClass").value.trim();
    studentMsg.textContent = ""; studentMsg.className = "msg";
    if (!id || !name || !cls) { studentMsg.textContent = "All fields are required."; studentMsg.className = "msg err"; return; }
    if (state.students.some(s => s.id === id)) { studentMsg.textContent = "A student with this ID already exists."; studentMsg.className = "msg err"; return; }
    state.students.push({ id, name, class: cls });
    save(); studentForm.reset();
    studentMsg.textContent = "Student added."; studentMsg.className = "msg ok";
    renderStudents(); renderStudentSelects();
  });

  function renderStudents() {
    const tbody = document.querySelector("#studentTable tbody");
    tbody.innerHTML = "";
    document.getElementById("studentEmpty").hidden = state.students.length > 0;
    state.students.forEach(s => {
      const count = state.assessments.filter(a => a.studentId === s.id).length;
      const tr = document.createElement("tr");
      tr.innerHTML = `<td>${esc(s.id)}</td><td>${esc(s.name)}</td><td>${esc(s.class)}</td><td class="num">${count}</td>
        <td><button class="rowdel" data-id="${esc(s.id)}">Remove</button></td>`;
      tbody.appendChild(tr);
    });
    tbody.querySelectorAll(".rowdel").forEach(b => b.addEventListener("click", () => {
      state.students = state.students.filter(s => s.id !== b.dataset.id);
      state.assessments = state.assessments.filter(a => a.studentId !== b.dataset.id);
      save(); renderStudents(); renderStudentSelects(); renderRank();
    }));
  }

  function renderStudentSelects() {
    [document.getElementById("mStudent"), document.getElementById("reportStudent")].forEach(sel => {
      const current = sel.value;
      sel.innerHTML = state.students.length
        ? state.students.map(s => `<option value="${esc(s.id)}">${esc(s.id)} — ${esc(s.name)}</option>`).join("")
        : `<option value="">No students yet</option>`;
      if (state.students.some(s => s.id === current)) sel.value = current;
    });
  }

  // ---- Marks ----
  const markForm = document.getElementById("markForm");
  const markMsg = document.getElementById("markMsg");
  markForm.addEventListener("submit", e => {
    e.preventDefault();
    markMsg.textContent = ""; markMsg.className = "msg";
    const studentId = document.getElementById("mStudent").value;
    const subject = document.getElementById("mSubject").value.trim();
    const type = document.getElementById("mType").value;
    const marks = parseFloat(document.getElementById("mMarks").value);
    const max = parseFloat(document.getElementById("mMax").value);
    if (!studentId) { markMsg.textContent = "Add a student first."; markMsg.className = "msg err"; return; }
    if (!subject) { markMsg.textContent = "Enter a subject."; markMsg.className = "msg err"; return; }
    if (isNaN(marks) || isNaN(max) || max <= 0) { markMsg.textContent = "Enter valid numbers for marks."; markMsg.className = "msg err"; return; }
    if (marks < 0 || marks > max) { markMsg.textContent = `Marks must be between 0 and ${max}.`; markMsg.className = "msg err"; return; }
    state.assessments.push({ studentId, subject, type, marks, max });
    save(); markForm.reset(); document.getElementById("mMax").value = 100;
    markMsg.textContent = "Assessment added."; markMsg.className = "msg ok";
    renderStudents();
  });

  // ---- Report ----
  document.getElementById("reportStudent").addEventListener("change", renderReport);
  function renderReport() {
    const sel = document.getElementById("reportStudent");
    const body = document.getElementById("reportBody");
    const student = state.students.find(s => s.id === sel.value);
    if (!student) { body.innerHTML = `<div class="empty">Add a student to see their report card.</div>`; return; }
    const stats = studentStats(student.id);
    const rowsHtml = stats.rows.length
      ? stats.rows.map(a => `<tr><td>${esc(a.type)}</td><td>${esc(a.subject)}</td><td class="num">${a.marks} / ${a.max}</td></tr>`).join("")
      : `<tr><td colspan="3" class="empty">No assessments recorded yet.</td></tr>`;
    body.innerHTML = `
      <div class="summary-stats">
        <div class="stat"><div class="num-big">${stats.pct.toFixed(1)}%</div><div class="label">Overall percentage</div></div>
        <div class="stat"><div class="num-big">${stats.grade}</div><div class="label">Grade</div></div>
        <div class="stat"><div class="num-big"><span class="pill ${stats.pass ? 'pass' : 'fail'}">${stats.pass ? 'Pass' : 'Fail'}</span></div><div class="label">Result</div></div>
      </div>
      <div class="table-wrap"><table><thead><tr><th>Exam type</th><th>Subject</th><th class="num">Marks</th></tr></thead>
      <tbody>${rowsHtml}</tbody></table></div>
      ${stats.weakest ? `<p style="color:var(--ink-soft);font-size:13.5px;margin-top:14px;">Weakest subject: ${esc(stats.weakest)}</p>` : ""}
    `;
  }

  // ---- Rank ----
  function renderRank() {
    const tbody = document.querySelector("#rankTable tbody");
    tbody.innerHTML = "";
    const ranked = state.students.map(s => ({ s, stats: studentStats(s.id) }))
      .sort((a, b) => b.stats.pct - a.stats.pct);
    document.getElementById("rankEmpty").hidden = ranked.length > 0;
    ranked.forEach((r, i) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `<td>${i + 1}</td><td>${esc(r.s.id)}</td><td>${esc(r.s.name)}</td><td>${esc(r.s.class)}</td>
        <td class="num">${r.stats.pct.toFixed(1)}</td><td>${r.stats.grade}</td>`;
      tbody.appendChild(tr);
    });
  }

  function esc(str) {
    return String(str).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  load();
  renderStudents();
  renderStudentSelects();
  renderRank();
})();
