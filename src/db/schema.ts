import { relations, sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

export const userRoleEnum = pgEnum("user_role", ["SUPER_ADMIN", "ADMIN", "STAFF"]);
export const delegatedStatusEnum = pgEnum("delegated_status", [
  "UNASSIGNED",
  "LAST_ACTIVE",
  "INACTIVE",
  "WIP",
  "CUSTOM",
]);
export const fileStatusEnum = pgEnum("file_status", ["READY", "UPLOADING", "FAILED", "DELETED"]);
export const backupStatusEnum = pgEnum("backup_status", ["SUCCESS", "FAILED", "RUNNING"]);

export const users = pgTable(
  "users",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    email: varchar("email", { length: 255 }).notNull(),
    name: varchar("name", { length: 120 }).notNull(),
    passwordHash: text("password_hash").notNull(),
    role: userRoleEnum("role").notNull().default("STAFF"),
    pinHash: text("pin_hash"),
    failedLoginAttempts: integer("failed_login_attempts").notNull().default(0),
    lockoutUntil: timestamp("lockout_until", { withTimezone: true }),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("users_email_unique").on(t.email),
    uniqueIndex("users_super_admin_only_one")
      .on(t.role)
      .where(sql`${t.role} = 'SUPER_ADMIN'`),
    index("users_role_idx").on(t.role),
    index("users_created_at_idx").on(t.createdAt),
  ],
);

export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("sessions_token_hash_unique").on(t.tokenHash),
    index("sessions_user_id_idx").on(t.userId),
    index("sessions_expires_idx").on(t.expiresAt),
  ],
);

export const clients = pgTable(
  "clients",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: varchar("name", { length: 220 }).notNull(),
    contact: varchar("contact", { length: 220 }),
    address: text("address"),
    ipAddress: varchar("ip_address", { length: 45 }),
    tpin: varchar("tpin", { length: 100 }).notNull(),
    delegatedTo: varchar("delegated_to", { length: 120 }),
    delegatedStatus: delegatedStatusEnum("delegated_status").notNull().default("UNASSIGNED"),
    delegatedLastActiveAt: timestamp("delegated_last_active_at", { withTimezone: true }),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("clients_name_idx").on(t.name),
    index("clients_contact_idx").on(t.contact),
    index("clients_tpin_idx").on(t.tpin),
    index("clients_created_at_idx").on(t.createdAt),
  ],
);

export const files = pgTable(
  "files",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    clientId: uuid("client_id")
      .references(() => clients.id, { onDelete: "set null" }),
    originalName: varchar("original_name", { length: 255 }).notNull(),
    mimeType: varchar("mime_type", { length: 140 }).notNull(),
    sizeBytes: bigint("size_bytes", { mode: "number" }).notNull().default(0),
    extension: varchar("extension", { length: 20 }),
    storageProvider: varchar("storage_provider", { length: 30 }).notNull().default("supabase"),
    storagePath: text("storage_path").notNull(),
    thumbnailPath: text("thumbnail_path"),
    checksum: varchar("checksum", { length: 128 }),
    status: fileStatusEnum("status").notNull().default("READY"),
    uploadedBy: uuid("uploaded_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("files_client_id_idx").on(t.clientId),
    index("files_created_at_idx").on(t.createdAt),
    index("files_name_idx").on(t.originalName),
    index("files_status_idx").on(t.status),
    index("files_checksum_idx").on(t.checksum),
  ],
);

export const credentials = pgTable(
  "credentials",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    clientId: uuid("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),
    title: varchar("title", { length: 200 }).notNull(),
    username: varchar("username", { length: 220 }),
    email: varchar("email", { length: 255 }),
    secretCiphertext: text("secret_ciphertext").notNull(),
    notes: text("notes"),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    updatedBy: uuid("updated_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("credentials_client_id_idx").on(t.clientId),
    index("credentials_title_idx").on(t.title),
    index("credentials_created_at_idx").on(t.createdAt),
  ],
);

export const passwordResetRequests = pgTable(
  "password_reset_requests",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    codeHash: text("code_hash").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    consumedAt: timestamp("consumed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("password_reset_user_id_idx").on(t.userId), index("password_reset_expires_idx").on(t.expiresAt)],
);

export const backups = pgTable(
  "backups",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    status: backupStatusEnum("status").notNull().default("RUNNING"),
    provider: varchar("provider", { length: 30 }).notNull().default("MEGA"),
    fileName: varchar("file_name", { length: 255 }),
    sizeBytes: bigint("size_bytes", { mode: "number" }),
    startedBy: uuid("started_by").references(() => users.id, { onDelete: "set null" }),
    startedAt: timestamp("started_at", { withTimezone: true }).defaultNow().notNull(),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    details: jsonb("details"),
  },
  (t) => [index("backups_started_at_idx").on(t.startedAt), index("backups_status_idx").on(t.status)],
);

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    actorUserId: uuid("actor_user_id").references(() => users.id, { onDelete: "set null" }),
    action: varchar("action", { length: 120 }).notNull(),
    entityType: varchar("entity_type", { length: 80 }).notNull(),
    entityId: varchar("entity_id", { length: 100 }),
    ipAddress: varchar("ip_address", { length: 100 }),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("audit_logs_actor_idx").on(t.actorUserId),
    index("audit_logs_action_idx").on(t.action),
    index("audit_logs_entity_idx").on(t.entityType, t.entityId),
    index("audit_logs_created_at_idx").on(t.createdAt),
  ],
);

export const usersRelations = relations(users, ({ many }) => ({
  sessions: many(sessions),
  clients: many(clients),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, { fields: [sessions.userId], references: [users.id] }),
}));

export const clientsRelations = relations(clients, ({ one, many }) => ({
  creator: one(users, { fields: [clients.createdBy], references: [users.id] }),
  files: many(files),
  credentials: many(credentials),
}));

export const filesRelations = relations(files, ({ one }) => ({
  client: one(clients, { fields: [files.clientId], references: [clients.id] }),
  uploader: one(users, { fields: [files.uploadedBy], references: [users.id] }),
}));

export const credentialsRelations = relations(credentials, ({ one }) => ({
  client: one(clients, { fields: [credentials.clientId], references: [clients.id] }),
}));
