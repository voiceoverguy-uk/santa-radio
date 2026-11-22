import { databasePool } from './name-request-store.js';

let ready;
async function store() {
  const db = databasePool();
  ready ??= db.query(`CREATE TABLE IF NOT EXISTS santa_game_rounds (
    id uuid PRIMARY KEY, started_at timestamptz NOT NULL DEFAULT now(), winning_title varchar(160)
  )`).catch(error => { ready = undefined; throw error; });
  await ready;
  return db;
}

export async function recordGameRound(id, title) {
  const db = await store();
  if (title === undefined) {
    await db.query('INSERT INTO santa_game_rounds(id) VALUES($1) ON CONFLICT DO NOTHING', [id]);
  } else {
    await db.query('UPDATE santa_game_rounds SET winning_title=$2 WHERE id=$1 AND winning_title IS NULL', [id, title]);
  }
}

export async function gameReport() {
  const db = await store();
  const daily = await db.query(`WITH counts AS (
    SELECT (started_at AT TIME ZONE 'Europe/London')::date day, count(*)::int plays FROM santa_game_rounds GROUP BY 1
  ), dates AS (SELECT generate_series(least(min(day), (now() AT TIME ZONE 'Europe/London')::date - 4),
    (now() AT TIME ZONE 'Europe/London')::date, interval '1 day')::date day FROM counts)
  SELECT to_char(day,'YYYY-MM-DD') day, coalesce(plays,0) plays FROM dates LEFT JOIN counts USING(day) ORDER BY dates.day DESC`);
  const titles = await db.query(`SELECT min(winning_title) title, count(*)::int wins FROM santa_game_rounds
    WHERE winning_title IS NOT NULL GROUP BY lower(winning_title) ORDER BY wins DESC, title ASC`);
  return { daily: daily.rows, titles: titles.rows };
}
