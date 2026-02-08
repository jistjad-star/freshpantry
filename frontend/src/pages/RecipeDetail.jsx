import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { 
  ArrowLeft, 
  Clock, 
  Users, 
  ChefHat,
  Trash2,
  ShoppingCart,
  Loader2,
  ExternalLink
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import api from "@/lib/api";

export default function RecipeDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [recipe, setRecipe] = useState(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    const fetchRecipe = async () => {
      try {
        const response = await api.getRecipe(id);
        setRecipe(response.data);
      } catch (error) {
        console.error("Error fetching recipe:", error);
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
      console.error("Error deleting recipe:", error);
      toast.error("Failed to delete recipe");
    }
  };

  const handleGenerateList = async () => {
    setGenerating(true);
    try {
      await api.generateShoppingList([id]);
      toast.success("Shopping list generated!");
      navigate("/shopping-list");
    } catch (error) {
      console.error("Error generating list:", error);
      toast.error("Failed to generate shopping list");
    } finally {
      setGenerating(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-[#39ff14] animate-spin" />
      </div>
    );
  }

  if (!recipe) return null;

  const categoryColors = {
    produce: "category-produce",
    dairy: "category-dairy",
    protein: "category-protein",
    grains: "category-grains",
    pantry: "category-pantry",
    spices: "category-spices",
    frozen: "category-frozen",
    other: "category-other"
  };

  return (
    <div className="min-h-screen py-8" data-testid="recipe-detail-page">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Back Button */}
        <Link 
          to="/recipes" 
          className="inline-flex items-center gap-2 text-zinc-400 hover:text-white mb-6 transition-colors"
          data-testid="back-to-recipes"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Recipes
        </Link>

        {/* Hero */}
        <div className="glass-card overflow-hidden mb-8 animate-fade-in-up">
          {recipe.image_url ? (
            <div 
              className="h-64 md:h-80 bg-cover bg-center"
              style={{ backgroundImage: `url(${recipe.image_url})` }}
            />
          ) : (
            <div className="h-64 md:h-80 bg-zinc-900 flex items-center justify-center">
              <ChefHat className="w-24 h-24 text-zinc-700" />
            </div>
          )}
          
          <div className="p-8">
            <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
              <div>
                <h1 className="font-display text-3xl md:text-4xl font-bold text-white mb-3">
                  {recipe.name}
                </h1>
                
                {recipe.description && (
                  <p className="text-zinc-400 mb-4 max-w-2xl">
                    {recipe.description}
                  </p>
                )}

                {/* Meta */}
                <div className="flex flex-wrap items-center gap-4 text-sm">
                  <div className="flex items-center gap-2 text-zinc-400">
                    <Users className="w-4 h-4" />
                    <span>{recipe.servings} servings</span>
                  </div>
                  {recipe.prep_time && (
                    <div className="flex items-center gap-2 text-zinc-400">
                      <Clock className="w-4 h-4" />
                      <span>Prep: {recipe.prep_time}</span>
                    </div>
                  )}
                  {recipe.cook_time && (
                    <div className="flex items-center gap-2 text-zinc-400">
                      <Clock className="w-4 h-4" />
                      <span>Cook: {recipe.cook_time}</span>
                    </div>
                  )}
                  {recipe.source_url && (
                    <a 
                      href={recipe.source_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-[#39ff14] hover:underline"
                    >
                      <ExternalLink className="w-4 h-4" />
                      <span>Source</span>
                    </a>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-3">
                <Button
                  onClick={handleGenerateList}
                  disabled={generating}
                  className="btn-witch bg-[#39ff14] text-black hover:bg-[#32D712]"
                  data-testid="generate-shopping-list-btn"
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

                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="outline"
                      className="border-red-900 text-red-500 hover:bg-red-900/20"
                      data-testid="delete-recipe-btn"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent className="bg-zinc-900 border-zinc-800">
                    <AlertDialogHeader>
                      <AlertDialogTitle className="text-white">Delete Recipe?</AlertDialogTitle>
                      <AlertDialogDescription className="text-zinc-400">
                        This will permanently delete "{recipe.name}". 
                        This action cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel className="border-zinc-700 text-zinc-400 hover:bg-zinc-800">
                        Cancel
                      </AlertDialogCancel>
                      <AlertDialogAction
                        onClick={handleDelete}
                        className="bg-red-600 text-white hover:bg-red-700"
                        data-testid="confirm-delete-recipe"
                      >
                        Delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-8">
          {/* Ingredients */}
          <div className="glass-card p-8 animate-fade-in-up stagger-1">
            <h2 className="font-display text-xl font-bold text-white mb-6">
              Ingredients
              <span className="ml-2 text-sm font-normal text-zinc-500">
                ({recipe.ingredients?.length || 0})
              </span>
            </h2>

            {recipe.ingredients && recipe.ingredients.length > 0 ? (
              <ul className="space-y-3">
                {recipe.ingredients.map((ing, index) => (
                  <li 
                    key={index}
                    className="flex items-center gap-3 p-3 rounded-lg bg-zinc-900/50 border border-zinc-800"
                    data-testid={`ingredient-${index}`}
                  >
                    <span className={`category-badge ${categoryColors[ing.category] || categoryColors.other}`}>
                      {ing.category}
                    </span>
                    <span className="text-white">
                      <span className="text-[#39ff14] font-medium">
                        {ing.quantity} {ing.unit}
                      </span>
                      {" "}{ing.name}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-zinc-500">No ingredients listed</p>
            )}
          </div>

          {/* Instructions */}
          <div className="glass-card p-8 animate-fade-in-up stagger-2">
            <h2 className="font-display text-xl font-bold text-white mb-6">
              Instructions
              <span className="ml-2 text-sm font-normal text-zinc-500">
                ({recipe.instructions?.length || 0} steps)
              </span>
            </h2>

            {recipe.instructions && recipe.instructions.length > 0 ? (
              <ol className="space-y-4">
                {recipe.instructions.map((step, index) => (
                  <li 
                    key={index}
                    className="flex gap-4"
                    data-testid={`instruction-${index}`}
                  >
                    <span className="flex-shrink-0 w-8 h-8 rounded-full bg-[#39ff14]/10 text-[#39ff14] flex items-center justify-center text-sm font-bold">
                      {index + 1}
                    </span>
                    <p className="text-zinc-300 pt-1">{step}</p>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-zinc-500">No instructions listed</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
