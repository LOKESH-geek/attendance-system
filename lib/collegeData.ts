export const DEPARTMENTS = [
  "Computer Science",
  "Information Technology",
  "Electronics",
  "Mechanical Engineering",
  "Civil Engineering",
  "Electrical Engineering",
] as const;

export const YEARS = ["1st Year", "2nd Year", "3rd Year", "4th Year"] as const;
export const SECTIONS = ["A", "B", "C", "D", "E", "F"] as const;
export const SUBJECTS = [
  "Programming Fundamentals",
  "Database Management",
  "Computer Networks",
  "Operating Systems",
  "Mathematics",
  "Physics",
  "Communication Skills",
  "Digital Electronics",
  "Engineering Mechanics",
] as const;

export type AttendanceStatus = "Present" | "Absent" | "Late";

export type Student = {
  id: string;
  erpId: string;
  name: string;
  email: string;
  department: string;
  year: string;
  section: string;
  phone?: string;
};

export type AttendanceRecord = {
  id?: string;
  date: string;
  subject: string;
  department: string;
  year: string;
  section: string;
  statuses: Record<string, AttendanceStatus>;
  savedAt: string;
};

async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    credentials: "include",
    cache: "no-store",
    headers: { "Content-Type": "application/json", ...(options?.headers ?? {}) },
    ...options,
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({ error: "Request failed" }));
    throw new Error(body.error || `Request failed (${response.status})`);
  }
  return response.json();
}

export async function getCollegeStudents(): Promise<Student[]> {
  return api<Student[]>("/api/students");
}

export async function saveCollegeStudents(students: Student[]): Promise<Student[]> {
  return api<Student[]>("/api/students", {
    method: "PUT",
    body: JSON.stringify(students),
  });
}

export async function getAttendanceRecords(): Promise<AttendanceRecord[]> {
  return api<AttendanceRecord[]>("/api/attendance");
}

export async function saveAttendanceRecords(
  records: AttendanceRecord[]
): Promise<AttendanceRecord[]> {
  return api<AttendanceRecord[]>("/api/attendance", {
    method: "PUT",
    body: JSON.stringify(records),
  });
}
