import mongoose from "mongoose";
const userSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, unique: true },
    password: {type: String, required: true},
    avatar: { type: String, default: null },
    zealId: {type: String, required: true},
    rollNo: {type: String, required: true},
    section: {type: String, required: true},
    email: {type: String}
  },
  { timestamps: true }
);

export default mongoose.model("User", userSchema);