
"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  Users,
  UserCheck,
  UserX,
  Clock,
  ArrowUpRight,
  ClipboardCheck,
  CalendarDays,
} from "lucide-react";
import Shell from "./ui/Shell";
import {
  getCollegeStudents,
  getAttendanceRecords,
  type Student,
  type AttendanceRecord,
  type AttendanceStatus,
} from "../lib/collegeData";

type DashboardEntry = {
  studentId: string;
  subject: string;
  department: string;
  year: string;
  section: string;
  status: AttendanceStatus;
  date: string;
  savedAt: string;
};

/**
 * Converts either the app's grouped attendance format or MongoDB's
 * individual attendance documents into the format used by the dashboard.
 */
function normalizeAttendance(
  response: unknown,
  students: Student[]
): AttendanceRecord[] {
  let rawRecords: unknown[] = [];

  if (Array.isArray(response)) {
    rawRecords = response;
  } else if (
    response !== null &&
    typeof response === "object" &&
    "records" in response &&
    Array.isArray(response.records)
  ) {
    rawRecords = response.records;
  }

  const alreadyGrouped = rawRecords.every(
    (record) =>
      record !== null &&
      typeof record === "object" &&
      "date" in record &&
      "statuses" in record
  );

  if (alreadyGrouped) {
    return rawRecords as AttendanceRecord[];
  }

  const studentsByErpId = new Map(
    students.map((student) => [String(student.erpId ?? "").trim(), student])
  );
  const grouped = new Map<string, AttendanceRecord>();

  for (const item of rawRecords) {
    if (item === null || typeof item !== "object") continue;

    const record = item as {
      erpId?: string;
      subject?: string;
      department?: string;
      year?: string | number;
      section?: string;
      status?: string;
      attendanceDate?: string | Date;
      date?: string | Date;
      createdAt?: string | Date;
      savedAt?: string;
    };

    if (
      !record.erpId ||
      !record.subject ||
      !["Present", "Absent", "Late"].includes(record.status ?? "")
    ) {
      continue;
    }

    const student = studentsByErpId.get(String(record.erpId).trim());
    if (!student) continue;

    const dateValue = record.attendanceDate ?? record.date;
    if (!dateValue) continue;

    const date =
      dateValue instanceof Date
        ? dateValue.toISOString().slice(0, 10)
        : String(dateValue).slice(0, 10);

    const department = String(record.department ?? student.department ?? "");
    const year = String(record.year ?? student.year ?? "");
    const section = String(record.section ?? student.section ?? "");
    const key = JSON.stringify([
      date,
      record.subject,
      department,
      year,
      section,
    ]);

    const savedAtValue = record.createdAt ?? record.savedAt;
    const savedAt = savedAtValue ? String(savedAtValue) : "";
    let group = grouped.get(key);

    if (!group) {
      group = {
        date,
        subject: record.subject,
        department,
        year,
        section,
        statuses: {},
        savedAt,
      };
      grouped.set(key, group);
    }

    group.statuses[student.id] = record.status as AttendanceStatus;

    if (savedAt > group.savedAt) {
      group.savedAt = savedAt;
    }
  }

  return Array.from(grouped.values());
}

export default function DashboardPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [today, setToday] = useState("");

  useEffect(() => {
    const now = new Date();
    const date = `${now.getFullYear()}-${String(
      now.getMonth() + 1
    ).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

    setToday(date);
    Promise.all([getCollegeStudents(), getAttendanceRecords()])
      .then(([nextStudents, nextRecords]) => {
        setStudents(nextStudents);
        setRecords(normalizeAttendance(nextRecords, nextStudents));
        setLoaded(true);
      })
      .catch(() => setLoaded(true));

    const refreshStudents = () => {
      getCollegeStudents().then(setStudents).catch(() => undefined);
    };
    const refreshAttendance = () => {
      Promise.all([getCollegeStudents(), getAttendanceRecords()])
        .then(([nextStudents, nextRecords]) => {
          setStudents(nextStudents);
          setRecords(normalizeAttendance(nextRecords, nextStudents));
        })
        .catch(() => undefined);
    };

    window.addEventListener("students-updated", refreshStudents);
    window.addEventListener("attendance-updated", refreshAttendance);

    return () => {
      window.removeEventListener("students-updated", refreshStudents);
      window.removeEventListener("attendance-updated", refreshAttendance);
    };
  }, []);

  const todayEntries = useMemo<DashboardEntry[]>(() => {
    const validStudents = new Map(
      students.map((student) => [student.id, student])
    );
    const latest = new Map<string, DashboardEntry>();

    records
      .filter((record) => record.date === today)
      .forEach((record) => {
        Object.entries(record.statuses ?? {}).forEach(([studentId, status]) => {
          const student = validStudents.get(studentId);

          if (!student) return;
          if (
            status !== "Present" &&
            status !== "Absent" &&
            status !== "Late"
          ) {
            return;
          }

          const entry: DashboardEntry = {
            studentId,
            subject: record.subject,
            department: student.department || record.department,
            year: student.year || record.year,
            section: student.section || record.section || "",
            status,
            date: record.date,
            savedAt: record.savedAt || "",
          };

          // Count each student once today, across all subjects.
          const key = studentId;
          const existing = latest.get(key);

          if (
            !existing ||
            entry.savedAt > existing.savedAt ||
            entry.savedAt === existing.savedAt
          ) {
            latest.set(key, entry);
          }
        });
      });

    return Array.from(latest.values());
  }, [records, students, today]);

  const present = todayEntries.filter(
    (record) => record.status === "Present"
  ).length;

  const absent = todayEntries.filter(
    (record) => record.status === "Absent"
  ).length;

  const late = todayEntries.filter(
    (record) => record.status === "Late"
  ).length;

  const percentage =
    todayEntries.length > 0
      ? Math.round(((present + late) / todayEntries.length) * 100)
      : 0;

  const stats = [
    {
      label: "Total Students",
      value: students.length.toLocaleString(),
      icon: Users,
      color: "#4f46e5",
      bg: "#eef2ff",
    },
    {
      label: "Present Today",
      value: present,
      icon: UserCheck,
      color: "#16a34a",
      bg: "#dcfce7",
    },
    {
      label: "Absent Today",
      value: absent,
      icon: UserX,
      color: "#dc2626",
      bg: "#fee2e2",
    },
    {
      label: "Late Today",
      value: late,
      icon: Clock,
      color: "#d97706",
      bg: "#fef3c7",
    },
  ];

  return (
    <Shell>
      <div className="page-container">
        <div className="page-heading">
          <div>
            <h1>Dashboard</h1>
            <p>
              Welcome back, Administrator. Here is your attendance overview.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <CalendarDays size={18} color="#64748b" />
            <span>
              {today
                ? new Date(`${today}T00:00:00`).toLocaleDateString("en-IN", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })
                : "Loading date..."}
            </span>
          </div>
        </div>

        <div className="grid grid-4 mb-6">
          {stats.map((stat) => {
            const Icon = stat.icon;

            return (
              <div className="card stat-card" key={stat.label}>
                <div
                  className="stat-icon"
                  style={{ color: stat.color, background: stat.bg }}
                >
                  <Icon size={24} />
                </div>
                <div>
                  <div className="stat-label">{stat.label}</div>
                  <div className="stat-value">
                    {loaded ? stat.value : "—"}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="grid grid-2 mb-6">
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2>Today's Attendance</h2>
                <p className="muted">Overall attendance summary</p>
              </div>
              <ClipboardCheck size={23} color="#4f46e5" />
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 24,
                flexWrap: "wrap",
              }}
            >
              <div
                style={{
                  width: 120,
                  height: 120,
                  borderRadius: "50%",
                  background: `conic-gradient(#4f46e5 ${
                    percentage * 3.6
                  }deg, #e5e7eb 0deg)`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <div
                  style={{
                    width: 94,
                    height: 94,
                    borderRadius: "50%",
                    background: "#fff",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexDirection: "column",
                  }}
                >
                  <strong style={{ fontSize: 25 }}>{percentage}%</strong>
                  <small>Attendance</small>
                </div>
              </div>

              <div style={{ flex: 1, minWidth: 130 }}>
                <p>
                  <span style={{ color: "#16a34a" }}>●</span>{" "}
                  Present: <strong>{present}</strong>
                </p>
                <p>
                  <span style={{ color: "#dc2626" }}>●</span>{" "}
                  Absent: <strong>{absent}</strong>
                </p>
                <p>
                  <span style={{ color: "#d97706" }}>●</span>{" "}
                  Late: <strong>{late}</strong>
                </p>
                <p className="muted">Marked: {todayEntries.length} students</p>
              </div>
            </div>

            <Link
              href="/attendance"
              className="btn btn-primary"
              style={{ marginTop: 20 }}
            >
              Mark Attendance <ArrowUpRight size={17} />
            </Link>
          </div>

          <div className="card">
            <h2>Quick Actions</h2>
            <p className="muted mb-6">
              Access frequently used attendance tools.
            </p>

            <div className="grid" style={{ gap: 12 }}>
              <Link
                href="/students"
                className="btn btn-secondary"
                style={{ justifyContent: "flex-start", padding: 16 }}
              >
                <Users size={20} color="#4f46e5" />
                <span>Manage Students</span>
                <ArrowUpRight size={17} style={{ marginLeft: "auto" }} />
              </Link>

              <Link
                href="/attendance"
                className="btn btn-secondary"
                style={{ justifyContent: "flex-start", padding: 16 }}
              >
                <ClipboardCheck size={20} color="#16a34a" />
                <span>Take Attendance</span>
                <ArrowUpRight size={17} style={{ marginLeft: "auto" }} />
              </Link>

              <Link
                href="/analytics"
                className="btn btn-secondary"
                style={{ justifyContent: "flex-start", padding: 16 }}
              >
                <ArrowUpRight size={20} color="#d97706" />
                <span>View Analytics</span>
                <ArrowUpRight size={17} style={{ marginLeft: "auto" }} />
              </Link>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2>Today's Attendance Records</h2>
              <p className="muted">
                Latest attendance status for {today || "today"}
              </p>
            </div>

            <Link href="/attendance" className="btn btn-secondary">
              View All
            </Link>
          </div>

          {todayEntries.length === 0 ? (
            <div className="empty-state">
              <ClipboardCheck
                size={40}
                style={{ marginBottom: 12, opacity: 0.5 }}
              />
              <h3>No attendance marked yet</h3>
              <p>Start by marking attendance for your students.</p>
              <Link href="/attendance" className="btn btn-primary">
                Start Attendance
              </Link>
            </div>
          ) : (
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>ERP ID</th>
                    <th>Student Name</th>
                    <th>Subject</th>
                    <th>Department</th>
                    <th>Section</th>
                    <th>Status</th>
                  </tr>
                </thead>

                <tbody>
                  {todayEntries.slice(0, 8).map((record) => {
                    const student = students.find(
                      (item) => item.id === record.studentId
                    );

                    return (
                      <tr key={`${record.date}-${record.studentId}`}>
                        <td>{student?.erpId || "—"}</td>
                        <td>{student?.name || "Unknown"}</td>
                        <td>{record.subject || "—"}</td>
                        <td>{record.department || "—"}</td>
                        <td>{student?.section || record.section || "—"}</td>
                        <td>
                          <span
                            className={`badge ${
                              record.status === "Present"
                                ? "badge-success"
                                : record.status === "Absent"
                                ? "badge-danger"
                                : "badge-warning"
                            }`}
                          >
                            {record.status}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </Shell>
  );
}
