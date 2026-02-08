import "@/App.css";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import Dashboard from "@/pages/Dashboard";
import AddRecipe from "@/pages/AddRecipe";
import RecipeLibrary from "@/pages/RecipeLibrary";
import RecipeDetail from "@/pages/RecipeDetail";
import WeeklyPlanner from "@/pages/WeeklyPlanner";
import ShoppingList from "@/pages/ShoppingList";
import Layout from "@/components/Layout";

function App() {
  return (
    <div className="App min-h-screen bg-[#050505] noise-overlay">
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<Dashboard />} />
            <Route path="add-recipe" element={<AddRecipe />} />
            <Route path="recipes" element={<RecipeLibrary />} />
            <Route path="recipes/:id" element={<RecipeDetail />} />
            <Route path="weekly-planner" element={<WeeklyPlanner />} />
            <Route path="shopping-list" element={<ShoppingList />} />
          </Route>
        </Routes>
      </BrowserRouter>
      <Toaster position="bottom-right" theme="dark" />
    </div>
  );
}

export default App;
