import "server-only";
import { buildTasks, type Task } from "./engine.ts";
import { getHolidays, listCohorts, listCustoms, listDone, listOverrides, type StoredCohort } from "./store";
import { todayIST } from "./today.ts";

/**
 * Everything the task views need, built fresh from the database.
 * Call it inside <Suspense> and after reading the session, because it uses the clock.
 */
export async function loadTasks(): Promise<{ tasks: Task[]; cohorts: StoredCohort[]; today: string }> {
  const [cohorts, done, holidays, overrides, customs] = await Promise.all([
    listCohorts(), listDone(), getHolidays(), listOverrides(), listCustoms(),
  ]);
  const today = todayIST();
  const tasks = buildTasks({ cohorts, done, overrides, customs, holidays: holidays.map((h) => h.date), today });
  return { tasks, cohorts, today };
}
