/**
 * @fileoverview Database schema definition for calendar meetings.
 * Configures schedule times, links, participants, and room mappings.
 */

import { pgTable, serial, text, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { organizationsTable } from "./organizations";

export const meetingsTable = pgTable("meetings", {
  id: serial("id").primaryKey(),
  organizationId: integer("organization_id").notNull().references(() => organizationsTable.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  startTime: text("start_time").notNull(),
  endTime: text("end_time").notNull(),
  location: text("location"),
  meetLink: text("meet_link"),
  organizer: text("organizer").notNull(),
  status: text("status").notNull().default("SCHEDULED"),
  attendees: text("attendees").array().notNull().default([]),
  source: text("source").notNull().default("LOCAL"),
  googleEventId: text("google_event_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertMeetingSchema = createInsertSchema(meetingsTable).omit({ id: true, createdAt: true });
export type InsertMeeting = z.infer<typeof insertMeetingSchema>;
export type Meeting = typeof meetingsTable.$inferSelect;
