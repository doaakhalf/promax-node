const EXERCISEDB_URL = "https://oss.exercisedb.dev/api/v1/exercises";
const DEFAULT_LIMIT = 24;
const MAX_LIMIT = 25;

export const getLiveExerciseDbExercises = async (req, res) => {
  try {
    const parsedLimit = parseInt(req.query.limit, 10);
    const limit = Number.isFinite(parsedLimit)
      ? Math.min(Math.max(parsedLimit, 1), MAX_LIMIT)
      : DEFAULT_LIMIT;
    const after =
      typeof req.query.after === "string" && req.query.after.trim()
        ? req.query.after.trim()
        : null;

    const url = new URL(EXERCISEDB_URL);
    url.searchParams.set("limit", String(limit));
    if (after) url.searchParams.set("after", after);

    const response = await fetch(url, {
      signal: AbortSignal.timeout(30000),
    });

    if (!response.ok) {
      return res.status(502).json({
        message: `ExerciseDB request failed (${response.status})`,
      });
    }

    const payload = await response.json();
    if (!payload?.success) {
      return res.status(502).json({
        message: "ExerciseDB returned an unsuccessful response",
      });
    }

    const meta = payload.meta || {};
    return res.status(200).json({
      data: payload.data || [],
      meta: {
        total: meta.total ?? 0,
        hasNextPage: !!meta.hasNextPage,
        nextCursor: meta.nextCursor || null,
      },
    });
  } catch (error) {
    return res.status(500).json({
      message: "Failed to fetch ExerciseDB exercises",
      error: error?.message,
    });
  }
};
