import mysql from 'mysql2/promise';

const baseConfig = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  connectionLimit: 5,
  waitForConnections: true,
  dateStrings: true,
  charset: 'utf8mb4',
  timezone: '+08:00',
};

const connectionConfig = process.env.DB_SOCKET_PATH
  ? { ...baseConfig, socketPath: process.env.DB_SOCKET_PATH }
  : { ...baseConfig, host: process.env.DB_HOST || '127.0.0.1', port: Number(process.env.DB_PORT) || 3306 };

function getPool() {
  if (!global.__mysqlPool) {
    if (!connectionConfig.user || !connectionConfig.database) {
      throw new Error('Missing DB env vars: DB_USER, DB_NAME (and DB_PASSWORD, DB_HOST or DB_SOCKET_PATH).');
    }
    global.__mysqlPool = mysql.createPool(connectionConfig);
  }
  return global.__mysqlPool;
}

function makeStmt(executor, sql) {
  return {
    all: async (...args) => {
      const [rows] = await executor.query(sql, args);
      return rows;
    },
    get: async (...args) => {
      const [rows] = await executor.query(sql, args);
      return rows[0];
    },
    run: async (...args) => {
      const [result] = await executor.query(sql, args);
      return { lastInsertRowid: result.insertId, changes: result.affectedRows };
    },
  };
}

const db = {
  prepare(sql) {
    return makeStmt(getPool(), sql);
  },
  async transaction(fn) {
    const conn = await getPool().getConnection();
    try {
      await conn.beginTransaction();
      const tx = { prepare: (sql) => makeStmt(conn, sql) };
      const result = await fn(tx);
      await conn.commit();
      return result;
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  },
  async query(sql, params = []) {
    const [rows] = await getPool().query(sql, params);
    return rows;
  },
  async end() {
    if (global.__mysqlPool) {
      await global.__mysqlPool.end();
      global.__mysqlPool = null;
    }
  },
};

export default db;
