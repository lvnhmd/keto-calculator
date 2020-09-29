const express = require('express');
const bodyParser = require('body-parser');
const db = require('./schema');
const cors = require('cors');
const { ObjectId } = require('mongoose').Types;
const { groupBy, prop, compose, sortBy, toLower } = require('ramda');
var jsondiffpatch = require('jsondiffpatch');

const app = express();
app.use(cors());

app.use(
  bodyParser.urlencoded({
    // to support URL-encoded bodies
    extended: true,
  })
);

app.use(bodyParser.json());

const models = db({
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
});

app.engine('html', require('ejs').renderFile);
app.set('view engine', 'ejs');

function calculateOneIngredientNutritionForAmount(ingredient) {
  const { amount } = ingredient;
  const { energy, fat, carbs, protein, serving } = ingredient.ingredient;

  const nutritionForAmount = {
    energy: (energy / serving) * amount,
    fat: (fat / serving) * amount,
    carbs: (carbs / serving) * amount,
    protein: (protein / serving) * amount,
  };

  return nutritionForAmount;
}

function calculateOneComponentNutrition(component) {
  const nutrition = Object.values({
    ...component.ingredients.map((ing) => ({
      ...ing.nutrition,
    })),
  }).reduce((a, cv) => ({
    energy: a.energy + cv.energy,
    fat: a.fat + cv.fat,
    carbs: a.carbs + cv.carbs,
    protein: a.protein + cv.protein,
  }));

  return nutrition;
}

function calculateAllComponentsNutrition(components) {
  return components
    .map((c) => ({
      ...c,
      ingredients: c.ingredients.map((i) => ({
        ...i,
        nutrition: calculateOneIngredientNutritionForAmount(i),
      })),
    }))
    .map((component) => ({
      ...component,
      nutrition: calculateOneComponentNutrition(component),
    }));
}

app.get('/ingredients', async function (req, res) {
  const { Ingredient } = models;

  const ingredients = await Ingredient.find().lean();
  // group by category and order by name
  const sortByNameCaseInsensitive = sortBy(compose(toLower, prop('name')));
  const byCategory = groupBy(
    prop('category'),
    sortByNameCaseInsensitive(ingredients)
  );

  return res.status(200).json({
    ingredients: byCategory,
  });
});

app.get('/components', async function (req, res) {
  const { Component } = models;

  const components = await Component.find()
    .populate('ingredients.ingredient')
    .lean();
  return res.status(200).json({
    components: calculateAllComponentsNutrition(components),
  });
});

app.get('/recipes', async function (req, res) {
  const { Ingredient, Recipe } = models;

  let recipes = await Recipe.find()
    .populate('ingredients.ingredient')
    .populate('components')
    .lean();

  // populate the ingredients of the components as they do not get populated by mongoose
  const promises = recipes.map(async (r) => {
    const promises = r.components.map(async (c) => {
      const promises = c.ingredients.map(async (i) => {
        let doc = await Ingredient.findById(i.ingredient).lean();
        return { ...i, ingredient: doc };
      });
      const result = await Promise.all(promises);
      return { ...c, ingredients: result };
    });
    const result = await Promise.all(promises);
    return { ...r, components: result };
  });

  recipes = await Promise.all(promises);

  recipes = recipes.map((r) => ({
    ...r,
    ingredients: r.ingredients.map((i) => ({
      ...i,
      nutrition: calculateOneIngredientNutritionForAmount(i),
    })),
    components: calculateAllComponentsNutrition(r.components),
  }));

  // calculate total recipe nutrition for each of the recipes
  for (let i = 0; i < recipes.length; i++) {
    const ingNut = Object.values({
      ...recipes[i].ingredients.map((ing) => ({
        ...ing.nutrition,
      })),
    }).reduce((a, cv) => ({
      energy: a.energy + cv.energy,
      fat: a.fat + cv.fat,
      carbs: a.carbs + cv.carbs,
      protein: a.protein + cv.protein,
    }));

    let compNut = {
      energy: 0,
      fat: 0,
      carbs: 0,
      protein: 0,
    };

    if (recipes[i].components.length) {
      compNut = Object.values({
        ...recipes[i].components.map((ing) => ({
          ...ing.nutrition,
        })),
      }).reduce((a, cv) => ({
        energy: a.energy + cv.energy,
        fat: a.fat + cv.fat,
        carbs: a.carbs + cv.carbs,
        protein: a.protein + cv.protein,
      }));
    }

    recipes[i].nutrition = {
      energy: Number(ingNut.energy + compNut.energy).toFixed(2),
      fat: Number(ingNut.fat + compNut.fat).toFixed(2),
      carbs: Number(ingNut.carbs + compNut.carbs).toFixed(2),
      protein: Number(ingNut.protein + compNut.protein).toFixed(2),
    };
  }

  return res.status(200).json({
    recipes,
  });
});

app.post('/ingredient', async function (req, res) {
  const { Ingredient } = models;
  const {
    name,
    serving,
    energy,
    fat,
    carbs,
    protein,
    price,
    packageSize,
  } = req.body;

  await Ingredient.create({
    name,
    serving,
    energy,
    fat,
    carbs,
    protein,
    price,
    packageSize,
  });

  res.redirect('/');
});

app.put('/component/:componentId', async function (req, res) {
  const { componentId } = req.params;
  const { Component } = models;
  
  const component = await Component.findById({ _id: componentId }).lean();

  const updateIngredients = req.body.map((i) => ({
    _id: i.id.startsWith('temp-') ? undefined : i.id,
    amount: Number(i.amount),
    ingredient: i.ingredient._id
  }));

  const delta = jsondiffpatch.diff(component.ingredients, updateIngredients);
  const patched = [...component.ingredients];

  jsondiffpatch.patch(patched, delta);
  
  const update = await Component.findOneAndUpdate(
    { _id: componentId },
    {
      $set: {
        'ingredients': patched,
      },
    },
    { new: true }
  );

  return res.status(200);
});

app.post('/recipe', async function (req, res) {
  const { Recipe } = models;
  const {
    recipeName: name,
    recipeComponents,
    recipeIngredients: ingredients,
    recipeAmounts: amounts,
  } = req.body;

  const ings = [];
  const comps = [];

  for (let i = 0; i < ingredients.length; i++) {
    ingredients[i] !== 'Select' &&
      ings.push({
        ingredient: new ObjectId(ingredients[i]),
        amount: amounts[i],
      });
  }

  for (let i = 0; i < recipeComponents.length; i++) {
    recipeComponents[i] !== 'Select' &&
      comps.push(new ObjectId(recipeComponents[i]));
  }

  await Recipe.create({
    name,
    ingredients: ings,
    components: comps,
  });

  res.redirect('/');
});

// Listen for incoming requests and serve them.
app.listen(process.env.PORT || 8080);
