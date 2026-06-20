require('dotenv').config()
const express = require('express')
const app = express()
const loginSignupModule = require('./Modules/loginModule')
// const argon2 = require('argon2') probably dont need here
const mysql = require('mysql2')
const fs = require('fs')

const port = process.env.PORT || 8080

app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// database connection

const connection = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    ssl: {
        ca: fs.readFileSync(__dirname + '/global-bundle.pem')
    }
})

connection.getConnection((err, conn) => {
    if (err) {
        console.error("Cloud Database connection failed: ", err)
    }
    else {
        console.log("Successfully connected to AWS RDS!")
        conn.release()
    }
})

// cors

const allowedOrigin = process.env.NODE_ENV === 'production' ? 'https://virax5.github.io' : '*' 

app.use((req, res, next) => {
    res.set({
        'Access-Control-Allow-Origin': allowedOrigin,
        'Access-Control-Allow-Headers': 'Origin, X-Requested-With, Content-Type, Accept',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE',
        'Content-Type': 'application/json'
    })
    next()
})

// get/post/etc.

app.post('/api/signup', (req, res) => {
    loginSignupModule.signUp(req,res, connection)
    // const { firstname, lastname, email, password, repeatPassword } = req.body

    // const errors = loginSignupModule.validateSignUp(firstname, lastname, email, password, repeatPassword)

    // if (errors.length > 0) {
    //     return res.status(400).json({ success: false, errors })
    // }

    // // data is valid TODO add to database

    // res.json({ success: true, redirect: './campaignList.html' })
    // // look into json web tokens to keep track of which account it is that is logged in
})

app.post('/api/login', (req, res) => {
    const { email, password } = req.body;

    const errors = loginSignupModule.validateLogin(email, password);

    if (errors.length > 0) {
        return res.status(400).json({ success: false, errors });
    }

    res.json({ success: true, redirect: './campaignList.html' });
    // look into json web tokens to keep track of which account it is that is logged in
})

app.get("/", (req, res) => {
    res.send(`This is localhost:${port}`)
})

const server = app.listen(port, () => {
    console.log(`server is running on localhost:${port}`)
})

const io = require('socket.io')(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

io.on('connection', (socket) => {
    console.log('Backend Connection', socket.id);
})


