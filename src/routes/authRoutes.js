import { error } from "console";
import express from "express";
import * as authService from "../services/authService.js";
import cookieParser from "cookie-parser";
import authMiddleware from "../middleware/authMiddleware.js";

const router = express.Router();

router.post("/register", async(req, res) => {
    try{
        const result = await authService.register(req.body);
        return res.status(201).json(result);
    } catch (err) {
        return res.status(err.status || 500).json({ error: err.message});
    }
});

router.post("/login", async(req, res) => {
    try{
        const { user, accessToken, refreshToken } = await authService.login(req.body);

        res.cookie("jid", refreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
            maxAge: 7 * 24 * 60 * 60 * 1000,
        });
        
        return res.json({ user, accessToken});
    } catch (err) {
        return res.status(err.status || 500).json({ error: err.message});
    }
});

router.post("/setup", authMiddleware, async (req, res) => {
  console.log("req.user:", req.user);
  console.log("typeof userId:", typeof req.user?.id);

  const userId = req.user.id; // or userId — see next step
  console.log("SETUP userId:", userId);

  const result = await authService.setup(userId, req.body);
  res.json(result);
});



export default router;