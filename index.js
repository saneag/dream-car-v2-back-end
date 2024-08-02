import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import fs from 'fs';
import mongoose from 'mongoose';
import multer from 'multer';

dotenv.config();

import { CarsController, UserController } from './controllers/index.js';
import { checkAuth, handleValidationErrors } from './utils/index.js';
import {
    createCarValidation,
    loginValidation,
    registerValidation,
} from './validations.js';

mongoose
    .connect(process.env.MONGO_URI)
    .then((res) => {
        console.log('db ok');
    })
    .catch((err) => {
        console.log(err);
    });

const app = express();

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

app.listen(PORT, (err) => {
    if (err) {
        return console.log(err);
    }

    console.log('Server is listening on port 5000');
});
