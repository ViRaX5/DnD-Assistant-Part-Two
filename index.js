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
const multer = require('multer');
const { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const crypto = require('crypto');
const sharp = require('sharp');
const DMModule = require('./Modules/DMModule');
const chatModule = require('./Modules/chatModule');
const cookieParser = require('cookie-parser');
// const { MongoClient, ServerApiVersion } = require('mongodb');
// const uri = `mongodb+srv://amit505r_db_user:${process.env.MONGODB_PASSWORD}@cluster0.6a6vfcx.mongodb.net/?appName=Cluster0`;

const port = process.env.PORT || 8080

app.use(express.json())
app.use(express.urlencoded({ extended: true }))
app.use(cookieParser())

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
        'Access-Control-Allow-Credentials': 'true',
        'Access-Control-Allow-Headers': 'Origin, X-Requested-With, Content-Type, Accept, Authorization',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        // 'Content-Type': 'application/json'
    })

    if (req.method === 'OPTIONS') {
        return res.sendStatus(200)
    }
    if (!res.get('Content-Type')) {
        res.set('Content-Type', 'application/json')
    }
    next()
})

// setup multer, s3, crypto

const storage = multer.memoryStorage()
const upload = multer({ storage: storage })

const client = new S3Client({ region: process.env.BUCKET_REGION })

const randomImageName = (bytes = 32) => crypto.randomBytes(bytes).toString('hex')

// get/post/etc.

app.post('/api/refresh', async (req, res) => {
    helper.refreshToken(req, res, pool)
})

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

app.get('/api/getCharacter', (req, res) => {
    campaignListModule.getCharacter(req, res)
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

app.post('/api/DM/uploadAsset', upload.single('media'), async (req, res) => {
    DMModule.uploadAssets(req, res, pool, client)

    // if (!req.file) {
    //     return res.status(400).json({ success: false, error: "No file uploaded." })
    // }

    // const campaignId = req.body.campaignID
    // const uploaderId = req.body.uploaderID
    // const assetType = req.body.assetType || 'map'

    // if (!campaignId || !uploaderId) {
    //     return res.status(400).json({ success: false, error: "Missing campaign or user IDs." });
    // }

    // const buffer = await sharp(req.file.buffer).resize({ height: 3000, width: 3000, fit: "contain" }).toBuffer() //might need to change values
    // const imageName = randomImageName()

    // const params = {
    //     Bucket: process.env.BUCKET_NAME,
    //     Key: imageName,
    //     Body: buffer,
    //     ContentType: req.file.mimetype
    // }

    // try {
    //     const command = new PutObjectCommand(params)
    //     await client.send(command)

    //     const [dbResult] = await pool.promise().query(`
    //         INSERT INTO campaign_assets 
    //         (campaign_id, uploader_id, s3_key, original_name, asset_type) 
    //         VALUES (?, ?, ?, ?, ?)`, [campaignId, uploaderId, imageName, req.file.originalname, assetType])

    //     return res.json({
    //         success: true,
    //         message: "Asset uploaded and saved to database!",
    //         assetId: dbResult.insertId,
    //         imageName: imageName
    //     })
    // }
    // catch (err) {
    //     console.error("Upload process failed:", err)
    //     return res.status(500).json({ success: false, error: "An error occurred during the upload process." })
    // }


    // req.file.buffer this is the actual image that we will need to send
})

app.get("/api/DM/getAsset", async (req, res) => {
    DMModule.getAssets(req, res, pool, client)
})

app.delete("/api/DM/deleteAsset", async (req, res) => {
    DMModule.deleteAssets(req, res, pool, client)
})

app.get('/api/chatHistory', (req, res) => {
    chatModule.getChatHistory(req, res)
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

// socket.id -> { userId, campaignId, isDM }
const socketContext = new Map()

io.on('connection', (socket) => {
    console.log('Backend Connection', socket.id)

    socket.on('session:join', ({ campaignId, userId, isDM }) => {
        socketContext.set(socket.id, { userId, campaignId, isDM })
        socket.join(`campaign:${campaignId}`)
    });

    socket.on('map:moveToken', (data) => {
        const ctx = socketContext.get(socket.id)
        if (!ctx) return

        // Sends the data to everyone else in the same campaign room, excluding the sender
        socket.to(`campaign:${ctx.campaignId}`).emit('map:updateToken', data)
    });

    socket.on('chat:send', (payload) => {
        chatModule.handleMessageSend(io, socket, socketContext, payload)
    });

    socket.on('disconnect', () => {
        socketContext.delete(socket.id)
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