import { NextResponse } from "next/server";
import crypto from "crypto";
import { readDb, replaceCollection, type AttendanceRecord, type AttendanceStatus } from "../../../lib/server/db";
import { requireUser } from "../../../lib/server/auth";

const validStatuses: AttendanceStatus[] = ["Present", "Absent", "Late"];

export async function GET() {
  try {
    await requireUser();
    const db = await readDb();
    return NextResponse.json(db.attendance);
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" });
    }
    console.error("List attendance failed:", error);
    return NextResponse.json({ error: "Unable to load attendance." }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    await requireUser();
    const records = await request.json();
    if (!Array.isArray(records)) {
      return NextResponse.json({ error: "Attendance records must be an array." }, { status: 400 });
    }

    const normalized: AttendanceRecord[] = records.map((record: Partial<AttendanceRecord>) => {
      if (!record || typeof record !== "object" || !record.date || !record.subject || !record.department || !record.year || !record.section || !record.statuses || typeof record.statuses !== "object") {
        throw new Error(
          "Each attendance record must include date, subject, department, year, section and statuses.",
        );
      }
      for (const status of Object.values(record.statuses)) {
        if (!validStatuses.includes(status as AttendanceStatus)) throw new Error("Status must be Present, Absent, or Late.");
      }
      return {
        id: typeof record.id === "string" && record.id ? record.id : crypto.randomUUID(),
        date: String(record.date),
        subject: String(record.subject),
        department: String(record.department),
        year: String(record.year),
        section: String(record.section),
        statuses: record.statuses as Record<string, AttendanceStatus>,
        savedAt: typeof record.savedAt === "string" ? record.savedAt : new Date().toISOString(),
      };
    });

    const db = await readDb();
    db.attendance = normalized;
    await replaceCollection("attendance", db.attendance);
    return NextResponse.json(normalized);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to save attendance records.";
    if (message === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (message.startsWith("Each attendance") || message.startsWith("Status must")) {
      return NextResponse.json({ error: message }, { status: 400 });
    }
    console.error("Save attendance failed:", error);
    return NextResponse.json({ error: "Unable to save attendance records." }, { status: 500 });
  }
}

// Postman-friendly single-student endpoint. It stores data in the same collection/model used by the app.
export async function POST(request: Request) {
  try {
    await requireUser();
    const body = await request.json();
    const required = ["erpId", "subject", "department", "section", "status"];
    for (const field of required) {
      if (typeof body[field] !== "string" || !body[field].trim()) {
        return NextResponse.json({ error: `${field} is required.` }, { status: 400 });
      }
    }
    if (!validStatuses.includes(body.status.trim())) {
      return NextResponse.json({ error: "Status must be Present, Absent, or Late." }, { status: 400 });
    }
    const attendanceDate = body.attendanceDate ? new Date(body.attendanceDate) : new Date();
    if (Number.isNaN(attendanceDate.getTime())) {
      return NextResponse.json({ error: "Invalid attendanceDate." }, { status: 400 });
    }

    const db = await readDb();
    const student = db.students.find((item) => item.erpId.trim().toLowerCase() === body.erpId.trim().toLowerCase());
    if (!student) {
      return NextResponse.json({ error: "Student ERP ID was not found. Create the student first using POST /api/students." }, { status: 404 });
    }
    const studentId = student.id;
    const date = attendanceDate.toISOString().slice(0, 10);
    const year = String(body.year || student.year || "").trim();
    const existing = db.attendance.find(
      (item) =>
        item.date.slice(0, 10) === date &&
        item.subject === body.subject.trim() &&
        item.department === body.department.trim() &&
        item.year === year &&
        item.section === body.section.trim(),
    );
    const status = body.status.trim() as AttendanceStatus;
    if (existing) {
      existing.statuses[studentId] = status;
      existing.savedAt = new Date().toISOString();
    } else {
      db.attendance.push({
        id: crypto.randomUUID(), date, subject: body.subject.trim(), department: body.department.trim(),
        year, section: body.section.trim(),
        statuses: { [studentId]: status }, savedAt: new Date().toISOString(),
      });
    }
    await replaceCollection("attendance", db.attendance);
    return NextResponse.json({ success: true, message: "Attendance saved successfully.", records: db.attendance }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to save attendance.";
    if (message === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (error instanceof SyntaxError) return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
    console.error("Mark attendance failed:", error);
    return NextResponse.json({ error: "Unable to save attendance." }, { status: 500 });
  }
}
