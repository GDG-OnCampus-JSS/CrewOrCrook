import mongoose from "mongoose";
const userSchema = new mongoose.Schema(
  {
    username: { type: String, required: true },
    avatar: { type: String, default: null },
    zealId: {type: String, required: true},
    rollNo: {type: String, required: true},
    class: {type: String, required: true}
  },
  { timestamps: true }
);

export default mongoose.model("User", userSchema);