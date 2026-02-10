import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { Search, ChefHat, Clock, Users, Trash2, PlusCircle, Loader2, Layers, Leaf, Fish, Salad, Zap, Heart, Share2, Upload, Check, Star, ArrowUpDown, Coffee, Sun, Moon, Cookie, Filter, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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

const MEAL_TYPE_CONFIG = {
  'breakfast': { label: 'Breakfast', color: 'bg-yellow-100 text-yellow-700', icon: Coffee, keywords: ['breakfast', 'pancake', 'egg', 'omelette', 'toast', 'porridge', 'cereal', 'smoothie', 'muffin', 'waffle', 'bacon', 'sausage', 'hash'] },
  'lunch': { label: 'Lunch', color: 'bg-sky-100 text-sky-700', icon: Sun, keywords: ['lunch', 'sandwich', 'salad', 'soup', 'wrap', 'bowl', 'panini', 'quesadilla'] },
  'dinner': { label: 'Dinner', color: 'bg-indigo-100 text-indigo-700', icon: Moon, keywords: ['dinner', 'roast', 'steak', 'curry', 'pasta', 'stir fry', 'casserole', 'pie', 'lasagna', 'risotto', 'tagine', 'chili'] },
  'snack': { label: 'Snack', color: 'bg-rose-100 text-rose-700', icon: Cookie, keywords: ['snack', 'cookie', 'cake', 'bar', 'dip', 'nuts', 'fruit', 'chips', 'popcorn', 'brownie', 'biscuit'] },
};

export default function RecipeLibrary() {
  const [recipes, setRecipes] = useState([]);
  const [recipeGroups, setRecipeGroups] = useState([]);
  const [favorites, setFavorites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [selectedMealType, setSelectedMealType] = useState(null);
  const [viewMode, setViewMode] = useState("all");
  const [showFavorites, setShowFavorites] = useState(false);
  const [sortBy, setSortBy] = useState(null);
  const [selectedForExport, setSelectedForExport] = useState([]);
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => { fetchRecipes(); }, [sortBy]);

  const fetchRecipes = async () => {
    try {
      const [recipesRes, groupsRes, favoritesRes] = await Promise.all([
        api.getRecipes(sortBy),
        api.getRecipesGrouped(),
        api.getFavorites().catch(() => ({ data: { favorites: [] } }))
      ]);
      setRecipes(recipesRes.data || []);
      setRecipeGroups(groupsRes.data?.groups || []);
      setFavorites(favoritesRes.data?.favorites || []);
    } catch (error) {
      console.error("Error fetching recipes:", error);
    } finally {
      setLoading(false);
    }
  };

  const toggleFavorite = async (recipeId, e) => {
    e.preventDefault();
    e.stopPropagation();
    
    const isFavorite = favorites.includes(recipeId);
    try {
      if (isFavorite) {
        await api.removeFavorite(recipeId);
        setFavorites(prev => prev.filter(id => id !== recipeId));
      } else {
        await api.addFavorite(recipeId);
        setFavorites(prev => [...prev, recipeId]);
      }
    } catch (error) {
      toast.error("Failed to update favorite");
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

  const toggleExportSelection = (recipeId) => {
    setSelectedForExport(prev => 
      prev.includes(recipeId) 
        ? prev.filter(id => id !== recipeId)
        : [...prev, recipeId]
    );
  };

  const exportRecipes = async () => {
    if (selectedForExport.length === 0) {
      toast.error("Select recipes to share");
      return;
    }
    
    setExporting(true);
    try {
      const response = await api.createShareLink(selectedForExport);
      const shareUrl = `${window.location.origin}/share/${response.data.share_id}`;
      
      // Copy to clipboard
      await navigator.clipboard.writeText(shareUrl);
      toast.success(`Share link copied! ${response.data.recipe_count} recipes`, {
        description: shareUrl,
        duration: 5000
      });
      setSelectedForExport([]);
    } catch (error) {
      toast.error("Failed to create share link");
    } finally {
      setExporting(false);
    }
  };

  const handleFileImport = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setImporting(true);
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      
      if (!data.recipes || !Array.isArray(data.recipes)) {
        throw new Error("Invalid file format");
      }
      
      const response = await api.importRecipes(data.recipes);
      toast.success(`Imported ${response.data.count} recipes!`);
      fetchRecipes();
    } catch (error) {
      console.error("Import error:", error);
      toast.error("Failed to import. Check file format.");
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Get all unique categories from recipes
  const allCategories = [...new Set(recipes.flatMap(r => r.categories || []))];

  // Infer meal type from recipe name
  const getRecipeMealType = (recipe) => {
    const nameLower = recipe.name.toLowerCase();
    for (const [type, config] of Object.entries(MEAL_TYPE_CONFIG)) {
      if (config.keywords.some(kw => nameLower.includes(kw))) {
        return type;
      }
    }
    return null;
  };

  const filteredRecipes = recipes.filter(recipe => {
    const matchesSearch = recipe.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = !selectedCategory || (recipe.categories || []).includes(selectedCategory);
    const matchesFavorites = !showFavorites || favorites.includes(recipe.id);
    const matchesMealType = !selectedMealType || getRecipeMealType(recipe) === selectedMealType;
    return matchesSearch && matchesCategory && matchesFavorites && matchesMealType;
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
          <div className="flex items-center gap-3 flex-wrap">
            {/* Favorites filter */}
            <button
              onClick={() => setShowFavorites(!showFavorites)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors border ${
                showFavorites 
                  ? 'bg-red-50 border-red-200 text-red-600' 
                  : 'bg-white border-stone-200 text-stone-500 hover:border-red-200 hover:text-red-500'
              }`}
              data-testid="favorites-filter-btn"
            >
              <Heart className={`w-4 h-4 ${showFavorites ? 'fill-red-500' : ''}`} />
              Favorites {favorites.length > 0 && `(${favorites.length})`}
            </button>
            
            {/* Sort dropdown */}
            <div className="flex items-center gap-1.5 bg-stone-50 rounded-lg p-1 border border-stone-200">
              <button
                onClick={() => setSortBy(null)}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  !sortBy ? 'bg-white shadow-sm text-[#1A2E1A]' : 'text-stone-500 hover:text-stone-700'
                }`}
                data-testid="sort-default-btn"
              >
                Default
              </button>
              <button
                onClick={() => setSortBy("popularity")}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors flex items-center gap-1.5 ${
                  sortBy === "popularity" ? 'bg-amber-100 shadow-sm text-amber-700' : 'text-stone-500 hover:text-stone-700'
                }`}
                data-testid="sort-popularity-btn"
              >
                <Star className="w-3.5 h-3.5" />
                Top Rated
              </button>
              <button
                onClick={() => setSortBy("newest")}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  sortBy === "newest" ? 'bg-white shadow-sm text-[#1A2E1A]' : 'text-stone-500 hover:text-stone-700'
                }`}
                data-testid="sort-newest-btn"
              >
                Newest
              </button>
            </div>
            {/* Export/Import buttons */}
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileImport}
              accept=".json"
              className="hidden"
            />
            <Button 
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={importing}
              className="border-stone-200"
              data-testid="import-recipes-btn"
            >
              {importing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Upload className="w-4 h-4 mr-2" />}
              Import
            </Button>
            {selectedForExport.length > 0 && (
              <Button 
                variant="outline"
                onClick={exportRecipes}
                disabled={exporting}
                className="border-[#4A7C59] text-[#4A7C59]"
                data-testid="export-recipes-btn"
              >
                {exporting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Share2 className="w-4 h-4 mr-2" />}
                Share ({selectedForExport.length})
              </Button>
            )}
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

        {/* Meal Type Filters */}
        <div className="flex flex-wrap gap-2 mb-4">
          <span className="text-sm text-stone-500 self-center mr-2">Meal:</span>
          <button
            onClick={() => setSelectedMealType(null)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
              !selectedMealType ? 'bg-[#4A7C59] text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
            }`}
            data-testid="meal-filter-all"
          >
            All
          </button>
          {Object.entries(MEAL_TYPE_CONFIG).map(([type, config]) => {
            const Icon = config.icon;
            return (
              <button
                key={type}
                onClick={() => setSelectedMealType(selectedMealType === type ? null : type)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors flex items-center gap-1.5 ${
                  selectedMealType === type ? config.color + ' ring-2 ring-offset-1' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                }`}
                data-testid={`meal-filter-${type}`}
              >
                {Icon && <Icon className="w-3.5 h-3.5" />}
                {config.label}
              </button>
            );
          })}
        </div>

        {/* Category Filters */}
        {allCategories.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-6">
            <span className="text-sm text-stone-500 self-center mr-2">Diet:</span>
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
            {filteredRecipes.map((recipe) => {
              const isFavorite = favorites.includes(recipe.id);
              return (
              <div key={recipe.id} className="fresh-card overflow-hidden group" data-testid={`recipe-card-${recipe.id}`}>
                <Link to={`/recipes/${recipe.id}`}>
                  {recipe.image_url ? (
                    <div className="h-48 bg-cover bg-center transition-transform duration-300 group-hover:scale-105 relative" style={{ backgroundImage: `url(${recipe.image_url})` }}>
                      {/* Favorite button */}
                      <button
                        onClick={(e) => toggleFavorite(recipe.id, e)}
                        className="absolute top-2 right-2 w-8 h-8 rounded-full bg-white/90 flex items-center justify-center shadow-sm hover:bg-white transition-colors"
                        data-testid={`favorite-btn-${recipe.id}`}
                      >
                        <Heart className={`w-4 h-4 ${isFavorite ? 'fill-red-500 text-red-500' : 'text-stone-400'}`} />
                      </button>
                      {/* Category badges on image */}
                      {recipe.categories?.length > 0 && (
                        <div className="absolute top-2 left-2 flex flex-wrap gap-1">
                          {recipe.categories.slice(0, 2).map(cat => {
                            const config = CATEGORY_CONFIG[cat] || { label: cat, color: 'bg-stone-100 text-stone-600' };
                            return (
                              <span key={cat} className={`px-2 py-0.5 rounded-full text-xs font-medium ${config.color} shadow-sm`}>
                                {config.label}
                              </span>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="h-48 bg-stone-100 flex items-center justify-center relative">
                      <ChefHat className="w-16 h-16 text-stone-300" />
                      {/* Favorite button */}
                      <button
                        onClick={(e) => toggleFavorite(recipe.id, e)}
                        className="absolute top-2 right-2 w-8 h-8 rounded-full bg-white/90 flex items-center justify-center shadow-sm hover:bg-white transition-colors"
                        data-testid={`favorite-btn-${recipe.id}`}
                      >
                        <Heart className={`w-4 h-4 ${isFavorite ? 'fill-red-500 text-red-500' : 'text-stone-400'}`} />
                      </button>
                      {/* Category badges */}
                      {recipe.categories?.length > 0 && (
                        <div className="absolute top-2 left-2 flex flex-wrap gap-1">
                          {recipe.categories.slice(0, 2).map(cat => {
                            const config = CATEGORY_CONFIG[cat] || { label: cat, color: 'bg-stone-100 text-stone-600' };
                            return (
                              <span key={cat} className={`px-2 py-0.5 rounded-full text-xs font-medium ${config.color}`}>
                                {config.label}
                              </span>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </Link>
                <div className="p-6">
                  <Link to={`/recipes/${recipe.id}`}>
                    <h3 className="font-semibold text-lg text-[#1A2E1A] group-hover:text-[#4A7C59] transition-colors line-clamp-1 mb-2">{recipe.name}</h3>
                  </Link>
                  <div className="flex items-center gap-4 text-sm text-stone-500 mb-4">
                    <div className="flex items-center gap-1"><Users className="w-4 h-4" /><span>{recipe.servings}</span></div>
                    {(recipe.prep_time || recipe.cook_time) && (
                      <div className="flex items-center gap-1">
                        <Clock className="w-4 h-4" />
                        <span>
                          {(() => {
                            const prep = parseInt(recipe.prep_time) || 0;
                            const cook = parseInt(recipe.cook_time) || 0;
                            const total = prep + cook;
                            return total > 0 ? `${total} min` : recipe.prep_time || recipe.cook_time;
                          })()}
                        </span>
                      </div>
                    )}
                    <span className="text-[#4A7C59]">{recipe.ingredients?.length || 0} ingredients</span>
                  </div>
                  {/* Rating display */}
                  {recipe.review_count > 0 && (
                    <div className="flex items-center gap-2 mb-4 text-sm">
                      <div className="flex items-center">
                        {[1, 2, 3, 4, 5].map(star => (
                          <Star 
                            key={star}
                            className={`w-3.5 h-3.5 ${
                              star <= Math.round(recipe.average_rating || 0)
                                ? 'text-amber-400 fill-amber-400'
                                : 'text-stone-300'
                            }`}
                          />
                        ))}
                      </div>
                      <span className="text-stone-500">
                        {recipe.average_rating?.toFixed(1)} ({recipe.review_count})
                      </span>
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={(e) => { e.preventDefault(); toggleExportSelection(recipe.id); }}
                        className={`w-6 h-6 rounded border-2 flex items-center justify-center transition-colors ${
                          selectedForExport.includes(recipe.id)
                            ? 'bg-[#4A7C59] border-[#4A7C59] text-white'
                            : 'border-stone-300 hover:border-[#4A7C59]'
                        }`}
                        data-testid={`export-select-${recipe.id}`}
                      >
                        {selectedForExport.includes(recipe.id) && <Check className="w-4 h-4" />}
                      </button>
                      <Link to={`/recipes/${recipe.id}`}>
                        <Button variant="outline" size="sm" className="border-stone-200" data-testid="view-recipe-btn">View Recipe</Button>
                      </Link>
                    </div>
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
            );})}
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
