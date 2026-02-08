import "@/App.css";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider } from "@/lib/AuthContext";
import Dashboard from "@/pages/Dashboard";
import AddRecipe from "@/pages/AddRecipe";
import RecipeLibrary from "@/pages/RecipeLibrary";
import RecipeDetail from "@/pages/RecipeDetail";
import WeeklyPlanner from "@/pages/WeeklyPlanner";
import ShoppingList from "@/pages/ShoppingList";
import Login from "@/pages/Login";
import AuthCallback from "@/pages/AuthCallback";
import Layout from "@/components/Layout";

function AppRouter() {
  const location = useLocation();
  
  // Check for session_id in URL fragment (auth callback)
  if (location.hash?.includes('session_id=')) {
    return <AuthCallback />;
  }

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/auth/callback" element={<AuthCallback />} />
      <Route path="/" element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="add-recipe" element={<AddRecipe />} />
        <Route path="recipes" element={<RecipeLibrary />} />
        <Route path="recipes/:id" element={<RecipeDetail />} />
        <Route path="weekly-planner" element={<WeeklyPlanner />} />
        <Route path="shopping-list" element={<ShoppingList />} />
      </Route>
    </Routes>
  );
}

function App() {
  return (
    <div className="App min-h-screen bg-[#050505] noise-overlay">
      <AuthProvider>
        <BrowserRouter>
          <AppRouter />
        </BrowserRouter>
      </AuthProvider>
      <Toaster position="bottom-right" theme="dark" />
    </div>
  );
}

export default App;
