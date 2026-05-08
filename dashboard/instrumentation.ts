export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") {
    return;
  }

  try {
    const { getDatabase } = await import("./lib/db");
    getDatabase();

    const { getSchedulerSettings, initScheduler } = await import("./lib/scheduler");
    const settings = getSchedulerSettings();

    if (settings.enabled) {
      console.log(
        `[Boot] Restoring scheduler from DB (enabled=true, freq=${settings.frequency}, hour=${settings.hour})`
      );
      initScheduler();
    } else {
      console.log("[Boot] Scheduler is disabled in DB, skipping restore");
    }
  } catch (error) {
    console.error("[Boot] Failed to restore scheduler:", error);
  }
}
