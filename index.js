require('dotenv').config();
const express = require('express');
const app = express();
const loginSignupModule = require('./Modules/loginModule');
const campaignListModule = require('./Modules/campaignListModule');
// const argon2 = require('argon2'); probably dont need here
const mysql = require('mysql2');
const fs = require('fs');
const helper = require('./Modules/helperFunctionsModule');
const mongoose = require('mongoose');
const uri = `mongodb+srv://amit505r_db_user:${process.env.MONGODB_PASSWORD}@cluster0.6a6vfcx.mongodb.net/?appName=Cluster0`;
const multer  = require('multer')
const { S3Client, ListBucketsCommand } = require('@aws-sdk/client-s3')
// const { MongoClient, ServerApiVersion } = require('mongodb');
// const uri = `mongodb+srv://amit505r_db_user:${process.env.MONGODB_PASSWORD}@cluster0.6a6vfcx.mongodb.net/?appName=Cluster0`;

const port = process.env.PORT || 8080

app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// database connection

// mySQL

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

// mongoDB

const clientOptions = { serverApi: { version: '1', strict: true, deprecationErrors: true } }
async function run() {
    try {
        // Create a Mongoose client with a MongoClientOptions object to set the Stable API version
        await mongoose.connect(uri, clientOptions);
        await mongoose.connection.db.admin().command({ ping: 1 })
        console.log("Pinged your deployment. You successfully connected to MongoDB!")
    } 
    catch (err) {
        // Ensures that the client will close when you finish/error
        console.error("MongoDB connection error:", err)
    }
}
run().catch(console.dir);


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

// setup multer

const storage = multer.memoryStorage()
const upload = multer({ storage: storage })

// s3

const s3 = new S3Client({
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
    },
    region: process.env.BUCKET_REGION
})

// get/post/etc.

app.post('/api/signup', (req, res) => {
    loginSignupModule.signUp(req, res, pool)
    // look into json web tokens to keep track of which account it is that is logged in
})

app.post('/api/login', (req, res) => {
    loginSignupModule.logIn(req, res, pool)
    // look into json web tokens to keep track of which account it is that is logged in
})

app.get('/api/campaignListID', (req, res) => {
    campaignListModule.getCampaignsListByID(req, res, pool)
})

app.get('/api/campaignListCode', (req, res) => {
    campaignListModule.getCampaignsListByCode(req, res, pool)
})

app.get('/api/campaignList', (req, res) => {
    campaignListModule.getCampaignsList(req, res, pool)
})

app.get('/api/generateCode', (req, res) => {
    helper.getUniqueJoinCode(req, res, pool)
})

app.post('/api/createNewCampaign', (req, res) => {
    campaignListModule.createNewCampaign(req, res, pool)
})

app.post('/api/joinCampaign', (req, res) => {
    campaignListModule.joinNewCampaign(req, res, pool)
})

app.get('/api/campaignListCampaignAndDM', (req, res) => {
    campaignListModule.getSessionPlayersExceptDM(req, res, pool)
})

app.delete('/api/campaignListNewDM', (req, res) => {
    campaignListModule.setUpNewDM(req, res, pool)
})

app.delete('/api/campaignListPlayerLeave', (req, res) => {
    campaignListModule.leaveSession(req, res, pool)
})

app.delete('/api/deleteEntireCampaign', (req, res) => {
    campaignListModule.deleteEntireCampaign(req, res, pool)
})

app.post('/api/DMUpload', upload.single('media'), async (req, res) => {
    console.log("req.body", req.body)
    console.log("req.file", req.file)
    // req.file.buffer this is the actual image that we will need to send
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
    console.log('Backend Connection', socket.id)

    socket.on('map:moveToken', (data) => {
        // Broadcast sends the data to EVERYONE connected EXCEPT the person who just moved the token
        socket.broadcast.emit('map:updateToken', data)
    });
})


process.on('SIGINT', async () => {
    console.log("Shutting down server...")

    // Close MySQL
    pool.end();

    // Close MongoDB
    await mongoose.connection.close()
    console.log("Database connections closed cleanly.")

    process.exit(0)
})