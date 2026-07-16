import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "fallback-jwt-secret-key-123";
const REFRESH_SECRET = process.env.REFRESH_SECRET || "fallback-refresh-secret-key-456";

export interface AuthenticatedRequest extends Request {
  user?: {
    userId: number;
    organizationId: number;
    role: "ADMIN" | "EMPLOYEE";
    email: string;
  };
}

export function generateAccessToken(payload: { userId: number; organizationId: number; role: "ADMIN" | "EMPLOYEE"; email: string }): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "15m" });
}

export function generateRefreshToken(payload: { userId: number; organizationId: number; role: "ADMIN" | "EMPLOYEE"; email: string }): string {
  return jwt.sign(payload, REFRESH_SECRET, { expiresIn: "7d" });
}

export function authenticateSession(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const accessToken = req.cookies?.access_token;
  const refreshToken = req.cookies?.refresh_token;

  if (!accessToken) {
    if (refreshToken) {
      try {
        const decoded = jwt.verify(refreshToken, REFRESH_SECRET) as any;
        const payload = {
          userId: decoded.userId,
          organizationId: decoded.organizationId,
          role: decoded.role,
          email: decoded.email,
        };
        const newAccessToken = generateAccessToken(payload);
        res.cookie("access_token", newAccessToken, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "lax",
          path: "/",
        });
        req.user = payload;
        return next();
      } catch (err) {
        res.clearCookie("access_token");
        res.clearCookie("refresh_token");
        res.status(401).json({ error: "Session expired. Please log in again." });
        return;
      }
    }
    res.status(401).json({ error: "Unauthorized. Please log in." });
    return;
  }

  try {
    const decoded = jwt.verify(accessToken, JWT_SECRET) as any;
    req.user = {
      userId: decoded.userId,
      organizationId: decoded.organizationId,
      role: decoded.role,
      email: decoded.email,
    };
    next();
  } catch (err) {
    // Access token invalid or expired, try using the refresh token
    if (refreshToken) {
      try {
        const decoded = jwt.verify(refreshToken, REFRESH_SECRET) as any;
        const payload = {
          userId: decoded.userId,
          organizationId: decoded.organizationId,
          role: decoded.role,
          email: decoded.email,
        };
        const newAccessToken = generateAccessToken(payload);
        res.cookie("access_token", newAccessToken, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "lax",
          path: "/",
        });
        req.user = payload;
        return next();
      } catch (refreshErr) {
        res.clearCookie("access_token");
        res.clearCookie("refresh_token");
        res.status(401).json({ error: "Session expired. Please log in again." });
        return;
      }
    }
    res.status(401).json({ error: "Unauthorized. Session expired." });
  }
}

export function requireRole(allowedRoles: string[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({ error: "Forbidden. Insufficient permissions." });
      return;
    }
    next();
  };
}
