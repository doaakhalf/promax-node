import Role from "../Models/Role.js";
import { connectToMongo, disconnectFromMongo } from "../db.js";
import registerModels from "../registerModels.js";

async function seedRoles() {
  await connectToMongo();
  registerModels();

  const roleNames = ["admin", "coach", "athlete"];

  for (const name of roleNames) {
    await Role.updateOne({ name }, { $set: { name } }, { upsert: true });
  }

  const roles = await Role.find({ name: { $in: roleNames } }).sort({ name: 1 }).lean();
  console.log("Seeded roles:");
  for (const r of roles) console.log(`- ${r.name} (${r._id})`);
}

seedRoles()
  .then(async () => {
    await disconnectFromMongo();
    process.exit(0);
  })
  .catch(async (err) => {
    console.error(err);
    try {
      await disconnectFromMongo();
    } catch {
      // ignore
    }
    process.exit(1);
  });
