import mongoose from "mongoose";

const roomSchema = new mongoose.Schema({
    roomCode: {
        type: String,
        required: true,
        unique: true
    },
    hostId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    players: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
    }],
    gameState: {
        type: String,
        enum: ["waiting", "running", "ended"],
        default: "waiting"
    },
    maxPlayers: {
        type: Number,
        default: 10
    }
}, {timestamps: true});

export const Room = mongoose.model("Room", roomSchema);