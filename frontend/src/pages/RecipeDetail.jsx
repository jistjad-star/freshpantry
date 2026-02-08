import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { ArrowLeft, Clock, Users, ChefHat, Trash2, ShoppingCart, Loader2, ExternalLink, UtensilsCrossed } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import api from "@/lib/api";

export default function RecipeDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [recipe, setRecipe] = useState(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [cooking, setCooking] = useState(false);

  useEffect(() => {
    const fetchRecipe = async () => {
      try {
        const response = await api.getRecipe(id);
        setRecipe(response.data);
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
            <div className="h-64 md:h-80 bg-cover bg-center" style={{ backgroundImage: `url(${recipe.image_url})` }} />
          ) : (
            <div className="h-64 md:h-80 bg-stone-100 flex items-center justify-center">
              <ChefHat className="w-24 h-24 text-stone-300" />
            </div>
          )}
          
          <div className="p-8">
            <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
              <div>
                <h1 className="font-display text-3xl md:text-4xl font-bold text-[#1A2E1A] mb-3">{recipe.name}</h1>
                {recipe.description && <p className="text-stone-600 mb-4 max-w-2xl">{recipe.description}</p>}
                <div className="flex flex-wrap items-center gap-4 text-sm">
                  <div className="flex items-center gap-2 text-stone-500"><Users className="w-4 h-4" /><span>{recipe.servings} servings</span></div>
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
            <h2 className="font-display text-xl font-semibold text-[#1A2E1A] mb-6">
              Ingredients <span className="text-sm text-stone-500 font-normal">({recipe.ingredients?.length || 0})</span>
            </h2>
            {recipe.ingredients && recipe.ingredients.length > 0 ? (
              <ul className="space-y-3">
                {recipe.ingredients.map((ing, index) => (
                  <li key={index} className="flex items-center gap-3 p-3 rounded-xl bg-stone-50 border border-stone-100" data-testid={`ingredient-${index}`}>
                    <span className={`category-badge ${categoryColors[ing.category] || categoryColors.other}`}>{ing.category}</span>
                    <span className="text-[#1A2E1A]"><span className="text-[#4A7C59] font-medium">{ing.quantity} {ing.unit}</span> {ing.name}</span>
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
