import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Configure axios to send cookies
axios.defaults.withCredentials = true;

export const api = {
  // Auth
  createSession: (sessionId) => axios.post(`${API}/auth/session`, { session_id: sessionId }),
  getMe: () => axios.get(`${API}/auth/me`),
  logout: () => axios.post(`${API}/auth/logout`),

  // Recipes
  getRecipes: () => axios.get(`${API}/recipes`),
  getRecipe: (id) => axios.get(`${API}/recipes/${id}`),
  getRecipesGrouped: () => axios.get(`${API}/recipes/grouped`),
  createRecipe: (data) => axios.post(`${API}/recipes`, data),
  updateRecipe: (id, data) => axios.put(`${API}/recipes/${id}`, data),
  importRecipe: (url) => axios.post(`${API}/recipes/import`, { url }),
  deleteRecipe: (id) => axios.delete(`${API}/recipes/${id}`),
  generateRecipeImage: (id) => axios.post(`${API}/recipes/${id}/generate-image`),
  updateRecipeCategories: (id, categories) => axios.put(`${API}/recipes/${id}/categories`, { categories }),
  exportRecipes: (recipeIds) => axios.post(`${API}/recipes/export`, { recipe_ids: recipeIds }),
  importRecipes: (recipes) => axios.post(`${API}/recipes/import-batch`, { recipes }),
  
  // Parse ingredients
  parseIngredients: (recipeName, ingredientsText, instructionsText = "") => 
    axios.post(`${API}/parse-ingredients`, { 
      recipe_name: recipeName, 
      ingredients_text: ingredientsText,
      instructions_text: instructionsText
    }),
  
  // Parse image
  parseImage: (file) => {
    const formData = new FormData();
    formData.append('file', file);
    return axios.post(`${API}/parse-image`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
  },

  // Parse instructions image
  parseInstructionsImage: (file) => {
    const formData = new FormData();
    formData.append('file', file);
    return axios.post(`${API}/parse-instructions-image`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
  },

  // Shopping List
  getShoppingList: () => axios.get(`${API}/shopping-list`),
  generateShoppingList: (recipeIds) => axios.post(`${API}/shopping-list/generate`, { recipe_ids: recipeIds }),
  updateShoppingList: (items) => axios.put(`${API}/shopping-list`, { items }),
  addShoppingItem: (item) => axios.post(`${API}/shopping-list/add-item`, item),
  deleteShoppingItem: (id) => axios.delete(`${API}/shopping-list/item/${id}`),
  estimateShoppingCosts: () => axios.get(`${API}/shopping-list/estimate-costs`),

  // Weekly Plan
  getWeeklyPlan: (weekStart) => axios.get(`${API}/weekly-plan`, { params: { week_start: weekStart } }),
  saveWeeklyPlan: (data) => axios.post(`${API}/weekly-plan`, data),
  getAllWeeklyPlans: () => axios.get(`${API}/weekly-plan/all`),

  // Pantry/Inventory
  getPantry: () => axios.get(`${API}/pantry`),
  addPantryItem: (item) => axios.post(`${API}/pantry/items`, item),
  updatePantryItem: (id, data) => axios.put(`${API}/pantry/items/${id}`, data),
  deletePantryItem: (id) => axios.delete(`${API}/pantry/items/${id}`),
  cookRecipe: (recipeId, servingsMultiplier = 1) => axios.post(`${API}/pantry/cook`, { recipe_id: recipeId, servings_multiplier: servingsMultiplier }),
  getLowStockItems: () => axios.get(`${API}/pantry/low-stock`),
  addFromShopping: () => axios.post(`${API}/pantry/add-from-shopping`),

  // Meal Suggestions
  getMealSuggestions: () => axios.get(`${API}/suggestions/meals`),
  generateAIRecipe: () => axios.post(`${API}/suggestions/generate-recipe`),
};

export default api;
