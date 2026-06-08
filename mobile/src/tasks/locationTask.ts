import * as Location from "expo-location";
import * as TaskManager from "expo-task-manager";

import { appendRunPoint, loadActiveRun } from "../lib/database";
import { RunPoint } from "../types";

export const RUN_LOCATION_TASK = "rungether-background-location";

if (!TaskManager.isTaskDefined(RUN_LOCATION_TASK)) {
  TaskManager.defineTask(
    RUN_LOCATION_TASK,
    async ({
      data,
      error
    }: TaskManager.TaskManagerTaskBody<{
      locations: Location.LocationObject[];
    }>) => {
      if (error || !data?.locations?.length) return;
      const run = await loadActiveRun();
      if (!run) return;
      for (const location of data.locations) {
        const point: RunPoint = {
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
          altitude_m: location.coords.altitude,
          accuracy_m: location.coords.accuracy,
          speed_mps: location.coords.speed,
          heading_deg: location.coords.heading,
          recorded_at: new Date(location.timestamp).toISOString(),
          is_mocked: Boolean(location.mocked)
        };
        await appendRunPoint(run.id, point);
      }
    }
  );
}
