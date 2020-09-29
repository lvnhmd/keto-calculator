const mongoose = require('mongoose');

mongoose.Promise = global.Promise;
const { Schema } = mongoose;

const schema = new Schema(
  {
    name: { type: String, unique: true },
    ingredients: [
      {
        ingredient: { type: Schema.Types.ObjectId, ref: 'Ingredient' },
        amount: { type: Number },
      },
    ]
  },
  { timestamps: true }
);

module.exports = mongoose.model('Component', schema);
