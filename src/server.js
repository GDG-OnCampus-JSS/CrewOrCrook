import express from "express";
import http from "http";
import { Server } from "socket.io";
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
    cors: {
        origin:"*",
        methods: ["GET", "POST"]
    }
});

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
    res.send("AmongUs Backend is Running ");
})

io.on("connection", (socket) => {
    console.log(`Player connected: ${socket.id}`);

    socket.on("sendMessage", (msg) => {
        console.log("Message recieved:", msg);
        io.emit("newMessage", msg);
    });

    socket.on("disconnect", () => {
        console.log(`Player disconnected: ${socket.id}`);
    });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
})