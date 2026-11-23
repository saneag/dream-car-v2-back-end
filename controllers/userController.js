import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { pool, newId } from '../db.js';

const publicUser = ({ passwordHash, ...user }) => user;
const withToken = (user) => ({ ...publicUser(user),
    token: jwt.sign({ _id: user._id }, process.env.JWT_SECRET, { expiresIn: '30d' }) });

export const register = async (req, res) => {
    try {
        const hash = await bcrypt.hash(req.body.password, 10);
        const { rows: [user] } = await pool.query(
            'INSERT INTO users (_id, email, name, "avatarUrl", "passwordHash", role) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *',
            [newId(), req.body.email, req.body.name, req.body.avatarUrl || null, hash, 'user']);
        res.json(withToken(user));
    } catch (err) {
        if (err.code === '23505') return res.status(400).json({ message: 'User with this email already exists' });
        res.status(500).json({ message: 'Could not register user' });
    }
};

export const login = async (req, res) => {
    try {
        const { rows: [user] } = await pool.query('SELECT * FROM users WHERE email=$1', [req.body.email]);
        if (!user || !await bcrypt.compare(req.body.password, user.passwordHash)) {
            return res.status(400).json({ message: 'Invalid email or password' });
        }
        res.json(withToken(user));
    } catch {
        res.status(500).json({ message: 'Could not sign in' });
    }
};

export const getUser = async (req, res) => {
    try {
        const { rows: [user] } = await pool.query('SELECT * FROM users WHERE _id=$1', [req.userId]);
        if (!user) return res.status(404).json({ message: 'User not found' });
        res.json(publicUser(user));
    } catch {
        res.status(500).json({ message: 'Access denied' });
    }
};
