const mongoose = require('mongoose');

mongoose.Promise = global.Promise;
const { Schema } = mongoose;

const schema = new Schema(
  {
    name: { type: String, unique: true },
    avatar: { type: String },
    description: { type: String },
    type: { type: String, enum: ['pizza', 'salad', 'dessert'] },
    ingredients: [
      {
        ingredient: { type: Schema.Types.ObjectId, ref: 'Ingredient' },
        amount: { type: Number },
      },
    ],
    components: [{ type: Schema.Types.ObjectId, ref: 'Component' }],
    price: { type: Number },
    // raw weight can be calculated but cooked needs to be measured
    weight: { raw: { type: Number }, cooked: { type: Number } },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Recipe', schema);
