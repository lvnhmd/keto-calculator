const mongoose = require('mongoose');

mongoose.Promise = global.Promise;
const { Schema } = mongoose;

const schema = new Schema(
  {
    name: { type: String, unique: true },
    serving: { type: Number },
    energy: { type: Number },
    fat: { type: Number },
    carbs: { type: Number },
    protein: { type: Number },
    price: { type: Number },
    packageSize: { type: Number },
    category: [
      'flour',
      'eggs',
      'cheese',
      'meat',
      'vegetables',
      'pickles',
      'fish',
      'salad',
      'condiment',
      'seed',
      'nuts',
      'fruit',
      'milk',
      'sweeteners'
    ],
  },
  { timestamps: true }
);

module.exports = mongoose.model('Ingredient', schema);
