import { databasePool } from './name-request-store.js';
export async function dashboardTodos(body, pool = databasePool()) {
  if (body) {
    if (typeof body.id !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(body.id)) throw Object.assign(new Error('Invalid task.'), {status:400});
    if (['add','edit'].includes(body.action)) {
      const title = typeof body.title === 'string' ? body.title.trim() : '';
      if (!title || title.length > 300) throw Object.assign(new Error('Enter a task of up to 300 characters.'), {status:400});
      if (body.action === 'edit') {
        const result = await pool.query('UPDATE santa_dashboard_todos SET title=$2 WHERE id=$1 RETURNING id',[body.id,title]);
        if (!result.rowCount) throw Object.assign(new Error('Task not found. Refresh the list.'),{status:404});
      } else await pool.query('INSERT INTO santa_dashboard_todos(id,title) VALUES($1,$2) ON CONFLICT(id) DO NOTHING',[body.id,title]);
    } else if (body.action === 'delete') {
      await pool.query('DELETE FROM santa_dashboard_todos WHERE id=$1',[body.id]);
    } else if (body.action === 'complete' && ['true','false'].includes(body.completed)) {
      const result = await pool.query("UPDATE santa_dashboard_todos SET completed_at=CASE WHEN $2::boolean THEN COALESCE(completed_at,now()) ELSE NULL END WHERE id=$1 RETURNING id",[body.id,body.completed]);
      if (!result.rowCount) throw Object.assign(new Error('Task not found. Refresh the list.'),{status:404});
    } else throw Object.assign(new Error('Invalid task action.'),{status:400});
  }
  const {rows}=await pool.query('SELECT id,title,completed_at AS "completedAt",created_at AS "createdAt" FROM santa_dashboard_todos ORDER BY completed_at IS NOT NULL,created_at DESC,id');
  return {tasks:rows};
}
