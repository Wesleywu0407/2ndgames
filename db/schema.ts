import { index, integer, primaryKey, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const worldState = sqliteTable("world_state", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});

export const npcs = sqliteTable("npcs", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  role: text("role").notNull(),
  home: text("home").notNull(),
  location: text("location").notNull(),
  activity: text("activity").notNull(),
  goal: text("goal").notNull(),
  mood: text("mood").notNull(),
  status: text("status").notNull().default("active"),
  health: real("health").notNull().default(3),
  maxHealth: real("max_health").notNull().default(3),
  energy: real("energy").notNull().default(80),
  curiosity: real("curiosity").notNull().default(50),
  sociability: real("sociability").notNull().default(50),
  courage: real("courage").notNull().default(50),
  trustPlayer: real("trust_player").notNull().default(0),
  fearPlayer: real("fear_player").notNull().default(0),
  updatedAt: integer("updated_at").notNull(),
});

export const memories = sqliteTable("memories", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  npcId: text("npc_id").notNull().references(() => npcs.id, { onDelete: "cascade" }),
  kind: text("kind").notNull(),
  summaryEn: text("summary_en").notNull(),
  summaryZh: text("summary_zh").notNull(),
  intensity: real("intensity").notNull().default(0.5),
  createdAt: integer("created_at").notNull(),
  expiresAt: integer("expires_at"),
}, table => [index("idx_memories_npc_created").on(table.npcId, table.createdAt)]);

export const worldEvents = sqliteTable("world_events", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  type: text("type").notNull(),
  summaryEn: text("summary_en").notNull(),
  summaryZh: text("summary_zh").notNull(),
  payloadJson: text("payload_json").notNull().default("{}"),
  createdAt: integer("created_at").notNull(),
}, table => [index("idx_world_events_created").on(table.createdAt)]);

export const processedActions = sqliteTable("processed_actions", {
  actionId: text("action_id").primaryKey(),
  resultJson: text("result_json").notNull(),
  createdAt: integer("created_at").notNull(),
});

export const relationships = sqliteTable("relationships", {
  sourceId: text("source_id").notNull().references(() => npcs.id, { onDelete: "cascade" }),
  targetId: text("target_id").notNull().references(() => npcs.id, { onDelete: "cascade" }),
  affinity: real("affinity").notNull().default(0),
  trust: real("trust").notNull().default(0),
  updatedAt: integer("updated_at").notNull(),
}, table => [primaryKey({ columns: [table.sourceId, table.targetId] })]);
