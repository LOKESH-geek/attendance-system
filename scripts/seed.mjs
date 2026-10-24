import { MongoClient } from 'mongodb';
import crypto from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const uri = process.env.MONGODB_URI;
if (!uri) {
  console.error('MONGODB_URI is missing. Add it to .env.local before running npm run seed.');
  process.exit(1);
}

const databaseName = process.env.MONGODB_DB || 'attendease';
const today = new Date();
const date = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
const samples = [
  {
    id: 'e21127be-2c81-4f30-85e7-78fd7256b23b',
    erpId: '6605745', name: 'asa', email: 'sas@gmail.com',
    department: 'Computer Science', year: '1st Year', section: 'A', phone: '5654654622',
  },
  {
    id: '7b1f8b9a-6b22-4a1d-9f31-3d55f5a10001',
    erpId: 'DEMO1001', name: 'Aarav Sharma', email: 'aarav.sharma@example.com',
    department: 'Computer Science', year: '3rd Year', section: 'A', phone: '9000000001',
  },
  {
    id: '7b1f8b9a-6b22-4a1d-9f31-3d55f5a10002',
    erpId: 'DEMO1002', name: 'Ananya Verma', email: 'ananya.verma@example.com',
    department: 'Computer Science', year: '3rd Year', section: 'A', phone: '9000000002',
  },
  {
    id: '7b1f8b9a-6b22-4a1d-9f31-3d55f5a10003',
    erpId: 'DEMO1003', name: 'Rohan Sahu', email: 'rohan.sahu@example.com',
    department: 'Information Technology', year: '2nd Year', section: 'B', phone: '9000000003',
  },
  {
    id: '7b1f8b9a-6b22-4a1d-9f31-3d55f5a10004',
    erpId: 'DEMO1004', name: 'Priya Patel', email: 'priya.patel@example.com',
    department: 'Electronics', year: '1st Year', section: 'A', phone: '9000000004',
  },
  {
    id: '7b1f8b9a-6b22-4a1d-9f31-3d55f5a10005',
    erpId: 'DEMO1005', name: 'Kabir Netam', email: 'kabir.netam@example.com',
    department: 'Mechanical Engineering', year: '4th Year', section: 'C', phone: '9000000005',
  },
];

const client = new MongoClient(uri);
try {
  await client.connect();
  const db = client.db(databaseName);
  const students = db.collection('students');
  const attendance = db.collection('attendance');
  const users = db.collection('users');

  // Import legacy JSON documents first, without replacing or overwriting MongoDB records.
  try {
    const legacy = JSON.parse(await readFile(path.join(process.cwd(), 'data', 'db.json'), 'utf8'));
    for (const student of Array.isArray(legacy.students) ? legacy.students : []) {
      const query = student.erpId
        ? { erpId: { $regex: `^${String(student.erpId).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' } }
        : { id: student.id };
      if (!(await students.findOne(query))) await students.insertOne({ ...student });
    }
    for (const record of Array.isArray(legacy.attendance) ? legacy.attendance : []) {
      const query = record.id ? { id: record.id } : {
        date: record.date, subject: record.subject, department: record.department,
        year: record.year, section: record.section,
      };
      if (!(await attendance.findOne(query))) {
        await attendance.insertOne({ ...record, id: record.id || crypto.randomUUID() });
      }
    }
    for (const user of Array.isArray(legacy.users) ? legacy.users : []) {
      if (!(await users.findOne({ email: String(user.email || '').toLowerCase() }))) {
        await users.insertOne({ ...user, email: String(user.email || '').toLowerCase() });
      }
    }
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  }

  // Preserve existing records. Add only sample ERP IDs that do not already exist.
  let insertedStudents = 0;
  for (const student of samples) {
    const existing = await students.findOne({ erpId: { $regex: `^${student.erpId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' } });
    if (existing) continue;
    const existingId = await students.findOne({ id: student.id });
    if (existingId) continue;
    await students.insertOne({ ...student, sampleRecord: student.erpId.startsWith('DEMO') });
    insertedStudents++;
  }

  // Add a demo attendance record for the sample CS 3rd-year section if none exists today.
  const csStudents = await students.find({ department: 'Computer Science', year: '3rd Year', section: 'A' }).toArray();
  const attendanceKey = { date, subject: 'Database Management', department: 'Computer Science', year: '3rd Year', section: 'A' };
  let insertedAttendance = 0;
  const existingAttendance = await attendance.findOne(attendanceKey);
  if (!existingAttendance && csStudents.length) {
    const statuses = {};
    csStudents.forEach((student, index) => { statuses[student.id] = index % 2 === 0 ? 'Present' : 'Late'; });
    await attendance.insertOne({ id: crypto.randomUUID(), ...attendanceKey, statuses, savedAt: new Date().toISOString(), sampleRecord: true });
    insertedAttendance = 1;
  }

  if ((await users.countDocuments()) === 0) {
    const password = process.env.DEFAULT_ADMIN_PASSWORD || 'admin123';
    const passwordHash = crypto.scryptSync(password, 'attendease-v1', 64).toString('hex');
    await users.insertOne({ id: crypto.randomUUID(), email: 'admin@attendease.local', passwordHash, name: 'College Admin', role: 'Administrator' });
    console.log(`Created local admin account: admin@attendease.local (password: ${password === 'admin123' ? 'admin123' : 'value from DEFAULT_ADMIN_PASSWORD'})`);
  }

  console.log(`Seed complete. Database: ${databaseName}`);
  console.log(`New students inserted: ${insertedStudents}; new attendance records inserted: ${insertedAttendance}`);
  console.log('Existing records were preserved. Sample students use ERP IDs DEMO1001–DEMO1005.');
} catch (error) {
  console.error('Seed failed:', error);
  process.exitCode = 1;
} finally {
  await client.close();
}
