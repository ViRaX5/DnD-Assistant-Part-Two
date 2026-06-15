require('dotenv').config()
const express = require('express')
const app = express()
const loginSignupModule = require('./Modules/loginModule')

const port = process.env.PORT || 8080

app.use(express.json())
app.use(express.urlencoded({ extended: true }))

app.get("/", (req, res) => {
    res.send(`This is localhost:${port}`)
})


app.listen(port, () => {
    console.log(`server is running on localhost:${port}`)
})


