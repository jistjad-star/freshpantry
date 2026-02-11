import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Calendar, ChefHat, ShoppingCart, ChevronLeft, ChevronRight, Loader2, Plus, X, Sparkles, Layers, UtensilsCrossed, CalendarClock, Minus, Shuffle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import api from "@/lib/api";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const MAX_MEALS_PER_DAY = 4; // breakfast, lunch, dinner, snack

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
  const [showExpiring, setShowExpiring] = useState(false);
  
  // Servings adjustment state
  const [selectedRecipe, setSelectedRecipe] = useState(null);
  const [selectedDay, setSelectedDay] = useState(null);
  const [selectedServings, setSelectedServings] = useState(2);
  
  // Surprise Me state
  const [showSurpriseDialog, setShowSurpriseDialog] = useState(false);
  const [surpriseDays, setSurpriseDays] = useState(DAYS.reduce((acc, day) => ({...acc, [day]: true}), {}));
  const [surpriseCategories, setSurpriseCategories] = useState([]);
  const [generatingSurprise, setGeneratingSurprise] = useState(false);
  
  const ALL_CATEGORIES = [
    { value: "vegan", label: "Vegan" },
    { value: "vegetarian", label: "Veggie" },
    { value: "pescatarian", label: "Pescatarian" },
    { value: "quick-easy", label: "Quick & Easy" },
    { value: "low-fat", label: "Low Fat" },
  ];

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
        api.getMealSuggestions(null, false).then(res => {
          setSuggestions(res.data?.suggestions || []);
        }).catch(() => {});
      } catch (error) { console.error("Error:", error); setLoading(false); }
    };
    fetchData();
  }, [currentWeek]);

  // Refetch suggestions when showExpiring changes
  useEffect(() => {
    api.getMealSuggestions(null, showExpiring).then(res => {
      setSuggestions(res.data?.suggestions || []);
    }).catch(() => {});
  }, [showExpiring]);

  const getTotalMeals = () => DAYS.reduce((sum, day) => sum + (weeklyPlan[day]?.length || 0), 0);
  const getMealsForDay = (day) => (weeklyPlan[day] || []).length;
  const canAddToDay = (day) => getMealsForDay(day) < MAX_MEALS_PER_DAY;

  // Open servings dialog before adding recipe
  const selectRecipeForDay = (day, recipeId) => {
    if (!canAddToDay(day)) {
      toast.error(`Maximum ${MAX_MEALS_PER_DAY} meals per day. Remove one to add another.`);
      return;
    }
    const recipe = recipes.find(r => r.id === recipeId);
    setSelectedRecipe(recipe);
    setSelectedDay(day);
    setSelectedServings(recipe?.servings || 2);
    setOpenDay(null);
  };
  
  // Confirm adding recipe with selected servings
  const confirmAddRecipe = () => {
    if (!selectedRecipe || !selectedDay) return;
    
    // Store recipe with custom servings in the plan
    setWeeklyPlan(prev => ({
      ...prev,
      [selectedDay]: [...(prev[selectedDay] || []), { id: selectedRecipe.id, servings: selectedServings }]
    }));
    
    toast.success(`Added ${selectedRecipe.name} (${selectedServings} servings)`);
    setSelectedRecipe(null);
    setSelectedDay(null);
  };

  const addRecipeToDay = (day, recipeId) => {
    if (!canAddToDay(day)) {
      toast.error(`Maximum ${MAX_MEALS_PER_DAY} meals per day. Remove one to add another.`);
      return;
    }
    
    // For backward compatibility, store as object with servings
    const recipe = recipes.find(r => r.id === recipeId);
    setWeeklyPlan(prev => ({ 
      ...prev, 
      [day]: [...(prev[day] || []), { id: recipeId, servings: recipe?.servings || 2 }] 
    }));
    setOpenDay(null);
    toast.success("Meal added!");
  };

  const removeRecipeFromDay = (day, recipeId) => {
    setWeeklyPlan(prev => ({ 
      ...prev, 
      [day]: (prev[day] || []).filter(item => {
        // Handle both old format (string) and new format (object)
        const itemId = typeof item === 'string' ? item : item.id;
        return itemId !== recipeId;
      })
    }));
  };
  
  // Get recipe ID from plan item (handles old and new format)
  const getRecipeIdFromPlanItem = (item) => typeof item === 'string' ? item : item.id;
  const getServingsFromPlanItem = (item, recipe) => typeof item === 'string' ? (recipe?.servings || 2) : (item.servings || recipe?.servings || 2);
  
  // Surprise Me - Auto-populate the planner
  const handleSurpriseMe = async () => {
    const selectedDaysList = DAYS.filter(day => surpriseDays[day]);
    if (selectedDaysList.length === 0) {
      toast.error("Please select at least one day");
      return;
    }
    
    setGeneratingSurprise(true);
    
    try {
      // Get suggestions (prioritizes pantry items and shared ingredients)
      const suggestionsRes = await api.getMealSuggestions(null, true);
      let availableRecipes = suggestionsRes.data?.suggestions || [];
      
      // If we have category filters, filter the suggestions
      if (surpriseCategories.length > 0) {
        // Also include all recipes that match categories
        const filteredRecipes = recipes.filter(r => 
          r.categories?.some(cat => surpriseCategories.includes(cat))
        );
        
        // Prioritize suggested recipes that match categories
        availableRecipes = availableRecipes.filter(s => {
          const recipe = recipes.find(r => r.id === s.recipe_id);
          return recipe?.categories?.some(cat => surpriseCategories.includes(cat));
        });
        
        // Add any matching recipes not in suggestions
        filteredRecipes.forEach(recipe => {
          if (!availableRecipes.find(s => s.recipe_id === recipe.id)) {
            availableRecipes.push({
              recipe_id: recipe.id,
              recipe_name: recipe.name,
              match_percentage: 50,
              shared_ingredient_count: 0
            });
          }
        });
      }
      
      // If still no recipes, use all recipes
      if (availableRecipes.length === 0) {
        availableRecipes = recipes.map(r => ({
          recipe_id: r.id,
          recipe_name: r.name,
          match_percentage: 50,
          shared_ingredient_count: 0
        }));
      }
      
      // Sort by: shared ingredients (efficiency) > match percentage (pantry) > random
      availableRecipes.sort((a, b) => {
        if ((b.shared_ingredient_count || 0) !== (a.shared_ingredient_count || 0)) {
          return (b.shared_ingredient_count || 0) - (a.shared_ingredient_count || 0);
        }
        return (b.match_percentage || 0) - (a.match_percentage || 0);
      });
      
      // Build new plan without duplicates (unless not enough recipes)
      const newPlan = { ...weeklyPlan };
      const usedRecipeIds = new Set();
      
      // Get already planned recipe IDs
      DAYS.forEach(day => {
        (newPlan[day] || []).forEach(item => {
          usedRecipeIds.add(getRecipeIdFromPlanItem(item));
        });
      });
      
      let recipeIndex = 0;
      for (const day of selectedDaysList) {
        if (!canAddToDay(day)) continue;
        
        // Find a recipe not yet used this week
        let selectedRecipeData = null;
        let searchIndex = recipeIndex;
        
        // First pass: try to find unused recipe
        while (searchIndex < availableRecipes.length) {
          const candidate = availableRecipes[searchIndex];
          if (!usedRecipeIds.has(candidate.recipe_id)) {
            selectedRecipeData = candidate;
            recipeIndex = searchIndex + 1;
            break;
          }
          searchIndex++;
        }
        
        // Second pass: if not enough unique recipes, allow duplicates
        if (!selectedRecipeData && availableRecipes.length > 0) {
          selectedRecipeData = availableRecipes[recipeIndex % availableRecipes.length];
          recipeIndex++;
        }
        
        if (selectedRecipeData) {
          const recipe = recipes.find(r => r.id === selectedRecipeData.recipe_id);
          if (!newPlan[day]) newPlan[day] = [];
          newPlan[day].push({ 
            id: selectedRecipeData.recipe_id, 
            servings: recipe?.servings || 2 
          });
          usedRecipeIds.add(selectedRecipeData.recipe_id);
        }
      }
      
      setWeeklyPlan(newPlan);
      setShowSurpriseDialog(false);
      toast.success(`Added meals to ${selectedDaysList.length} days!`);
      
    } catch (error) {
      console.error("Error generating surprise plan:", error);
      toast.error("Failed to generate plan");
    } finally {
      setGeneratingSurprise(false);
    }
  };

  const handleCookedThis = async (recipeId, day) => {
    setCookingRecipe(recipeId);
    try {
      const response = await api.cookRecipe(recipeId, 1);
      toast.success(`Marked as cooked! ${response.data.deducted_count || 0} ingredients updated in pantry`);
      // Remove from planner after cooking
      removeRecipeFromDay(day, recipeId);
    } catch (error) {
      console.error("Error:", error);
      toast.error("Failed to mark as cooked");
    } finally {
      setCookingRecipe(null);
    }
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
        expiringUsed: s.expiring_ingredients_used || 0,
        sharedCount: s.shared_ingredient_count || 0,
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
            <p className="text-stone-500">{totalMeals} meals planned</p>
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
                      disabled={!canAddToDay(day)}
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
                          {/* Use Expiring Toggle */}
                          <div className="px-2 pt-2">
                            <button
                              onClick={() => setShowExpiring(!showExpiring)}
                              className={`w-full text-xs px-2 py-1.5 rounded-lg flex items-center justify-center gap-1 transition-colors ${
                                showExpiring 
                                  ? 'bg-red-100 text-red-700 font-medium' 
                                  : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                              }`}
                              data-testid="planner-expiring-toggle"
                            >
                              <CalendarClock className="w-3 h-3" />
                              {showExpiring ? 'Showing expiring items' : 'Use expiring items'}
                            </button>
                          </div>
                          
                          {getSuggestedRecipes().length > 0 ? (
                            <div className="p-2 space-y-1">
                              <p className="text-xs text-[#4A7C59] font-medium px-2 py-1 flex items-center gap-1 bg-[#4A7C59]/5 rounded-lg mb-2">
                                <Sparkles className="w-3 h-3" />
                                {showExpiring ? 'Using ingredients expiring soon' : 'Suggested based on pantry'}
                              </p>
                              {getSuggestedRecipes().map((recipe) => (
                                <button
                                  key={recipe.id}
                                  onClick={() => addRecipeToDay(day, recipe.id)}
                                  className="w-full text-left px-3 py-2 rounded-lg hover:bg-[#4A7C59]/10 transition-colors"
                                >
                                  <div className="flex items-center justify-between">
                                    <span className="text-sm text-[#1A2E1A] truncate flex-1">{recipe.name}</span>
                                    <div className="flex items-center gap-1">
                                      {recipe.expiringUsed > 0 && (
                                        <span className="text-xs font-medium px-1.5 py-0.5 rounded-full text-red-600 bg-red-50">
                                          {recipe.expiringUsed} exp
                                        </span>
                                      )}
                                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                                        recipe.match >= 80 ? 'text-green-600 bg-green-50' : 
                                        recipe.match >= 50 ? 'text-amber-600 bg-amber-50' : 
                                        'text-orange-600 bg-orange-50'
                                      }`}>
                                        {recipe.match}%
                                      </span>
                                    </div>
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
                      
                      {/* By Ingredient Tab - Shows recipe pairs sharing 2+ ingredients */}
                      <TabsContent value="ingredient" className="m-0">
                        <div className="max-h-64 overflow-y-auto">
                          {recipeGroups.length > 0 ? (
                            <div className="p-2 space-y-3">
                              <p className="text-xs text-[#4A7C59] font-medium px-2 py-1 bg-[#4A7C59]/5 rounded-lg">
                                Recipes sharing 2+ ingredients
                              </p>
                              {recipeGroups.slice(0, 6).map((group, idx) => (
                                <div key={idx} className="border border-stone-100 rounded-lg p-2 bg-stone-50/50">
                                  <p className="text-xs text-stone-500 px-1 mb-2 flex items-center gap-1">
                                    <span className="font-medium text-[#4A7C59]">{group.count} shared:</span>
                                    <span>{group.shared_ingredient}</span>
                                  </p>
                                  <div className="space-y-1">
                                    {group.recipes.map((recipe) => (
                                      <button
                                        key={recipe.id}
                                        onClick={() => addRecipeToDay(day, recipe.id)}
                                        className="w-full text-left px-2 py-1.5 rounded-lg hover:bg-[#4A7C59]/10 transition-colors text-sm text-[#1A2E1A]"
                                      >
                                        {recipe.name}
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-sm text-stone-400 px-4 py-8 text-center">Add more recipes to see groups sharing 2+ ingredients</p>
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
                  const isCooking = cookingRecipe === recipeId;
                  return (
                    <div key={`${recipeId}-${i}`} className="flex items-center gap-2 p-2 rounded-lg bg-stone-50 border border-stone-100 group">
                      {recipe.image_url ? <div className="w-8 h-8 rounded bg-cover bg-center flex-shrink-0" style={{ backgroundImage: `url(${recipe.image_url})` }} /> : <div className="w-8 h-8 rounded bg-stone-200 flex items-center justify-center flex-shrink-0"><ChefHat className="w-4 h-4 text-stone-400" /></div>}
                      <div className="flex-1 min-w-0">
                        <span className="text-sm text-[#1A2E1A] truncate block">{recipe.name}</span>
                        <span className="text-xs text-stone-400">{recipe.servings || 2} servings</span>
                      </div>
                      <button 
                        onClick={() => handleCookedThis(recipeId, day)} 
                        disabled={isCooking}
                        className="opacity-0 group-hover:opacity-100 text-[#4A7C59] hover:text-[#3A6C49] transition-opacity text-xs flex items-center gap-1 bg-[#4A7C59]/10 px-2 py-1 rounded-md"
                        title="Mark as cooked & deduct from pantry"
                      >
                        {isCooking ? <Loader2 className="w-3 h-3 animate-spin" /> : <UtensilsCrossed className="w-3 h-3" />}
                        Cooked
                      </button>
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
