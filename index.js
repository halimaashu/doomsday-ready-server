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