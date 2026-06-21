require('dotenv').config();
const express = require('express');
const app = express();
const loginSignupModule = require('./Modules/loginModule');
const campaignListModule = require('./Modules/campaignListModule');
// const argon2 = require('argon2'); probably dont need here
const mysql = require('mysql2');
const fs = require('fs');

const port = process.env.PORT || 8080

app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// database connection

const pool = mysql.createPool({
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

pool.getConnection((err, conn) => {
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
    loginSignupModule.signUp(req,res, pool)
    // look into json web tokens to keep track of which account it is that is logged in
})

app.post('/api/login', (req, res) => {
    loginSignupModule.logIn(req, res, pool)
    // look into json web tokens to keep track of which account it is that is logged in
})

app.get('/api/campaignList', (req, res) => {
    campaignListModule.getCampaignsList(req, res, pool)
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

    socket.on('map:moveToken', (data) => {
        // Broadcast sends the data to EVERYONE connected EXCEPT the person who just moved the token
        socket.broadcast.emit('map:updateToken', data);
    });
})


