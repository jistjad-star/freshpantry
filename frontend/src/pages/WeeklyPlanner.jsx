import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Calendar, ChefHat, ShoppingCart, ChevronLeft, ChevronRight, Loader2, Plus, X, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import api from "@/lib/api";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const MAX_MEALS_PER_WEEK = 7;

export default function WeeklyPlanner() {
  const navigate = useNavigate();
  const location = useLocation();
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

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [recipesRes, planRes] = await Promise.all([api.getRecipes(), api.getWeeklyPlan(currentWeek)]);
        setRecipes(recipesRes.data || []);
        const plan = {};
        if (planRes.data?.days) { planRes.data.days.forEach(day => { plan[day.day] = day.recipe_ids; }); }
        setWeeklyPlan(plan);
      } catch (error) { console.error("Error:", error); } finally { setLoading(false); }
    };
    fetchData();
  }, [currentWeek]);

  const addRecipeToDay = (day) => {
    if (!selectedRecipeId) { toast.error("Select a recipe first"); return; }
    setWeeklyPlan(prev => ({ ...prev, [day]: [...(prev[day] || []), selectedRecipeId] }));
    setSelectedRecipeId("");
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
  const totalMeals = DAYS.reduce((sum, day) => sum + (weeklyPlan[day]?.length || 0), 0);

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 text-[#4A7C59] animate-spin" /></div>;

  return (
    <div className="min-h-screen py-8" data-testid="weekly-planner-page">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
          <div>
            <h1 className="font-display text-3xl font-bold text-[#1A2E1A] mb-2">Weekly Plan</h1>
            <p className="text-stone-500">{totalMeals} meal{totalMeals !== 1 ? 's' : ''} planned</p>
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

        {recipes.length > 0 && (
          <div className="fresh-card-static p-4 mb-8">
            <div className="flex items-center gap-4">
              <span className="text-[#1A2E1A] font-medium">Add recipe:</span>
              <Select value={selectedRecipeId} onValueChange={setSelectedRecipeId}>
                <SelectTrigger className="w-64 fresh-input"><SelectValue placeholder="Select a recipe" /></SelectTrigger>
                <SelectContent className="bg-white">{recipes.map(recipe => <SelectItem key={recipe.id} value={recipe.id}>{recipe.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-7 gap-4">
          {DAYS.map((day, index) => (
            <div key={day} className="fresh-card-static p-4 min-h-[200px] animate-fade-in-up" style={{ animationDelay: `${index * 0.05}s` }} data-testid={`day-${day.toLowerCase()}`}>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-semibold text-[#1A2E1A]">{day}</h3>
                  <p className="text-xs text-stone-500">{formatDate(currentWeek, index)}</p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => addRecipeToDay(day)} disabled={!selectedRecipeId} className="text-[#4A7C59] hover:bg-[#4A7C59]/10 h-8 w-8 p-0"><Plus className="w-4 h-4" /></Button>
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
