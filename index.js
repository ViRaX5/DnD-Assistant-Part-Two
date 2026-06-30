require('dotenv').config()
const express = require('express')
const app = express()
const cors = require('cors')
const loginSignupModule = require('./Modules/loginModule')
const campaignListModule = require('./Modules/campaignListModule')
const playerModule = require('./Modules/playerModule')
const mysql = require('mysql2')
const fs = require('fs')
const helper = require('./Modules/helperFunctionsModule')
const mongoose = require('mongoose')
const uri = `mongodb+srv://amit505r_db_user:${process.env.MONGODB_PASSWORD}@cluster0.6a6vfcx.mongodb.net/?appName=Cluster0`
const multer = require('multer')
const { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3')
const crypto = require('crypto')
const sharp = require('sharp')
const DMModule = require('./Modules/DMModule')
const chatModule = require('./Modules/chatModule')
const effectsModule = require('./Modules/effectsModule')
const shopModule = require('./Modules/shopModule')
const mapModule = require('./Modules/mapModule')
const initiativeModule = require('./Modules/initiativeModule')
const combatModule = require('./Modules/combatModule')
const cookieParser = require('cookie-parser')
const jwt = require('jsonwebtoken')

const port = process.env.PORT || 8080

app.use(express.json())
app.use(express.urlencoded({ extended: true }))
app.use(cookieParser())

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

const clientOptions = { serverApi: { version: '1', strict: true, deprecationErrors: true } }
async function run() {
    try {
        await mongoose.connect(uri, clientOptions)
        await mongoose.connection.db.admin().command({ ping: 1 })
        console.log("Pinged your deployment. You successfully connected to MongoDB!")
    }
    catch (err) {
        console.error("MongoDB connection error:", err)
    }
}
run().catch(console.dir)

const allowedOrigin = process.env.NODE_ENV === 'production' ? ['https://virax5.github.io'] : ['http://127.0.0.1:5500', 'http://localhost:5500']

app.use(cors({
    origin: allowedOrigin,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Origin', 'X-Requested-With', 'Content-Type', 'Accept', 'Authorization']
}))
app.use((req, res, next) => {
     if (!res.get('Content-Type')) {
        res.set('Content-Type', 'application/json')
    }
    next()
})

const storage = multer.memoryStorage()
const upload = multer({ storage: storage })

const client = new S3Client({ region: process.env.BUCKET_REGION })

const randomImageName = (bytes = 32) => crypto.randomBytes(bytes).toString('hex')

app.post('/api/refresh', async (req, res) => {
    helper.refreshToken(req, res, pool)
})

app.post('/api/signup', (req, res) => {
    loginSignupModule.signUp(req, res, pool)
})

app.post('/api/login', (req, res) => {
    loginSignupModule.logIn(req, res, pool)
})

app.get('/api/campaignListID', helper.authenticateToken, (req, res) => {
    campaignListModule.getCampaignsListByID(req, res, pool)
})

app.get('/api/campaignListCode', helper.authenticateToken, (req, res) => {
    campaignListModule.getCampaignsListByCode(req, res, pool)
})

app.get('/api/campaignList', helper.authenticateToken, (req, res) => {
    campaignListModule.getCampaignsList(req, res, pool)
})

app.get('/api/generateCode', helper.authenticateToken, (req, res) => {
    helper.getUniqueJoinCode(req, res, pool)
})

app.post('/api/createNewCampaign', helper.authenticateToken, (req, res) => {
    campaignListModule.createNewCampaign(req, res, pool)
})

app.post('/api/joinCampaign', helper.authenticateToken, (req, res) => {
    campaignListModule.joinNewCampaign(req, res, pool)
})

app.get('/api/getCharacter', helper.authenticateToken, helper.checkCampaignAccess(pool), (req, res) => {
    campaignListModule.getCharacter(req, res)
})

app.patch('/api/updateSkillProficiency', helper.authenticateToken, helper.checkCampaignAccess(pool), (req, res) => {
    campaignListModule.updateSkillProficiency(req, res)
})

app.patch('/api/updateSavingThrowProficiency', helper.authenticateToken, helper.checkCampaignAccess(pool), (req, res) => {
    campaignListModule.updateSavingThrowProficiency(req, res)
})

app.get('/api/campaignListCampaignAndDM', helper.authenticateToken, (req, res) => {
    campaignListModule.getSessionPlayersExceptDM(req, res, pool)
})

app.delete('/api/campaignListNewDM', helper.authenticateToken, helper.checkCampaignAccess(pool), (req, res) => {
    campaignListModule.setUpNewDM(req, res, pool)
})

app.delete('/api/campaignListPlayerLeave', helper.authenticateToken, (req, res) => {
    campaignListModule.leaveSession(req, res, pool)
})

app.delete('/api/deleteEntireCampaign', helper.authenticateToken, helper.checkCampaignAccess(pool), (req, res) => {
    campaignListModule.deleteEntireCampaign(req, res, pool)
})

app.post('/api/DM/uploadAsset', helper.authenticateToken, upload.single('media'), async (req, res) => {
    DMModule.uploadAssets(req, res, pool, client)
})

app.get("/api/DM/getAsset", helper.authenticateToken, helper.checkCampaignAccess(pool), async (req, res) => {
    DMModule.getAssets(req, res, pool, client)
})

app.delete("/api/DM/deleteAsset", helper.authenticateToken, async (req, res) => {
    DMModule.deleteAssets(req, res, pool, client)
})

app.post('/api/DM/saveMonster', helper.authenticateToken, helper.checkCampaignAccess(pool), (req, res) => {
    DMModule.saveMonster(req, res, pool)
})

app.get('/api/DM/getSavedMonsters', helper.authenticateToken, helper.checkCampaignAccess(pool), (req, res) => {
    DMModule.getSavedMonsters(req, res, pool)
})

app.get('/api/DM/getShopInventory', helper.authenticateToken, helper.checkCampaignAccess(pool), (req, res) => {
    shopModule.getShopInventory(req, res)
})

app.post('/api/DM/updateShopInventory', helper.authenticateToken, helper.checkCampaignAccess(pool), (req, res) => {
    shopModule.updateShopInventory(req, res)
})

app.get('/api/getShopInventory', helper.authenticateToken, helper.checkCampaignAccess(pool), (req, res) => {
    shopModule.getShopInventory(req, res)
})

app.post('/api/player/checkout', helper.authenticateToken, helper.checkCampaignAccess(pool), (req, res) => {
    playerModule.processCheckout(req, res) 
})

app.get('/api/chatHistory', helper.authenticateToken, helper.checkCampaignAccess(pool), (req, res) => {
    chatModule.getChatHistory(req, res)
})

app.get('/api/getEffects', helper.authenticateToken, helper.checkCampaignAccess(pool), (req, res) => {
    effectsModule.getActiveEffects(req, res)
})

app.get('/api/getShopStatus', helper.authenticateToken, helper.checkCampaignAccess(pool), (req, res) => {
    shopModule.getShopStatus(req, res)
})

app.get('/api/getMapState', helper.authenticateToken, helper.checkCampaignAccess(pool), (req, res) => {
    mapModule.getMapState(req, res)
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
})

// socket.id -> { userId, campaignId, isDM }
const socketContext = new Map()

io.on('connection', (socket) => {
    console.log('Backend Connection', socket.id)

    socket.on('session:join', async ({ campaignId, accessToken }) => {
        if (!campaignId || !accessToken) return

        let decoded
        try {
            decoded = jwt.verify(accessToken, process.env.JWT_SECRET)
        }
        catch (err) {
            return
        }

        const userId = decoded.userId

        try {
            const [participants] = await pool.promise().query(
                'SELECT users_role FROM capmaign_participants WHERE user_id = ? AND campaign_id = ?',
                [userId, campaignId]
            )

            if (participants.length === 0) return

            const isDM = participants[0].users_role === 'DM'

            socketContext.set(socket.id, { userId, campaignId, isDM })
            socket.join(`campaign:${campaignId}`)

            if (!isDM) {
                initiativeModule.checkReconnectingRoller(socket, campaignId, userId)
            }

            combatModule.checkReconnectingCombatState(socket, campaignId)
        }
        catch (err) {
            console.error("session:join authorization check failed:", err)
        }
    })

    socket.on('combat:turnChanged', (payload) => {
        combatModule.handleTurnChanged(io, socket, socketContext, payload)
    })

    socket.on('rest:request', (payload) => {
        combatModule.handleRestRequest(io, socket, socketContext, payload)
    })

    socket.on('rest:respond', (payload) => {
        combatModule.handleRestRespond(io, socket, socketContext, payload)
    })

    socket.on('initiative:start', () => {
        initiativeModule.handleInitiativeStart(io, socket, socketContext, pool)
    })

    socket.on('initiative:submitRoll', (payload) => {
        initiativeModule.handleInitiativeSubmitRoll(io, socket, socketContext, payload)
    })

    socket.on('initiative:end', () => {
        initiativeModule.handleInitiativeEnd(io, socket, socketContext)
    })

    socket.on('map:moveToken', (data) => {
        const ctx = socketContext.get(socket.id)
        if (!ctx) return

        mapModule.persistTokenMove(ctx.campaignId, data.tokenId, data.newX, data.newY)
        socket.to(`campaign:${ctx.campaignId}`).emit('map:updateToken', data)
    })

    socket.on('map:spawnToken', (data) => {
        const ctx = socketContext.get(socket.id)
        if (!ctx) return

        mapModule.persistTokenSpawn(ctx.campaignId, data)
        socket.to(`campaign:${ctx.campaignId}`).emit('map:spawnToken', data)
    })

    socket.on('map:changeBackground', (data) => {
        const ctx = socketContext.get(socket.id)
        if (!ctx) return

        mapModule.persistBackground(ctx.campaignId, data.imageUrl)
        socket.to(`campaign:${ctx.campaignId}`).emit('map:changeBackground', data)
    })

    socket.on('map:reset', () => {
        const ctx = socketContext.get(socket.id)
        if (!ctx || !ctx.isDM) return

        mapModule.clearMapState(ctx.campaignId)
        io.to(`campaign:${ctx.campaignId}`).emit('map:reset')
    })

    socket.on('chat:send', (payload) => {
        chatModule.handleMessageSend(io, socket, socketContext, payload)
    })

    socket.on('effects:add', (payload) => {
        effectsModule.handleEffectAdd(io, socket, socketContext, payload)
    })

    socket.on('effects:decrementRound', () => {
        effectsModule.handleDecrementRound(io, socket, socketContext)
    })

    socket.on('shop:toggle', (payload) => {
        shopModule.handleShopToggle(io, socket, socketContext, payload)
    })

    socket.on('disconnect', () => {
        socketContext.delete(socket.id)
    })

    socket.on('audio:play', (data) => {
        const context = socketContext.get(socket.id)
        if (context) {
            socket.to(`campaign:${context.campaignId}`).emit('audio:syncPlay', data)
        }
    })

    socket.on('audio:pause', () => {
        const context = socketContext.get(socket.id)
        if (context) {
            socket.to(`campaign:${context.campaignId}`).emit('audio:syncPause')
        }
    })

    socket.on('audio:resume', () => {
        const context = socketContext.get(socket.id)
        if (context) {
            socket.to(`campaign:${context.campaignId}`).emit('audio:syncResume')
        }
    })

    socket.on('audio:stop', () => {
        const context = socketContext.get(socket.id)
        if (context) {
            socket.to(`campaign:${context.campaignId}`).emit('audio:syncStop')
        }
    })

    socket.on('audio:seek', (data) => {
        const context = socketContext.get(socket.id)
        if (context) {
            socket.to(`campaign:${context.campaignId}`).emit('audio:syncSeek', data)
        }
    })

    socket.on('audio:setPlayerVolume', (data) => {
        const context = socketContext.get(socket.id)
        if (context) {
            socket.to(`campaign:${context.campaignId}`).emit('audio:syncTargetVolume', data)
        }
    })
})


process.on('SIGINT', async () => {
    console.log("Shutting down server...")

    pool.end()

    await mongoose.connection.close()
    console.log("Database connections closed cleanly.")

    process.exit(0)
})