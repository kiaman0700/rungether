import * as SQLite from "expo-sqlite";

import { ActiveRun, RunPoint, StudioLayer } from "../types";

let database: SQLite.SQLiteDatabase | null = null;

async function getDatabase() {
  if (!database) database = await SQLite.openDatabaseAsync("rungether.db");
  return database;
}

export async function initializeDatabase() {
  const db = await getDatabase();
  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    create table if not exists active_run (
      id text primary key not null,
      payload text not null,
      updated_at text not null
    );
    create table if not exists run_points (
      id integer primary key autoincrement,
      run_id text not null,
      payload text not null,
      recorded_at text not null
    );
    create index if not exists run_points_run_id_idx on run_points(run_id, id);
    create table if not exists studio_drafts (
      id text primary key not null,
      payload text not null,
      updated_at text not null
    );
  `);
}

export async function saveActiveRun(run: ActiveRun) {
  const db = await getDatabase();
  await db.runAsync(
    `insert into active_run (id, payload, updated_at) values (?, ?, ?)
     on conflict(id) do update set payload = excluded.payload, updated_at = excluded.updated_at`,
    run.id,
    JSON.stringify(run),
    new Date().toISOString()
  );
}

export async function appendRunPoint(runId: string, point: RunPoint) {
  const db = await getDatabase();
  await db.runAsync(
    "insert into run_points (run_id, payload, recorded_at) values (?, ?, ?)",
    runId,
    JSON.stringify(point),
    point.recorded_at
  );
}

export async function loadActiveRun() {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ payload: string }>(
    "select payload from active_run order by updated_at desc limit 1"
  );
  return row ? (JSON.parse(row.payload) as ActiveRun) : null;
}

export async function loadRunPoints(runId: string) {
  const db = await getDatabase();
  const rows = await db.getAllAsync<{ payload: string }>(
    "select payload from run_points where run_id = ? order by id asc",
    runId
  );
  return rows.map((row) => JSON.parse(row.payload) as RunPoint);
}

export async function clearActiveRun(runId: string) {
  const db = await getDatabase();
  await db.withTransactionAsync(async () => {
    await db.runAsync("delete from run_points where run_id = ?", runId);
    await db.runAsync("delete from active_run where id = ?", runId);
  });
}

export async function saveStudioDraft(
  id: string,
  payload: {
    ratio: string;
    backgroundType: string;
    backgroundUrl: string | null;
    layers: StudioLayer[];
  }
) {
  const db = await getDatabase();
  await db.runAsync(
    `insert into studio_drafts (id, payload, updated_at) values (?, ?, ?)
     on conflict(id) do update set payload = excluded.payload, updated_at = excluded.updated_at`,
    id,
    JSON.stringify(payload),
    new Date().toISOString()
  );
}

export async function loadStudioDraft(id: string) {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ payload: string }>(
    "select payload from studio_drafts where id = ?",
    id
  );
  return row ? JSON.parse(row.payload) : null;
}
