import { createHash } from 'crypto';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema.ts';
import { SCHEMA_STATEMENTS } from './schema-sql.ts';

declare global {
  var _postgresPool: Pool | undefined;
  var _schemaReady: Promise<void> | undefined;
}

const connectionString =
  process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.SUPABASE_DB_URL || '';

export const createPool = () => {
  if (!global._postgresPool) {
    global._postgresPool = connectionString
      ? new Pool({
          connectionString,
          ssl: { rejectUnauthorized: false },
          max: 3,
          connectionTimeoutMillis: 15000,
        })
      : new Pool({
          host: process.env.SQL_HOST,
          user: process.env.SQL_USER,
          password: process.env.SQL_PASSWORD,
          database: process.env.SQL_DB_NAME,
          max: 10,
          connectionTimeoutMillis: 15000,
        });

    global._postgresPool.on('error', (err) => {
      console.error('Unexpected error on idle SQL pool client:', err);
    });
  }
  return global._postgresPool;
};

const pool = createPool();

// Creates/upgrades all tables (idempotent, additive only: never drops or truncates).
// A version marker avoids re-running the batch on every cold start.
const SCHEMA_VERSION = createHash('sha1').update(SCHEMA_STATEMENTS.join('\n')).digest('hex').slice(0, 16);

export function ensureSchema(): Promise<void> {
  if (!global._schemaReady) {
    global._schemaReady = (async () => {
      const client = await pool.connect();
      try {
        await client.query('CREATE TABLE IF NOT EXISTS "_soorar_schema" ("version" text PRIMARY KEY, "applied_at" timestamp DEFAULT now())');
        const r = await client.query('SELECT 1 FROM "_soorar_schema" WHERE version = $1', [SCHEMA_VERSION]);
        if (r.rowCount) return;
        // Fast path: one round-trip for the whole (idempotent) batch; on any error fall back to one-by-one.
        let batched = false;
        try {
          await client.query(SCHEMA_STATEMENTS.join('\n'));
          batched = true;
        } catch (e: any) {
          console.error('Schema batch failed, applying statements one by one:', e?.message);
        }
        if (!batched) {
          for (const s of SCHEMA_STATEMENTS) {
            try {
              await client.query(s);
            } catch (e: any) {
              console.error('Schema statement failed (continuing):', e?.message);
            }
          }
        }
        await client.query('INSERT INTO "_soorar_schema"(version) VALUES ($1) ON CONFLICT DO NOTHING', [SCHEMA_VERSION]);
      } finally {
        client.release();
      }
    })().catch((e) => {
      global._schemaReady = undefined;
      throw e;
    });
  }
  return global._schemaReady;
}

export const db = drizzle(pool, { schema });
