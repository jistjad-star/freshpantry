import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { ArrowLeft, Clock, Users, ChefHat, Trash2, ShoppingCart, Loader2, ExternalLink, UtensilsCrossed, ImagePlus, Sparkles, Minus, Plus, Pencil, X, Check, Leaf, Fish, Salad, Zap, Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import api from "@/lib/api";

const ALL_CATEGORIES = [
  { value: "vegan", label: "Vegan", icon: Leaf, color: "bg-green-100 text-green-700 border-green-200" },
  { value: "vegetarian", label: "Veggie", icon: Salad, color: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  { value: "pescatarian", label: "Pescatarian", icon: Fish, color: "bg-blue-100 text-blue-700 border-blue-200" },
  { value: "low-fat", label: "Low Fat", icon: Heart, color: "bg-pink-100 text-pink-700 border-pink-200" },
  { value: "quick-easy", label: "Quick & Easy", icon: Zap, color: "bg-amber-100 text-amber-700 border-amber-200" },
];

export default function RecipeDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [recipe, setRecipe] = useState(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [cooking, setCooking] = useState(false);
  const [generatingImage, setGeneratingImage] = useState(false);
  const [servings, setServings] = useState(null);
  const [editingCategories, setEditingCategories] = useState(false);
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [savingCategories, setSavingCategories] = useState(false);

  useEffect(() => {
    const fetchRecipe = async () => {
      try {
        const response = await api.getRecipe(id);
        setRecipe(response.data);
        setServings(response.data.servings || 2);
        setSelectedCategories(response.data.categories || []);
      } catch (error) {
        toast.error("Recipe not found");
        navigate("/recipes");
      } finally {
        setLoading(false);
      }
    };
    fetchRecipe();
  }, [id, navigate]);

  const handleDelete = async () => {
    try {
      await api.deleteRecipe(id);
      toast.success("Recipe deleted");
      navigate("/recipes");
    } catch (error) {
      toast.error("Failed to delete");
    }
  };

  const handleGenerateList = async () => {
    setGenerating(true);
    try {
      await api.generateShoppingList([id]);
      toast.success("Shopping list generated!");
      navigate("/shopping-list");
    } catch (error) {
      toast.error("Failed to generate list");
    } finally {
      setGenerating(false);
    }
  };

  const handleGenerateImage = async () => {
    setGeneratingImage(true);
    toast.info("Generating AI image... This may take a minute.");
    try {
      const response = await api.generateRecipeImage(id);
      setRecipe(prev => ({ ...prev, image_url: response.data.image_url }));
      toast.success("Image generated!");
    } catch (error) {
      toast.error("Failed to generate image");
    } finally {
      setGeneratingImage(false);
    }
  };

  const handleCook = async () => {
    setCooking(true);
    try {
      const response = await api.cookRecipe(id);
      const deducted = response.data.deducted?.length || 0;
      const missing = response.data.missing_ingredients?.length || 0;
      
      if (deducted > 0) {
        toast.success(`Cooked! ${deducted} ingredients deducted from pantry.`);
      }
      if (missing > 0) {
        toast.warning(`${missing} ingredients not in pantry: ${response.data.missing_ingredients.slice(0, 3).join(', ')}`);
      }
    } catch (error) {
      toast.error("Failed to update pantry");
    } finally {
      setCooking(false);
    }
  };

  // Scale ingredient quantity based on servings
  const scaleQuantity = (originalQty, originalServings, newServings) => {
    if (!originalQty || !originalServings || !newServings) return originalQty;
    
    const multiplier = newServings / originalServings;
    
    // Try to parse the quantity
    const qtyStr = String(originalQty).trim();
    
    // Handle fractions like "1/2", "1/4"
    if (qtyStr.includes('/')) {
      const parts = qtyStr.split('/');
      if (parts.length === 2) {
        const num = parseFloat(parts[0]) || 0;
        const denom = parseFloat(parts[1]) || 1;
        const scaled = (num / denom) * multiplier;
        
        // Format nicely
        if (scaled === Math.floor(scaled)) return String(Math.floor(scaled));
        if (scaled >= 1) return scaled.toFixed(1).replace(/\.0$/, '');
        
        // Convert back to fraction if small
        if (Math.abs(scaled - 0.25) < 0.05) return '1/4';
        if (Math.abs(scaled - 0.33) < 0.05) return '1/3';
        if (Math.abs(scaled - 0.5) < 0.05) return '1/2';
        if (Math.abs(scaled - 0.67) < 0.05) return '2/3';
        if (Math.abs(scaled - 0.75) < 0.05) return '3/4';
        
        return scaled.toFixed(2).replace(/\.?0+$/, '');
      }
    }
    
    // Handle mixed numbers like "1 1/2"
    const mixedMatch = qtyStr.match(/^(\d+)\s+(\d+)\/(\d+)$/);
    if (mixedMatch) {
      const whole = parseInt(mixedMatch[1]);
      const num = parseInt(mixedMatch[2]);
      const denom = parseInt(mixedMatch[3]);
      const total = (whole + num / denom) * multiplier;
      if (total === Math.floor(total)) return String(Math.floor(total));
      return total.toFixed(1).replace(/\.0$/, '');
    }
    
    // Handle plain numbers
    const num = parseFloat(qtyStr);
    if (!isNaN(num)) {
      const scaled = num * multiplier;
      if (scaled === Math.floor(scaled)) return String(Math.floor(scaled));
      return scaled.toFixed(1).replace(/\.0$/, '');
    }
    
    return originalQty; // Return original if can't parse
  };

  const originalServings = recipe?.servings || 2;
  const scaledIngredients = recipe?.ingredients?.map(ing => ({
    ...ing,
    scaledQuantity: scaleQuantity(ing.quantity, originalServings, servings)
  })) || [];

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 text-[#4A7C59] animate-spin" /></div>;
  }

  if (!recipe) return null;

  const categoryColors = {
    produce: "category-produce", dairy: "category-dairy", protein: "category-protein",
    grains: "category-grains", pantry: "category-pantry", spices: "category-spices",
    frozen: "category-frozen", other: "category-other"
  };

  return (
    <div className="min-h-screen py-8" data-testid="recipe-detail-page">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <Link to="/recipes" className="inline-flex items-center gap-2 text-stone-500 hover:text-[#4A7C59] mb-6 transition-colors" data-testid="back-to-recipes">
          <ArrowLeft className="w-4 h-4" />Back to Recipes
        </Link>

        <div className="fresh-card-static overflow-hidden mb-8 animate-fade-in-up">
          {recipe.image_url ? (
            <div className="h-64 md:h-80 bg-cover bg-center relative" style={{ backgroundImage: `url(${recipe.image_url})` }}>
              <Button 
                onClick={handleGenerateImage} 
                disabled={generatingImage}
                variant="outline"
                size="sm"
                className="absolute bottom-4 right-4 bg-white/90 hover:bg-white"
              >
                {generatingImage ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Sparkles className="w-4 h-4 mr-1" />Regenerate</>}
              </Button>
            </div>
          ) : (
            <div className="h-64 md:h-80 bg-stone-100 flex flex-col items-center justify-center gap-4">
              <ChefHat className="w-24 h-24 text-stone-300" />
              <Button 
                onClick={handleGenerateImage} 
                disabled={generatingImage}
                className="btn-primary"
                data-testid="generate-image-btn"
              >
                {generatingImage ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Generating...</>
                ) : (
                  <><ImagePlus className="w-4 h-4 mr-2" />Generate AI Image</>
                )}
              </Button>
              <p className="text-sm text-stone-400">Creates an appetizing photo using AI</p>
            </div>
          )}
          
          <div className="p-8">
            <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
              <div>
                <h1 className="font-display text-3xl md:text-4xl font-bold text-[#1A2E1A] mb-3">{recipe.name}</h1>
                {recipe.description && <p className="text-stone-600 mb-4 max-w-2xl">{recipe.description}</p>}
                
                {/* Category badges */}
                {recipe.categories?.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-4">
                    {recipe.categories.map(cat => (
                      <span key={cat} className="px-3 py-1 rounded-full text-xs font-medium bg-[#4A7C59]/10 text-[#4A7C59]">
                        {cat.replace('-', ' ')}
                      </span>
                    ))}
                  </div>
                )}
                
                <div className="flex flex-wrap items-center gap-4 text-sm">
                  {/* Servings Adjuster */}
                  <div className="flex items-center gap-2 bg-stone-50 rounded-lg px-3 py-1.5 border border-stone-200">
                    <Users className="w-4 h-4 text-stone-500" />
                    <button 
                      onClick={() => setServings(Math.max(1, servings - 1))}
                      className="w-6 h-6 rounded-full bg-stone-200 hover:bg-stone-300 flex items-center justify-center text-stone-600 transition-colors"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    <span className="font-medium text-[#1A2E1A] min-w-[60px] text-center">
                      {servings} {servings === 1 ? 'serving' : 'servings'}
                    </span>
                    <button 
                      onClick={() => setServings(Math.min(20, servings + 1))}
                      className="w-6 h-6 rounded-full bg-[#4A7C59] hover:bg-[#3A6C49] flex items-center justify-center text-white transition-colors"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                    {servings !== originalServings && (
                      <button 
                        onClick={() => setServings(originalServings)}
                        className="text-xs text-[#4A7C59] hover:underline ml-1"
                      >
                        Reset
                      </button>
                    )}
                  </div>
                  
                  {recipe.prep_time && <div className="flex items-center gap-2 text-stone-500"><Clock className="w-4 h-4" /><span>Prep: {recipe.prep_time}</span></div>}
                  {recipe.cook_time && <div className="flex items-center gap-2 text-stone-500"><Clock className="w-4 h-4" /><span>Cook: {recipe.cook_time}</span></div>}
                  {recipe.source_url && <a href={recipe.source_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-[#4A7C59] hover:underline"><ExternalLink className="w-4 h-4" /><span>Source</span></a>}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <Button onClick={handleCook} disabled={cooking} className="btn-secondary" data-testid="cook-recipe-btn">
                  {cooking ? <Loader2 className="w-4 h-4 animate-spin" /> : <><UtensilsCrossed className="w-4 h-4 mr-2" />I Cooked This</>}
                </Button>
                <Button onClick={handleGenerateList} disabled={generating} className="btn-primary" data-testid="generate-shopping-list-btn">
                  {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <><ShoppingCart className="w-4 h-4 mr-2" />Shop</>}
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="outline" className="border-[#E07A5F]/50 text-[#E07A5F] hover:bg-[#E07A5F]/10" data-testid="delete-recipe-btn"><Trash2 className="w-4 h-4" /></Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent className="bg-white">
                    <AlertDialogHeader>
                      <AlertDialogTitle className="text-[#1A2E1A]">Delete Recipe?</AlertDialogTitle>
                      <AlertDialogDescription className="text-stone-500">This will permanently delete "{recipe.name}".</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel className="border-stone-200">Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={handleDelete} className="bg-[#E07A5F] text-white hover:bg-[#D06A4F]">Delete</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-8">
          <div className="fresh-card-static p-8 animate-fade-in-up stagger-1">
            <div className="flex items-center justify-between mb-6">
              <h2 className="font-display text-xl font-semibold text-[#1A2E1A]">
                Ingredients <span className="text-sm text-stone-500 font-normal">({recipe.ingredients?.length || 0})</span>
              </h2>
              {servings !== originalServings && (
                <span className="text-xs text-[#4A7C59] bg-[#4A7C59]/10 px-2 py-1 rounded-full">
                  Adjusted for {servings}
                </span>
              )}
            </div>
            {scaledIngredients.length > 0 ? (
              <ul className="space-y-3">
                {scaledIngredients.map((ing, index) => (
                  <li key={index} className="flex items-center gap-3 p-3 rounded-xl bg-stone-50 border border-stone-100" data-testid={`ingredient-${index}`}>
                    <span className={`category-badge ${categoryColors[ing.category] || categoryColors.other}`}>{ing.category}</span>
                    <span className="text-[#1A2E1A]">
                      <span className={`font-medium ${servings !== originalServings ? 'text-[#4A7C59] bg-[#4A7C59]/10 px-1.5 py-0.5 rounded' : 'text-[#4A7C59]'}`}>
                        {ing.scaledQuantity} {ing.unit}
                      </span> {ing.name}
                    </span>
                  </li>
                ))}
              </ul>
            ) : <p className="text-stone-500">No ingredients listed</p>}
          </div>

          <div className="fresh-card-static p-8 animate-fade-in-up stagger-2">
            <h2 className="font-display text-xl font-semibold text-[#1A2E1A] mb-6">
              Instructions <span className="text-sm text-stone-500 font-normal">({recipe.instructions?.length || 0} steps)</span>
            </h2>
            {recipe.instructions && recipe.instructions.length > 0 ? (
              <ol className="space-y-4">
                {recipe.instructions.map((step, index) => (
                  <li key={index} className="flex gap-4" data-testid={`instruction-${index}`}>
                    <span className="flex-shrink-0 w-8 h-8 rounded-full bg-[#4A7C59]/10 text-[#4A7C59] flex items-center justify-center text-sm font-bold">{index + 1}</span>
                    <p className="text-stone-600 pt-1">{step}</p>
                  </li>
                ))}
              </ol>
            ) : <p className="text-stone-500">No instructions listed</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
