import express from "express";
import { verifyRefreshToken, generateAccessToken} from '../utils/token.js';
import User from '../models/userModel.js';

const router = express.Router();

router.post("/refresh", async (req, res) => {
    try{
        const token = req.cookies.jid;
        if(!token) {
            return res.status(401).json({error: "No refresh Token"});
        }

        let payload;
        try {
            payload = verifyRefreshToken(token);
        } catch (err) {
            return res.status(403).json({ error: "Invalid Refresh Token"});
        }

        const accessToken = generateAccessToken({id: payload.id, username: payload.username });
        return res.json({ accessToken });
    } catch (err) {
        return res.status(500).json({ error: err.message});
    }
});

export default router;