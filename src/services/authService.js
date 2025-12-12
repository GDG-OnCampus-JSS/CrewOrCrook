import User from '../models/userModel.js';
import bcrypt from "bcryptjs";
import { generateAccessToken, generateRefreshToken } from '../utils/token.js';

const SALT_ROUNDS = 10;

export const register = async({ username, password, email, zealId, rollNo, section, avatar }) => {
    if(!username || !password || !zealId || !section) {
        console.log("Some fields are missing");
        throw new Error("Missing required fields");
    }

    const existing = await User.findOne({ username});
    if(existing) {
        const err = new Error("User already exists");
        err.status = 400;
        throw err;
    }

    const hashed = await bcrypt.hash(password, SALT_ROUNDS);

    const user = await User.create({
        username,
        password: hashed,
        email,
        zealId,
        rollNo,
        section,
        avatar: avatar ?? null,
    });

    return {
        message: "User created",
        user: {
            id: user._id,
            username: user.username,
            email: user.email
        }
    };
}

export const login = async ({ username, password }) => {
    if(!username || !password) {
        const err = new Error("Missing credentials");
        err.status = 400;
        throw err;
    }

    const user = await User.findOne({ username });
    if(!user) {
        const err = new Error("User not exist");
        err.status = 400;
        throw err;
    }

    const match = await bcrypt.compare(password, user.password);
    if(!match) {
        const err = new Error("Wrong Password");
        err.status = 400;
        throw err;
    }

    const payload = { id: user._id, username: user.username};
    const accessToken = generateAccessToken(payload);
    const refreshToken = generateRefreshToken(payload);

    return {
        user: {
            id: user._id,
            username: user.username,
            email: user.email
        },
        accessToken,
        refreshToken
    };
};