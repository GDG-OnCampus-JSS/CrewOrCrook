const express = require("express");
const router = express.Router();
const { createUser, getUserById } = require("../services/userService");

// POST /api/users
router.post("/", async (req, res) => {
  try {
    const { username, avatar } = req.body;
    if (!username) {
      return res.status(400).json({ message: "username is required" });
    }

    const user = await createUser(username, avatar);
    res.status(201).json(user);
  } catch (err) {
    console.error("createUser error", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

// GET /api/users/:id
router.get("/:id", async (req, res) => {
  try {
    const user = await getUserById(req.params.id);
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json(user);
  } catch (err) {
    console.error("getUserById error", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

module.exports = router;
