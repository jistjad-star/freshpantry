import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { 
  Calendar, 
  ChefHat, 
  ShoppingCart, 
  Trash2,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Loader2,
  Plus,
  X
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { toast } from "sonner";
import api from "@/lib/api";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export default function WeeklyPlanner() {
  const navigate = useNavigate();
  const [recipes, setRecipes] = useState([]);
  const [weeklyPlan, setWeeklyPlan] = useState({});
  const [currentWeek, setCurrentWeek] = useState(getWeekStart(new Date()));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [selectedRecipeId, setSelectedRecipeId] = useState("");

  function getWeekStart(date) {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    const weekStart = new Date(d.setDate(diff));
    return weekStart.toISOString().split('T')[0];
  }

  function addDays(date, days) {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
  }

  function formatDate(dateStr, dayIndex) {
    const date = addDays(new Date(dateStr), dayIndex);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [recipesRes, planRes] = await Promise.all([
          api.getRecipes(),
          api.getWeeklyPlan(currentWeek)
        ]);
        
        setRecipes(recipesRes.data || []);
        
        // Convert plan to our format
        const plan = {};
        if (planRes.data?.days) {
          planRes.data.days.forEach(day => {
            plan[day.day] = day.recipe_ids;
          });
        }
        setWeeklyPlan(plan);
      } catch (error) {
        console.error("Error fetching data:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [currentWeek]);

  const addRecipeToDay = (day) => {
    if (!selectedRecipeId) {
      toast.error("Please select a recipe first");
      return;
    }
    
    setWeeklyPlan(prev => ({
      ...prev,
      [day]: [...(prev[day] || []), selectedRecipeId]
    }));
    setSelectedRecipeId("");
  };

  const removeRecipeFromDay = (day, recipeId) => {
    setWeeklyPlan(prev => ({
      ...prev,
      [day]: (prev[day] || []).filter(id => id !== recipeId)
    }));
  };

  const savePlan = async () => {
    setSaving(true);
    try {
      const days = DAYS.map(day => ({
        day,
        recipe_ids: weeklyPlan[day] || []
      }));
      
      await api.saveWeeklyPlan({
        week_start: currentWeek,
        days
      });
      
      toast.success("Week plan saved!");
    } catch (error) {
      console.error("Error saving plan:", error);
      toast.error("Failed to save plan");
    } finally {
      setSaving(false);
    }
  };

  const generateShoppingList = async () => {
    const allRecipeIds = DAYS.flatMap(day => weeklyPlan[day] || []);
    const uniqueIds = [...new Set(allRecipeIds)];
    
    if (uniqueIds.length === 0) {
      toast.error("Add some recipes to your week first");
      return;
    }
    
    setGenerating(true);
    try {
      await api.generateShoppingList(uniqueIds);
      toast.success("Shopping list generated!");
      navigate("/shopping-list");
    } catch (error) {
      console.error("Error generating list:", error);
      toast.error("Failed to generate shopping list");
    } finally {
      setGenerating(false);
    }
  };

  const getRecipeById = (id) => recipes.find(r => r.id === id);

  const totalMeals = DAYS.reduce((sum, day) => sum + (weeklyPlan[day]?.length || 0), 0);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-[#39ff14] animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen py-8" data-testid="weekly-planner-page">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
          <div>
            <h1 className="font-display text-3xl font-bold text-white mb-2">
              Weekly Meal Plan
            </h1>
            <p className="text-zinc-500">
              {totalMeals} meal{totalMeals !== 1 ? 's' : ''} planned this week
            </p>
          </div>
          
          <div className="flex items-center gap-3">
            <Button
              onClick={savePlan}
              disabled={saving}
              variant="outline"
              className="border-zinc-700 text-zinc-400 hover:bg-zinc-800"
              data-testid="save-plan-btn"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save Plan"}
            </Button>
            
            <Button
              onClick={generateShoppingList}
              disabled={generating || totalMeals === 0}
              className="btn-witch bg-[#39ff14] text-black hover:bg-[#32D712]"
              data-testid="generate-list-btn"
            >
              {generating ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <ShoppingCart className="w-4 h-4 mr-2" />
                  Generate List
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Week Navigation */}
        <div className="glass-card p-4 mb-8 flex items-center justify-between">
          <Button
            variant="ghost"
            onClick={() => setCurrentWeek(getWeekStart(addDays(currentWeek, -7)))}
            className="text-zinc-400 hover:text-white"
            data-testid="prev-week-btn"
          >
            <ChevronLeft className="w-5 h-5 mr-1" />
            Previous
          </Button>
          
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-[#39ff14]" />
            <span className="font-medium text-white">
              Week of {new Date(currentWeek).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
            </span>
          </div>
          
          <Button
            variant="ghost"
            onClick={() => setCurrentWeek(getWeekStart(addDays(currentWeek, 7)))}
            className="text-zinc-400 hover:text-white"
            data-testid="next-week-btn"
          >
            Next
            <ChevronRight className="w-5 h-5 ml-1" />
          </Button>
        </div>

        {/* Recipe Selector */}
        {recipes.length > 0 && (
          <div className="glass-card p-4 mb-8">
            <div className="flex items-center gap-4">
              <Sparkles className="w-5 h-5 text-[#39ff14]" />
              <span className="text-white font-medium">Add recipe to day:</span>
              <Select value={selectedRecipeId} onValueChange={setSelectedRecipeId}>
                <SelectTrigger className="w-64 bg-zinc-900 border-zinc-800 text-white" data-testid="recipe-selector">
                  <SelectValue placeholder="Select a recipe" />
                </SelectTrigger>
                <SelectContent className="bg-zinc-900 border-zinc-800">
                  {recipes.map(recipe => (
                    <SelectItem key={recipe.id} value={recipe.id} className="text-white hover:bg-zinc-800">
                      {recipe.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        {/* Week Grid */}
        <div className="grid grid-cols-1 md:grid-cols-7 gap-4">
          {DAYS.map((day, index) => (
            <div 
              key={day}
              className={`glass-card p-4 min-h-[200px] animate-fade-in-up stagger-${index + 1}`}
              data-testid={`day-${day.toLowerCase()}`}
            >
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-semibold text-white">{day}</h3>
                  <p className="text-xs text-zinc-500">{formatDate(currentWeek, index)}</p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => addRecipeToDay(day)}
                  disabled={!selectedRecipeId}
                  className="text-[#39ff14] hover:bg-[#39ff14]/10 h-8 w-8 p-0"
                  data-testid={`add-to-${day.toLowerCase()}`}
                >
                  <Plus className="w-4 h-4" />
                </Button>
              </div>

              {/* Recipes for this day */}
              <div className="space-y-2">
                {(weeklyPlan[day] || []).map((recipeId, i) => {
                  const recipe = getRecipeById(recipeId);
                  if (!recipe) return null;
                  
                  return (
                    <div 
                      key={`${recipeId}-${i}`}
                      className="flex items-center gap-2 p-2 rounded bg-zinc-900/50 border border-zinc-800 group"
                      data-testid={`meal-${day.toLowerCase()}-${i}`}
                    >
                      {recipe.image_url ? (
                        <div 
                          className="w-8 h-8 rounded bg-cover bg-center flex-shrink-0"
                          style={{ backgroundImage: `url(${recipe.image_url})` }}
                        />
                      ) : (
                        <div className="w-8 h-8 rounded bg-zinc-800 flex items-center justify-center flex-shrink-0">
                          <ChefHat className="w-4 h-4 text-zinc-600" />
                        </div>
                      )}
                      <span className="text-sm text-white truncate flex-1">
                        {recipe.name}
                      </span>
                      <button
                        onClick={() => removeRecipeFromDay(day, recipeId)}
                        className="opacity-0 group-hover:opacity-100 text-zinc-500 hover:text-red-500 transition-opacity"
                        data-testid={`remove-meal-${day.toLowerCase()}-${i}`}
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  );
                })}
                
                {(!weeklyPlan[day] || weeklyPlan[day].length === 0) && (
                  <p className="text-sm text-zinc-600 text-center py-4">
                    No meals planned
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Empty State */}
        {recipes.length === 0 && (
          <div className="glass-card p-12 text-center mt-8">
            <ChefHat className="w-16 h-16 text-zinc-700 mx-auto mb-4" />
            <h3 className="font-display text-xl font-bold text-white mb-2">
              No Recipes Available
            </h3>
            <p className="text-zinc-500 mb-6">
              Add some recipes first to start planning your week
            </p>
            <Button
              onClick={() => navigate("/add-recipe")}
              className="btn-witch bg-[#39ff14] text-black hover:bg-[#32D712]"
            >
              Add Recipe
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
