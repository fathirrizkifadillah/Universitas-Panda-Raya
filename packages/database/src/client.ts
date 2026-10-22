import mysql from 'mysql2/promise';
import { config } from '../../shared/src/config.js';

export interface QueryResult<T = any> {
  rows: T[];
  rowCount: number;
}

// Convert PostgreSQL positional placeholders ($1, $2, ...) to MySQL ? placeholders
export function convertPgToMysql(text: string, params?: unknown[]): { sql: string; values: unknown[] } {
  if (!params || params.length === 0) {
    return { sql: text, values: [] };
  }
  const values: unknown[] = [];
  const sql = text.replace(/\$(\d+)/g, (_, indexStr) => {
    const idx = parseInt(indexStr, 10) - 1;
    values.push(params[idx]);
    return '?';
  });
  return { sql, values };
}

// MySQL Connection Pool
export const pool = mysql.createPool({
  host: config.database.host,
  port: config.database.port,
  user: config.database.user,
  password: config.database.password,
  database: config.database.database,
  waitForConnections: true,
  connectionLimit: 20,
  queueLimit: 0,
  multipleStatements: true,
  typeCast: function (field, next) {
    if (field.type === 'TINY' && field.length === 1) {
      const val = field.string();
      return val === null ? null : val === '1';
    }
    return next();
  },
});

export async function query<T = any>(
  text: string,
  params?: unknown[]
): Promise<QueryResult<T>> {
  const { sql, values } = convertPgToMysql(text, params);
  const start = Date.now();
  const [result] = await pool.query(sql, values);
  const duration = Date.now() - start;

  if (process.env.DEBUG_SQL === 'true') {
    console.log('[DB SQL]', { sql, duration });
  }

  if (Array.isArray(result)) {
    return {
      rows: result as T[],
      rowCount: result.length,
    };
  }

  const header = result as mysql.ResultSetHeader;
  return {
    rows: [],
    rowCount: header.affectedRows || 0,
  };
}

export interface ClientConnection {
  query<T = any>(text: string, params?: unknown[]): Promise<QueryResult<T>>;
  release(): void;
}

export async function getClient(): Promise<ClientConnection> {
  const connection = await pool.getConnection();

  return {
    async query<T = any>(text: string, params?: unknown[]): Promise<QueryResult<T>> {
      const { sql, values } = convertPgToMysql(text, params);
      const [result] = await connection.query(sql, values);

      if (Array.isArray(result)) {
        return {
          rows: result as T[],
          rowCount: result.length,
        };
      }

      const header = result as mysql.ResultSetHeader;
      return {
        rows: [],
        rowCount: header.affectedRows || 0,
      };
    },
    release() {
      connection.release();
    },
  };
}

export async function closePool(): Promise<void> {
  await pool.end();
}
