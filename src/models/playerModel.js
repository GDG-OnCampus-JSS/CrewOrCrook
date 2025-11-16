import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
    username: {
        type: String,
        required: true,
        unique: true,
        trim: true
    },
    password: {
        type: String,
        required: true
    },
    inGame: {
        type: Boolean,
        default: false
    },
    currentRoomId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "GameRoom",
        default: null
    },
    role: {
        type: String,
        enum: ["crewmate", "imposter", "none"],
        default: "none"
    }
}, {timestamps: true});

export const User = mongoose.model("User", userSchema);