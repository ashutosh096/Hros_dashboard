import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import employeesRouter from "./employees";
import attendanceRouter from "./attendance";
import meetingsRouter from "./meetings";
import tasksRouter from "./tasks";
import announcementsRouter from "./announcements";
import dashboardRouter from "./dashboard";
import salaryRouter from "./salary";
import googleCalendarRouter from "./google-calendar";
import applicationsRouter from "./applications";
import { authenticateSession } from "../middlewares/auth";

const router: IRouter = Router();

/**
 * Public routes: Access allowed without session tokens
 */
router.use(healthRouter);
router.use(authRouter);

/**
 * Middleware: Apply tenant authentication session checks to subsequent API endpoints.
 * Users must possess a valid JWT session token.
 */
router.use(authenticateSession as any);

/**
 * Protected routes: Session verification required
 */
router.use(employeesRouter);
router.use(attendanceRouter);
router.use(meetingsRouter);
router.use(tasksRouter);
router.use(announcementsRouter);
router.use(dashboardRouter);
router.use(salaryRouter);
router.use(googleCalendarRouter);
router.use(applicationsRouter);

export default router;
