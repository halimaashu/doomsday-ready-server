require("dotenv").config();
const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 5000;

// ---------- Model ----------
const movieSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, unique: true, trim: true },
    releaseYear: { type: Number, required: true },
    runtime: { type: Number, required: true, min: 1, max: 300 },
    prerequisites: [{ type: mongoose.Schema.Types.ObjectId, ref: "Movie" }],
    watched: { type: Boolean, default: false },
  },
  { timestamps: true }
);

const Movie = mongoose.model("Movie", movieSchema);

// ---------- Routes ----------
// ---------- Circular check ----------
// movieId-r prerequisite hishebe newPrereqIds dile loop hobe kina
async function hasCircularDependency(movieId, newPrereqIds) {
  const visited = new Set();
  const stack = newPrereqIds.map(String);

  while (stack.length > 0) {
    const currentId = stack.pop();

    if (currentId === String(movieId)) return true; // A peye gelam, loop
    if (visited.has(currentId)) continue;
    visited.add(currentId);

    const movie = await Movie.findById(currentId);
    if (movie) {
      for (const preId of movie.prerequisites) {
        stack.push(String(preId));
      }
    }
  }

  return false;
}

// simple check the api status 
app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

// POST /api/movies (ekta object ba array)
app.post("/api/movies", async (req, res) => {
  const items = Array.isArray(req.body) ? req.body : [req.body];
  const created = [];

  for (const item of items) {
    if (!Number.isInteger(item.releaseYear) || !Number.isInteger(item.runtime)) {
      return res.status(400).json({
        error: "VALIDATION_ERROR",
        messages: ["releaseYear and runtime must be whole numbers"],
      });
    }

    const prereqs = item.prerequisites || [];
    if (!Array.isArray(prereqs) || !prereqs.every((id) => mongoose.isValidObjectId(id))) {
      return res.status(400).json({
        error: "VALIDATION_ERROR",
        messages: ["prerequisites must be a list of valid movie ids"],
      });
    }

    try {
      const movie = await Movie.create({
        title: item.title,
        releaseYear: item.releaseYear,
        runtime: item.runtime,
        prerequisites: prereqs,
        watched: item.watched,
      });
      created.push(movie);
    } catch (err) {
      if (err.code === 11000) {
        return res
          .status(409)
          .json({ error: "DUPLICATE_TITLE", message: `${item.title} already exists` });
      }
      if (err.name === "ValidationError") {
        return res.status(400).json({
          error: "VALIDATION_ERROR",
          messages: Object.values(err.errors).map((e) => e.message),
        });
      }
      return res.status(500).json({ error: "SERVER_ERROR" });
    }
  }

  res.status(201).json(Array.isArray(req.body) ? created : created[0]);
});

// GET /api/movies
app.get("/api/movies", async (req, res) => {
  const movies = await Movie.find();
  res.json(movies);
});

// PATCH /api/movies/:id
app.patch("/api/movies/:id", async (req, res) => {
  const { id } = req.params;

  if (!mongoose.isValidObjectId(id)) {
    return res.status(400).json({ error: "VALIDATION_ERROR", messages: ["invalid movie id"] });
  }

  const movie = await Movie.findById(id);
  if (!movie) {
    return res.status(404).json({ error: "NOT_FOUND", message: "Movie not found" });
  }

  const { title, releaseYear, runtime, prerequisites, watched } = req.body;

  if (releaseYear !== undefined && !Number.isInteger(releaseYear)) {
    return res.status(400).json({ error: "VALIDATION_ERROR", messages: ["releaseYear must be a whole number"] });
  }
  if (runtime !== undefined && (!Number.isInteger(runtime) || runtime < 1 || runtime > 300)) {
    return res.status(400).json({ error: "VALIDATION_ERROR", messages: ["runtime must be a whole number from 1 to 300"] });
  }
  if (watched !== undefined && typeof watched !== "boolean") {
    return res.status(400).json({ error: "VALIDATION_ERROR", messages: ["watched must be true or false"] });
  }

  if (prerequisites !== undefined) {
    if (!Array.isArray(prerequisites) || !prerequisites.every((p) => mongoose.isValidObjectId(p))) {
      return res.status(400).json({ error: "VALIDATION_ERROR", messages: ["prerequisites must be a list of valid movie ids"] });
    }

    // Circular check, save-er age
    if (await hasCircularDependency(id, prerequisites)) {
      return res.status(409).json({
        error: "CIRCULAR_DEPENDENCY",
        message: "This change would create a circular dependency",
      });
    }
    movie.prerequisites = prerequisites;
  }

  if (title !== undefined) movie.title = title;
  if (releaseYear !== undefined) movie.releaseYear = releaseYear;
  if (runtime !== undefined) movie.runtime = runtime;
  if (watched !== undefined) movie.watched = watched;

  try {
    await movie.save();
    res.json(movie);
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ error: "DUPLICATE_TITLE", message: "Title already exists" });
    }
    if (err.name === "ValidationError") {
      return res.status(400).json({ error: "VALIDATION_ERROR", messages: Object.values(err.errors).map((e) => e.message) });
    }
    res.status(500).json({ error: "SERVER_ERROR" });
  }
});

// ---------- Start ----------
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    console.log("MongoDB connected");
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
  })
  .catch((err) => {
    console.error("MongoDB connection failed:", err.message);
    process.exit(1);
  });