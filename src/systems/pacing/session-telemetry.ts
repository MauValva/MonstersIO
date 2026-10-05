export type SessionEvent = {
  time: number;
  type: string;
  size: "MICRO" | "MEDIUM" | "MACRO";
  detail?: string;
};

export type SessionTelemetrySnapshot = {
  activity: string;
  intent: string;
  intensity: number;
  visibleEggs: number;
  nearbyEggs: number;
  visibleOpportunities: number;
  activeMajorEvent: boolean;
  returning: boolean;
  depositing: boolean;
};

export function createSessionTelemetry(sampleInterval = 0.75) {
  const events: SessionEvent[] = [];
  const samples: Array<{
    time: number;
    intensity: number;
    activity: string;
    intent: string;
  }> = [];
  const powerUpTypes: string[] = [];
  let deadAirDuration = 0;
  let longestDeadAirDuration = 0;
  let emptyMapDuration = 0;
  let longestEmptyMapPeriod = 0;
  let emptyMapOccurrences = 0;
  let lastSampleTime = -Infinity;
  let lastRewardTime = -Infinity;
  let microIntervals: number[] = [];
  let mediumIntervals: number[] = [];
  let macroIntervals: number[] = [];
  let firstPowerUpTime: number | null = null;
  let firstGoldMineTime: number | null = null;
  let firstEvolutionTime: number | null = null;
  let firstUpgradeTime: number | null = null;

  function record(time: number, type: string, size: SessionEvent["size"], detail?: string) {
    events.push({ time, type, size, detail });
    if (events.length > 250) events.shift();
    if (type.includes("POWER_UP") && type.includes("SPAWN")) {
      if (firstPowerUpTime === null) firstPowerUpTime = time;
      if (detail && !powerUpTypes.includes(detail)) powerUpTypes.push(detail);
    }
    if (type === "GOLD_MINE_SPAWNED" && firstGoldMineTime === null) firstGoldMineTime = time;
    if (type === "EVOLUTION" && firstEvolutionTime === null) firstEvolutionTime = time;
    if (type === "UPGRADE_INTRODUCED" && firstUpgradeTime === null) firstUpgradeTime = time;
    if (size !== "MICRO" || type.includes("CLUSTER") || type.includes("POWER_UP")) {
      const interval = Number.isFinite(lastRewardTime) ? time - lastRewardTime : null;
      if (interval !== null) {
        if (size === "MICRO") microIntervals.push(interval);
        if (size === "MEDIUM") mediumIntervals.push(interval);
        if (size === "MACRO") macroIntervals.push(interval);
      }
      lastRewardTime = time;
    }
  }

  function update(time: number, snapshot: SessionTelemetrySnapshot) {
    if (time - lastSampleTime < sampleInterval) return;
    const dt = Number.isFinite(lastSampleTime) ? time - lastSampleTime : sampleInterval;
    lastSampleTime = time;
    samples.push({ time, intensity: snapshot.intensity, activity: snapshot.activity, intent: snapshot.intent });
    if (samples.length > 400) samples.shift();

    const hasGoal = snapshot.visibleEggs > 0 || snapshot.nearbyEggs > 0 ||
      snapshot.visibleOpportunities > 0 || snapshot.activeMajorEvent ||
      snapshot.returning || snapshot.depositing;
    if (!hasGoal) {
      deadAirDuration += dt;
      longestDeadAirDuration = Math.max(longestDeadAirDuration, deadAirDuration);
    } else {
      deadAirDuration = 0;
    }
    const emptyMap = snapshot.visibleEggs === 0 && snapshot.visibleOpportunities === 0 &&
      !snapshot.activeMajorEvent && !snapshot.returning && !snapshot.depositing;
    if (emptyMap) {
      if (emptyMapDuration === 0) emptyMapOccurrences += 1;
      emptyMapDuration += dt;
      longestEmptyMapPeriod = Math.max(longestEmptyMapPeriod, emptyMapDuration);
    } else {
      emptyMapDuration = 0;
    }
  }

  function average(values: number[]) {
    return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
  }

  function getReport(duration: number) {
    const warnings: string[] = [];
    if (longestDeadAirDuration > 4) warnings.push(`Dead Air > 4s (${longestDeadAirDuration.toFixed(1)}s)`);
    if (longestEmptyMapPeriod > 4) warnings.push(`Empty Map period (${longestEmptyMapPeriod.toFixed(1)}s)`);
    if (firstPowerUpTime === null && duration >= 45) warnings.push("No Power-Up delivered");
    if (firstGoldMineTime === null && duration >= 150) warnings.push("Gold Mine not introduced");
    return {
      duration,
      events: [...events],
      samples: [...samples],
      firstPowerUpTime,
      firstGoldMineTime,
      firstEvolutionTime,
      firstUpgradeTime,
      powerUpTypes: [...powerUpTypes],
      deadAirDuration,
      longestDeadAirDuration,
      emptyMapOccurrences,
      longestEmptyMapPeriod,
      avgMicroInterval: average(microIntervals),
      avgMediumInterval: average(mediumIntervals),
      avgMacroInterval: average(macroIntervals),
      warnings,
    };
  }

  function formatReport(duration: number) {
    const report = getReport(duration);
    return [
      "PACING SESSION REPORT",
      `Duration: ${report.duration.toFixed(1)}s`,
      `First Power-Up: ${report.firstPowerUpTime?.toFixed(1) ?? "-"}s`,
      `First Evolution: ${report.firstEvolutionTime?.toFixed(1) ?? "-"}s`,
      `Upgrade Introduced: ${report.firstUpgradeTime?.toFixed(1) ?? "-"}s`,
      `First Gold Mine: ${report.firstGoldMineTime?.toFixed(1) ?? "-"}s`,
      `Power-Ups: ${report.powerUpTypes.join(", ") || "-"}`,
      `Dead Air Longest: ${report.longestDeadAirDuration.toFixed(1)}s`,
      `Empty Map Longest: ${report.longestEmptyMapPeriod.toFixed(1)}s`,
      `Reward Intervals: micro ${report.avgMicroInterval.toFixed(1)} / medium ${report.avgMediumInterval.toFixed(1)} / macro ${report.avgMacroInterval.toFixed(1)}`,
      `Warnings: ${report.warnings.join(" | ") || "none"}`,
      "Timeline:",
      ...report.events.map((event) => `${event.time.toFixed(1)}s ${event.type}${event.detail ? ` (${event.detail})` : ""}`),
    ].join("\n");
  }

  return { record, update, getReport, formatReport };
}
