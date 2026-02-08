import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export const api = {
  // Recipes
  getRecipes: () => axios.get(`${API}/recipes`),
  getRecipe: (id) => axios.get(`${API}/recipes/${id}`),
  createRecipe: (data) => axios.post(`${API}/recipes`, data),
  importRecipe: (url) => axios.post(`${API}/recipes/import`, { url }),
  deleteRecipe: (id) => axios.delete(`${API}/recipes/${id}`),

  // Shopping List
  getShoppingList: () => axios.get(`${API}/shopping-list`),
  generateShoppingList: (recipeIds) => axios.post(`${API}/shopping-list/generate`, { recipe_ids: recipeIds }),
  updateShoppingList: (items) => axios.put(`${API}/shopping-list`, { items }),
  addShoppingItem: (item) => axios.post(`${API}/shopping-list/add-item`, item),
  deleteShoppingItem: (id) => axios.delete(`${API}/shopping-list/item/${id}`),

  // Weekly Plan
  getWeeklyPlan: (weekStart) => axios.get(`${API}/weekly-plan`, { params: { week_start: weekStart } }),
  saveWeeklyPlan: (data) => axios.post(`${API}/weekly-plan`, data),
  getAllWeeklyPlans: () => axios.get(`${API}/weekly-plan/all`),
};

export default api;
