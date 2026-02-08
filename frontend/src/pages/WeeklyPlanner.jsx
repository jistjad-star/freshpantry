import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Calendar, ChefHat, ShoppingCart, ChevronLeft, ChevronRight, Loader2, Plus, X, AlertCircle, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "sonner";
import api from "@/lib/api";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const MAX_MEALS_PER_WEEK = 7;

export default function WeeklyPlanner() {
  const navigate = useNavigate();
  const location = useLocation();
  const [recipes, setRecipes] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [weeklyPlan, setWeeklyPlan] = useState({});
  const [currentWeek, setCurrentWeek] = useState(getWeekStart(new Date()));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [openDay, setOpenDay] = useState(null);

  function getWeekStart(date) {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(d.setDate(diff)).toISOString().split('T')[0];
  }

  function addDays(date, days) {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
  }

  function formatDate(dateStr, dayIndex) {
    return addDays(new Date(dateStr), dayIndex).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  // Handle suggested meals from MealSuggestions page
  useEffect(() => {
    if (location.state?.suggestedMeals && recipes.length > 0) {
      const suggestedIds = location.state.suggestedMeals;
      const newPlan = { ...weeklyPlan };
      let dayIndex = 0;
      
      for (const recipeId of suggestedIds) {
        const day = DAYS[dayIndex % 7];
        if (!newPlan[day]) newPlan[day] = [];
        newPlan[day].push(recipeId);
        dayIndex++;
      }
      
      setWeeklyPlan(newPlan);
      toast.success(`Added ${suggestedIds.length} suggested meals to your plan!`);
      window.history.replaceState({}, document.title);
    }
  }, [location.state, recipes]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [recipesRes, planRes, suggestionsRes] = await Promise.all([
          api.getRecipes(), 
          api.getWeeklyPlan(currentWeek),
          api.getMealSuggestions().catch(() => ({ data: { suggestions: [] } }))
        ]);
        setRecipes(recipesRes.data || []);
        setSuggestions(suggestionsRes.data?.suggestions || []);
        const plan = {};
        if (planRes.data?.days) { planRes.data.days.forEach(day => { plan[day.day] = day.recipe_ids; }); }
        setWeeklyPlan(plan);
      } catch (error) { console.error("Error:", error); } finally { setLoading(false); }
    };
    fetchData();
  }, [currentWeek]);

  const getTotalMeals = () => DAYS.reduce((sum, day) => sum + (weeklyPlan[day]?.length || 0), 0);

  const addRecipeToDay = (day, recipeId) => {
    if (getTotalMeals() >= MAX_MEALS_PER_WEEK) {
      toast.error(`Maximum ${MAX_MEALS_PER_WEEK} meals per week. Remove one to add another.`);
      return;
    }
    
    setWeeklyPlan(prev => ({ ...prev, [day]: [...(prev[day] || []), recipeId] }));
    setOpenDay(null);
    toast.success("Meal added!");
  };

  const removeRecipeFromDay = (day, recipeId) => {
    setWeeklyPlan(prev => ({ ...prev, [day]: (prev[day] || []).filter(id => id !== recipeId) }));
  };

  const savePlan = async () => {
    setSaving(true);
    try {
      const days = DAYS.map(day => ({ day, recipe_ids: weeklyPlan[day] || [] }));
      await api.saveWeeklyPlan({ week_start: currentWeek, days });
      toast.success("Plan saved!");
    } catch (error) { toast.error("Failed to save"); } finally { setSaving(false); }
  };

  const generateShoppingList = async () => {
    const allRecipeIds = DAYS.flatMap(day => weeklyPlan[day] || []);
    const uniqueIds = [...new Set(allRecipeIds)];
    if (uniqueIds.length === 0) { toast.error("Add recipes first"); return; }
    setGenerating(true);
    try {
      await api.generateShoppingList(uniqueIds);
      toast.success("Shopping list generated!");
      navigate("/shopping-list");
    } catch (error) { toast.error("Failed"); } finally { setGenerating(false); }
  };

  const getRecipeById = (id) => recipes.find(r => r.id === id);
  const totalMeals = getTotalMeals();
  const canAddMore = totalMeals < MAX_MEALS_PER_WEEK;

  // Get suggested recipes for the popover - show more with lower threshold
  const getSuggestedRecipes = () => {
    return suggestions
      .filter(s => s.match_percentage >= 20) // Show recipes even with low match
      .slice(0, 5) // Show up to 5 suggestions
      .map(s => ({
        id: s.recipe_id,
        name: s.recipe_name,
        match: s.match_percentage,
        missing: s.missing_ingredients?.length || 0,
        missingItems: s.missing_ingredients || [],
        isSuggested: true
      }));
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 text-[#4A7C59] animate-spin" /></div>;

  return (
    <div className="min-h-screen py-8" data-testid="weekly-planner-page">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
          <div>
            <h1 className="font-display text-3xl font-bold text-[#1A2E1A] mb-2">Weekly Plan</h1>
            <div className="flex items-center gap-3">
              <p className="text-stone-500">{totalMeals} of {MAX_MEALS_PER_WEEK} meals planned</p>
              {totalMeals >= MAX_MEALS_PER_WEEK && (
                <span className="flex items-center gap-1 text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded-full">
                  <AlertCircle className="w-3 h-3" />
                  Week full
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button onClick={savePlan} disabled={saving} variant="outline" className="border-stone-200">{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save Plan"}</Button>
            <Button onClick={generateShoppingList} disabled={generating || totalMeals === 0} className="btn-primary">
              {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <><ShoppingCart className="w-4 h-4 mr-2" />Generate List</>}
            </Button>
          </div>
        </div>

        <div className="fresh-card-static p-4 mb-8 flex items-center justify-between">
          <Button variant="ghost" onClick={() => setCurrentWeek(getWeekStart(addDays(currentWeek, -7)))} className="text-stone-500 hover:text-[#4A7C59]"><ChevronLeft className="w-5 h-5 mr-1" />Previous</Button>
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-[#4A7C59]" />
            <span className="font-medium text-[#1A2E1A]">Week of {new Date(currentWeek).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</span>
          </div>
          <Button variant="ghost" onClick={() => setCurrentWeek(getWeekStart(addDays(currentWeek, 7)))} className="text-stone-500 hover:text-[#4A7C59]">Next<ChevronRight className="w-5 h-5 ml-1" /></Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-7 gap-4">
          {DAYS.map((day, index) => (
            <div key={day} className="fresh-card-static p-4 min-h-[200px] animate-fade-in-up" style={{ animationDelay: `${index * 0.05}s` }} data-testid={`day-${day.toLowerCase()}`}>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-semibold text-[#1A2E1A]">{day}</h3>
                  <p className="text-xs text-stone-500">{formatDate(currentWeek, index)}</p>
                </div>
                
                {/* Add Recipe Popover */}
                <Popover open={openDay === day} onOpenChange={(open) => setOpenDay(open ? day : null)}>
                  <PopoverTrigger asChild>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      disabled={!canAddMore}
                      className="text-[#4A7C59] hover:bg-[#4A7C59]/10 h-8 w-8 p-0"
                      data-testid={`add-meal-${day.toLowerCase()}`}
                    >
                      <Plus className="w-4 h-4" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-72 p-0 bg-white shadow-xl border-stone-200" align="end">
                    <div className="p-3 border-b border-stone-100">
                      <h4 className="font-semibold text-[#1A2E1A] text-sm">Add meal to {day}</h4>
                    </div>
                    
                    {/* AI Suggestions Section */}
                    {getSuggestedRecipes().length > 0 && (
                      <div className="p-2 border-b border-stone-100 bg-[#4A7C59]/5">
                        <p className="text-xs text-[#4A7C59] font-medium px-2 py-1 flex items-center gap-1">
                          <Sparkles className="w-3 h-3" />
                          Suggested based on pantry
                        </p>
                        <div className="space-y-1 mt-1">
                          {getSuggestedRecipes().map((recipe) => (
                            <button
                              key={recipe.id}
                              onClick={() => addRecipeToDay(day, recipe.id)}
                              className="w-full text-left px-3 py-2 rounded-lg hover:bg-[#4A7C59]/10 transition-colors flex items-center justify-between"
                            >
                              <span className="text-sm text-[#1A2E1A] truncate">{recipe.name}</span>
                              <span className="text-xs text-[#4A7C59] font-medium">{recipe.match}%</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {/* All Recipes Section */}
                    <div className="max-h-64 overflow-y-auto">
                      <p className="text-xs text-stone-500 font-medium px-4 py-2 sticky top-0 bg-white">All recipes</p>
                      <div className="px-2 pb-2 space-y-1">
                        {recipes.length > 0 ? recipes.map((recipe) => (
                          <button
                            key={recipe.id}
                            onClick={() => addRecipeToDay(day, recipe.id)}
                            className="w-full text-left px-3 py-2 rounded-lg hover:bg-stone-50 transition-colors flex items-center gap-3"
                          >
                            {recipe.image_url ? (
                              <div className="w-8 h-8 rounded bg-cover bg-center flex-shrink-0" style={{ backgroundImage: `url(${recipe.image_url})` }} />
                            ) : (
                              <div className="w-8 h-8 rounded bg-stone-100 flex items-center justify-center flex-shrink-0">
                                <ChefHat className="w-4 h-4 text-stone-400" />
                              </div>
                            )}
                            <span className="text-sm text-[#1A2E1A] truncate">{recipe.name}</span>
                          </button>
                        )) : (
                          <p className="text-sm text-stone-400 px-3 py-4 text-center">No recipes yet</p>
                        )}
                      </div>
                    </div>
                    
                    {/* More Suggestions Link */}
                    <div className="p-2 border-t border-stone-100">
                      <button
                        onClick={() => { setOpenDay(null); navigate("/suggestions"); }}
                        className="w-full text-center px-3 py-2 rounded-lg text-sm text-[#4A7C59] hover:bg-[#4A7C59]/10 transition-colors flex items-center justify-center gap-2"
                      >
                        <Sparkles className="w-4 h-4" />
                        Get more AI suggestions
                      </button>
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
              
              <div className="space-y-2">
                {(weeklyPlan[day] || []).map((recipeId, i) => {
                  const recipe = getRecipeById(recipeId);
                  if (!recipe) return null;
                  return (
                    <div key={`${recipeId}-${i}`} className="flex items-center gap-2 p-2 rounded-lg bg-stone-50 border border-stone-100 group">
                      {recipe.image_url ? <div className="w-8 h-8 rounded bg-cover bg-center flex-shrink-0" style={{ backgroundImage: `url(${recipe.image_url})` }} /> : <div className="w-8 h-8 rounded bg-stone-200 flex items-center justify-center flex-shrink-0"><ChefHat className="w-4 h-4 text-stone-400" /></div>}
                      <span className="text-sm text-[#1A2E1A] truncate flex-1">{recipe.name}</span>
                      <button onClick={() => removeRecipeFromDay(day, recipeId)} className="opacity-0 group-hover:opacity-100 text-stone-400 hover:text-[#E07A5F] transition-opacity"><X className="w-4 h-4" /></button>
                    </div>
                  );
                })}
                {(!weeklyPlan[day] || weeklyPlan[day].length === 0) && <p className="text-sm text-stone-400 text-center py-4">No meals</p>}
              </div>
            </div>
          ))}
        </div>

        {recipes.length === 0 && (
          <div className="fresh-card-static p-12 text-center mt-8">
            <ChefHat className="w-16 h-16 text-stone-300 mx-auto mb-4" />
            <h3 className="font-display text-xl font-semibold text-[#1A2E1A] mb-2">No Recipes</h3>
            <p className="text-stone-500 mb-6">Add recipes to plan your week</p>
            <Button onClick={() => navigate("/add-recipe")} className="btn-primary">Add Recipe</Button>
          </div>
        )}
      </div>
    </div>
  );
}
