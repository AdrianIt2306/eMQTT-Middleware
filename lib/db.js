// lib/db.js
require('dotenv').config()
console.log(process.env.DATABASE_IP) // remove this after you've confirmed it is working
const mysql = require('mysql');
const connection = mysql.createConnection({
  host: process.env.DATABASE_IP,
  user: process.env.DATABASE_USER,
  database:process.env.DATABASE_NAME,
  password: process.env.DATABASE_PASSWORD
});
connection.connect();
module.exports = connection;
