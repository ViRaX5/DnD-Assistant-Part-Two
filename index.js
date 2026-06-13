const express = require('express')
const app = express()

app.get("/", (req, res) => {
    res.send("This is local host 3000")
})


app.listen(3000, () => {
    console.log("server is running on localhost:3000")
})


