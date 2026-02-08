import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { 
  Search, 
  ChefHat, 
  Clock, 
  Users,
  Trash2,
  PlusCircle,
  Loader2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

export default function RecipeLibrary() {
  const [recipes, setRecipes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [deletingId, setDeletingId] = useState(null);

  useEffect(() => {
    fetchRecipes();
  }, []);

  const fetchRecipes = async () => {
    try {
      const response = await api.getRecipes();
      setRecipes(response.data || []);
    } catch (error) {
      console.error("Error fetching recipes:", error);
      toast.error("Failed to load recipes");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    setDeletingId(id);
    try {
      await api.deleteRecipe(id);
      setRecipes(prev => prev.filter(r => r.id !== id));
      toast.success("Recipe deleted");
    } catch (error) {
      console.error("Error deleting recipe:", error);
      toast.error("Failed to delete recipe");
    } finally {
      setDeletingId(null);
    }
  };

  const filteredRecipes = recipes.filter(recipe =>
    recipe.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    recipe.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-[#39ff14] animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen py-8" data-testid="recipe-library-page">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
          <div>
            <h1 className="font-display text-3xl font-bold text-white mb-2">
              Recipe Library
            </h1>
            <p className="text-zinc-500">
              {recipes.length} recipe{recipes.length !== 1 ? 's' : ''} in your spellbook
            </p>
          </div>
          
          <Link to="/add-recipe">
            <Button className="btn-witch bg-[#39ff14] text-black hover:bg-[#32D712]" data-testid="add-new-recipe-btn">
              <PlusCircle className="w-4 h-4 mr-2" />
              Add Recipe
            </Button>
          </Link>
        </div>

        {/* Search */}
        <div className="relative mb-8">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
          <Input
            placeholder="Search recipes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-12 bg-zinc-900 border-zinc-800 focus:border-[#39ff14] text-white h-12"
            data-testid="search-recipes-input"
          />
        </div>

        {/* Recipe Grid */}
        {filteredRecipes.length > 0 ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredRecipes.map((recipe, i) => (
              <div 
                key={recipe.id}
                className={`glass-card overflow-hidden group animate-fade-in-up stagger-${(i % 5) + 1}`}
                data-testid={`recipe-card-${recipe.id}`}
              >
                {/* Image */}
                <Link to={`/recipes/${recipe.id}`}>
                  {recipe.image_url ? (
                    <div 
                      className="h-48 bg-cover bg-center transition-transform duration-300 group-hover:scale-105"
                      style={{ backgroundImage: `url(${recipe.image_url})` }}
                    />
                  ) : (
                    <div className="h-48 bg-zinc-900 flex items-center justify-center">
                      <ChefHat className="w-16 h-16 text-zinc-700" />
                    </div>
                  )}
                </Link>

                {/* Content */}
                <div className="p-6">
                  <Link to={`/recipes/${recipe.id}`}>
                    <h3 className="font-semibold text-lg text-white group-hover:text-[#39ff14] transition-colors line-clamp-1 mb-2">
                      {recipe.name}
                    </h3>
                  </Link>
                  
                  {recipe.description && (
                    <p className="text-sm text-zinc-500 line-clamp-2 mb-4">
                      {recipe.description}
                    </p>
                  )}

                  {/* Meta */}
                  <div className="flex items-center gap-4 text-sm text-zinc-500 mb-4">
                    <div className="flex items-center gap-1">
                      <Users className="w-4 h-4" />
                      <span>{recipe.servings}</span>
                    </div>
                    {recipe.prep_time && (
                      <div className="flex items-center gap-1">
                        <Clock className="w-4 h-4" />
                        <span>{recipe.prep_time}</span>
                      </div>
                    )}
                    <span className="text-[#39ff14]">
                      {recipe.ingredients?.length || 0} ingredients
                    </span>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center justify-between">
                    <Link to={`/recipes/${recipe.id}`}>
                      <Button 
                        variant="outline" 
                        size="sm"
                        className="border-zinc-700 text-zinc-400 hover:text-white hover:border-zinc-600"
                        data-testid={`view-recipe-${recipe.id}`}
                      >
                        View Recipe
                      </Button>
                    </Link>

                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-zinc-500 hover:text-red-500"
                          data-testid={`delete-recipe-btn-${recipe.id}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent className="bg-zinc-900 border-zinc-800">
                        <AlertDialogHeader>
                          <AlertDialogTitle className="text-white">Delete Recipe?</AlertDialogTitle>
                          <AlertDialogDescription className="text-zinc-400">
                            This will permanently delete "{recipe.name}" from your library. 
                            This action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel className="border-zinc-700 text-zinc-400 hover:bg-zinc-800">
                            Cancel
                          </AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleDelete(recipe.id)}
                            className="bg-red-600 text-white hover:bg-red-700"
                            data-testid={`confirm-delete-${recipe.id}`}
                          >
                            {deletingId === recipe.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              "Delete"
                            )}
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="glass-card p-12 text-center">
            <ChefHat className="w-16 h-16 text-zinc-700 mx-auto mb-4" />
            <h3 className="font-display text-xl font-bold text-white mb-2">
              {searchQuery ? "No recipes found" : "No recipes yet"}
            </h3>
            <p className="text-zinc-500 mb-6">
              {searchQuery 
                ? "Try a different search term"
                : "Add your first recipe to get started"}
            </p>
            {!searchQuery && (
              <Link to="/add-recipe">
                <Button className="btn-witch bg-[#39ff14] text-black hover:bg-[#32D712]">
                  <PlusCircle className="w-4 h-4 mr-2" />
                  Add Recipe
                </Button>
              </Link>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
