import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import pg from "pg";
import { backgroundFailure } from "./log.ts";

type Row = { data: Record<string, unknown> };
interface Database {
  query: (sql: string, params?: unknown[]) => Promise<{ rows: Row[] }>;
  close: () => Promise<void>;
}

/** Postgres names are lowercase letters, digits and underscores here, so they are safe in SQL text. */
const identifier = /^[a-z_][a-z0-9_]{0,62}$/;

export class Store {
  /** The records table, with its schema when the database is shared with other apps. */
  private readonly table: string;
  constructor(
    private readonly db: Database,
    schema?: string,
  ) {
    if (schema && !identifier.test(schema)) throw new Error("Invalid database schema name");
    this.table = schema ? `${schema}.records` : "records";
  }
  async get<T = Record<string, unknown>>(
    owner: string,
    kind: string,
    id: string,
  ): Promise<T | null> {
    const result = await this.db.query(
      `SELECT data FROM ${this.table} WHERE owner=$1 AND kind=$2 AND id=$3`,
      [owner, kind, id],
    );
    return (result.rows[0]?.data as T | undefined) ?? null;
  }
  async list<T = Record<string, unknown>>(owner: string, kind: string): Promise<T[]> {
    const result = await this.db.query(
      `SELECT data FROM ${this.table} WHERE owner=$1 AND kind=$2 ORDER BY updated_at DESC,id`,
      [owner, kind],
    );
    return result.rows.map((row) => row.data as T);
  }
  async listByGoalId<T = Record<string, unknown>>(
    owner: string,
    kind: string,
    goalId: string,
  ): Promise<T[]> {
    const result = await this.db.query(
      `SELECT data FROM ${this.table} WHERE owner=$1 AND kind=$2 AND data->>'goalId'=$3 ORDER BY updated_at DESC,id`,
      [owner, kind, goalId],
    );
    return result.rows.map((row) => row.data as T);
  }
  async listByTaskId<T = Record<string, unknown>>(
    owner: string,
    kind: string,
    taskId: string,
  ): Promise<T[]> {
    const result = await this.db.query(
      `SELECT data FROM ${this.table} WHERE owner=$1 AND kind=$2 AND data->>'taskId'=$3 ORDER BY updated_at DESC,id`,
      [owner, kind, taskId],
    );
    return result.rows.map((row) => row.data as T);
  }
  /** Rows of one kind named by id, in the same order `list` returns them. */
  async listByIds<T = Record<string, unknown>>(
    owner: string,
    kind: string,
    ids: readonly string[],
  ): Promise<T[]> {
    if (ids.length === 0) return [];
    const result = await this.db.query(
      `SELECT data FROM ${this.table} WHERE owner=$1 AND kind=$2 AND id=ANY($3) ORDER BY updated_at DESC,id`,
      [owner, kind, [...ids]],
    );
    return result.rows.map((row) => row.data as T);
  }
  async listByStatus<T = Record<string, unknown>>(
    owner: string,
    kind: string,
    status: string,
  ): Promise<T[]> {
    const result = await this.db.query(
      `SELECT data FROM ${this.table} WHERE owner=$1 AND kind=$2 AND data->>'status'=$3 ORDER BY updated_at DESC,id`,
      [owner, kind, status],
    );
    return result.rows.map((row) => row.data as T);
  }
  async put<T extends { id: string }>(owner: string, kind: string, value: T): Promise<T> {
    await this.db.query(
      `INSERT INTO ${this.table}(owner,kind,id,data) VALUES($1,$2,$3,$4::jsonb) ON CONFLICT(owner,kind,id) DO UPDATE SET data=excluded.data,updated_at=now()`,
      [owner, kind, value.id, JSON.stringify(value)],
    );
    return value;
  }
  async remove(owner: string, kind: string, id: string): Promise<void> {
    await this.db.query(`DELETE FROM ${this.table} WHERE owner=$1 AND kind=$2 AND id=$3`, [
      owner,
      kind,
      id,
    ]);
  }
  async compareAndSwap<T>(
    owner: string,
    kind: string,
    id: string,
    expected: Record<string, unknown>,
    patch: Record<string, unknown>,
  ): Promise<T | null> {
    const result = await this.db.query(
      `UPDATE ${this.table} SET data=data || $5::jsonb,updated_at=now() WHERE owner=$1 AND kind=$2 AND id=$3 AND data @> $4::jsonb RETURNING data`,
      [owner, kind, id, JSON.stringify(expected), JSON.stringify(patch)],
    );
    return (result.rows[0]?.data as T | undefined) ?? null;
  }
  // Update only the selected checkbox against the current row, preserving concurrent
  // additions, renames, reordering and other milestones' completion state.
  async setMilestoneDone<T>(owner: string, goalId: string, milestoneId: string, done: boolean) {
    const result = await this.db.query(
      `UPDATE ${this.table} SET data=jsonb_set(data, '{milestones}', (
        SELECT jsonb_agg(CASE WHEN item->>'id'=$3
          THEN item || jsonb_build_object('done', $4::boolean) ELSE item END ORDER BY ordinal)
        FROM jsonb_array_elements(data->'milestones') WITH ORDINALITY AS milestones(item, ordinal)
      )), updated_at=now()
      WHERE owner=$1 AND kind='goals' AND id=$2
        AND EXISTS (SELECT 1 FROM jsonb_array_elements(data->'milestones') item WHERE item->>'id'=$3)
      RETURNING data`,
      [owner, goalId, milestoneId, done],
    );
    return (result.rows[0]?.data as T | undefined) ?? null;
  }
  async insertIfAbsent<T extends { id: string }>(
    owner: string,
    kind: string,
    value: T,
  ): Promise<T | null> {
    const result = await this.db.query(
      `INSERT INTO ${this.table}(owner,kind,id,data) VALUES($1,$2,$3,$4::jsonb) ON CONFLICT DO NOTHING RETURNING data`,
      [owner, kind, value.id, JSON.stringify(value)],
    );
    return (result.rows[0]?.data as T | undefined) ?? null;
  }
  async scan<T>(kind: string): Promise<{ owner: string; value: T }[]> {
    const result = await this.db.query(
      `SELECT jsonb_build_object('owner',owner,'value',data) AS data FROM ${this.table} WHERE kind=$1 ORDER BY updated_at ASC`,
      [kind],
    );
    return result.rows.map((row) => row.data as { owner: string; value: T });
  }
  async claim<T>(owner: string, id: string, status: string, now: string): Promise<T | null> {
    const result = await this.db.query(
      `UPDATE ${this.table} AS action SET data=jsonb_set(data,'{status}',$4::jsonb),updated_at=now()
       WHERE owner=$1 AND kind='actions' AND id=$2 AND data->>'status'='awaiting_review'
       AND (data->>'expiresAt')::timestamptz>$3::timestamptz
       AND ($4::jsonb <> '"executing"'::jsonb OR data->>'taskId' IS NULL OR EXISTS (
         SELECT 1 FROM ${this.table} task WHERE task.owner=action.owner AND task.kind='tasks'
         AND task.id=action.data->>'taskId' AND task.data->>'status' IN ('running','waiting_approval')
       )) RETURNING data`,
      [owner, id, now, JSON.stringify(status)],
    );
    return (result.rows[0]?.data as T | undefined) ?? null;
  }
  async recoverInterruptedActions(): Promise<void> {
    await this.db.query(
      `UPDATE ${this.table} SET data=data || '{"status":"outcome_unknown","error":"Server restarted during execution. Check the provider before creating another action."}'::jsonb WHERE kind='actions' AND data->>'status'='executing'`,
    );
  }
  async take<T>(owner: string, kind: string, id: string): Promise<T | null> {
    const result = await this.db.query(
      `DELETE FROM ${this.table} WHERE owner=$1 AND kind=$2 AND id=$3 RETURNING data`,
      [owner, kind, id],
    );
    return (result.rows[0]?.data as T | undefined) ?? null;
  }
  /** Every row one person owns, for their data export. Never reads another owner's rows. */
  async listOwner(
    owner: string,
  ): Promise<{ kind: string; id: string; updatedAt: string; data: unknown }[]> {
    const result = await this.db.query(
      `SELECT jsonb_build_object('kind',kind,'id',id,'updatedAt',updated_at,'data',data) AS data FROM ${this.table} WHERE owner=$1 ORDER BY kind,id`,
      [owner],
    );
    return result.rows.map(
      (row) => row.data as { kind: string; id: string; updatedAt: string; data: unknown },
    );
  }
  /** Deletes every row one person owns. Returns how many rows were removed. */
  async removeOwner(owner: string): Promise<number> {
    const result = await this.db.query(`DELETE FROM ${this.table} WHERE owner=$1 RETURNING data`, [
      owner,
    ]);
    return result.rows.length;
  }
  close(): Promise<void> {
    return this.db.close();
  }
  async updateCredential(owner: string, connectionId: string, secret: string): Promise<boolean> {
    const result = await this.db.query(
      `UPDATE ${this.table} SET data=jsonb_set(data,'{secret}',$3::jsonb),updated_at=now() WHERE owner=$1 AND kind='credentials' AND id='google' AND data->>'connectionId'=$2 RETURNING data`,
      [owner, connectionId, JSON.stringify(secret)],
    );
    return result.rows.length === 1;
  }
}

/** Idle clients can be disconnected by a database restart; without a listener pg's `error` event crashes the process. */
export function createPool(connectionString: string) {
  const pool = new pg.Pool({ connectionString, max: 5 });
  pool.on("error", (error) => backgroundFailure("postgres pool", error));
  return pool;
}

export async function createStore(
  options: { dataDir?: string; databaseUrl?: string; schema?: string } = {},
): Promise<Store> {
  let database: Database;
  if (options.databaseUrl) {
    const pool = createPool(options.databaseUrl);
    database = { query: async (sql, params) => pool.query(sql, params), close: () => pool.end() };
  } else {
    if (options.dataDir) await mkdir(dirname(options.dataDir), { recursive: true, mode: 0o700 });
    const embedded = new PGlite(options.dataDir);
    await embedded.waitReady;
    database = {
      query: (sql, params) => embedded.query<Row>(sql, params),
      close: () => embedded.close(),
    };
  }
  const store = new Store(database, options.schema);
  // A shared Postgres keeps this table in its own schema, away from the host app's tables.
  if (options.schema) await database.query(`CREATE SCHEMA IF NOT EXISTS ${options.schema}`);
  await database.query(
    `CREATE TABLE IF NOT EXISTS ${options.schema ? `${options.schema}.records` : "records"}(owner text NOT NULL,kind text NOT NULL,id text NOT NULL,data jsonb NOT NULL,updated_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(owner,kind,id))`,
  );
  return store;
}
