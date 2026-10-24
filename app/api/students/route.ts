import crypto from "crypto";
import { NextResponse } from "next/server";
import { insertStudent, readDb, replaceCollection } from "../../../lib/server/db";
import { requireUser } from "../../../lib/server/auth";

export async function GET() {
  try {
    await requireUser();
    const db = await readDb();
    return NextResponse.json(db.students);
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" });
    }
    console.error("List students failed:", error);
    return NextResponse.json(
      { error: "Unable to load students." },
      { status: 500 },
    );
  }
}

export async function PUT(request: Request) {
  try {
    await requireUser();
    const students = await request.json();
    if (!Array.isArray(students)) {
      return NextResponse.json({ error: "Students must be an array." }, { status: 400 });
    }
    const db = await readDb();
    const seenIds = new Set<string>();
    const seenErpIds = new Set<string>();
    const normalizedStudents = students.map((student: unknown) => {
      if (!student || typeof student !== "object" || Array.isArray(student)) {
        throw new Error("Each student must be a JSON object.");
      }
      const value = student as Record<string, unknown>;
      const erpId = String(value.erpId ?? "").trim();
      const name = String(value.name ?? "").trim();
      const email = String(value.email ?? "").trim();
      const department = String(value.department ?? "").trim();
      const year = String(value.year ?? "").trim();
      const section = String(value.section ?? "").trim().toUpperCase();
      if (!erpId || !name || !email || !department || !year || !section) {
        throw new Error("Each student requires erpId, name, email, department, year and section.");
      }
      return {
        ...value,
        id: typeof value.id === "string" && value.id.trim() ? value.id.trim() : crypto.randomUUID(),
        erpId, name, email, department, year, section,
        ...(value.phone === undefined ? {} : { phone: String(value.phone).trim() }),
      };
    });
    for (const student of normalizedStudents) {
      const id = String(student.id);
      const erpId = String(student.erpId).toLowerCase();
      if (seenIds.has(id)) {
        return NextResponse.json({ error: `Duplicate student ID: ${id}` }, { status: 409 });
      }
      if (erpId && seenErpIds.has(erpId)) {
        return NextResponse.json({ error: `Duplicate ERP ID: ${student.erpId}` }, { status: 409 });
      }
      seenIds.add(id);
      if (erpId) seenErpIds.add(erpId);
    }
    db.students = normalizedStudents as typeof db.students;
    await replaceCollection("students", db.students);
    return NextResponse.json(db.students);
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const message = error instanceof Error ? error.message : "Unable to save students.";
    if (message.startsWith("Each student")) return NextResponse.json({ error: message }, { status: 400 });
    console.error("Save students failed:", error);
    return NextResponse.json({ error: "Unable to save students." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    await requireUser();
    const student = await request.json();
    const db = await readDb();
    if (!student?.erpId || !student?.name || !student?.email) {
      return NextResponse.json({ error: "ERP ID, name and email are required." }, { status: 400 });
    }
    if (db.students.some((s) => s.erpId.toLowerCase() === String(student.erpId).toLowerCase())) {
      return NextResponse.json({ error: "ERP ID already exists." }, { status: 409 });
    }
    if (student.id && db.students.some((s) => s.id === student.id)) {
      return NextResponse.json({ error: "Student ID already exists." }, { status: 409 });
    }
    const newStudent = {
      id: typeof student.id === "string" && student.id.trim() ? student.id.trim() : crypto.randomUUID(),
      erpId: String(student.erpId).trim(),
      name: String(student.name).trim(),
      email: String(student.email).trim(),
      department: String(student.department ?? "").trim(),
      year: String(student.year ?? "").trim(),
      section: String(student.section ?? "").trim().toUpperCase(),
      ...(student.phone === undefined ? {} : { phone: String(student.phone).trim() }),
    };
    if (!newStudent.department || !newStudent.year || !newStudent.section) {
      return NextResponse.json({ error: "Department, year and section are required." }, { status: 400 });
    }
    await insertStudent(newStudent);
    return NextResponse.json(newStudent, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to create student.";
    if (message.includes("E11000")) {
      return NextResponse.json({ error: "Student ID or ERP ID already exists." }, { status: 409 });
    }
    if (message === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    console.error("Create student failed:", error);
    return NextResponse.json({ error: "Unable to create student." }, { status: 500 });
  }
}
