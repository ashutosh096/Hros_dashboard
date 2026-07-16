import { db, employeesTable, attendanceTable, meetingsTable, tasksTable, announcementsTable, organizationsTable, usersTable } from "@workspace/db";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";

/**
 * Seeds the database with default organization, employee accounts, mock attendance entries,
 * tasks, meetings, and announcements if no organization currently exists.
 */
export async function seedDatabase() {
  await ensureDefaultAdmin();
  const existingOrgs = await db.select().from(organizationsTable);
  if (existingOrgs.length > 0) return;

  // Insert default organization
  const [org] = await db.insert(organizationsTable).values({
    name: "Acme Corporation",
    slug: "acme",
    plan: "FREE",
  }).returning();

  const passwordHash = await bcrypt.hash("employee123", 10);
  const adminPasswordHash = await bcrypt.hash("admin123", 10);

  // Insert employees
  const employees = await db.insert(employeesTable).values([
    { organizationId: org.id, name: "Alex Johnson", email: "admin@hrapp.com", phone: "+1 555-0101", department: "Engineering", position: "Senior Engineer", role: "ADMIN", status: "ACTIVE", joinDate: "2022-03-15", salary: "95000" },
    { organizationId: org.id, name: "Sarah Chen", email: "sarah@hrapp.com", phone: "+1 555-0102", department: "Engineering", position: "Frontend Developer", role: "EMPLOYEE", status: "ACTIVE", joinDate: "2023-01-10", salary: "78000" },
    { organizationId: org.id, name: "Priya Sharma", email: "priya.sharma@company.com", phone: "+1 555-0103", department: "Design", position: "UX Designer", role: "EMPLOYEE", status: "ACTIVE", joinDate: "2022-08-22", salary: "82000" },
    { organizationId: org.id, name: "Carlos Rivera", email: "carlos.rivera@company.com", phone: "+1 555-0104", department: "Marketing", position: "Marketing Manager", role: "EMPLOYEE", status: "ACTIVE", joinDate: "2021-11-05", salary: "88000" },
    { organizationId: org.id, name: "Emma Chen", email: "emma.chen@company.com", phone: "+1 555-0105", department: "HR", position: "HR Specialist", role: "EMPLOYEE", status: "ON_LEAVE", joinDate: "2023-04-17", salary: "72000" },
    { organizationId: org.id, name: "David Kowalski", email: "david@hrapp.com", phone: "+1 555-0106", department: "Engineering", position: "Backend Engineer", role: "EMPLOYEE", status: "ACTIVE", joinDate: "2022-06-30", salary: "85000" },
    { organizationId: org.id, name: "Aisha Ndiaye", email: "aisha.ndiaye@company.com", phone: "+1 555-0107", department: "Finance", position: "Financial Analyst", role: "EMPLOYEE", status: "ACTIVE", joinDate: "2023-09-01", salary: "80000" },
    { organizationId: org.id, name: "Lucas Petersen", email: "lucas.petersen@company.com", phone: "+1 555-0108", department: "Sales", position: "Sales Lead", role: "EMPLOYEE", status: "ACTIVE", joinDate: "2021-07-12", salary: "90000" },
  ]).returning();

  // Insert user credentials for each employee
  await db.insert(usersTable).values([
    { organizationId: org.id, email: "admin@hrapp.com", passwordHash: adminPasswordHash, role: "ADMIN" },
    { organizationId: org.id, email: "sarah@hrapp.com", passwordHash: passwordHash, role: "EMPLOYEE" },
    { organizationId: org.id, email: "priya.sharma@company.com", passwordHash: passwordHash, role: "EMPLOYEE" },
    { organizationId: org.id, email: "carlos.rivera@company.com", passwordHash: passwordHash, role: "EMPLOYEE" },
    { organizationId: org.id, email: "emma.chen@company.com", passwordHash: passwordHash, role: "EMPLOYEE" },
    { organizationId: org.id, email: "david@hrapp.com", passwordHash: passwordHash, role: "EMPLOYEE" },
    { organizationId: org.id, email: "aisha.ndiaye@company.com", passwordHash: passwordHash, role: "EMPLOYEE" },
    { organizationId: org.id, email: "lucas.petersen@company.com", passwordHash: passwordHash, role: "EMPLOYEE" },
  ]);

  const today = new Date().toISOString().split("T")[0];
  const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0];
  const twoDaysAgo = new Date(Date.now() - 2 * 86400000).toISOString().split("T")[0];
  const threeDaysAgo = new Date(Date.now() - 3 * 86400000).toISOString().split("T")[0];
  const fourDaysAgo = new Date(Date.now() - 4 * 86400000).toISOString().split("T")[0];
  const fiveDaysAgo = new Date(Date.now() - 5 * 86400000).toISOString().split("T")[0];
  const sixDaysAgo = new Date(Date.now() - 6 * 86400000).toISOString().split("T")[0];

  await db.insert(attendanceTable).values([
    // Today
    { organizationId: org.id, employeeId: employees[0].id, date: today, checkIn: "08:55", checkOut: null, status: "PRESENT", hoursWorked: null },
    { organizationId: org.id, employeeId: employees[1].id, date: today, checkIn: "09:12", checkOut: null, status: "LATE", hoursWorked: null },
    { organizationId: org.id, employeeId: employees[2].id, date: today, checkIn: "08:48", checkOut: null, status: "PRESENT", hoursWorked: null },
    { organizationId: org.id, employeeId: employees[3].id, date: today, checkIn: null, checkOut: null, status: "ABSENT", hoursWorked: null },
    { organizationId: org.id, employeeId: employees[4].id, date: today, checkIn: null, checkOut: null, status: "ON_LEAVE", hoursWorked: null },
    { organizationId: org.id, employeeId: employees[5].id, date: today, checkIn: "08:30", checkOut: null, status: "PRESENT", hoursWorked: null },
    { organizationId: org.id, employeeId: employees[6].id, date: today, checkIn: "09:02", checkOut: null, status: "PRESENT", hoursWorked: null },
    { organizationId: org.id, employeeId: employees[7].id, date: today, checkIn: "08:45", checkOut: null, status: "PRESENT", hoursWorked: null },
    // Yesterday
    { organizationId: org.id, employeeId: employees[0].id, date: yesterday, checkIn: "08:58", checkOut: "17:30", status: "PRESENT", hoursWorked: "8.5" },
    { organizationId: org.id, employeeId: employees[1].id, date: yesterday, checkIn: "09:00", checkOut: "18:00", status: "PRESENT", hoursWorked: "9" },
    { organizationId: org.id, employeeId: employees[2].id, date: yesterday, checkIn: "08:50", checkOut: "17:45", status: "PRESENT", hoursWorked: "8.9" },
    { organizationId: org.id, employeeId: employees[3].id, date: yesterday, checkIn: "09:15", checkOut: "17:00", status: "LATE", hoursWorked: "7.8" },
    { organizationId: org.id, employeeId: employees[5].id, date: yesterday, checkIn: "08:30", checkOut: "17:30", status: "PRESENT", hoursWorked: "9" },
    { organizationId: org.id, employeeId: employees[6].id, date: yesterday, checkIn: "09:00", checkOut: "17:00", status: "PRESENT", hoursWorked: "8" },
    { organizationId: org.id, employeeId: employees[7].id, date: yesterday, checkIn: "08:45", checkOut: "17:15", status: "PRESENT", hoursWorked: "8.5" },
    // Two days ago
    { organizationId: org.id, employeeId: employees[0].id, date: twoDaysAgo, checkIn: "09:00", checkOut: "17:30", status: "PRESENT", hoursWorked: "8.5" },
    { organizationId: org.id, employeeId: employees[1].id, date: twoDaysAgo, checkIn: "09:20", checkOut: "18:00", status: "LATE", hoursWorked: "8.7" },
    { organizationId: org.id, employeeId: employees[2].id, date: twoDaysAgo, checkIn: null, checkOut: null, status: "ABSENT", hoursWorked: null },
    { organizationId: org.id, employeeId: employees[5].id, date: twoDaysAgo, checkIn: "08:30", checkOut: "17:30", status: "PRESENT", hoursWorked: "9" },
    { organizationId: org.id, employeeId: employees[6].id, date: twoDaysAgo, checkIn: "08:55", checkOut: "17:00", status: "PRESENT", hoursWorked: "8.1" },
    // Three days ago
    { organizationId: org.id, employeeId: employees[0].id, date: threeDaysAgo, checkIn: "08:45", checkOut: "17:45", status: "PRESENT", hoursWorked: "9" },
    { organizationId: org.id, employeeId: employees[1].id, date: threeDaysAgo, checkIn: "09:05", checkOut: "18:00", status: "PRESENT", hoursWorked: "8.9" },
    { organizationId: org.id, employeeId: employees[3].id, date: threeDaysAgo, checkIn: "09:00", checkOut: "17:00", status: "PRESENT", hoursWorked: "8" },
    { organizationId: org.id, employeeId: employees[5].id, date: threeDaysAgo, checkIn: "08:30", checkOut: "17:00", status: "PRESENT", hoursWorked: "8.5" },
    // Four days ago
    { organizationId: org.id, employeeId: employees[0].id, date: fourDaysAgo, checkIn: "09:00", checkOut: "17:30", status: "PRESENT", hoursWorked: "8.5" },
    { organizationId: org.id, employeeId: employees[2].id, date: fourDaysAgo, checkIn: "08:50", checkOut: "17:45", status: "PRESENT", hoursWorked: "8.9" },
    { organizationId: org.id, employeeId: employees[5].id, date: fourDaysAgo, checkIn: "09:10", checkOut: "17:00", status: "LATE", hoursWorked: "7.8" },
    { organizationId: org.id, employeeId: employees[7].id, date: fourDaysAgo, checkIn: "08:45", checkOut: "17:15", status: "PRESENT", hoursWorked: "8.5" },
    // Five days ago
    { organizationId: org.id, employeeId: employees[0].id, date: fiveDaysAgo, checkIn: "08:55", checkOut: "17:30", status: "PRESENT", hoursWorked: "8.6" },
    { organizationId: org.id, employeeId: employees[1].id, date: fiveDaysAgo, checkIn: "09:00", checkOut: "18:00", status: "PRESENT", hoursWorked: "9" },
    { organizationId: org.id, employeeId: employees[3].id, date: fiveDaysAgo, checkIn: null, checkOut: null, status: "ABSENT", hoursWorked: null },
    { organizationId: org.id, employeeId: employees[6].id, date: fiveDaysAgo, checkIn: "09:00", checkOut: "17:00", status: "PRESENT", hoursWorked: "8" },
    // Six days ago
    { organizationId: org.id, employeeId: employees[0].id, date: sixDaysAgo, checkIn: "09:00", checkOut: "17:00", status: "PRESENT", hoursWorked: "8" },
    { organizationId: org.id, employeeId: employees[2].id, date: sixDaysAgo, checkIn: "08:45", checkOut: "17:30", status: "PRESENT", hoursWorked: "8.8" },
    { organizationId: org.id, employeeId: employees[5].id, date: sixDaysAgo, checkIn: "08:30", checkOut: "17:30", status: "PRESENT", hoursWorked: "9" },
    { organizationId: org.id, employeeId: employees[7].id, date: sixDaysAgo, checkIn: "09:15", checkOut: "17:00", status: "LATE", hoursWorked: "7.8" },
  ]);

  const futureDate1 = new Date(Date.now() + 2 * 3600000).toISOString();
  const futureDate1End = new Date(Date.now() + 3 * 3600000).toISOString();
  const futureDate2 = new Date(Date.now() + 24 * 3600000).toISOString();
  const futureDate2End = new Date(Date.now() + 25 * 3600000).toISOString();
  const futureDate3 = new Date(Date.now() + 48 * 3600000).toISOString();
  const futureDate3End = new Date(Date.now() + 49.5 * 3600000).toISOString();
  const pastDate1 = new Date(Date.now() - 3 * 3600000).toISOString();
  const pastDate1End = new Date(Date.now() - 2 * 3600000).toISOString();

  await db.insert(meetingsTable).values([
    {
      organizationId: org.id,
      title: "Q2 Engineering Sync",
      description: "Quarterly engineering all-hands: roadmap review and sprint planning.",
      startTime: futureDate1,
      endTime: futureDate1End,
      location: "Conference Room A",
      meetLink: "https://meet.google.com/abc-defg-hij",
      organizer: "Alex Johnson",
      status: "SCHEDULED",
      attendees: ["admin@hrapp.com", "sarah@hrapp.com", "david@hrapp.com"],
    },
    {
      organizationId: org.id,
      title: "Design Review — Mobile App",
      description: "Review latest Figma prototypes for the mobile app redesign.",
      startTime: futureDate2,
      endTime: futureDate2End,
      location: "Design Studio",
      meetLink: "https://meet.google.com/klm-nopq-rst",
      organizer: "Priya Sharma",
      status: "SCHEDULED",
      attendees: ["priya.sharma@company.com", "admin@hrapp.com"],
    },
    {
      organizationId: org.id,
      title: "Marketing Campaign Kickoff",
      description: "Kickoff meeting for the summer marketing campaign.",
      startTime: futureDate3,
      endTime: futureDate3End,
      location: "Main Boardroom",
      meetLink: null,
      organizer: "Carlos Rivera",
      status: "SCHEDULED",
      attendees: ["carlos.rivera@company.com", "emma.chen@company.com", "aisha.ndiaye@company.com"],
    },
    {
      organizationId: org.id,
      title: "1:1 — Lucas & Alex",
      description: "Weekly check-in.",
      startTime: pastDate1,
      endTime: pastDate1End,
      location: "Alex's Office",
      meetLink: null,
      organizer: "Alex Johnson",
      status: "COMPLETED",
      attendees: ["admin@hrapp.com", "lucas.petersen@company.com"],
    },
  ]);

  await db.insert(tasksTable).values([
    { organizationId: org.id, title: "Set up CI/CD pipeline", description: "Configure GitHub Actions for automated testing and deployment.", status: "DONE", priority: "HIGH", assigneeId: employees[0].id, dueDate: yesterday },
    { organizationId: org.id, title: "Redesign onboarding flow", description: "Improve the first-time user experience based on usability testing feedback.", status: "IN_PROGRESS", priority: "HIGH", assigneeId: employees[2].id, dueDate: new Date(Date.now() + 5 * 86400000).toISOString().split("T")[0] },
    { organizationId: org.id, title: "Write Q2 sales report", description: "Compile and analyze Q2 sales data for the board presentation.", status: "IN_PROGRESS", priority: "MEDIUM", assigneeId: employees[7].id, dueDate: new Date(Date.now() + 3 * 86400000).toISOString().split("T")[0] },
    { organizationId: org.id, title: "Update employee handbook", description: "Revise HR policies to reflect new remote work guidelines.", status: "TODO", priority: "MEDIUM", assigneeId: employees[4].id, dueDate: new Date(Date.now() + 10 * 86400000).toISOString().split("T")[0] },
    { organizationId: org.id, title: "Backend API performance audit", description: "Profile slow endpoints and optimize database queries.", status: "TODO", priority: "HIGH", assigneeId: employees[5].id, dueDate: new Date(Date.now() + 7 * 86400000).toISOString().split("T")[0] },
    { organizationId: org.id, title: "Budget planning for Q3", description: "Draft department budget proposals for Q3 review.", status: "TODO", priority: "URGENT", assigneeId: employees[6].id, dueDate: new Date(Date.now() + 4 * 86400000).toISOString().split("T")[0] },
    { organizationId: org.id, title: "Social media content calendar", description: "Plan and schedule posts for July and August.", status: "TODO", priority: "LOW", assigneeId: employees[3].id, dueDate: new Date(Date.now() + 14 * 86400000).toISOString().split("T")[0] },
    { organizationId: org.id, title: "Migrate auth to new provider", description: "Switch from legacy auth system to the new OAuth provider.", status: "IN_PROGRESS", priority: "URGENT", assigneeId: employees[1].id, dueDate: new Date(Date.now() + 2 * 86400000).toISOString().split("T")[0] },
  ]);

  await db.insert(announcementsTable).values([
    { organizationId: org.id, title: "Office Closure — National Holiday", content: "A reminder that the office will be closed on July 4th. Enjoy the long weekend!", author: "Alex Johnson", priority: "HIGH", pinned: true },
    { organizationId: org.id, title: "New Health Benefits Package", content: "We are pleased to announce an upgraded health benefits package effective August 1st. Please review the details in the HR portal and contact Emma with any questions.", author: "Emma Chen", priority: "NORMAL", pinned: false },
    { organizationId: org.id, title: "Q2 All-Hands Meeting", content: "Our Q2 all-hands meeting is scheduled for next Friday at 3 PM in the main boardroom. Attendance is mandatory for all staff.", author: "Alex Johnson", priority: "URGENT", pinned: true },
    { organizationId: org.id, title: "Parking Lot Maintenance", content: "The east parking lot will be closed for maintenance next Monday and Tuesday. Please use the west lot or street parking.", author: "David Kowalski", priority: "LOW", pinned: false },
  ]);
}

/**
 * Ensures that a default admin account exists in the system.
 * Creates an admin with email 'ashutoshmishraup78@gmail.com' and password 'Ashu@123'
 * if it doesn't already exist in the database.
 */
export async function ensureDefaultAdmin() {
  const adminEmail = "ashutoshmishraup78@gmail.com";
  const [existingAdmin] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.email, adminEmail));

  if (!existingAdmin) {
    let [org] = await db.select().from(organizationsTable).limit(1);
    if (!org) {
      [org] = await db.insert(organizationsTable).values({
        name: "Acme Corporation",
        slug: "acme",
        plan: "FREE",
      }).returning();
    }

    const adminPasswordHash = await bcrypt.hash("Ashu@123", 10);
    
    await db.insert(usersTable).values({
      organizationId: org.id,
      email: adminEmail,
      passwordHash: adminPasswordHash,
      role: "ADMIN",
    });

    await db.insert(employeesTable).values({
      organizationId: org.id,
      name: "Ashutosh Mishra",
      email: adminEmail,
      department: "Management",
      position: "Administrator",
      role: "ADMIN",
      status: "ACTIVE",
      joinDate: new Date().toISOString().split("T")[0],
    });
  }
}
