import { decimalToNumberOrNull, measurementsToNumbers } from "../../services/athleteProgressService.js";

class AthleteProgressResource {
  constructor(entry) {
    this.id = entry._id?.toString?.() ?? entry._id;
    this.weight = decimalToNumberOrNull(entry.weight);
    this.measurements = measurementsToNumbers(entry.measurements);
    this.note = entry.note ?? null;
    this.recordedAt = entry.recordedAt ? new Date(entry.recordedAt).toISOString() : null;
    this.date = entry.recordedAt
      ? new Date(entry.recordedAt).toISOString().split("T")[0]
      : null;
    this.createdAt = entry.createdAt ?? null;
    this.updatedAt = entry.updatedAt ?? null;
  }

  static collection(entries) {
    return entries.map((entry) => new AthleteProgressResource(entry));
  }
}

export default AthleteProgressResource;
