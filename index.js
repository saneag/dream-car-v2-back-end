import express from 'express'
import config from './config/default.json' assert {type: 'json'}
import fs from 'fs'
import mongoose from 'mongoose'
import multer from 'multer'
import cors from 'cors'

import { createCarValidation, loginValidation, registerValidation } from './validations.js'
import { UserController, CarsController } from './controllers/index.js'
import { handleValidationErrors, checkAuth } from './utils/index.js'

mongoose.connect(process.env.mongoURI || config.mongoURI)
    .then((res) => {
        console.log('db ok')
    }).catch(err => {
        console.log(err)
    })

const app = express()

const storage = multer.diskStorage({
    destination: (_, __, cb) => {
        if (!fs.existsSync('/server/uploads')) {
            fs.mkdirSync('/server/uploads')
        }
        cb(null, '/server/uploads')
    },
    filename: (_, file, cb) => {
        cb(null, file.originalname)
    }
})

const upload = multer({ storage })

app.use(express.json())
app.use(cors())
app.use('/server/uploads', express.static('server/uploads'))

app.post('/auth/login', loginValidation, handleValidationErrors, UserController.login)
app.post('/auth/register', registerValidation, handleValidationErrors, UserController.register)
app.get('/auth/me', checkAuth, UserController.getUser)

app.post('/upload', checkAuth, upload.single('image'), (req, res) => {
    res.json({
        url: `/server/uploads/${req.file.originalname}`
    })
})

app.get('/cars', CarsController.getAll)
app.get('/cars/:id', CarsController.getOne)
app.post('/cars', checkAuth, createCarValidation, handleValidationErrors, CarsController.setCar)
app.delete('/cars/:id', checkAuth, CarsController.deleteCar)
app.patch('/cars/:id', checkAuth, handleValidationErrors, CarsController.updateCar)

const PORT = process.env.PORT || config.port

app.listen(PORT, (err) => {
    if (err) {
        return console.log(err)
    }

    console.log('Server is listening on port 5000')
})