import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { 
  Sparkles, 
  ChefHat, 
  Loader2, 
  CheckCircle2, 
  AlertCircle,
  ArrowRight,
  RefreshCw,
  Calendar,
  Wand2,
  Save,
  Coffee,
  Sun,
  Moon,
  Cookie,
  UtensilsCrossed,
  Clock,
  Users,
  CalendarClock,
  Layers
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import api from "@/lib/api";

const MEAL_TYPES = [
  { value: "all", label: "All", icon: UtensilsCrossed },
  { value: "breakfast", label: "Breakfast", icon: Coffee },
  { value: "lunch", label: "Lunch", icon: Sun },
  { value: "dinner", label: "Dinner", icon: Moon },
  { value: "snack", label: "Snack", icon: Cookie },
];

// Get meal type based on current time
const getMealTypeByTime = () => {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 11) return "breakfast";
  if (hour >= 11 && hour < 15) return "lunch";
  if (hour >= 15 && hour < 18) return "snack";
  return "dinner";
};

export default function MealSuggestions() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [suggestions, setSuggestions] = useState([]);
  const [message, setMessage] = useState("");
  const [mealTypeFilter, setMealTypeFilter] = useState(getMealTypeByTime());
  const [expiringSoonFilter, setExpiringSoonFilter] = useState(false);
  
  // AI Generated Recipe State
  const [generatingRecipe, setGeneratingRecipe] = useState(false);
  const [generatedRecipe, setGeneratedRecipe] = useState(null);
  const [savingRecipe, setSavingRecipe] = useState(false);

  const fetchSuggestions = async (mealType = "all", expiringSoon = false) => {
    setLoading(true);
    try {
      const response = await api.getMealSuggestions(
        mealType !== "all" ? mealType : null,
        expiringSoon
      );
      setSuggestions(response.data.suggestions || []);
      setMessage(response.data.message || "");
    } catch (error) {
      console.error("Error fetching suggestions:", error);
      toast.error("Failed to get meal suggestions");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Auto-generate a recipe on first load
    generateAIRecipe();
    fetchSuggestions(mealTypeFilter, expiringSoonFilter);
  }, []);

  useEffect(() => {
    fetchSuggestions(mealTypeFilter, expiringSoonFilter);
    // Regenerate AI recipe when filter changes
    generateAIRecipe();
  }, [mealTypeFilter, expiringSoonFilter]);

  const generateAIRecipe = async () => {
    setGeneratingRecipe(true);
    setGeneratedRecipe(null);
    try {
      const response = await api.generateAIRecipe(
        mealTypeFilter !== "all" ? mealTypeFilter : getMealTypeByTime(),
        expiringSoonFilter  // Pass the expiring filter
      );
      setGeneratedRecipe(response.data.recipe);
      if (expiringSoonFilter && response.data.recipe) {
        toast.success("Recipe created using your expiring ingredients!");
      }
    } catch (error) {
      console.error("Error generating recipe:", error);
      if (error.response?.data?.detail?.includes("pantry")) {
        toast.error("Add items to your pantry first!");
      } else if (error.response?.data?.detail?.includes("expiring")) {
        toast.info("No ingredients expiring soon - your pantry is fresh!");
      }
    } finally {
      setGeneratingRecipe(false);
    }
  };

  const saveGeneratedRecipe = async () => {
    if (!generatedRecipe) return;
    setSavingRecipe(true);
    try {
      const recipeData = {
        name: generatedRecipe.name,
        description: generatedRecipe.description,
        servings: generatedRecipe.servings || 4,
        prep_time: generatedRecipe.prep_time,
        cook_time: generatedRecipe.cook_time,
        ingredients: generatedRecipe.ingredients?.map(ing => ({
          name: ing.name,
          quantity: String(ing.quantity),
          unit: ing.unit || "",
          category: ing.category || "other"
        })) || [],
        instructions: generatedRecipe.instructions || [],
        categories: generatedRecipe.categories || []
      };
      const response = await api.createRecipe(recipeData);
      toast.success("Recipe saved to your library!");
      navigate(`/recipes/${response.data.id}`);
    } catch (error) {
      toast.error("Failed to save recipe");
    } finally {
      setSavingRecipe(false);
    }
  };

  const getMealIcon = (type) => {
    const meal = MEAL_TYPES.find(m => m.value === type);
    return meal?.icon || UtensilsCrossed;
  };

  const currentMealType = MEAL_TYPES.find(m => m.value === mealTypeFilter) || MEAL_TYPES[0];
  const MealIcon = currentMealType.icon;

  return (
    <div className="min-h-screen py-8" data-testid="meal-suggestions-page">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-6">
          <h1 className="font-display text-3xl font-bold text-[#1A2E1A] mb-2 flex items-center gap-3">
            <Sparkles className="w-8 h-8 text-orange-500" />
            What to Eat Now
          </h1>
          <p className="text-stone-500">
            AI-powered meal ideas based on your pantry
          </p>
        </div>

        {/* Meal Type Filters */}
        <div className="flex flex-wrap items-center gap-2 mb-6" data-testid="meal-type-filters">
          {MEAL_TYPES.map(type => {
            const Icon = type.icon;
            const isActive = mealTypeFilter === type.value;
            return (
              <button
                key={type.value}
                onClick={() => {
                  setMealTypeFilter(type.value);
                  if (type.value !== "all") generateAIRecipe();
                }}
                className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all ${
                  isActive 
                    ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-md' 
                    : 'bg-white border border-stone-200 text-stone-600 hover:border-orange-300 hover:text-orange-600'
                }`}
                data-testid={`filter-${type.value}`}
              >
                <Icon className="w-4 h-4" />
                {type.label}
              </button>
            );
          })}
          
          {/* Expiring Soon Toggle */}
          <div className="h-6 w-px bg-stone-200 mx-2" />
          <button
            onClick={() => setExpiringSoonFilter(!expiringSoonFilter)}
            className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all ${
              expiringSoonFilter 
                ? 'bg-gradient-to-r from-red-500 to-orange-500 text-white shadow-md' 
                : 'bg-white border border-stone-200 text-stone-600 hover:border-red-300 hover:text-red-600'
            }`}
            data-testid="filter-expiring-soon"
          >
            <CalendarClock className="w-4 h-4" />
            Use Expiring
          </button>
        </div>

        {/* AI Generated Recipe - Main Feature */}
        <div className="mb-8">
          <div className="fresh-card-static p-6 bg-gradient-to-br from-orange-50 to-amber-50 border-orange-200" data-testid="ai-recipe-card">
            {generatingRecipe ? (
              <div className="flex flex-col items-center justify-center py-12">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-orange-400 to-amber-500 flex items-center justify-center mb-4 animate-pulse">
                  <Wand2 className="w-8 h-8 text-white" />
                </div>
                <p className="text-orange-600 font-medium">Creating your perfect {currentMealType.label.toLowerCase()}...</p>
                <Loader2 className="w-6 h-6 animate-spin text-orange-500 mt-3" />
              </div>
            ) : generatedRecipe ? (
              <div className="flex items-start gap-4">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-orange-400 to-amber-500 flex items-center justify-center flex-shrink-0 shadow-lg">
                  <MealIcon className="w-7 h-7 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-medium text-orange-600 uppercase tracking-wider">
                      {currentMealType.label} Idea
                    </span>
                    <Sparkles className="w-3 h-3 text-orange-500" />
                  </div>
                  <h3 className="font-display text-xl font-bold text-[#1A2E1A] mb-1">
                    {generatedRecipe.name}
                  </h3>
                  <p className="text-sm text-stone-600 mb-3 line-clamp-2">
                    {generatedRecipe.description}
                  </p>
                  
                  <div className="flex flex-wrap items-center gap-3 text-xs text-stone-500 mb-4">
                    {generatedRecipe.prep_time && (
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" /> Prep: {generatedRecipe.prep_time}
                      </span>
                    )}
                    {generatedRecipe.cook_time && (
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" /> Cook: {generatedRecipe.cook_time}
                      </span>
                    )}
                    {generatedRecipe.servings && (
                      <span className="flex items-center gap-1">
                        <Users className="w-3 h-3" /> Serves {generatedRecipe.servings}
                      </span>
                    )}
                  </div>

                  {/* Ingredients preview */}
                  <div className="mb-4">
                    <p className="text-xs font-medium text-stone-500 mb-2">Ingredients:</p>
                    <div className="flex flex-wrap gap-1">
                      {generatedRecipe.ingredients?.slice(0, 8).map((ing, i) => (
                        <span 
                          key={i} 
                          className={`text-xs px-2 py-1 rounded-full ${
                            ing.from_pantry 
                              ? 'bg-green-100 text-green-700' 
                              : 'bg-orange-100 text-orange-700'
                          }`}
                        >
                          {ing.name}
                        </span>
                      ))}
                      {generatedRecipe.ingredients?.length > 8 && (
                        <span className="text-xs px-2 py-1 text-stone-400">
                          +{generatedRecipe.ingredients.length - 8} more
                        </span>
                      )}
                    </div>
                  </div>
                  
                  {/* Expiring items used */}
                  {generatedRecipe.expiring_items_used?.length > 0 && (
                    <div className="mb-4 p-2 bg-red-50 rounded-lg border border-red-100">
                      <p className="text-xs font-medium text-red-700 flex items-center gap-1 mb-1">
                        <CalendarClock className="w-3 h-3" />
                        Uses expiring ingredients:
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {generatedRecipe.expiring_items_used.map((item, i) => (
                          <span key={i} className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700">
                            {item.name} ({item.days_until_expiry <= 0 ? 'expired' : `${item.days_until_expiry}d left`})
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {generatedRecipe.missing_ingredients?.length > 0 && (
                    <p className="text-xs text-orange-600 mt-2 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />
                      You may need: {generatedRecipe.missing_ingredients.join(", ")}
                    </p>
                  )}

                  <div className="flex flex-wrap items-center gap-3">
                    <Button 
                      onClick={saveGeneratedRecipe}
                      disabled={savingRecipe}
                      className="bg-orange-500 hover:bg-orange-600 text-white"
                      data-testid="save-ai-recipe"
                    >
                      {savingRecipe ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                      Save & View Recipe
                    </Button>
                    <Button 
                      variant="outline"
                      onClick={generateAIRecipe}
                      disabled={generatingRecipe}
                      className="border-orange-300 text-orange-700 hover:bg-orange-50"
                      data-testid="try-another"
                    >
                      <Sparkles className="w-4 h-4 mr-2" />
                      Try Something Else
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-8">
                <p className="text-stone-500 mb-4">Add items to your pantry to get personalized meal suggestions!</p>
                <Button 
                  onClick={() => navigate('/pantry')}
                  variant="outline"
                  className="border-orange-300 text-orange-700"
                >
                  Go to Pantry
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Your Recipes That Match */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display text-xl font-semibold text-[#1A2E1A]">
              Your Recipes
            </h2>
            <Button 
              variant="ghost" 
              onClick={() => fetchSuggestions(mealTypeFilter)}
              disabled={loading}
              size="sm"
              className="text-stone-500"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>

          {loading ? (
            <div className="grid gap-4">
              {[1, 2, 3].map(i => (
                <div key={i} className="fresh-card-static p-4 animate-pulse">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-stone-200" />
                    <div className="flex-1">
                      <div className="h-4 bg-stone-200 rounded w-1/3 mb-2" />
                      <div className="h-3 bg-stone-100 rounded w-1/2" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : suggestions.length > 0 ? (
            <div className="grid gap-4">
              {suggestions.map((suggestion, index) => (
                <div 
                  key={suggestion.recipe_id} 
                  className="fresh-card-static p-4 hover:border-orange-200 transition-colors cursor-pointer group"
                  onClick={() => navigate(`/recipes/${suggestion.recipe_id}`)}
                  data-testid={`suggestion-${index}`}
                >
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${
                      suggestion.match_percentage >= 80 
                        ? 'bg-gradient-to-br from-green-400 to-emerald-500' 
                        : suggestion.match_percentage >= 50 
                          ? 'bg-gradient-to-br from-amber-400 to-orange-500'
                          : 'bg-gradient-to-br from-orange-400 to-red-500'
                    }`}>
                      <ChefHat className="w-6 h-6 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-[#1A2E1A] group-hover:text-orange-600 transition-colors">
                        {suggestion.recipe_name}
                      </h3>
                      <div className="flex flex-wrap items-center gap-2 mt-1">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          suggestion.match_percentage >= 80 
                            ? 'bg-green-100 text-green-700' 
                            : suggestion.match_percentage >= 50 
                              ? 'bg-amber-100 text-amber-700'
                              : 'bg-orange-100 text-orange-700'
                        }`}>
                          {suggestion.match_percentage >= 80 ? 'Ready to cook!' : `${suggestion.match_percentage}% match`}
                        </span>
                        
                        {/* Show shared ingredients info */}
                        {suggestion.shared_ingredient_count >= 2 && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 flex items-center gap-1">
                            <Layers className="w-3 h-3" />
                            Shares {suggestion.shared_ingredient_count} with other recipes
                          </span>
                        )}
                        
                        {/* Show expiring ingredients used */}
                        {suggestion.expiring_ingredients_used > 0 && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700 flex items-center gap-1" title={suggestion.expiring_ingredients_list?.join(', ')}>
                            <CalendarClock className="w-3 h-3" />
                            Uses {suggestion.expiring_ingredients_used} expiring: {suggestion.expiring_ingredients_list?.slice(0, 2).join(', ')}{suggestion.expiring_ingredients_list?.length > 2 ? '...' : ''}
                          </span>
                        )}
                        
                        {suggestion.missing_ingredients?.length > 0 && (
                          <span className="text-xs text-stone-400">
                            Missing: {suggestion.missing_ingredients.slice(0, 2).join(", ")}
                            {suggestion.missing_ingredients.length > 2 && ` +${suggestion.missing_ingredients.length - 2}`}
                          </span>
                        )}
                      </div>
                      {suggestion.recommendation && (
                        <p className="text-xs text-stone-500 mt-1 italic">{suggestion.recommendation}</p>
                      )}
                    </div>
                    <ArrowRight className="w-5 h-5 text-stone-300 group-hover:text-orange-500 transition-colors" />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="fresh-card-static p-8 text-center">
              <ChefHat className="w-12 h-12 text-stone-300 mx-auto mb-3" />
              <p className="text-stone-500">{message || "No matching recipes found"}</p>
              <Button 
                onClick={() => navigate('/add-recipe')}
                className="mt-4 btn-primary"
              >
                Add a Recipe
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
