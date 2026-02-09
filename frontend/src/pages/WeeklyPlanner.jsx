import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Calendar, ChefHat, ShoppingCart, ChevronLeft, ChevronRight, Loader2, Plus, X, AlertCircle, Sparkles, Layers, UtensilsCrossed } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import api from "@/lib/api";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const MAX_MEALS_PER_WEEK = 7;

export default function WeeklyPlanner() {
  const navigate = useNavigate();
  const location = useLocation();
  const [recipes, setRecipes] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [recipeGroups, setRecipeGroups] = useState([]);
  const [weeklyPlan, setWeeklyPlan] = useState({});
  const [currentWeek, setCurrentWeek] = useState(getWeekStart(new Date()));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [openDay, setOpenDay] = useState(null);
  const [cookingRecipe, setCookingRecipe] = useState(null);

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
  }, [location.state?.suggestedMeals, recipes.length]);

  // Handle add single recipe from RecipeDetail page
  useEffect(() => {
    if (location.state?.addRecipeId && recipes.length > 0) {
      const recipeId = location.state.addRecipeId;
      const recipe = recipes.find(r => r.id === recipeId);
      if (recipe) {
        // Find first day without a meal or use Monday
        const emptyDay = DAYS.find(day => !weeklyPlan[day]?.length) || "Monday";
        setOpenDay(emptyDay);
        toast.info(`Select a day to add "${recipe.name}" to your plan`);
      }
      window.history.replaceState({}, document.title);
    }
  }, [location.state?.addRecipeId, recipes.length]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Load essential data first (fast)
        const [recipesRes, planRes, groupsRes] = await Promise.all([
          api.getRecipes(), 
          api.getWeeklyPlan(currentWeek),
          api.getRecipesGrouped().catch(() => ({ data: { groups: [] } }))
        ]);
        setRecipes(recipesRes.data || []);
        setRecipeGroups(groupsRes.data?.groups || []);
        const plan = {};
        if (planRes.data?.days) { planRes.data.days.forEach(day => { plan[day.day] = day.recipe_ids; }); }
        setWeeklyPlan(plan);
        setLoading(false);
        
        // Load AI suggestions in background (slow)
        api.getMealSuggestions().then(res => {
          setSuggestions(res.data?.suggestions || []);
        }).catch(() => {});
      } catch (error) { console.error("Error:", error); setLoading(false); }
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
                  <PopoverContent className="w-80 p-0 bg-white shadow-xl border-stone-200" align="end">
                    <Tabs defaultValue="suggested" className="w-full">
                      <div className="p-2 border-b border-stone-100">
                        <TabsList className="w-full grid grid-cols-3 h-8">
                          <TabsTrigger value="suggested" className="text-xs data-[state=active]:bg-[#4A7C59]/10 data-[state=active]:text-[#4A7C59]">
                            <Sparkles className="w-3 h-3 mr-1" />Suggested
                          </TabsTrigger>
                          <TabsTrigger value="ingredient" className="text-xs data-[state=active]:bg-[#4A7C59]/10 data-[state=active]:text-[#4A7C59]">
                            <Layers className="w-3 h-3 mr-1" />By Ingredient
                          </TabsTrigger>
                          <TabsTrigger value="all" className="text-xs data-[state=active]:bg-[#4A7C59]/10 data-[state=active]:text-[#4A7C59]">
                            All
                          </TabsTrigger>
                        </TabsList>
                      </div>
                      
                      {/* Suggested Tab */}
                      <TabsContent value="suggested" className="m-0">
                        <div className="max-h-64 overflow-y-auto">
                          {getSuggestedRecipes().length > 0 ? (
                            <div className="p-2 space-y-1">
                              <p className="text-xs text-[#4A7C59] font-medium px-2 py-1 flex items-center gap-1 bg-[#4A7C59]/5 rounded-lg mb-2">
                                <Sparkles className="w-3 h-3" />
                                Suggested based on pantry
                              </p>
                              {getSuggestedRecipes().map((recipe) => (
                                <button
                                  key={recipe.id}
                                  onClick={() => addRecipeToDay(day, recipe.id)}
                                  className="w-full text-left px-3 py-2 rounded-lg hover:bg-[#4A7C59]/10 transition-colors"
                                >
                                  <div className="flex items-center justify-between">
                                    <span className="text-sm text-[#1A2E1A] truncate flex-1">{recipe.name}</span>
                                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                                      recipe.match >= 80 ? 'text-green-600 bg-green-50' : 
                                      recipe.match >= 50 ? 'text-amber-600 bg-amber-50' : 
                                      'text-orange-600 bg-orange-50'
                                    }`}>
                                      {recipe.match}%
                                    </span>
                                  </div>
                                  {recipe.missing > 0 && (
                                    <p className="text-xs text-orange-600 mt-1 truncate">
                                      Missing: {recipe.missingItems.slice(0, 2).join(", ")}{recipe.missingItems.length > 2 ? '...' : ''}
                                    </p>
                                  )}
                                </button>
                              ))}
                            </div>
                          ) : (
                            <p className="text-sm text-stone-400 px-4 py-8 text-center">Add items to your pantry for suggestions</p>
                          )}
                        </div>
                      </TabsContent>
                      
                      {/* By Ingredient Tab */}
                      <TabsContent value="ingredient" className="m-0">
                        <div className="max-h-64 overflow-y-auto">
                          {recipeGroups.length > 0 ? (
                            <div className="p-2 space-y-3">
                              {recipeGroups.slice(0, 6).map((group, idx) => (
                                <div key={idx}>
                                  <p className="text-xs text-[#4A7C59] font-medium px-2 mb-1 flex items-center gap-1">
                                    <span className="px-2 py-0.5 rounded bg-[#4A7C59]/10">{group.shared_ingredient}</span>
                                    <span className="text-stone-400">({group.count})</span>
                                  </p>
                                  <div className="space-y-1">
                                    {group.recipes.map((recipe) => (
                                      <button
                                        key={recipe.id}
                                        onClick={() => addRecipeToDay(day, recipe.id)}
                                        className="w-full text-left px-3 py-2 rounded-lg hover:bg-stone-50 transition-colors text-sm text-[#1A2E1A]"
                                      >
                                        {recipe.name}
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-sm text-stone-400 px-4 py-8 text-center">Add more recipes to see groups</p>
                          )}
                        </div>
                      </TabsContent>
                      
                      {/* All Recipes Tab */}
                      <TabsContent value="all" className="m-0">
                        <div className="max-h-64 overflow-y-auto">
                          <div className="p-2 space-y-1">
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
                      </TabsContent>
                    </Tabs>
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
                      <div className="flex-1 min-w-0">
                        <span className="text-sm text-[#1A2E1A] truncate block">{recipe.name}</span>
                        <span className="text-xs text-stone-400">{recipe.servings || 2} servings</span>
                      </div>
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
