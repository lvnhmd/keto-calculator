const mongoose = require('mongoose');


const Ingredient = require('./ingredient');
const Component = require('./component');
const Recipe = require('./recipe');

const dbPath = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@${process.env.DB_HOST}/${process.env.DB_NAME}`;

mongoose.connect(dbPath, {
  useUnifiedTopology: true,
  useNewUrlParser: true,
  useFindAndModify: false,
  useCreateIndex: true,
});
const db = mongoose.connection;
db.on('error', (err) => {
  console.log(err);
});
db.once('open', () => {
  console.log(`> Connected to ${process.env.DB_HOST}`);
});

module.exports = () => ({
  Ingredient,
  Component,
  Recipe
});
