
"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  ClipboardCheck,
  Save,
  Search,
  Users,
} from "lucide-react";
import Shell from "../ui/Shell";
import {
  DEPARTMENTS,
  YEARS,
  SECTIONS,
  SUBJECTS,
  getCollegeStudents,
  getAttendanceRecords,
  saveAttendanceRecords,
  type Student,
  type AttendanceRecord,
  type AttendanceStatus,
} from "../../lib/collegeData";

const normalizeYear = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .replace("firstyear", "1styear")
    .replace("secondyear", "2ndyear")
    .replace("thirdyear", "3rdyear")
    .replace("fourthyear", "4thyear");

const BRANCH_SUBJECTS: Record<string, string[]> = {
  "Computer Science": [
    "Programming Fundamentals",
    "Database Management",
    "Computer Networks",
    "Operating Systems",
    "Mathematics",
    "Physics",
    "Communication Skills",
  ],
  "Information Technology": [
    "Programming Fundamentals",
    "Database Management",
    "Computer Networks",
    "Mathematics",
    "Physics",
    "Communication Skills",
  ],
  Electronics: [
    "Digital Electronics",
    "Mathematics",
    "Physics",
    "Communication Skills",
  ],
  "Mechanical Engineering": [
    "Engineering Mechanics",
    "Mathematics",
    "Physics",
    "Communication Skills",
  ],
  "Civil Engineering": [
    "Engineering Mechanics",
    "Mathematics",
    "Physics",
    "Communication Skills",
  ],
  "Electrical Engineering": [
    "Digital Electronics",
    "Mathematics",
    "Physics",
    "Communication Skills",
  ],
};

function getSubjectsForBranch(branch: string) {
  return BRANCH_SUBJECTS[branch] ?? SUBJECTS;
}

export default function AttendancePage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [date, setDate] = useState("");
  const [today, setToday] = useState("");
  const [department, setDepartment] = useState("All");
  const [year, setYear] = useState("All");
  const [section, setSection] = useState("All");
  const [subject, setSubject] = useState(SUBJECTS[0]);
  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [statusMap, setStatusMap] = useState<Record<string, AttendanceStatus>>({});
  const [message, setMessage] = useState("");
  const [filtersApplied, setFiltersApplied] = useState(false);
  const [filterError, setFilterError] = useState("");

  useEffect(() => {
    const now = new Date();
    const currentDate = `${now.getFullYear()}-${String(
      now.getMonth() + 1
    ).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

    setToday(currentDate);
    setDate(currentDate);
    Promise.all([getCollegeStudents(), getAttendanceRecords()])
      .then(([nextStudents, nextRecords]) => {
        setStudents(nextStudents);
        setRecords(nextRecords);
      })
      .catch(() => undefined);

    const refreshStudents = () => {
      getCollegeStudents().then(setStudents).catch(() => undefined);
    };
    const refreshAttendance = () => {
      getAttendanceRecords().then(setRecords).catch(() => undefined);
    };

    window.addEventListener("students-updated", refreshStudents);
    window.addEventListener("attendance-updated", refreshAttendance);

    return () => {
      window.removeEventListener("students-updated", refreshStudents);
      window.removeEventListener("attendance-updated", refreshAttendance);
    };
  }, []);

  const availableSubjects = useMemo(
    () => getSubjectsForBranch(department),
    [department]
  );

  useEffect(() => {
    if (!availableSubjects.includes(subject)) {
      setSubject(availableSubjects[0] ?? SUBJECTS[0]);
    }
  }, [availableSubjects, subject]);

  const isSearching = appliedSearch.trim().length > 0;

  const filteredStudents = useMemo(() => {
    const term = appliedSearch.trim().toLowerCase();

    if (term) {
      return students.filter((student) =>
        [
          student.name,
          student.erpId,
          student.email,
          student.department,
          student.year,
          student.section,
        ].some((value) => String(value ?? "").toLowerCase().includes(term))
      );
    }

    if (!filtersApplied) return [];

    return students.filter(
      (student) =>
        student.department === department &&
        normalizeYear(student.year) === normalizeYear(year) &&
        student.section === section
    );
  }, [students, appliedSearch, filtersApplied, department, year, section]);

  useEffect(() => {
    if (!date) return;

    const next: Record<string, AttendanceStatus> = {};

    filteredStudents.forEach((student) => {
      const existing = records.find(
        (record) =>
          record.date === date &&
          record.subject === subject &&
          record.department === student.department &&
          normalizeYear(record.year) === normalizeYear(student.year) &&
          record.section === student.section &&
          record.statuses?.[student.id]
      );

      if (existing) next[student.id] = existing.statuses[student.id];
    });

    setStatusMap((previous) => {
      const result = { ...previous };

      filteredStudents.forEach((student) => {
        delete result[student.id];
        if (next[student.id]) result[student.id] = next[student.id];
      });

      return result;
    });
  }, [filteredStudents, records, date, subject]);

  const canTakeAttendance =
    filtersApplied &&
    department !== "All" &&
    year !== "All" &&
    section !== "All" &&
    !isSearching;

  const canMarkVisibleStudents =
    (isSearching && filteredStudents.length > 0) || canTakeAttendance;

  function applyFilters() {
    setAppliedSearch("");
    setSearch("");

    if (department === "All" || year === "All" || section === "All") {
      setFiltersApplied(false);
      setFilterError("Please select Branch, Academic Year, and Section.");
      setMessage("");
      return;
    }

    setFilterError("");
    setFiltersApplied(true);
    setMessage("");
  }

  function runSearch() {
    setAppliedSearch(search.trim());
    setFiltersApplied(false);
    setMessage("");
    setFilterError("");
  }

  function resetFilters() {
    setDepartment("All");
    setYear("All");
    setSection("All");
    setSearch("");
    setAppliedSearch("");
    setFiltersApplied(false);
    setFilterError("");
    setMessage("");
    setStatusMap({});
  }

  function markAll(status: AttendanceStatus) {
    if (!canMarkVisibleStudents || !filteredStudents.length) return;

    setStatusMap((previous) => {
      const next = { ...previous };
      filteredStudents.forEach((student) => {
        next[student.id] = status;
      });
      return next;
    });

    setMessage("");
  }

  function setStudentStatus(studentId: string, status: AttendanceStatus) {
    if (!canMarkVisibleStudents) return;

    setStatusMap((previous) => ({ ...previous, [studentId]: status }));
    setMessage("");
  }

  const presentCount = filteredStudents.filter(
    (student) => statusMap[student.id] === "Present"
  ).length;

  const absentCount = filteredStudents.filter(
    (student) => statusMap[student.id] === "Absent"
  ).length;

  const lateCount = filteredStudents.filter(
    (student) => statusMap[student.id] === "Late"
  ).length;

  const markedCount = presentCount + absentCount + lateCount;

  function saveAttendance() {
    if (!canMarkVisibleStudents) {
      setMessage("Search for students or apply the required attendance filters first.");
      return;
    }

    if (!today || date !== today) {
      setMessage("Attendance can only be marked for today's date.");
      return;
    }

    if (markedCount === 0) {
      setMessage("Please mark attendance for at least one student.");
      return;
    }

    const groups = new Map<string, AttendanceRecord>();

    records.forEach((record) => {
      const key = `${record.date}|${record.department}|${normalizeYear(record.year)}|${record.section}|${record.subject}`;

      const previous = groups.get(key);
      if (previous) {
        groups.set(key, {
          ...previous,
          statuses: { ...previous.statuses, ...record.statuses },
        });
      } else {
        groups.set(key, {
          ...record,
          statuses: { ...record.statuses },
        });
      }
    });

    filteredStudents.forEach((student) => {
      const status = statusMap[student.id];
      if (!status) return;

      const key = `${date}|${student.department}|${normalizeYear(student.year)}|${student.section}|${subject}`;
      const existing = groups.get(key);

      if (existing) {
        existing.statuses[student.id] = status;
        existing.savedAt = new Date().toISOString();
      } else {
        groups.set(key, {
          date,
          department: student.department,
          year: student.year,
          section: student.section,
          subject,
          statuses: { [student.id]: status },
          savedAt: new Date().toISOString(),
        });
      }
    });

    try {
      const validIds = new Set(students.map((student) => student.id));
      const updated = Array.from(groups.values())
        .map((record) => ({
          ...record,
          statuses: Object.fromEntries(
            Object.entries(record.statuses ?? {}).filter(([id]) => validIds.has(id))
          ),
        }))
        .filter((record) => Object.keys(record.statuses).length > 0);

      saveAttendanceRecords(updated).then((saved) => {
        setRecords(saved);
        window.dispatchEvent(new Event("attendance-updated"));
      }).catch((error) => setMessage(error instanceof Error ? error.message : "Unable to save attendance."));
      setRecords(updated);
      setMessage(`Attendance saved for ${markedCount} students.`);
    } catch {
      setMessage("Could not save attendance. Please try again.");
    }
  }

  const statusColors = {
    Present: { color: "#15803d", bg: "#dcfce7", border: "#16a34a" },
    Absent: { color: "#b91c1c", bg: "#fee2e2", border: "#dc2626" },
    Late: { color: "#b45309", bg: "#fef3c7", border: "#d97706" },
  };

  function renderStatusButtons(student: Student) {
    return (
      <div className="flex flex-wrap gap-2">
        {(["Present", "Absent", "Late"] as AttendanceStatus[]).map((status) => {
          const selected = statusMap[student.id] === status;
          const colors = statusColors[status];

          return (
            <button
              key={status}
              type="button"
              aria-pressed={selected}
              onClick={() => setStudentStatus(student.id, status)}
              style={{
                padding: "7px 10px",
                borderRadius: 7,
                border: `1px solid ${colors.border}`,
                background: selected ? colors.bg : "transparent",
                color: colors.color,
                fontWeight: selected ? 700 : 500,
                cursor: "pointer",
              }}
            >
              {status}
            </button>
          );
        })}
      </div>
    );
  }

  function renderStudentTable(searchMode: boolean) {
    return (
      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>ERP ID</th>
              <th>Student Name</th>
              <th>Branch / Year</th>
              <th>Section</th>
              {searchMode && <th>Email</th>}
              <th>Attendance Status</th>
            </tr>
          </thead>
          <tbody>
            {filteredStudents.map((student, index) => (
              <tr key={`${student.id || student.erpId || "student"}-${index}`}>
                <td><strong>{student.erpId || "—"}</strong></td>
                <td>{student.name}</td>
                <td>
                  {student.department}
                  <br />
                  <small>{student.year}</small>
                </td>
                <td>{student.section || "—"}</td>
                {searchMode && <td>{student.email || "—"}</td>}
                <td>{renderStatusButtons(student)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <Shell>
      <div className="page-container">
        <div className="page-heading">
          <div>
            <h1>Attendance Management</h1>
            <p>Record and manage daily student attendance.</p>
          </div>
          <button
            className="btn btn-primary"
            onClick={saveAttendance}
            disabled={!canMarkVisibleStudents || !today || date !== today || markedCount === 0}
          >
            <Save size={18} /> Save Attendance
          </button>
        </div>

        <div className="grid grid-4 mb-6">
          {[
            { label: "Students", count: filteredStudents.length, icon: Users, color: "#64748b", bg: "#f1f5f9" },
            { label: "Present", count: presentCount, icon: ClipboardCheck, color: "#16a34a", bg: "#dcfce7" },
            { label: "Absent", count: absentCount, icon: Users, color: "#dc2626", bg: "#fee2e2" },
            { label: "Late", count: lateCount, icon: CalendarDays, color: "#d97706", bg: "#fef3c7" },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <div className="card stat-card" key={item.label}>
                <div className="stat-icon" style={{ background: item.bg, color: item.color }}>
                  <Icon size={22} />
                </div>
                <div>
                  <div className="stat-label">{item.label}</div>
                  <div className="stat-value">{canMarkVisibleStudents ? item.count : "—"}</div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="card mb-6">
          <h2>Attendance Filters</h2>
          <p className="muted mb-4">
            Search students across branches, or select Branch, Academic Year, and Section to mark a group.
          </p>

          <div className="form-grid">
            <div className="form-group">
              <label htmlFor="attendance-date">Attendance Date</label>
              <input
                id="attendance-date"
                type="date"
                value={date}
                min={today}
                max={today}
                onChange={() => {
                  setDate(today);
                  setMessage("Attendance can only be marked for today's date.");
                }}
              />
            </div>

            <div className="form-group">
              <label htmlFor="attendance-subject">Subject</label>
              <select
                id="attendance-subject"
                value={subject}
                onChange={(e) => {
                  setSubject(e.target.value);
                  setMessage("");
                }}
              >
                {availableSubjects.map((item) => (
                  <option key={item} value={item}>{item}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="attendance-department">Branch *</label>
              <select
                id="attendance-department"
                value={department}
                onChange={(e) => {
                  setDepartment(e.target.value);
                  setFiltersApplied(false);
                  setFilterError("");
                  setMessage("");
                }}
              >
                <option value="All">Select Branch</option>
                {DEPARTMENTS.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="attendance-year">Academic Year *</label>
              <select
                id="attendance-year"
                value={year}
                onChange={(e) => {
                  setYear(e.target.value);
                  setFiltersApplied(false);
                  setFilterError("");
                  setMessage("");
                }}
              >
                <option value="All">Select Academic Year</option>
                {YEARS.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="attendance-section">Section *</label>
              <select
                id="attendance-section"
                value={section}
                onChange={(e) => {
                  setSection(e.target.value);
                  setFiltersApplied(false);
                  setFilterError("");
                  setMessage("");
                }}
              >
                <option value="All">Select Section</option>
                {SECTIONS.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="attendance-search">Search Student</label>
              <div className="flex items-center gap-2">
                <div style={{ position: "relative", flex: 1 }}>
                  <Search size={17} style={{ position: "absolute", left: 12, top: 12, color: "#64748b" }} />
                  <input
                    id="attendance-search"
                    type="search"
                    placeholder="Name, ERP ID, roll number, email..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        runSearch();
                      }
                    }}
                    style={{ paddingLeft: 38, width: "100%" }}
                  />
                </div>
                <button type="button" className="btn btn-primary" onClick={runSearch}>Search</button>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2" style={{ marginTop: 16 }}>
            <button type="button" className="btn btn-primary" onClick={applyFilters}>Apply Filters</button>
            <button type="button" className="btn btn-secondary" onClick={resetFilters}>Reset</button>
          </div>

          {filterError && <p role="alert" style={{ color: "#dc2626", marginTop: 10 }}>{filterError}</p>}

          {isSearching && (
            <p className="muted" style={{ marginTop: 10 }}>
              Search results for "{appliedSearch}": {filteredStudents.length} students found.
            </p>
          )}
        </div>

        <div className="card">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div>
              <h2>Student Attendance</h2>
              <p className="muted">{date || "Loading date"} · {subject}</p>
            </div>
            {canMarkVisibleStudents && (
              <div className="flex flex-wrap gap-2">
                <button type="button" className="btn btn-secondary" onClick={() => markAll("Present")}>Mark All Present</button>
                <button type="button" className="btn btn-secondary" onClick={() => markAll("Absent")}>Mark All Absent</button>
              </div>
            )}
          </div>

          {isSearching ? (
            filteredStudents.length === 0 ? (
              <div className="empty-state">
                <Search size={36} />
                <h3>No students found</h3>
                <p>Try another name, roll number, ERP ID, or email.</p>
              </div>
            ) : renderStudentTable(true)
          ) : !canTakeAttendance ? (
            <div className="empty-state">
              <Users size={38} />
              <h3>Select all required filters</h3>
              <p>Choose a Branch, Academic Year, and Section, then click Apply Filters.</p>
            </div>
          ) : filteredStudents.length === 0 ? (
            <div className="empty-state">
              <Users size={38} />
              <h3>No students in this group</h3>
              <p>Check your filters or add students to this section.</p>
            </div>
          ) : renderStudentTable(false)}

          <div className="flex flex-wrap items-center justify-between gap-3" style={{ marginTop: 20, paddingTop: 16, borderTop: "1px solid #e5eaf2" }}>
            <div className="muted">
              {isSearching
                ? `Found ${filteredStudents.length} matching students · Marked ${markedCount}`
                : canTakeAttendance
                  ? `Marked ${markedCount} of ${filteredStudents.length} students`
                  : "Apply filters or search for students to continue"}
            </div>
            <button
              type="button"
              className="btn btn-primary"
              onClick={saveAttendance}
              disabled={!canMarkVisibleStudents || !today || date !== today || markedCount === 0}
            >
              <Save size={17} /> Save Attendance
            </button>
          </div>

          {message && (
            <p role="status" style={{
              marginTop: 16,
              marginBottom: 0,
              color: message.startsWith("Could not") ? "#dc2626" : "#15803d",
              fontWeight: 600,
            }}>
              {message}
            </p>
          )}
        </div>
      </div>
    </Shell>
  );
}
