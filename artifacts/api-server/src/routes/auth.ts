/**
 * @fileoverview Express router endpoints for user authentication.
 * Handles registration, token validation, login, and session logout.
 */

import { Router } from "express";
import bcrypt from "bcryptjs";
import { db, organizationsTable, usersTable, employeesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { RegisterOrganizationBody, LoginUserBody } from "@workspace/api-zod";
import {
  generateAccessToken,
  generateRefreshToken,
  authenticateSession,
  AuthenticatedRequest,
} from "../middlewares/auth";

const router = Router();

router.post("/auth/register-org", async (req, res): Promise<void> => {
  const parsed = RegisterOrganizationBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { orgName, orgSlug, email, name, password } = parsed.data;

  try {
    // Check if slug exists
    const [existingOrg] = await db
      .select()
      .from(organizationsTable)
      .where(eq(organizationsTable.slug, orgSlug.toLowerCase()));

    if (existingOrg) {
      res.status(400).json({ error: "Organization slug is already taken." });
      return;
    }

    // Check if user email exists
    const [existingUser] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.email, email.toLowerCase()));

    if (existingUser) {
      res.status(400).json({ error: "Email is already registered." });
      return;
    }

    // Create organization
    const [org] = await db
      .insert(organizationsTable)
      .values({
        name: orgName,
        slug: orgSlug.toLowerCase(),
        plan: "FREE",
        settings: {},
      })
      .returning();

    // Hash password
    const passwordHash = bcrypt.hashSync(password, 10);

    // Create user (role: ADMIN)
    const [user] = await db
      .insert(usersTable)
      .values({
        organizationId: org.id,
        email: email.toLowerCase(),
        passwordHash,
        role: "ADMIN",
      })
      .returning();

    // Create employee record
    await db.insert(employeesTable).values({
      organizationId: org.id,
      name,
      email: email.toLowerCase(),
      department: "Management",
      position: "Administrator",
      role: "ADMIN",
      status: "ACTIVE",
      joinDate: new Date().toISOString().split("T")[0],
    });

    // Generate tokens
    const payload = {
      userId: user.id,
      organizationId: org.id,
      role: user.role as "ADMIN" | "EMPLOYEE",
      email: user.email,
    };
    const accessToken = generateAccessToken(payload);
    const refreshToken = generateRefreshToken(payload);

    // Set cookies
    res.cookie("access_token", accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
    });
    res.cookie("refresh_token", refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
    });

    res.status(201).json({
      organization: {
        id: org.id,
        name: org.name,
        slug: org.slug,
        plan: org.plan,
        createdAt: org.createdAt.toISOString(),
        settings: org.settings || {},
      },
      user: {
        id: user.id,
        organizationId: user.organizationId,
        email: user.email,
        role: user.role,
        lastLoginAt: user.lastLoginAt ? user.lastLoginAt.toISOString() : null,
        createdAt: user.createdAt.toISOString(),
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to register organization." });
  }
});

router.post("/auth/login", async (req, res): Promise<void> => {
  const parsed = LoginUserBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { email, password } = parsed.data;

  try {
    const [user] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.email, email.toLowerCase()));

    if (!user || !bcrypt.compareSync(password, user.passwordHash)) {
      res.status(401).json({ error: "Invalid email or password." });
      return;
    }

    // Verify employee status is active (INACTIVE acts as pending approval)
    const [employee] = await db
      .select()
      .from(employeesTable)
      .where(eq(employeesTable.email, email.toLowerCase()));

    if (employee && employee.status === "INACTIVE") {
      res.status(403).json({ error: "Your account is pending admin approval." });
      return;
    }

    // Update lastLoginAt
    await db
      .update(usersTable)
      .set({ lastLoginAt: new Date() })
      .where(eq(usersTable.id, user.id));

    // Generate tokens
    const payload = {
      userId: user.id,
      organizationId: user.organizationId,
      role: user.role as "ADMIN" | "EMPLOYEE",
      email: user.email,
    };
    const accessToken = generateAccessToken(payload);
    const refreshToken = generateRefreshToken(payload);

    // Set cookies
    res.cookie("access_token", accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
    });
    res.cookie("refresh_token", refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
    });

    res.json({
      user: {
        id: user.id,
        organizationId: user.organizationId,
        email: user.email,
        role: user.role,
        name: employee?.name || user.email.split("@")[0],
        department: employee?.department || "Management",
        lastLoginAt: new Date().toISOString(),
        createdAt: user.createdAt.toISOString(),
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to log in." });
  }
});

router.post("/auth/refresh", authenticateSession, (req: AuthenticatedRequest, res) => {
  res.json({ success: true });
});

router.post("/auth/logout", (req, res) => {
  res.clearCookie("access_token");
  res.clearCookie("refresh_token");
  res.sendStatus(204);
});

router.get("/auth/me", authenticateSession, async (req: AuthenticatedRequest, res): Promise<void> => {
  if (!req.user) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  try {
    const [user] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, req.user.userId));

    if (!user) {
      res.status(401).json({ error: "User not found" });
      return;
    }

    // Verify employee status is active
    const [employee] = await db
      .select()
      .from(employeesTable)
      .where(eq(employeesTable.email, user.email.toLowerCase()));

    if (employee && employee.status === "INACTIVE") {
      res.status(403).json({ error: "Your account is pending admin approval." });
      return;
    }

    const [org] = await db
      .select()
      .from(organizationsTable)
      .where(eq(organizationsTable.id, user.organizationId));

    if (!org) {
      res.status(401).json({ error: "Organization not found" });
      return;
    }

    res.json({
      user: {
        id: user.id,
        organizationId: user.organizationId,
        email: user.email,
        role: user.role,
        name: employee?.name || user.email.split("@")[0],
        department: employee?.department || "Management",
        lastLoginAt: user.lastLoginAt ? user.lastLoginAt.toISOString() : null,
        createdAt: user.createdAt.toISOString(),
      },
      organization: {
        id: org.id,
        name: org.name,
        slug: org.slug,
        plan: org.plan,
        createdAt: org.createdAt.toISOString(),
        settings: org.settings || {},
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to retrieve profile." });
  }
});

router.post("/auth/register-employee", async (req, res): Promise<void> => {
  const { name, email, password, department } = req.body;
  if (!name || !email || !password || !department) {
    res.status(400).json({ error: "Missing required fields." });
    return;
  }

  try {
    const [existingUser] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.email, email.toLowerCase()));

    if (existingUser) {
      res.status(400).json({ error: "Email is already registered." });
      return;
    }

    const [org] = await db.select().from(organizationsTable).limit(1);
    if (!org) {
      res.status(500).json({ error: "No organization found. Please contact administrator." });
      return;
    }

    const passwordHash = bcrypt.hashSync(password, 10);

    // Create credentials
    await db.insert(usersTable).values({
      organizationId: org.id,
      email: email.toLowerCase(),
      passwordHash,
      role: "EMPLOYEE",
    });

    // Create employee record (INACTIVE status = pending approval)
    await db.insert(employeesTable).values({
      organizationId: org.id,
      name,
      email: email.toLowerCase(),
      department,
      position: "Team Member",
      role: "EMPLOYEE",
      status: "INACTIVE",
      joinDate: new Date().toISOString().split("T")[0],
    });

    res.status(201).json({ success: true, message: "Account created successfully. Please wait for admin approval." });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to register." });
  }
});

export default router;
