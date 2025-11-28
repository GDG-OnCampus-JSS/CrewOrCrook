import mongoose from "mongoose";

const roomSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true },

    host: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },

    players: [{ type: mongoose.Schema.Types.ObjectId, ref: "Player" }],

    maxPlayers: { type: Number, default: 10 },

    gameState: {
      type: String,
      enum: ["lobby", "in-game", "meeting", "finished"],
      default: "lobby",
    },

    imposters: { type: Number, default: 1 },
  },
  { timestamps: true }
);

export default mongoose.model("Room", roomSchema);
