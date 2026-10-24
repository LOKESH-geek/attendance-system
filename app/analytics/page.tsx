
"use client";

import { useEffect, useMemo, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import {
  ChartNoAxesCombined,
  Users,
  UserCheck,
  CalendarDays,
  Download,
  TrendingUp,
  AlertTriangle,
  Target,
} from "lucide-react";
import Shell from "../ui/Shell";
import {
  DEPARTMENTS,
  getCollegeStudents,
  getAttendanceRecords,
  type Student,
  type AttendanceRecord,
  type AttendanceStatus,
} from "../../lib/collegeData";

const COLORS = ["#16a34a", "#dc2626", "#d97706"];
const ATTENDANCE_TARGET = 75;

type Entry = {
  date: string;
  subject: string;
  department: string;
  year: string;
  section: string;
  studentId: string;
  status: AttendanceStatus;
  savedAt: string;
};

type PerformanceItem = {
  name: string;
  rate: number;
  total: number;
};

function formatDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseLocalDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function formatShortDate(value: string) {
  return parseLocalDate(value).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
  });
}

function countStatuses(data: Entry[]) {
  const present = data.filter((e) => e.status === "Present").length;
  const absent = data.filter((e) => e.status === "Absent").length;
  const late = data.filter((e) => e.status === "Late").length;
  const total = data.length;

  return {
    present,
    absent,
    late,
    total,
    rate: total ? Math.round(((present + late) / total) * 100) : 0,
  };
}

function FilterSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
}) {
  const allLabel =
    label === "Department"
      ? "All Departments"
      : label === "Year"
        ? "All Years"
        : label === "Section"
          ? "All Sections"
          : label === "Subject"
            ? "All Subjects"
            : "All";

  return (
    <div className="form-group">
      <label>{label}</label>
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="All">{allLabel}</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </div>
  );
}

export default function AnalyticsPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [today, setToday] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [department, setDepartment] = useState("All");

  // Independent horizontal chart filters
  const [barGroup, setBarGroup] = useState("Department");
  const [barDepartment, setBarDepartment] = useState("All");
  const [barYear, setBarYear] = useState("All");
  const [barSection, setBarSection] = useState("All");
  const [barSubject, setBarSubject] = useState("All");

  // Independent pie chart filters
  const [piePeriod, setPiePeriod] = useState("Overall");
  const [pieDepartment, setPieDepartment] = useState("All");
  const [pieYear, setPieYear] = useState("All");
  const [pieSection, setPieSection] = useState("All");
  const [pieSubject, setPieSubject] = useState("All");

  useEffect(() => {
    setToday(formatDate(new Date()));

    const refresh = () => {
      Promise.all([getCollegeStudents(), getAttendanceRecords()])
        .then(([nextStudents, nextRecords]) => {
          setStudents(nextStudents);
          setRecords(nextRecords);
        })
        .catch(() => undefined);
    };

    refresh();

    window.addEventListener("students-updated", refresh);
    window.addEventListener("attendance-updated", refresh);

    return () => {
      window.removeEventListener("students-updated", refresh);
      window.removeEventListener("attendance-updated", refresh);
    };
  }, []);

  const years = useMemo(
    () =>
      Array.from(new Set(students.map((s) => s.year).filter(Boolean))).sort(),
    [students]
  );

  const sections = useMemo(
    () =>
      Array.from(
        new Set(students.map((s) => s.section).filter(Boolean))
      ).sort(),
    [students]
  );

  const subjects = useMemo(
    () =>
      Array.from(
        new Set(
          records.map((r) => r.subject).filter((s): s is string => Boolean(s))
        )
      ).sort(),
    [records]
  );

  // Keep the latest saved status per student, date, and subject.
  const entries = useMemo<Entry[]>(() => {
    const studentMap = new Map(students.map((s) => [s.id, s]));
    const latest = new Map<string, Entry>();

    records.forEach((record) => {
      Object.entries(record.statuses ?? {}).forEach(([studentId, status]) => {
        const student = studentMap.get(studentId);

        if (!student || !record.date) return;

        if (
          status !== "Present" &&
          status !== "Absent" &&
          status !== "Late"
        ) {
          return;
        }

        const entry: Entry = {
          date: record.date,
          subject: record.subject || "Unknown",
          department: student.department || record.department || "Unknown",
          year: student.year || record.year || "Unknown",
          section: student.section || record.section || "Unknown",
          studentId,
          status,
          savedAt: record.savedAt || "",
        };

        const key = `${entry.date}|${entry.studentId}|${entry.subject}`;
        const previous = latest.get(key);

        if (!previous || entry.savedAt >= previous.savedAt) {
          latest.set(key, entry);
        }
      });
    });

    return Array.from(latest.values());
  }, [students, records]);

  // Global report filters
  const reportEntries = useMemo(
    () =>
      entries.filter(
        (entry) =>
          (department === "All" || entry.department === department) &&
          (!fromDate || entry.date >= fromDate) &&
          (!toDate || entry.date <= toDate)
      ),
    [entries, department, fromDate, toDate]
  );

  const todayEntries = useMemo(
    () =>
      entries.filter(
        (entry) =>
          entry.date === today &&
          (department === "All" || entry.department === department)
      ),
    [entries, today, department]
  );

  const todayStats = useMemo(
    () => countStatuses(todayEntries),
    [todayEntries]
  );

  const overallStats = useMemo(
    () => countStatuses(reportEntries),
    [reportEntries]
  );

  // Horizontal chart filters are independent of the pie chart.
  const barEntries = useMemo(
    () =>
      reportEntries.filter(
        (entry) =>
          (barDepartment === "All" ||
            entry.department === barDepartment) &&
          (barYear === "All" || entry.year === barYear) &&
          (barSection === "All" || entry.section === barSection) &&
          (barSubject === "All" || entry.subject === barSubject)
      ),
    [reportEntries, barDepartment, barYear, barSection, barSubject]
  );

  const performanceData = useMemo<PerformanceItem[]>(() => {
    if (barGroup === "Overall") {
      const result = countStatuses(barEntries);

      return result.total
        ? [
            {
              name: "Overall Attendance",
              rate: result.rate,
              total: result.total,
            },
          ]
        : [];
    }

    const field: "department" | "year" | "section" | "subject" =
      barGroup === "Department"
        ? "department"
        : barGroup === "Year"
          ? "year"
          : barGroup === "Section"
            ? "section"
            : "subject";

    const groups = Array.from(
      new Set(barEntries.map((entry) => entry[field]))
    ).sort();

    return groups.map((name) => {
      const groupEntries = barEntries.filter(
        (entry) => entry[field] === name
      );
      const result = countStatuses(groupEntries);

      return {
        name,
        rate: result.rate,
        total: result.total,
      };
    });
  }, [barEntries, barGroup]);

  const barStats = useMemo(() => countStatuses(barEntries), [barEntries]);

  const attentionCount = performanceData.filter(
    (item) => item.total === 0 || item.rate < ATTENDANCE_TARGET
  ).length;

  const meetingTargetCount = performanceData.filter(
    (item) => item.total > 0 && item.rate >= ATTENDANCE_TARGET
  ).length;

  // Pie chart period and filters are independent of the horizontal chart.
  const pieEntries = useMemo(
    () =>
      entries.filter(
        (entry) =>
          (piePeriod === "Today"
            ? entry.date === today
            : (!fromDate || entry.date >= fromDate) &&
              (!toDate || entry.date <= toDate)) &&
          (pieDepartment === "All" ||
            entry.department === pieDepartment) &&
          (pieYear === "All" || entry.year === pieYear) &&
          (pieSection === "All" || entry.section === pieSection) &&
          (pieSubject === "All" || entry.subject === pieSubject)
      ),
    [
      entries,
      piePeriod,
      today,
      fromDate,
      toDate,
      pieDepartment,
      pieYear,
      pieSection,
      pieSubject,
    ]
  );

  const pieStats = useMemo(() => countStatuses(pieEntries), [pieEntries]);

  const pieData = [
    { name: "Present", value: pieStats.present },
    { name: "Absent", value: pieStats.absent },
    { name: "Late", value: pieStats.late },
  ];

  const departmentSummary = useMemo(
    () =>
      DEPARTMENTS.filter(
        (name) =>
          (department === "All" || name === department) &&
          students.some((s) => s.department === name)
      ).map((name) => ({
        name,
        students: students.filter((s) => s.department === name).length,
        today: countStatuses(
          todayEntries.filter((entry) => entry.department === name)
        ).rate,
        overall: countStatuses(
          reportEntries.filter((entry) => entry.department === name)
        ).rate,
      })),
    [students, department, todayEntries, reportEntries]
  );

  function applyPreset(days: number | "all") {
    if (days === "all") {
      setFromDate("");
      setToDate("");
      return;
    }

    if (!today) return;

    const end = parseLocalDate(today);
    const start = new Date(end);
    start.setDate(start.getDate() - days + 1);

    setFromDate(formatDate(start));
    setToDate(today);
  }

  function exportReport() {
    const studentMap = new Map(students.map((s) => [s.id, s]));

    const rows = [
      [
        "Date",
        "ERP ID",
        "Student",
        "Department",
        "Year",
        "Section",
        "Subject",
        "Status",
      ],
      ...reportEntries.map((entry) => {
        const student = studentMap.get(entry.studentId);

        return [
          entry.date,
          student?.erpId ?? "Unknown",
          student?.name ?? "Unknown",
          entry.department,
          entry.year,
          entry.section,
          entry.subject,
          entry.status,
        ];
      }),
    ];

    const csv = rows
      .map((row) =>
        row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(",")
      )
      .join("\r\n");

    const blob = new Blob(["\uFEFF" + csv], {
      type: "text/csv;charset=utf-8;",
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = "attendance-analytics.csv";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  const registeredCount = students.filter(
    (student) =>
      department === "All" || student.department === department
  ).length;

  return (
    <Shell>
      <div className="page-container">
        <div
          style={{
            background:
              "linear-gradient(120deg,#0f172a,#172554 55%,#1d4ed8)",
            color: "#fff",
            borderRadius: 22,
            padding: "28px 30px",
            marginBottom: 24,
            boxShadow: "0 12px 30px rgba(30,64,175,.18)",
          }}
        >
          <div className="page-heading" style={{ marginBottom: 0 }}>
            <div>
              <p
                style={{
                  color: "#bfdbfe",
                  fontSize: 12,
                  fontWeight: 700,
                  letterSpacing: 2,
                  marginBottom: 8,
                }}
              >
                COLLEGE INSIGHTS
              </p>
              <h1 style={{ color: "#fff", fontSize: 30 }}>
                Attendance Analytics
              </h1>
              <p style={{ color: "#dbeafe", marginTop: 8 }}>
                Monitor attendance trends and identify groups needing support.
              </p>
            </div>
            <button
              className="btn"
              onClick={exportReport}
              style={{
                background: "#fff",
                color: "#1d4ed8",
                border: 0,
                fontWeight: 700,
              }}
            >
              <Download size={18} /> Export Report
            </button>
          </div>
        </div>

        {/* Global report filters */}
        <div className="card mb-6">
          <h2>Report Filters</h2>
          <div className="form-grid">
            <div className="form-group">
              <label htmlFor="from-date">From Date</label>
              <input
                id="from-date"
                type="date"
                value={fromDate}
                max={toDate || today || undefined}
                onChange={(e) => setFromDate(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label htmlFor="to-date">To Date</label>
              <input
                id="to-date"
                type="date"
                value={toDate}
                min={fromDate || undefined}
                max={today || undefined}
                onChange={(e) => setToDate(e.target.value)}
              />
            </div>
            <FilterSelect
              label="Department"
              value={department}
              options={[...DEPARTMENTS]}
              onChange={setDepartment}
            />
          </div>

          <div
            style={{
              display: "flex",
              gap: 8,
              flexWrap: "wrap",
              marginTop: 18,
            }}
          >
            {[7, 30, 90].map((days) => (
              <button
                className="btn"
                key={days}
                onClick={() => applyPreset(days)}
                style={{
                  background: "#eff6ff",
                  color: "#1d4ed8",
                  border: "1px solid #bfdbfe",
                }}
              >
                Last {days} Days
              </button>
            ))}
            <button className="btn" onClick={() => applyPreset("all")}>
              All Time
            </button>
          </div>
        </div>

        {/* Today's cards */}
        <h2 className="mb-4">Today&apos;s Attendance</h2>
        <div className="grid grid-4 mb-6">
          {[
            {
              label: "Registered Students",
              value: registeredCount,
              icon: <Users size={22} />,
            },
            {
              label: "Present Today",
              value: todayStats.present,
              icon: <UserCheck size={22} />,
            },
            {
              label: "Records Today",
              value: todayStats.total,
              icon: <CalendarDays size={22} />,
            },
            {
              label: "Today's Attendance Rate",
              value: `${todayStats.rate}%`,
              icon: <ChartNoAxesCombined size={22} />,
            },
          ].map((item, index) => (
            <div className="card stat-card" key={item.label}>
              <div
                className="stat-icon"
                style={
                  index === 1
                    ? { background: "#dcfce7", color: "#15803d" }
                    : index === 2
                      ? { background: "#fef3c7", color: "#b45309" }
                      : index === 3
                        ? { background: "#dbeafe", color: "#1d4ed8" }
                        : {}
                }
              >
                {item.icon}
              </div>
              <div>
                <div className="stat-label">{item.label}</div>
                <div className="stat-value">{item.value}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Overall cards */}
        <h2 className="mb-4">Overall Attendance</h2>
        <div className="grid grid-4 mb-6">
          {[
            {
              label: "Registered Students",
              value: registeredCount,
              icon: <Users size={22} />,
            },
            {
              label: "Present Records",
              value: overallStats.present,
              icon: <UserCheck size={22} />,
            },
            {
              label: "Marked Records",
              value: overallStats.total,
              icon: <CalendarDays size={22} />,
            },
            {
              label: "Overall Attendance Rate",
              value: `${overallStats.rate}%`,
              icon: <TrendingUp size={22} />,
            },
          ].map((item, index) => (
            <div className="card stat-card" key={item.label}>
              <div
                className="stat-icon"
                style={
                  index === 1
                    ? { background: "#dcfce7", color: "#15803d" }
                    : index === 2
                      ? { background: "#fef3c7", color: "#b45309" }
                      : index === 3
                        ? { background: "#dbeafe", color: "#1d4ed8" }
                        : {}
                }
              >
                {item.icon}
              </div>
              <div>
                <div className="stat-label">{item.label}</div>
                <div className="stat-value">{item.value}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Attendance trends and independently filtered pie chart */}
        <div className="grid grid-2 mb-6">
          <div className="card" style={{ minWidth: 0 }}>
            <h2>Attendance Trends</h2>
            <p className="muted mb-4">
              Daily Present, Absent, and Late records for the selected report
              range.
            </p>

            {reportEntries.length === 0 ? (
              <div className="empty-state">
                No attendance records found for this date range.
              </div>
            ) : (
              <div style={{ width: "100%", height: 320 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={(() => {
                      const grouped = new Map<
                        string,
                        {
                          period: string;
                          Present: number;
                          Absent: number;
                          Late: number;
                        }
                      >();

                      reportEntries.forEach((entry) => {
                        if (!grouped.has(entry.date)) {
                          grouped.set(entry.date, {
                           period: formatShortDate(entry.date),
                            Present: 0,
                            Absent: 0,
                            Late: 0,
                          });
                        }
                        grouped.get(entry.date)![entry.status] += 1;
                      });

                      return Array.from(grouped.entries())
                        .sort(([a], [b]) => a.localeCompare(b))
                        .map(([, value]) => value);
                    })()}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      vertical={false}
                      stroke="#e2e8f0"
                    />
                    <XAxis dataKey="period" tick={{ fontSize: 11 }} />
                    <YAxis allowDecimals={false} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="Present" fill={COLORS[0]} />
                    <Bar dataKey="Absent" fill={COLORS[1]} />
                    <Bar dataKey="Late" fill={COLORS[2]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          <div className="card" style={{ minWidth: 0 }}>
            <h2>Attendance Distribution</h2>
            <p className="muted mb-4">
              Filter attendance by date, department, year, section, and subject.
            </p>

            <div
              style={{
                display: "flex",
                gap: 8,
                margin: "14px 0",
                flexWrap: "wrap",
              }}
            >
              {["Today", "Overall"].map((period) => (
                <button
                  key={period}
                  className="btn"
                  onClick={() => setPiePeriod(period)}
                  style={
                    piePeriod === period
                      ? {
                          background: "#dbeafe",
                          color: "#1d4ed8",
                          borderColor: "#93c5fd",
                        }
                      : {}
                  }
                >
                  {period}
                </button>
              ))}
            </div>

            <div className="form-grid">
              <FilterSelect
                label="Department"
                value={pieDepartment}
                options={[...DEPARTMENTS]}
                onChange={setPieDepartment}
              />
              <FilterSelect
                label="Year"
                value={pieYear}
                options={years}
                onChange={setPieYear}
              />
              <FilterSelect
                label="Section"
                value={pieSection}
                options={sections}
                onChange={setPieSection}
              />
              <FilterSelect
                label="Subject"
                value={pieSubject}
                options={subjects}
                onChange={setPieSubject}
              />
            </div>

            {pieStats.total === 0 ? (
              <div className="empty-state">
                No attendance records match these filters.
              </div>
            ) : (
              <div style={{ width: "100%", height: 280 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData.filter((item) => item.value > 0)}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="48%"
                      outerRadius={85}
                      paddingAngle={3}
                      label={({ name, value }) => `${name}: ${value}`}
                    >
                      {pieData
                        .filter((item) => item.value > 0)
                        .map((item) => (
                          <Cell
                            key={item.name}
                            fill={
                              COLORS[
                                item.name === "Present"
                                  ? 0
                                  : item.name === "Absent"
                                    ? 1
                                    : 2
                              ]
                            }
                          />
                        ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}

            <p className="muted" style={{ fontSize: 12 }}>
              Showing {pieStats.total} marked records.
              {piePeriod === "Overall"
                ? " Overall uses the selected report date range."
                : " Today uses today's date only."}
            </p>
          </div>
        </div>

        {/* Horizontal performance chart */}
        <div
          className="card mb-6"
          style={{
            padding: 26,
            borderRadius: 22,
            background: "linear-gradient(135deg,#fff,#f0f7ff)",
            border: "1px solid #dbeafe",
            boxShadow: "0 12px 32px rgba(30,64,175,.07)",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 16,
              flexWrap: "wrap",
              marginBottom: 20,
            }}
          >
            <div>
              <p
                style={{
                  color: "#2563eb",
                  fontSize: 12,
                  fontWeight: 800,
                  letterSpacing: 1.5,
                  marginBottom: 8,
                }}
              >
                PERFORMANCE OVERVIEW
              </p>
              <h2 style={{ color: "#172554", fontSize: 24 }}>
                Attendance Performance
              </h2>
              <p className="muted">
                Filter by department, academic year, section, and subject.
              </p>
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "11px 15px",
                background: "#dbeafe",
                borderRadius: 14,
                color: "#1d4ed8",
                fontWeight: 800,
              }}
            >
              <Target size={18} /> Target: {ATTENDANCE_TARGET}%
            </div>
          </div>

          <div className="form-grid">
            <FilterSelect
              label="Group"
              value={barGroup}
              options={["Overall", "Department", "Year", "Section", "Subject"]}
              onChange={setBarGroup}
            />
            <FilterSelect
              label="Department"
              value={barDepartment}
              options={[...DEPARTMENTS]}
              onChange={setBarDepartment}
            />
            <FilterSelect
              label="Year"
              value={barYear}
              options={years}
              onChange={setBarYear}
            />
            <FilterSelect
              label="Section"
              value={barSection}
              options={sections}
              onChange={setBarSection}
            />
            <FilterSelect
              label="Subject"
              value={barSubject}
              options={subjects}
              onChange={setBarSubject}
            />
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))",
              gap: 14,
              margin: "22px 0",
            }}
          >
            <div style={{ background: "#dbeafe", padding: 18, borderRadius: 15 }}>
              <TrendingUp size={18} color="#1d4ed8" />
              <p style={{ color: "#1d4ed8", marginTop: 8 }}>Filtered Rate</p>
              <strong style={{ fontSize: 30, color: "#1e3a8a" }}>
                {barStats.rate}%
              </strong>
            </div>
            <div style={{ background: "#fff1f2", padding: 18, borderRadius: 15 }}>
              <AlertTriangle size={18} color="#be123c" />
              <p style={{ color: "#be123c", marginTop: 8 }}>Needs Attention</p>
              <strong style={{ fontSize: 30, color: "#9f1239" }}>
                {attentionCount}
              </strong>
            </div>
            <div style={{ background: "#ecfdf5", padding: 18, borderRadius: 15 }}>
              <UserCheck size={18} color="#047857" />
              <p style={{ color: "#047857", marginTop: 8 }}>Meeting Target</p>
              <strong style={{ fontSize: 30, color: "#065f46" }}>
                {meetingTargetCount}
              </strong>
            </div>
          </div>

          <h3 style={{ fontSize: 18, fontWeight: 800, color: "#172554" }}>
            {barGroup === "Overall"
              ? "Overall Attendance Rate"
              : `${barGroup} Attendance Comparison`}
          </h3>
          <p className="muted mb-4">
            Attendance rate = (Present + Late) / all marked records.
          </p>

          {performanceData.length === 0 ? (
            <div className="empty-state">
              No attendance records match these filters.
            </div>
          ) : (
            <div
              style={{
                width: "100%",
                height: Math.max(220, performanceData.length * 55),
              }}
            >
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={performanceData}
                  layout="vertical"
                  margin={{ top: 8, right: 45, left: 12, bottom: 8 }}
                >
                  <CartesianGrid
                    strokeDasharray="4 4"
                    horizontal={false}
                    stroke="#e2e8f0"
                  />
                  <XAxis
                    type="number"
                    domain={[0, 100]}
                    tickFormatter={(value) => `${value}%`}
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={145}
                    tick={{ fontSize: 12 }}
                  />
                  <Tooltip
                    formatter={(value) => [`${value ?? 0}%`, "Attendance rate"]}
                  />
                  <Bar
  dataKey="rate"
  name="Attendance rate"
  radius={[0, 8, 8, 0]}
  barSize={24}
  label={{
    position: "right",
    fill: "#334155",
    fontSize: 12,
  }}
>
  {performanceData.map((item) => (
    <Cell
      key={item.name}
      fill={
        item.rate < 60
          ? "#e11d48"
          : item.rate < ATTENDANCE_TARGET
            ? "#f59e0b"
            : "#059669"
      }
    />
  ))}
</Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 16,
              marginTop: 20,
              paddingTop: 18,
              borderTop: "1px solid #dbeafe",
              fontSize: 12,
              color: "#475569",
            }}
          >
            <span>
              <span style={{ color: "#059669" }}>●</span> 75–100% — Meeting
              target
            </span>
            <span>
              <span style={{ color: "#d97706" }}>●</span> 60–74% — Needs
              improvement
            </span>
            <span>
              <span style={{ color: "#e11d48" }}>●</span> Below 60% — Priority
              attention
            </span>
          </div>
        </div>

        {/* Department summary */}
        <div className="card">
          <h2>Department Summary</h2>
          <p className="muted mb-4">
            Overall and today's attendance rate by department.
          </p>
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Department</th>
                  <th>Total Students</th>
                  <th>Today&apos;s Rate</th>
                  <th>Overall Attendance Rate</th>
                </tr>
              </thead>
              <tbody>
                {departmentSummary.map((item) => (
                  <tr key={item.name}>
                    <td>{item.name}</td>
                    <td>{item.students}</td>
                    <td>{item.today}%</td>
                    <td
                      style={{
                        fontWeight: 750,
                        color:
                          item.overall < 60
                            ? "#dc2626"
                            : item.overall < ATTENDANCE_TARGET
                              ? "#b45309"
                              : "#15803d",
                      }}
                    >
                      {item.overall}%
                    </td>
                  </tr>
                ))}
                {!departmentSummary.length && (
                  <tr>
                    <td colSpan={4}>No registered students found.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </Shell>
  );
}
