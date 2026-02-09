import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Leaf, ChefHat, Clock, Users, Download, Loader2, Check, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import api from "@/lib/api";
import { useAuth } from "@/lib/AuthContext";

export default function SharedRecipes() {
  const { shareId } = useParams();
  const navigate = useNavigate();
  const { user, login } = useAuth();
  const [recipes, setRecipes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchShared = async () => {
      try {
        const response = await api.getSharedRecipes(shareId);
        setRecipes(response.data.recipes || []);
      } catch (err) {
        setError("Share link not found or expired");
      } finally {
        setLoading(false);
      }
    };
    fetchShared();
  }, [shareId]);

  const handleImport = async () => {
    if (!user) {
      toast.error("Please sign in to import recipes");
      login();
      return;
    }

    setImporting(true);
    try {
      const response = await api.importSharedRecipes(shareId);
      toast.success(`Imported ${response.data.count} recipes!`);
      navigate("/recipes");
    } catch (err) {
      toast.error("Failed to import recipes");
    } finally {
      setImporting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FAFAF9] flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-[#4A7C59] mx-auto mb-4 animate-spin" />
          <p className="text-stone-500">Loading shared recipes...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#FAFAF9] flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          <AlertCircle className="w-16 h-16 text-[#E07A5F] mx-auto mb-4" />
          <h1 className="text-2xl font-semibold text-[#1A2E1A] mb-2">Link Not Found</h1>
          <p className="text-stone-500 mb-6">{error}</p>
          <Button onClick={() => navigate("/")} className="btn-primary">
            Go to Fresh Pantry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAFAF9]">
      {/* Header */}
      <header className="bg-white border-b border-stone-200 py-4">
        <div className="max-w-4xl mx-auto px-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#4A7C59]/10 flex items-center justify-center">
              <Leaf className="w-5 h-5 text-[#4A7C59]" />
            </div>
            <div>
              <h1 className="font-display text-xl font-semibold text-[#1A2E1A]">Fresh Pantry</h1>
              <p className="text-xs text-stone-500">Shared Recipes</p>
            </div>
          </div>
          <Button onClick={handleImport} disabled={importing} className="btn-primary" data-testid="import-shared-btn">
            {importing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Download className="w-4 h-4 mr-2" />}
            {user ? `Import All (${recipes.length})` : "Sign in to Import"}
          </Button>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="text-center mb-8">
          <h2 className="text-2xl font-semibold text-[#1A2E1A] mb-2">
            {recipes.length} Recipe{recipes.length !== 1 ? 's' : ''} Shared With You
          </h2>
          <p className="text-stone-500">Import them to your Fresh Pantry library</p>
        </div>

        <div className="grid gap-4">
          {recipes.map((recipe, index) => (
            <div key={index} className="bg-white rounded-xl border border-stone-200 p-6 flex gap-4">
              {recipe.image_url && (
                <img 
                  src={recipe.image_url} 
                  alt={recipe.name}
                  className="w-24 h-24 rounded-lg object-cover flex-shrink-0"
                />
              )}
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-lg text-[#1A2E1A] mb-1">{recipe.name}</h3>
                {recipe.description && (
                  <p className="text-stone-500 text-sm mb-3 line-clamp-2">{recipe.description}</p>
                )}
                <div className="flex items-center gap-4 text-sm text-stone-500">
                  <div className="flex items-center gap-1">
                    <Users className="w-4 h-4" />
                    <span>{recipe.servings} servings</span>
                  </div>
                  {recipe.prep_time && (
                    <div className="flex items-center gap-1">
                      <Clock className="w-4 h-4" />
                      <span>{recipe.prep_time}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-1">
                    <ChefHat className="w-4 h-4" />
                    <span>{recipe.ingredients?.length || 0} ingredients</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {!user && (
          <div className="mt-8 text-center p-6 bg-[#4A7C59]/5 rounded-xl border border-[#4A7C59]/20">
            <p className="text-[#1A2E1A] mb-4">Sign in to import these recipes to your library</p>
            <Button onClick={login} className="btn-primary">
              Sign in with Google
            </Button>
          </div>
        )}
      </main>
    </div>
  );
}
