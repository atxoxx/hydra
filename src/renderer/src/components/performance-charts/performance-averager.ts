import type { HardwareSample } from "../../declaration";

export interface AveragedSession {
  samples: HardwareSample[];
  durationMs: number;
  label: string;
}

/**
 * Downsamples and averages a list of performance sessions to exactly `pointsCount` points.
 * Returns a single virtual session representing the average timeline.
 */
export function getAverageTimeline(
  sessions: {
    hardwareMetrics?: { samples: HardwareSample[] } | null;
    durationMs: number;
  }[],
  label: string,
  pointsCount = 50
): AveragedSession | null {
  const sessionTimelines = sessions
    .map((session) => {
      const samples = session.hardwareMetrics?.samples ?? [];
      const duration = session.durationMs;
      if (samples.length === 0) return null;

      const timeline: HardwareSample[] = [];
      for (let i = 0; i < pointsCount; i++) {
        // Linearly interpolate sample indices to get exactly pointsCount samples
        const sampleIdx = Math.min(
          samples.length - 1,
          Math.round((i / (pointsCount - 1)) * (samples.length - 1))
        );
        timeline.push(samples[sampleIdx]);
      }
      return { timeline, duration };
    })
    .filter(
      (t): t is { timeline: HardwareSample[]; duration: number } => t !== null
    );

  if (sessionTimelines.length === 0) return null;

  // Calculate average duration
  const avgDurationMs =
    sessionTimelines.reduce((sum, t) => sum + t.duration, 0) /
    sessionTimelines.length;

  const averagedSamples: HardwareSample[] = [];

  for (let i = 0; i < pointsCount; i++) {
    let fpsSum = 0,
      fpsCount = 0;
    let cpuUsageSum = 0,
      cpuUsageCount = 0;
    let gpuUsageSum = 0,
      gpuUsageCount = 0;
    let cpuTempSum = 0,
      cpuTempCount = 0;
    let gpuTempSum = 0,
      gpuTempCount = 0;
    let ramSum = 0,
      ramCount = 0;

    for (const t of sessionTimelines) {
      const sample = t.timeline[i];
      if (sample) {
        if (sample.fps > 0) {
          fpsSum += sample.fps;
          fpsCount++;
        }
        if (sample.cpuUsage > 0) {
          cpuUsageSum += sample.cpuUsage;
          cpuUsageCount++;
        }
        if (sample.gpuUsage > 0) {
          gpuUsageSum += sample.gpuUsage;
          gpuUsageCount++;
        }
        if (sample.cpuTemp > 0) {
          cpuTempSum += sample.cpuTemp;
          cpuTempCount++;
        }
        if (sample.gpuTemp > 0) {
          gpuTempSum += sample.gpuTemp;
          gpuTempCount++;
        }
        if (sample.ramUsageMB > 0) {
          ramSum += sample.ramUsageMB;
          ramCount++;
        }
      }
    }

    averagedSamples.push({
      timestamp: Date.now(), // virtual timestamp
      fps: fpsCount > 0 ? Math.round(fpsSum / fpsCount) : 0,
      cpuUsage: cpuUsageCount > 0 ? Math.round(cpuUsageSum / cpuUsageCount) : 0,
      gpuUsage: gpuUsageCount > 0 ? Math.round(gpuUsageSum / gpuUsageCount) : 0,
      cpuTemp: cpuTempCount > 0 ? Math.round(cpuTempSum / cpuTempCount) : 0,
      gpuTemp: gpuTempCount > 0 ? Math.round(gpuTempSum / gpuTempCount) : 0,
      ramUsageMB: ramCount > 0 ? Math.round(ramSum / ramCount) : 0,
    });
  }

  return {
    samples: averagedSamples,
    durationMs: avgDurationMs,
    label,
  };
}
