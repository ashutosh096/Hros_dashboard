export interface SessionUser {
  userId: number;
  organizationId: number;
  role: "ADMIN" | "EMPLOYEE";
  email: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: SessionUser;
    }
  }
}
