import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import fs from 'fs';
import { pool } from './db.js';
import multer from 'multer';

dotenv.config();

import { CarsController, UserController } from './controllers/index.js';
import { checkAuth, handleValidationErrors } from './utils/index.js';
import {
    createCarValidation,
    loginValidation,
    registerValidation,
} from './validations.js';

const app = express();

app.get('/health', async (_, res) => {
    try {
        await pool.query('SELECT 1');
        res.json({ status: 'ok' });
    } catch {
        res.status(503).json({ status: 'unavailable' });
    }
});

const storage = multer.diskStorage({
    destination: (_, __, cb) => {
        if (!fs.existsSync('uploads')) {
            fs.mkdirSync('uploads');
        }
        cb(null, 'uploads');
    },
    filename: (_, file, cb) => {
        cb(null, file.originalname);
    },
});

const upload = multer({ storage });

app.use(express.json());
app.use(cors());
app.use('/uploads', express.static('uploads'));

app.post(
    '/auth/login',
    loginValidation,
    handleValidationErrors,
    UserController.login
);
app.post(
    '/auth/register',
    registerValidation,
    handleValidationErrors,
    UserController.register
);
app.get('/auth/me', checkAuth, UserController.getUser);

app.post('/upload', checkAuth, upload.single('image'), (req, res) => {
    res.json({
        url: `uploads/${req.file.originalname}`,
    });
});

app.get('/cars', CarsController.getAll);
app.get('/cars/:id', CarsController.getOne);
app.post(
    '/cars',
    checkAuth,
    createCarValidation,
    handleValidationErrors,
    CarsController.setCar
);
app.delete('/cars/:id', checkAuth, CarsController.deleteCar);
app.patch(
    '/cars/:id',
    checkAuth,
    handleValidationErrors,
    CarsController.updateCar
);

const PORT = process.env.PORT || 5000;

if (process.env.NODE_ENV !== 'test') app.listen(PORT, (err) => {
    if (err) {
        return console.log(err);
    }

    console.log('Server is listening on port 5000');
});

export default app;
