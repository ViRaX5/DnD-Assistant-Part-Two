// const tempDB = { "firstname": "Amit", "lastname": "Lachmann", "email": "amit505r@gmail.com", "password": "HelloWorld" };
const argon2 = require('argon2');
const mysql = require('mysql2');

const connection = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '', //very imortant!!!!! this is your password, when you load into mySQL workbench and click the button in the image on whatsapp you
    //              a password, this is the same password!!. in order to keep it working well until I connect it to the clound, before you push
    //              make sure to delete this password as to not share your password online.
    database: 'DnDAssistant' //also very important. this DB needs to be created in your local DB for this to work.
    //                         While you are at it also add the table listed below
    /*
        CREATE TABLE users_info (
        first_name VARCHAR(40),
        last_name VARCHAR(40),
        email VARCHAR(254) NOT NULL,
        hashed_password VARCHAR(255) NOT NULL,
        PRIMARY KEY (email)
        )
        ;
    */
})

connection.connect((err) => {
    if (err)
    {
        console.log(err)
    }
    else
    {
        console.log("connected to db")
    }
})

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
    if (email !== tempDB.email && email !== '') {
        errors.push({ field: 'emailLogin', msg: 'Wrong email' });
    }

    if (!password) {
        errors.push({ field: 'passwordLogin', msg: 'Password is required' });
    } else if (password !== tempDB.password && password !== '') {
        errors.push({ field: 'passwordLogin', msg: 'Wrong password' });
    }

    return errors;
}

async function signUp(req, res) {
    const { firstname, lastname, email, password, repeatPassword } = req.body

    const errors = validateSignUp(firstname, lastname, email, password, repeatPassword)

    if (email){
        try {
            const [results] = await connection.promise().query(
                'SELECT email FROM users_info WHERE email = ?', [email]
            )
            if (results.length > 0) {
                error.push({ field: "email", msg: 'This email already has an account'})
            }
        }
        catch (dbErr) {
            console.error("Database error during email check: ", dbErr)
            return res.status(500).json({ success: false, error: dbErr})
        }
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
                return res.status(500).json({ success: false }, err)
            }
            res.json({ success: true, redirect: './campaignList.html' })
        })
        // look into json web tokens to keep track of which account it is that is logged in
    }
    catch (err) {
        console.error("Hashing error: ", err)
        return res.status(500).json({ success: false, err })
    }
}

module.exports = {
    signUp,
    validateSignUp,
    validateLogin
}