const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const fetch = require('node-fetch');

const config = require('./config');

const db = require('knex')({
  client: 'pg',
  connection: {
    host : config.db.host,
    user : config.db.user,
    password : config.db.password,
  },
});

const redis = require('redis').createClient({
  host: config.redis.host,
  port: config.redis.port,
})

const app = express();

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(cors());

const validateUserEmail = async (email) => {
  const res = await fetch(`${config.app.externalUrl}/validate?email=${email}`);
  if(res.status !== 200) return false;
  const json = await res.json();
  return json.result === 'valid';
}

app.route('/api/users').post(async (req, res, next) => {
  try {
    const { email, firstname } = req.body;
    // ... validate inputs here ...
    const userData = { email, firstname };

    const isValidUser = await validateUserEmail(email);
    if(!isValidUser) {
      return res.sendStatus(403);
    }

    const result = await db('users').returning('id').insert(userData);
    const id = result[0];
    await redis.set(id, JSON.stringify(userData));
    res.status(201).send({ id, ...userData });
  } catch (err) {
    console.log(`Error: Unable to create user: ${err.message}. ${err.stack}`);
    return next(err);
  }
});

app.route('/api/users').get((req, res, next) => {
  db('users')
  .select('id', 'email', 'firstname')
  .then(users => res.status(200).send(users))
  .catch(err => {
      console.log(`Unable to fetch users: ${err.message}. ${err.stack}`);
      return next(err);
  });
});

process.on('uncaughtException', function (err) {
  console.log(err.stack);
});

try {
  console.log("Starting web server...");

  const port = process.env.PORT || 8000;
  app.listen(port, () => console.log(`Server started on: ${port}`));
} catch(error) {
  console.error(error.stack);
}

module.exports = app;
