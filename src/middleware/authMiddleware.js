import jwt from 'jsonwebtoken';

export default (req, res, next ) => {
    try {
        const header = req.headers.authorization;
        if(!header) return res.status(401).json({ error: "No Authorozation header"});

        const token = header.split(" ")[1];
        const payload = jwt.verify(token, process.env.JWT_SECRET);
        req.user = payload;
        next();
    } catch (err) {
        return res.status(401).json({ error: "Invalid or expired Token"});
    }
};