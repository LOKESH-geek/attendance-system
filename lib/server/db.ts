import crypto from "crypto";
import { getMongoClient } from "./mongodb";

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

export type AttendanceStatus = "Present" | "Absent" | "Late";
export type AttendanceRecord = {
  id: string;
  date: string;
  subject: string;
  department: string;
  year: string;
  section: string;
  statuses: Record<string, AttendanceStatus>;
  savedAt: string;
};

type User = { id: string; email: string; passwordHash: string; name: string; role: string };
type Session = { id: string; userId: string; expiresAt: string };
type Database = { students: Student[]; attendance: AttendanceRecord[]; users: User[]; sessions: Session[] };

const databaseName = process.env.MONGODB_DB || "attendease";

async function getDatabase() {
  const client = await getMongoClient();
  return client.db(databaseName);
}

function stripMongoId<T>(doc: Record<string, unknown>): T {
  const { _id: _ignored, ...value } = doc;
  return value as T;
}

/** MongoDB is the source of truth. Existing JSON data is imported once when collections are empty. */
async function ensureDb() {
  const db = await getDatabase();
  const migration = db.collection<{ _id: string }>("_app_meta");
  const alreadyMigrated = await migration.findOne({ _id: "legacy-json-migrated" });
  if (!alreadyMigrated) {
    const collections: Array<keyof Database> = ["students", "attendance", "users", "sessions"];
    let legacy: Partial<Database> = {};
    // Optional one-time migration of the project's existing local data file.
    try {
      const fs = await import("fs/promises");
      const path = await import("path");
      const raw = await fs.readFile(path.join(process.cwd(), "data", "db.json"), "utf8");
      legacy = JSON.parse(raw) as Partial<Database>;
    } catch {
      // A missing local file is normal in production.
    }
    for (const name of collections) {
      const collection = db.collection(String(name));
      if ((await collection.countDocuments()) === 0) {
        const items = legacy[name];
        if (Array.isArray(items) && items.length) {
          await collection.insertMany(items.map((item) => ({ ...(item as object) })));
        }
      }
    }
    await migration.updateOne(
      { _id: "legacy-json-migrated" },
      { $set: { completedAt: new Date() } },
      { upsert: true },
    );
  }

  const userCount = await db.collection("users").countDocuments();
  if (!userCount) {
    await db.collection("users").insertOne({
      id: crypto.randomUUID(),
      email: "admin@attendease.local",
      passwordHash: hashPassword(process.env.DEFAULT_ADMIN_PASSWORD || "admin123"),
      name: "College Admin",
      role: "Administrator",
    });
  }
}


export async function readDb(): Promise<Database> {
  await ensureDb();
  const db = await getDatabase();
  const [studentDocs, attendance, users, sessions] = await Promise.all([
    db.collection("students").find({}).toArray(),
    db.collection("attendance").find({}).toArray(),
    db.collection("users").find({}).toArray(),
    db.collection("sessions").find({}).toArray(),
  ]);

  // Repair only malformed/duplicate student documents; never clear the whole collection.
  const students: Student[] = [];
  const seenIds = new Set<string>();
  const seenErpIds = new Set<string>();
  const studentCollection = db.collection<Student & { _id: string }>("students");
  for (const raw of studentDocs) {
    const student = stripMongoId<Student>(raw as unknown as Record<string, unknown>);
    const rawId = String(student.id ?? "").trim();
    const id = rawId || crypto.randomUUID();
    const erpId = String(student.erpId ?? "").trim();
    const normalizedErp = erpId.toLowerCase();
    const duplicate = seenIds.has(id) || (normalizedErp !== "" && seenErpIds.has(normalizedErp));

    if (duplicate) {
      await studentCollection.deleteOne({ _id: raw._id as string});
      continue;
    }

    if (!rawId) {
      await studentCollection.updateOne(
        { _id: raw._id as string},
        { $set: { id } },
      );
    }


  
    

    student.id = id;
    student.erpId = erpId;
    students.push(student);
    seenIds.add(id);
    if (normalizedErp) seenErpIds.add(normalizedErp);
  }

  // Unique IDs stop future duplicate React keys at the database level.
  await studentCollection.createIndex({ id: 1 }, { unique: true, name: "student_id_unique" });
  await studentCollection.createIndex(
    { erpId: 1 },
    {
      unique: true,
      name: "student_erp_unique",
      partialFilterExpression: { erpId: { $type: "string", $gt: "" } },
    },
  );

  return {
    students,
    attendance: attendance.map((doc) => stripMongoId<AttendanceRecord>(doc as unknown as Record<string, unknown>)),
    users: users.map((doc) => stripMongoId<User>(doc as unknown as Record<string, unknown>)),
    sessions: sessions.map((doc) => stripMongoId<Session>(doc as unknown as Record<string, unknown>)),
  };
}

export async function replaceCollection(
  name: "students" | "attendance",
  items: Array<Student | AttendanceRecord>,
) {
  await ensureDb();
  const db = await getDatabase();
  const collection = db.collection(name);
  await collection.deleteMany({});
  if (items.length) {
    await collection.insertMany(items.map((item) => ({ ...(item as object) })));
  }
}

export async function insertStudent(student: Student) {
  await ensureDb();
  const db = await getDatabase();
  await db.collection("students").insertOne({ ...student });
}


export function hashPassword(password: string) {
  return crypto.scryptSync(password, "attendease-v1", 64).toString("hex");
}

export function verifyPassword(password: string, hash: string) {
  try {
    const supplied = Buffer.from(hash, "hex");
    const expected = Buffer.from(hashPassword(password), "hex");
    return supplied.length === expected.length && crypto.timingSafeEqual(supplied, expected);
  } catch {
    return false;
  }
}

export async function createSession(userId: string) {
  await ensureDb();
  const db = await getDatabase();
  const id = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 8).toISOString();
  await db.collection("sessions").deleteMany({ expiresAt: { $lte: new Date().toISOString() } });
  await db.collection("sessions").insertOne({ id, userId, expiresAt });
  return { id, expiresAt };
}

export async function getSession(sessionId: string | undefined) {
  if (!sessionId) return null;
  await ensureDb();
  const db = await getDatabase();
  const session = await db.collection("sessions").findOne({ id: sessionId, expiresAt: { $gt: new Date().toISOString() } }) as Session | null;
  if (!session) return null;
  const user = await db.collection("users").findOne({ id: session.userId }) as User | null;
  return user ? { session, user } : null;
}

export async function deleteSession(sessionId: string | undefined) {
  if (!sessionId) return;
  await ensureDb();
  const db = await getDatabase();
  await db.collection("sessions").deleteOne({ id: sessionId });
}
