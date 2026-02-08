import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Search, ChefHat, Clock, Users, Trash2, PlusCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import api from "@/lib/api";

export default function RecipeLibrary() {
  const [recipes, setRecipes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => { fetchRecipes(); }, []);

  const fetchRecipes = async () => {
    try {
      const response = await api.getRecipes();
      setRecipes(response.data || []);
    } catch (error) {
      console.error("Error fetching recipes:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      await api.deleteRecipe(id);
      setRecipes(prev => prev.filter(r => r.id !== id));
      toast.success("Recipe deleted");
    } catch (error) {
      toast.error("Failed to delete");
    }
  };

  const filteredRecipes = recipes.filter(recipe =>
    recipe.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 text-[#4A7C59] animate-spin" /></div>;
  }

  return (
    <div className="min-h-screen py-8" data-testid="recipe-library-page">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
          <div>
            <h1 className="font-display text-3xl font-bold text-[#1A2E1A] mb-2">Recipes</h1>
            <p className="text-stone-500">{recipes.length} recipe{recipes.length !== 1 ? 's' : ''}</p>
          </div>
          <Link to="/add-recipe">
            <Button className="btn-primary" data-testid="add-new-recipe-btn">
              <PlusCircle className="w-4 h-4 mr-2" />Add Recipe
            </Button>
          </Link>
        </div>

        <div className="relative mb-8">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-stone-400" />
          <Input placeholder="Search recipes..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-12 fresh-input h-12" data-testid="search-recipes-input" />
        </div>

        {filteredRecipes.length > 0 ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredRecipes.map((recipe) => (
              <div key={recipe.id} className="fresh-card overflow-hidden group" data-testid={`recipe-card-${recipe.id}`}>
                <Link to={`/recipes/${recipe.id}`}>
                  {recipe.image_url ? (
                    <div className="h-48 bg-cover bg-center transition-transform duration-300 group-hover:scale-105" style={{ backgroundImage: `url(${recipe.image_url})` }} />
                  ) : (
                    <div className="h-48 bg-stone-100 flex items-center justify-center">
                      <ChefHat className="w-16 h-16 text-stone-300" />
                    </div>
                  )}
                </Link>
                <div className="p-6">
                  <Link to={`/recipes/${recipe.id}`}>
                    <h3 className="font-semibold text-lg text-[#1A2E1A] group-hover:text-[#4A7C59] transition-colors line-clamp-1 mb-2">{recipe.name}</h3>
                  </Link>
                  <div className="flex items-center gap-4 text-sm text-stone-500 mb-4">
                    <div className="flex items-center gap-1"><Users className="w-4 h-4" /><span>{recipe.servings}</span></div>
                    {recipe.prep_time && <div className="flex items-center gap-1"><Clock className="w-4 h-4" /><span>{recipe.prep_time}</span></div>}
                    <span className="text-[#4A7C59]">{recipe.ingredients?.length || 0} ingredients</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <Link to={`/recipes/${recipe.id}`}>
                      <Button variant="outline" size="sm" className="border-stone-200">View Recipe</Button>
                    </Link>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="sm" className="text-stone-400 hover:text-[#E07A5F]"><Trash2 className="w-4 h-4" /></Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent className="bg-white">
                        <AlertDialogHeader>
                          <AlertDialogTitle className="text-[#1A2E1A]">Delete Recipe?</AlertDialogTitle>
                          <AlertDialogDescription className="text-stone-500">This will permanently delete "{recipe.name}".</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel className="border-stone-200">Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleDelete(recipe.id)} className="bg-[#E07A5F] text-white hover:bg-[#D06A4F]">Delete</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="fresh-card-static p-12 text-center">
            <ChefHat className="w-16 h-16 text-stone-300 mx-auto mb-4" />
            <h3 className="font-display text-xl font-semibold text-[#1A2E1A] mb-2">{searchQuery ? "No recipes found" : "No recipes yet"}</h3>
            <p className="text-stone-500 mb-6">{searchQuery ? "Try a different search" : "Add your first recipe"}</p>
            {!searchQuery && <Link to="/add-recipe"><Button className="btn-primary"><PlusCircle className="w-4 h-4 mr-2" />Add Recipe</Button></Link>}
          </div>
        )}
      </div>
    </div>
  );
}
