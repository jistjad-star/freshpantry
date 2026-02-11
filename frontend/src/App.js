import "@/App.css";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider } from "@/lib/AuthContext";
import Dashboard from "@/pages/Dashboard";
import AddRecipe from "@/pages/AddRecipe";
import RecipeLibrary from "@/pages/RecipeLibrary";
import RecipeDetail from "@/pages/RecipeDetail";
import EditRecipe from "@/pages/EditRecipe";
import WeeklyPlanner from "@/pages/WeeklyPlanner";
import ShoppingList from "@/pages/ShoppingList";
import Pantry from "@/pages/Pantry";
import MealSuggestions from "@/pages/MealSuggestions";
import SharedRecipes from "@/pages/SharedRecipes";
import Cocktails from "@/pages/Cocktails";
import Login from "@/pages/Login";
import Layout from "@/components/Layout";

function AppRouter() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/share/:shareId" element={<SharedRecipes />} />
      <Route path="/" element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="add-recipe" element={<AddRecipe />} />
        <Route path="recipes" element={<RecipeLibrary />} />
        <Route path="recipes/:id" element={<RecipeDetail />} />
        <Route path="recipes/:id/edit" element={<EditRecipe />} />
        <Route path="cocktails" element={<Cocktails />} />
        <Route path="planner" element={<WeeklyPlanner />} />
        <Route path="weekly-planner" element={<WeeklyPlanner />} />
        <Route path="shopping-list" element={<ShoppingList />} />
        <Route path="pantry" element={<Pantry />} />
        <Route path="suggestions" element={<MealSuggestions />} />
      </Route>
    </Routes>
  );
}

function App() {
  return (
    <div className="App min-h-screen bg-[#FAFAF9]">
      <AuthProvider>
        <BrowserRouter>
          <AppRouter />
        </BrowserRouter>
      </AuthProvider>
      <Toaster position="bottom-right" />
    </div>
  );
}

export default App;
