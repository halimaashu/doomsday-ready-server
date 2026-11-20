require("dotenv").config();
const mongoose = require("mongoose");

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

// title, year, runtime, prerequisite-er title
const data = [
  { title: "Iron Man", releaseYear: 2008, runtime: 126, prereqs: [] },
  { title: "Captain America: The First Avenger", releaseYear: 2011, runtime: 124, prereqs: [] },
  { title: "The Avengers", releaseYear: 2012, runtime: 143, prereqs: ["Iron Man", "Captain America: The First Avenger"] },
  { title: "Captain America: Civil War", releaseYear: 2016, runtime: 147, prereqs: ["The Avengers"] },
  { title: "Thor: Ragnarok", releaseYear: 2017, runtime: 130, prereqs: [] },
  { title: "Avengers: Infinity War", releaseYear: 2018, runtime: 149, prereqs: ["Captain America: Civil War", "Thor: Ragnarok"] },
  { title: "Avengers: Endgame", releaseYear: 2019, runtime: 181, prereqs: ["Avengers: Infinity War"] },
  { title: "Avengers: Doomsday", releaseYear: 2026, runtime: 150, prereqs: ["Avengers: Endgame"] },
];

async function seed() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log("MongoDB connected");

  await Movie.deleteMany({});

  // Dhap 1: prerequisite chhara shob movie banai
  const idByTitle = {};
  for (const item of data) {
    const movie = await Movie.create({
      title: item.title,
      releaseYear: item.releaseYear,
      runtime: item.runtime,
    });
    idByTitle[item.title] = movie._id;
  }

  // Dhap 2: prerequisite set kori
  for (const item of data) {
    if (item.prereqs.length > 0) {
      await Movie.updateOne(
        { _id: idByTitle[item.title] },
        { prerequisites: item.prereqs.map((t) => idByTitle[t]) }
      );
    }
  }

  console.log("Seeded " + data.length + " movies");
  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error("Seed failed:", err.message);
  process.exit(1);
});