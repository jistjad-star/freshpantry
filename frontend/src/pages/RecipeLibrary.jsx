import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Search, ChefHat, Clock, Users, Trash2, PlusCircle, Loader2, Layers, Leaf, Fish, Salad, Zap, Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import api from "@/lib/api";

const CATEGORY_CONFIG = {
  'vegan': { label: 'Vegan', color: 'bg-green-100 text-green-700', icon: Leaf },
  'vegetarian': { label: 'Veggie', color: 'bg-emerald-100 text-emerald-700', icon: Salad },
  'pescatarian': { label: 'Pescatarian', color: 'bg-blue-100 text-blue-700', icon: Fish },
  'low-fat': { label: 'Low Fat', color: 'bg-pink-100 text-pink-700', icon: Heart },
  'quick-easy': { label: 'Quick & Easy', color: 'bg-amber-100 text-amber-700', icon: Zap },
  'healthy': { label: 'Healthy', color: 'bg-teal-100 text-teal-700', icon: Heart },
  'comfort-food': { label: 'Comfort', color: 'bg-orange-100 text-orange-700', icon: Heart },
  'family-friendly': { label: 'Family', color: 'bg-purple-100 text-purple-700', icon: Users },
};

export default function RecipeLibrary() {
  const [recipes, setRecipes] = useState([]);
  const [recipeGroups, setRecipeGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [viewMode, setViewMode] = useState("all"); // "all" or "grouped"

  useEffect(() => { fetchRecipes(); }, []);

  const fetchRecipes = async () => {
    try {
      const [recipesRes, groupsRes] = await Promise.all([
        api.getRecipes(),
        api.getRecipesGrouped()
      ]);
      setRecipes(recipesRes.data || []);
      setRecipeGroups(groupsRes.data?.groups || []);
    } catch (error) {
      console.error("Error fetching recipes:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      await api.deleteRecipe(id);
      setRecipes(prev => prev.filter(r => r.id !== id));
      toast.success("Recipe deleted");
    } catch (error) {
      toast.error("Failed to delete");
    }
  };

  // Get all unique categories from recipes
  const allCategories = [...new Set(recipes.flatMap(r => r.categories || []))];

  const filteredRecipes = recipes.filter(recipe => {
    const matchesSearch = recipe.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = !selectedCategory || (recipe.categories || []).includes(selectedCategory);
    return matchesSearch && matchesCategory;
  });

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 text-[#4A7C59] animate-spin" /></div>;
  }

  return (
    <div className="min-h-screen py-8" data-testid="recipe-library-page">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
          <div>
            <h1 className="font-display text-3xl font-bold text-[#1A2E1A] mb-2">Recipes</h1>
            <p className="text-stone-500">{filteredRecipes.length} of {recipes.length} recipe{recipes.length !== 1 ? 's' : ''}</p>
          </div>
          <div className="flex items-center gap-3">
            <Button 
              variant={viewMode === "grouped" ? "default" : "outline"} 
              onClick={() => setViewMode(viewMode === "grouped" ? "all" : "grouped")}
              className={viewMode === "grouped" ? "btn-secondary" : "border-stone-200"}
            >
              <Layers className="w-4 h-4 mr-2" />
              {viewMode === "grouped" ? "Show All" : "By Ingredient"}
            </Button>
            <Link to="/add-recipe">
              <Button className="btn-primary" data-testid="add-new-recipe-btn">
                <PlusCircle className="w-4 h-4 mr-2" />Add Recipe
              </Button>
            </Link>
          </div>
        </div>

        {/* Category Filters */}
        {allCategories.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-6">
            <button
              onClick={() => setSelectedCategory(null)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                !selectedCategory ? 'bg-[#4A7C59] text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
              }`}
            >
              All
            </button>
            {allCategories.map(cat => {
              const config = CATEGORY_CONFIG[cat] || { label: cat, color: 'bg-stone-100 text-stone-600' };
              const Icon = config.icon;
              return (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(selectedCategory === cat ? null : cat)}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors flex items-center gap-1.5 ${
                    selectedCategory === cat ? config.color + ' ring-2 ring-offset-1' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                  }`}
                >
                  {Icon && <Icon className="w-3.5 h-3.5" />}
                  {config.label}
                </button>
              );
            })}
          </div>
        )}

        <div className="relative mb-6">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-stone-400" />
          <Input placeholder="Search recipes..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-12 fresh-input h-12" data-testid="search-recipes-input" />
        </div>

        {/* Grouped View */}
        {viewMode === "grouped" && recipeGroups.length > 0 && (
          <div className="mb-8 space-y-4">
            <h2 className="font-display text-xl font-semibold text-[#1A2E1A] flex items-center gap-2">
              <Layers className="w-5 h-5 text-[#4A7C59]" />
              Recipes by Shared Ingredients
            </h2>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {recipeGroups.map((group, index) => (
                <div key={index} className="fresh-card-static p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="px-3 py-1 rounded-full bg-[#4A7C59]/10 text-[#4A7C59] text-sm font-medium">
                      {group.shared_ingredient}
                    </span>
                    <span className="text-xs text-stone-400">{group.count} recipes</span>
                  </div>
                  <div className="space-y-2">
                    {group.recipes.map((recipe) => (
                      <Link 
                        key={recipe.id} 
                        to={`/recipes/${recipe.id}`}
                        className="block p-2 rounded-lg hover:bg-stone-50 transition-colors text-sm text-[#1A2E1A] hover:text-[#4A7C59]"
                      >
                        {recipe.name}
                      </Link>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* All Recipes View */}
        {(viewMode === "all" || recipeGroups.length === 0) && filteredRecipes.length > 0 ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredRecipes.map((recipe) => (
              <div key={recipe.id} className="fresh-card overflow-hidden group" data-testid={`recipe-card-${recipe.id}`}>
                <Link to={`/recipes/${recipe.id}`}>
                  {recipe.image_url ? (
                    <div className="h-48 bg-cover bg-center transition-transform duration-300 group-hover:scale-105" style={{ backgroundImage: `url(${recipe.image_url})` }} />
                  ) : (
                    <div className="h-48 bg-stone-100 flex items-center justify-center">
                      <ChefHat className="w-16 h-16 text-stone-300" />
                    </div>
                  )}
                </Link>
                <div className="p-6">
                  <Link to={`/recipes/${recipe.id}`}>
                    <h3 className="font-semibold text-lg text-[#1A2E1A] group-hover:text-[#4A7C59] transition-colors line-clamp-1 mb-2">{recipe.name}</h3>
                  </Link>
                  <div className="flex items-center gap-4 text-sm text-stone-500 mb-4">
                    <div className="flex items-center gap-1"><Users className="w-4 h-4" /><span>{recipe.servings}</span></div>
                    {recipe.prep_time && <div className="flex items-center gap-1"><Clock className="w-4 h-4" /><span>{recipe.prep_time}</span></div>}
                    <span className="text-[#4A7C59]">{recipe.ingredients?.length || 0} ingredients</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <Link to={`/recipes/${recipe.id}`}>
                      <Button variant="outline" size="sm" className="border-stone-200">View Recipe</Button>
                    </Link>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="sm" className="text-stone-400 hover:text-[#E07A5F]"><Trash2 className="w-4 h-4" /></Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent className="bg-white">
                        <AlertDialogHeader>
                          <AlertDialogTitle className="text-[#1A2E1A]">Delete Recipe?</AlertDialogTitle>
                          <AlertDialogDescription className="text-stone-500">This will permanently delete "{recipe.name}".</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel className="border-stone-200">Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleDelete(recipe.id)} className="bg-[#E07A5F] text-white hover:bg-[#D06A4F]">Delete</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : viewMode === "all" && (
          <div className="fresh-card-static p-12 text-center">
            <ChefHat className="w-16 h-16 text-stone-300 mx-auto mb-4" />
            <h3 className="font-display text-xl font-semibold text-[#1A2E1A] mb-2">{searchQuery ? "No recipes found" : "No recipes yet"}</h3>
            <p className="text-stone-500 mb-6">{searchQuery ? "Try a different search" : "Add your first recipe"}</p>
            {!searchQuery && <Link to="/add-recipe"><Button className="btn-primary"><PlusCircle className="w-4 h-4 mr-2" />Add Recipe</Button></Link>}
          </div>
        )}
      </div>
    </div>
  );
}
