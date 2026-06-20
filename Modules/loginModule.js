// const tempDB = { "firstname": "Amit", "lastname": "Lachmann", "email": "amit505r@gmail.com", "password": "HelloWorld" };
const argon2 = require('argon2');
// const mysql = require('mysql2');
// const fs = require('fs')

// const connection = mysql.createConnection({
//     host: process.env.DB_HOST,
//     user: process.env.DB_USER,
//     password: process.env.DB_PASSWORD,
//     database: process.env.DB_NAME,
//     ssl: {
//         ca: fs.readFileSync(__dirname + '/global-bundle.pem')
//     }
// })

// connection.connect((err) => {
//     if (err) {
//         console.error("Cloud Database connection failed: ", err)
//     }
//     else {
//         console.log("Successfully connected to AWS RDS!")
//     }
// })

function validateSignUp(firstname, lastname, email, password, repeatPassword) {
    let errors = [];

    if (!firstname) { errors.push({ field: 'firstname', msg: 'First name is required' }) }
    else if (firstname.length > 40) { errors.push({ field: 'firstname', msg: "First name can't be longer than 40 characters" }) }
    if (!lastname) { errors.push({ field: 'lastname', msg: 'Last name is required' }) }
    else if (lastname.length > 40) { errors.push({ field: 'lastname', msg: "Last name can't be longer than 40 characters" }) }
    if (!email) { errors.push({ field: 'email', msg: 'Email is required' }) }
    else if (email.length > 254) { errors.push({ field: 'email', msg: "Email can't be longer than 254 characters" }) }
    // else if (email === tempDB.email) { errors.push({ field: 'email', msg: 'This email already has an account' }) }
    if (!password) { errors.push({ field: 'password', msg: 'Password is required' }) }
    else if (password.length < 8) { errors.push({ field: 'password', msg: 'Password must contain at least 8 characters' }) }
    else if (password.length > 128) { errors.push({ field: 'password', msg: "Password can't be longer than 128 characters" }) }
    if (password !== repeatPassword) {
        errors.push({ field: 'repeatPassword', msg: 'Password and repeat password do not match' })
        errors.push({ field: 'password', msg: 'Password and repeat password do not match' })
    }

    return errors
}

function validateLogin(email, password) {
    let errors = []

    if (!email) errors.push({ field: 'emailLogin', msg: 'Email is required' });
    // if (email !== tempDB.email && email !== '') {
    //     errors.push({ field: 'emailLogin', msg: 'Wrong email' });
    // }

    if (!password) {
        errors.push({ field: 'passwordLogin', msg: 'Password is required' });
    }
    // else if (password !== tempDB.password && password !== '') {
    //     errors.push({ field: 'passwordLogin', msg: 'Wrong password' });
    // }

    return errors;
}

async function signUp(req, res, connection) {
    const { firstname, lastname, email, password, repeatPassword } = req.body

    const errors = validateSignUp(firstname, lastname, email, password, repeatPassword)

    try {
        const [results] = await connection.promise().query(
            'SELECT email FROM users_info WHERE email = ?', [email]
        )
        if (results.length > 0) {
            errors.push({ field: "email", msg: 'This email already has an account' })
        }
    }
    catch (dbErr) {
        console.error("Database error during email check: ", dbErr)

        const clientMessage = process.env.NODE_ENV === 'development'
            ? dbErr.message
            : "An internal server error occurred."

        return res.status(500).json({ success: false, error: clientMessage })

    }

    if (errors.length > 0) {
        return res.status(400).json({ success: false, errors })
    }
    try {
        const hashedPassord = await argon2.hash(password);
        // try {
        //     hashedPassord = await argon2.hash("password")
        // }
        // catch (err) {
        //     return res.status(500).json({ success: false, err })
        // }
        // data is valid TODO add to database
        connection.query('insert into users_info values (?,?,?,?)', [firstname, lastname, email, hashedPassord], (err) => {
            if (err) {
                console.error("Database error: ", err)

                const clientMessage = process.env.NODE_ENV === 'development'
                    ? err.message
                    : "An internal server error occurred."

                return res.status(500).json({ success: false }, clientMessage)
            }
            res.json({ success: true, redirect: './campaignList.html' })
        })
        // look into json web tokens to keep track of which account it is that is logged in
    }
    catch (err) {
        console.error("Hashing error: ", err)

        const clientMessage = process.env.NODE_ENV === 'development'
            ? err.message
            : "An internal server error occurred."

        return res.status(500).json({ success: false, clientMessage })
    }
}

async function logIn(req, res, connection) {
    const { email, password } = req.body

    const errors = validateLogin(email, password)

    if (errors.length > 0) {
        return res.status(400).json({ success: false, errors })
    }

    if (email) {
        try {
            const [results] = await connection.promise().query(
                'SELECT email, hashed_password FROM users_info WHERE email = ?', [email]
            )
            if (results.length === 0) {
                error.push({ field: "email", msg: 'Invalid email or password' })
                return res.status(400).json({ success: false, errors })
            }
            const user = results[0]
            
            const isMatch = await argon2.verify(user.hashed_password, password)

            if (!isMatch) {
                errors.push({ field: "email", msg: 'This email does not have an account' })
                return res.status(400).json({ success: false, errors })
            }

            return res.json({ success: true, redirect: './campaignList.html'})
        }
        catch (err) {
            console.error("Login processing error: ", err)

            const clientMessage = process.env.NODE_ENV === 'development'
                ? dbErr.message
                : "An internal server error occurred."

            return res.status(500).json({ success: false, error: clientMessage })
        }
    }
    // if (errors.length > 0) {
    //     return res.status(400).json({ success: false, errors})
    // }
}

module.exports = {
    signUp,
    logIn,
    validateSignUp,
    validateLogin
}