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
  Plus,
  Save,
  Coffee,
  Sun,
  Moon,
  Cookie,
  UtensilsCrossed
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import api from "@/lib/api";

const MEAL_TYPES = [
  { value: "all", label: "All", icon: UtensilsCrossed },
  { value: "breakfast", label: "Breakfast", icon: Coffee },
  { value: "lunch", label: "Lunch", icon: Sun },
  { value: "dinner", label: "Dinner", icon: Moon },
  { value: "snack", label: "Snack", icon: Cookie },
];

export default function MealSuggestions() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [suggestions, setSuggestions] = useState([]);
  const [message, setMessage] = useState("");
  const [selectedMeals, setSelectedMeals] = useState([]);
  const [generatingRecipe, setGeneratingRecipe] = useState(false);
  const [generatedRecipe, setGeneratedRecipe] = useState(null);
  const [savingRecipe, setSavingRecipe] = useState(false);
  const [mealTypeFilter, setMealTypeFilter] = useState("all");

  const fetchSuggestions = async (mealType = "all") => {
    setLoading(true);
    try {
      const response = await api.getMealSuggestions(mealType !== "all" ? mealType : null);
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
    fetchSuggestions(mealTypeFilter);
  }, [mealTypeFilter]);

  const generateAIRecipe = async () => {
    setGeneratingRecipe(true);
    setGeneratedRecipe(null);
    try {
      const response = await api.generateAIRecipe();
      setGeneratedRecipe(response.data.recipe);
      toast.success("Recipe generated from your pantry!");
    } catch (error) {
      console.error("Error generating recipe:", error);
      if (error.response?.data?.detail?.includes("pantry")) {
        toast.error("Add items to your pantry first!");
      } else {
        toast.error("Failed to generate recipe");
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
      console.error("Error saving recipe:", error);
      toast.error("Failed to save recipe");
    } finally {
      setSavingRecipe(false);
    }
  };

  const toggleMealSelection = (recipeId) => {
    setSelectedMeals(prev => {
      if (prev.includes(recipeId)) {
        return prev.filter(id => id !== recipeId);
      }
      if (prev.length >= 7) {
        toast.warning("You can only select up to 7 meals per week");
        return prev;
      }
      return [...prev, recipeId];
    });
  };

  const addToWeeklyPlan = () => {
    if (selectedMeals.length === 0) {
      toast.error("Please select at least one meal");
      return;
    }
    navigate("/planner", { state: { suggestedMeals: selectedMeals } });
    toast.success(`Adding ${selectedMeals.length} meals to your weekly plan!`);
  };

  const getMatchColor = (percentage) => {
    if (percentage >= 80) return "text-green-600 bg-green-50 border-green-200";
    if (percentage >= 50) return "text-amber-600 bg-amber-50 border-amber-200";
    return "text-orange-600 bg-orange-50 border-orange-200";
  };

  const getMatchLabel = (percentage, missingCount) => {
    if (percentage >= 80) return "Ready to cook!";
    if (percentage >= 50) return `Missing ${missingCount} item${missingCount !== 1 ? 's' : ''}`;
    return `Need ${missingCount} more items`;
  };

  return (
    <div className="min-h-screen py-8" data-testid="meal-suggestions-page">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="font-display text-3xl font-bold text-[#1A2E1A] mb-2 flex items-center gap-3">
                <Sparkles className="w-8 h-8 text-[#4A7C59]" />
                Meal Suggestions
              </h1>
              <p className="text-stone-500">
                AI-powered recommendations based on your pantry
              </p>
            </div>
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                onClick={fetchSuggestions}
                disabled={loading}
                className="flex items-center gap-2"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>
          </div>
        </div>

        {/* AI Recipe Generator Card */}
        <div className="mb-8 fresh-card-static p-6 bg-gradient-to-br from-[#4A7C59]/5 to-[#4A7C59]/10 border-[#4A7C59]/20">
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-full bg-[#4A7C59]/20">
              <Wand2 className="w-6 h-6 text-[#4A7C59]" />
            </div>
            <div className="flex-1">
              <h2 className="font-display text-lg font-semibold text-[#1A2E1A] mb-1">
                Create a New Recipe from Your Pantry
              </h2>
              <p className="text-stone-600 text-sm mb-4">
                Let AI create a delicious recipe using only ingredients you already have
              </p>
              <Button 
                onClick={generateAIRecipe}
                disabled={generatingRecipe}
                className="btn-primary"
                data-testid="generate-ai-recipe-btn"
              >
                {generatingRecipe ? (
                  <><Loader2 className="w-4 h-4 animate-spin mr-2" />Creating Recipe...</>
                ) : (
                  <><Wand2 className="w-4 h-4 mr-2" />Generate Recipe</>
                )}
              </Button>
            </div>
          </div>

          {/* Generated Recipe Display */}
          {generatedRecipe && (
            <div className="mt-6 p-5 rounded-xl bg-white border border-[#4A7C59]/30" data-testid="generated-recipe">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="font-display text-xl font-bold text-[#1A2E1A]">
                    {generatedRecipe.name}
                  </h3>
                  <p className="text-stone-600 text-sm mt-1">{generatedRecipe.description}</p>
                </div>
                <Button 
                  onClick={saveGeneratedRecipe}
                  disabled={savingRecipe}
                  className="btn-primary"
                  data-testid="save-generated-recipe-btn"
                >
                  {savingRecipe ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <><Save className="w-4 h-4 mr-2" />Save Recipe</>
                  )}
                </Button>
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <h4 className="font-medium text-[#1A2E1A] mb-2 flex items-center gap-2">
                    <span className="text-sm">🥘</span> Ingredients
                  </h4>
                  <ul className="space-y-1 text-sm text-stone-600">
                    {generatedRecipe.ingredients?.map((ing, i) => (
                      <li key={i} className="flex items-center gap-2">
                        {ing.from_pantry ? (
                          <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
                        ) : (
                          <AlertCircle className="w-3.5 h-3.5 text-orange-500" />
                        )}
                        <span className={!ing.from_pantry ? 'text-orange-700 font-medium' : ''}>
                          {ing.quantity} {ing.unit} {ing.name}
                        </span>
                      </li>
                    ))}
                  </ul>
                  
                  {generatedRecipe.missing_ingredients?.length > 0 && (
                    <div className="mt-3 p-2 rounded-lg bg-orange-50 border border-orange-200">
                      <p className="text-xs text-orange-700">
                        <AlertCircle className="w-3 h-3 inline mr-1" />
                        You may need: {generatedRecipe.missing_ingredients.join(", ")}
                      </p>
                    </div>
                  )}
                </div>
                
                <div>
                  <h4 className="font-medium text-[#1A2E1A] mb-2 flex items-center gap-2">
                    <span className="text-sm">📝</span> Instructions
                  </h4>
                  <ol className="space-y-2 text-sm text-stone-600 list-decimal list-inside">
                    {generatedRecipe.instructions?.slice(0, 4).map((step, i) => (
                      <li key={i}>{step}</li>
                    ))}
                    {generatedRecipe.instructions?.length > 4 && (
                      <li className="text-stone-400 italic">+{generatedRecipe.instructions.length - 4} more steps...</li>
                    )}
                  </ol>
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-stone-200 flex items-center gap-4 text-xs text-stone-500">
                {generatedRecipe.prep_time && <span>⏱️ Prep: {generatedRecipe.prep_time}</span>}
                {generatedRecipe.cook_time && <span>🔥 Cook: {generatedRecipe.cook_time}</span>}
                {generatedRecipe.servings && <span>👥 Serves: {generatedRecipe.servings}</span>}
              </div>
            </div>
          )}
        </div>

        {/* Selection Counter */}
        {selectedMeals.length > 0 && (
          <div className="mb-6 p-4 rounded-xl bg-[#4A7C59]/10 border border-[#4A7C59]/20 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Calendar className="w-5 h-5 text-[#4A7C59]" />
              <span className="text-[#1A2E1A] font-medium">
                {selectedMeals.length} of 7 meals selected
              </span>
              <Progress value={(selectedMeals.length / 7) * 100} className="w-32 h-2" />
            </div>
            <Button onClick={addToWeeklyPlan} className="btn-primary">
              <Calendar className="w-4 h-4 mr-2" />
              Add to Weekly Plan
            </Button>
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="fresh-card-static p-12 text-center">
            <Loader2 className="w-12 h-12 text-[#4A7C59] animate-spin mx-auto mb-4" />
            <p className="text-stone-500">Analyzing your pantry and recipes...</p>
          </div>
        )}

        {/* Empty State */}
        {!loading && suggestions.length === 0 && (
          <div className="fresh-card-static p-12 text-center">
            <ChefHat className="w-16 h-16 text-stone-300 mx-auto mb-4" />
            <h2 className="font-display text-xl font-semibold text-[#1A2E1A] mb-2">
              {message || "No suggestions yet"}
            </h2>
            <p className="text-stone-500 mb-6">
              Add items to your pantry and save some recipes to get personalized meal suggestions.
            </p>
            <div className="flex gap-4 justify-center">
              <Button variant="outline" onClick={() => navigate("/pantry")}>
                Manage Pantry
              </Button>
              <Button className="btn-primary" onClick={() => navigate("/add-recipe")}>
                Add Recipe
              </Button>
            </div>
          </div>
        )}

        {/* Suggestions List */}
        {!loading && suggestions.length > 0 && (
          <div className="space-y-4">
            <p className="text-stone-600 text-sm">{message}</p>
            
            {suggestions.map((suggestion, index) => {
              const missingCount = suggestion.missing_ingredients?.length || 0;
              return (
              <div 
                key={suggestion.recipe_id || index}
                className={`fresh-card-static p-6 cursor-pointer transition-all ${
                  selectedMeals.includes(suggestion.recipe_id) 
                    ? 'ring-2 ring-[#4A7C59] bg-[#4A7C59]/5' 
                    : 'hover:shadow-md'
                }`}
                onClick={() => toggleMealSelection(suggestion.recipe_id)}
                data-testid={`suggestion-${index}`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center flex-wrap gap-3 mb-2">
                      {selectedMeals.includes(suggestion.recipe_id) ? (
                        <CheckCircle2 className="w-6 h-6 text-[#4A7C59]" />
                      ) : (
                        <div className="w-6 h-6 rounded-full border-2 border-stone-300" />
                      )}
                      <h3 className="font-display text-lg font-semibold text-[#1A2E1A]">
                        {suggestion.recipe_name}
                      </h3>
                      <span className={`px-3 py-1 rounded-full text-sm font-medium border ${getMatchColor(suggestion.match_percentage)}`}>
                        {suggestion.match_percentage}% match
                      </span>
                      <span className="text-xs text-stone-500">
                        {getMatchLabel(suggestion.match_percentage, missingCount)}
                      </span>
                    </div>
                    
                    <p className="text-stone-600 text-sm mb-3 ml-9">
                      {suggestion.recommendation}
                    </p>
                    
                    <div className="ml-9 space-y-3">
                      {/* Missing ingredients - shown prominently */}
                      {suggestion.missing_ingredients?.length > 0 && (
                        <div className="p-3 rounded-lg bg-orange-50 border border-orange-200">
                          <div className="flex items-start gap-2">
                            <AlertCircle className="w-4 h-4 text-orange-500 mt-0.5 flex-shrink-0" />
                            <div>
                              <p className="text-xs text-orange-700 font-medium mb-1">
                                Missing {missingCount} ingredient{missingCount !== 1 ? 's' : ''}:
                              </p>
                              <p className="text-sm text-orange-800 font-medium">
                                {suggestion.missing_ingredients.join(", ")}
                              </p>
                            </div>
                          </div>
                        </div>
                      )}
                      
                      {/* Available ingredients */}
                      {suggestion.available_ingredients?.length > 0 && (
                        <div className="flex items-start gap-2">
                          <CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5" />
                          <div>
                            <p className="text-xs text-stone-500 mb-1">You have:</p>
                            <p className="text-sm text-stone-700">
                              {suggestion.available_ingredients.slice(0, 5).join(", ")}
                              {suggestion.available_ingredients.length > 5 && ` +${suggestion.available_ingredients.length - 5} more`}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/recipes/${suggestion.recipe_id}`);
                    }}
                    className="text-[#4A7C59]"
                  >
                    View <ArrowRight className="w-4 h-4 ml-1" />
                  </Button>
                </div>
              </div>
              );
            })}
          </div>
        )}

        {/* Bottom CTA */}
        {!loading && selectedMeals.length > 0 && (
          <div className="mt-8 p-6 rounded-xl bg-gradient-to-r from-[#4A7C59]/10 to-[#4A7C59]/5 border border-[#4A7C59]/20">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-display text-lg font-semibold text-[#1A2E1A]">
                  Ready to plan your week?
                </h3>
                <p className="text-stone-600 text-sm">
                  {selectedMeals.length} meal{selectedMeals.length !== 1 ? 's' : ''} selected
                </p>
              </div>
              <Button onClick={addToWeeklyPlan} className="btn-primary py-6 px-8">
                <Calendar className="w-5 h-5 mr-2" />
                Add to Weekly Plan
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
