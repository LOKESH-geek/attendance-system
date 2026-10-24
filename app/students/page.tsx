"use client";

import { useEffect, useState } from "react";
import {
  Plus, Search, Pencil, Trash2, Download, Users, X,
} from "lucide-react";
import Shell from "../ui/Shell";
import {
  DEPARTMENTS,
  YEARS,
  SECTIONS,
  getCollegeStudents,
  saveCollegeStudents,
  getAttendanceRecords,
  saveAttendanceRecords,
  type Student,
} from "../../lib/collegeData";

const emptyStudent: Omit<Student, "id"> = {
erpId: "",
  name: "",
  email: "",
  department: DEPARTMENTS[0],
  year: YEARS[0],
  section: "",
  phone: "",
};

export default function StudentsPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [search, setSearch] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("All");
  const [yearFilter, setYearFilter] = useState("All");
  const [sectionFilter, setSectionFilter] = useState("All");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyStudent);
  const [error, setError] = useState("");

  useEffect(() => {
    getCollegeStudents().then(setStudents).catch(() => setStudents([]));

    const refresh = () => {
      getCollegeStudents().then(setStudents).catch(() => undefined);
    };
    window.addEventListener("students-updated", refresh);
    return () => window.removeEventListener("students-updated", refresh);
  }, []);

  async function saveStudents(updated: Student[]) {
    try {
      const saved = await saveCollegeStudents(updated);
      setStudents(saved);
      window.dispatchEvent(new Event("students-updated"));
    } catch (error) {
      setError(error instanceof Error ? error.message : "Unable to save students.");
    }
  }

  function openAddModal() {
    setEditingId(null);
    setForm({ ...emptyStudent });
    setError("");
    setModalOpen(true);
  }

  function openEditModal(student: Student) {
    setEditingId(student.id);
    setForm({
    erpId: student.erpId?? "",
      name: student.name ?? "",
      email: student.email ?? "",
      department: student.department ?? DEPARTMENTS[0],
      year: student.year ?? YEARS[0],
      section: student.section ?? "",
      phone: student.phone ?? "",
    });
    setError("");
    setModalOpen(true);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    const erpId = form.erpId.trim();
    const name = form.name.trim();
    const email = form.email.trim();
    const section = form.section.trim().toUpperCase();

    if (!erpId|| !erpId || !name || !email || !section) {
      setError("Please fill in all required fields, including section.");
      return;
    }

    const duplicate = students.some(
      (student) =>
        (
          String(student.erpId ?? "").toLowerCase() === erpId.toLowerCase()) &&
        student.id !== editingId
    );

    if (duplicate) {
      setError("This roll number or ERP ID already exists.");
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("Please enter a valid email address.");
      return;
    }

    const cleanStudent = {
      ...form,
    erpId,
      name,
      email,
      section,
      phone: form.phone?.trim() ?? "",
    };

    if (editingId) {
      await saveStudents(
        students.map((student) =>
          student.id === editingId
            ? { ...student, ...cleanStudent }
            : student
        )
      );
    } else {
      const newStudent: Student = {
        ...cleanStudent,
        id: crypto.randomUUID(),
      };
      await saveStudents([...students, newStudent]);
    }

    setModalOpen(false);
    setEditingId(null);
    setForm({ ...emptyStudent });
  }

  async function deleteStudent(student: Student) {
  if (!window.confirm(`Delete ${student.name} (${student.erpId})?`)) {
    return;
  }

  // Remove the student from the student register.
  const updatedStudents = students.filter(
    (item) => item.id !== student.id
  );

  // Remove this student's attendance entries from every record.
  const existingRecords = await getAttendanceRecords();
  const updatedRecords = existingRecords.map((record) => {
    const statuses = { ...(record.statuses ?? {}) };
    delete statuses[student.id];

    return { ...record, statuses };
  });

  // Save both changes so all pages receive the updated data.
  try {
    const savedStudents = await saveCollegeStudents(updatedStudents);
    await saveAttendanceRecords(updatedRecords);
    setStudents(savedStudents);
    window.dispatchEvent(new Event("students-updated"));
    window.dispatchEvent(new Event("attendance-updated"));
  } catch (error) {
    setError(error instanceof Error ? error.message : "Unable to delete student.");
  }
}

  const availableSections = Array.from(
    new Set([
      ...SECTIONS,
      ...students.map((student) => student.section?.trim()).filter(Boolean),
    ])
  ).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

  const filteredStudents = students.filter((student) => {
    const term = search.trim().toLowerCase();

    return (
      (
        String(student.name ?? "").toLowerCase().includes(term) ||
        String(student.erpId?? "").toLowerCase().includes(term) ||
        String(student.erpId ?? "").toLowerCase().includes(term) ||
        String(student.email ?? "").toLowerCase().includes(term)
      ) &&
      (departmentFilter === "All" || student.department === departmentFilter) &&
      (yearFilter === "All" || student.year === yearFilter) &&
      (sectionFilter === "All" || student.section === sectionFilter)
    );
  });

  function exportCSV() {
    const header = [
      "Roll Number", "ERP ID", "Name", "Email",
      "Phone", "Department", "Year", "Section",
    ];

    const rows = filteredStudents.map((student) => [
      student.erpId?? "",
      student.erpId ?? "",
      student.name ?? "",
      student.email ?? "",
      student.phone ?? "",
      student.department ?? "",
      student.year ?? "",
      student.section ?? "",
    ]);

    const escapeCSV = (value: string) =>
      `"${String(value).replace(/"/g, '""')}"`;

    const csv = [header, ...rows]
      .map((row) => row.map(escapeCSV).join(","))
      .join("\r\n");

    const blob = new Blob(["\uFEFF" + csv], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "student-register.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Shell>
      <div className="page-container">
        <div className="page-heading">
          <div>
            <h1>Student Register</h1>
            <p>Manage student information and academic groups.</p>
          </div>
          <button className="btn btn-primary" onClick={openAddModal}>
            <Plus size={18} /> Add Student
          </button>
        </div>

        <div className="grid grid-3 mb-6">
          <div className="card stat-card">
            <div className="stat-icon"><Users size={23} /></div>
            <div>
              <div className="stat-label">Total Students</div>
              <div className="stat-value">{students.length.toLocaleString()}</div>
            </div>
          </div>
          <div className="card">
            <div className="stat-label">Departments</div>
            <div className="stat-value">
              {new Set(students.map((s) => s.department)).size}
            </div>
          </div>
          <div className="card">
            <div className="stat-label">Academic Years</div>
            <div className="stat-value">
              {new Set(students.map((s) => s.year)).size}
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
            <div
              className="flex flex-wrap items-center gap-3"
              style={{ flex: 1 }}
            >
              <div style={{ position: "relative", flex: 1, minWidth: 180, maxWidth: 320 }}>
                <Search size={18} color="#64748b" style={{ position: "absolute", left: 12, top: 12 }} />
                <input
                  className="search-input"
                  placeholder="Search name, roll no., ERP ID or email"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  style={{ paddingLeft: 38 }}
                />
              </div>

              <select aria-label="Filter by department" value={departmentFilter} onChange={(e) => setDepartmentFilter(e.target.value)} style={{ width: "auto", minWidth: 160 }}>
                <option value="All">All Departments</option>
                {DEPARTMENTS.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>

              <select aria-label="Filter by year" value={yearFilter} onChange={(e) => setYearFilter(e.target.value)} style={{ width: "auto", minWidth: 140 }}>
                <option value="All">All Years</option>
                {YEARS.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>

              <select aria-label="Filter by section" value={sectionFilter} onChange={(e) => setSectionFilter(e.target.value)} style={{ width: "auto", minWidth: 120 }}>
                <option value="All">All Sections</option>
                {availableSections.map((item) => (
                  <option key={item} value={item}>{`Section ${item}`}</option>
                ))}
              </select>
            </div>

            <button className="btn btn-secondary" onClick={exportCSV}>
              <Download size={17} /> Export CSV
            </button>
          </div>

          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th> ERP ID</th>
                  <th>Student</th>
                  <th>Department</th>
                  <th>Year</th>
                  <th>Section</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredStudents.map((student, index) => (
                  <tr key={`${student.id || student.erpId || "student"}-${index}`}>
                    <td>
                      <strong>{student.erpId|| "—"}</strong><br />
                    </td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{student.name || "—"}</div>
                      <small>{student.email || "—"}</small>
                    </td>
                    <td>{student.department || "—"}</td>
                    <td>{student.year || "—"}</td>
                    <td><span className="badge badge-primary">{student.section || "—"}</span></td>
                    <td>
                      <div className="flex items-center gap-2">
                        <button aria-label={`Edit ${student.name}`} className="btn btn-secondary" onClick={() => openEditModal(student)} style={{ padding: 8, minHeight: 34 }}>
                          <Pencil size={15} />
                        </button>
                        <button aria-label={`Delete ${student.name}`} className="btn btn-secondary" onClick={() => deleteStudent(student)} style={{ padding: 8, minHeight: 34, color: "#dc2626" }}>
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredStudents.length === 0 && (
                  <tr>
                    <td colSpan={6}>
                      <div className="empty-state">
                        <Users size={36} />
                        <h3>No students found</h3>
                        <p>Try changing your filters or add a student.</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="muted" style={{ marginTop: 16 }}>
            Showing {filteredStudents.length.toLocaleString()} of {students.length.toLocaleString()} students
          </div>
        </div>

        {modalOpen && (
          <div className="modal-overlay">
            <div className="modal-content">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2>{editingId ? "Edit Student" : "Add New Student"}</h2>
                  <p className="muted">Enter the student's academic information.</p>
                </div>
                <button type="button" aria-label="Close form" className="btn btn-secondary" onClick={() => setModalOpen(false)}>
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleSubmit}>
                <div className="form-grid">
                
                  <div className="form-group">
                    <label htmlFor="erpId">ERP ID *</label>
                    <input id="erpId" value={form.erpId} onChange={(e) => setForm({ ...form, erpId: e.target.value })} required />
                  </div>
                  <div className="form-group">
                    <label htmlFor="name">Full Name *</label>
                    <input id="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
                  </div>
                  <div className="form-group">
                    <label htmlFor="email">Email Address *</label>
                    <input id="email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
                  </div>
                  <div className="form-group">
                    <label htmlFor="phone">Phone</label>
                    <input id="phone" type="tel" value={form.phone ?? ""} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label htmlFor="department">Department *</label>
                    <select id="department" value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })}>
                      {DEPARTMENTS.map((item) => <option key={item} value={item}>{item}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label htmlFor="year">Academic Year *</label>
                    <select id="year" value={form.year} onChange={(e) => setForm({ ...form, year: e.target.value })}>
                      {YEARS.map((item) => <option key={item} value={item}>{item}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label htmlFor="section">Section *</label>
                    <input
                      id="section"
                      type="text"
                      value={form.section}
                      onChange={(e) => setForm({ ...form, section: e.target.value })}
                      placeholder="e.g. A, F, CSE-1, IT-2"
                      required
                    />
                  </div>
                </div>

                {error && <p style={{ color: "#dc2626", marginTop: 16 }}>{error}</p>}

                <div className="flex justify-between gap-3" style={{ marginTop: 24 }}>
                  <button type="button" className="btn btn-secondary" onClick={() => setModalOpen(false)}>Cancel</button>
                  <button type="submit" className="btn btn-primary">{editingId ? "Save Changes" : "Add Student"}</button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </Shell>
  );
}