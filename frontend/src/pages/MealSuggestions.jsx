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
  Calendar
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import api from "@/lib/api";

export default function MealSuggestions() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [suggestions, setSuggestions] = useState([]);
  const [message, setMessage] = useState("");
  const [selectedMeals, setSelectedMeals] = useState([]);

  const fetchSuggestions = async () => {
    setLoading(true);
    try {
      const response = await api.getMealSuggestions();
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
    fetchSuggestions();
  }, []);

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
    // Navigate to planner with selected meals
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
            ))}
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
