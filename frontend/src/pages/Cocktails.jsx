import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { 
  GlassWater, 
  Loader2, 
  Search, 
  Plus, 
  Wine, 
  Star,
  Clock,
  Users
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@/components/ui/toggle-group";
import api from "@/lib/api";

export default function Cocktails() {
  const [cocktails, setCocktails] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [alcoholicFilter, setAlcoholicFilter] = useState("all"); // "all", "alcoholic", "non-alcoholic"

  useEffect(() => {
    fetchCocktails();
  }, [alcoholicFilter]);

  const fetchCocktails = async () => {
    setLoading(true);
    try {
      let alcoholicParam = null;
      if (alcoholicFilter === "alcoholic") alcoholicParam = "true";
      else if (alcoholicFilter === "non-alcoholic") alcoholicParam = "false";
      
      const response = await api.getCocktails(alcoholicParam);
      setCocktails(response.data || []);
    } catch (error) {
      console.error("Error fetching cocktails:", error);
      setCocktails([]);
    } finally {
      setLoading(false);
    }
  };

  // Filter by search query
  const filteredCocktails = cocktails.filter(cocktail => 
    cocktail.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    cocktail.ingredients?.some(ing => ing.name.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-[#4A7C59] animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen py-8" data-testid="cocktails-page">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
          <div>
            <h1 className="font-display text-3xl font-bold text-[#1A2E1A] mb-2 flex items-center gap-3">
              <GlassWater className="w-8 h-8 text-purple-500" />
              Cocktails
            </h1>
            <p className="text-stone-500">
              {filteredCocktails.length} cocktail{filteredCocktails.length !== 1 ? 's' : ''} in your collection
            </p>
          </div>
          
          <Link to="/add-recipe?type=cocktail">
            <Button className="btn-primary" data-testid="add-cocktail-btn">
              <Plus className="w-4 h-4 mr-2" />
              Add Cocktail
            </Button>
          </Link>
        </div>

        {/* Filters */}
        <div className="fresh-card-static p-4 mb-6 flex flex-col md:flex-row gap-4 items-center">
          {/* Search */}
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
            <Input
              placeholder="Search cocktails..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="fresh-input pl-10"
              data-testid="cocktail-search"
            />
          </div>
          
          {/* Alcoholic Filter */}
          <ToggleGroup 
            type="single" 
            value={alcoholicFilter}
            onValueChange={(value) => value && setAlcoholicFilter(value)}
            className="bg-stone-100 rounded-lg p-1"
          >
            <ToggleGroupItem 
              value="all" 
              className="data-[state=on]:bg-white data-[state=on]:shadow-sm rounded-md px-4 py-2 text-sm font-medium"
              data-testid="filter-all"
            >
              All
            </ToggleGroupItem>
            <ToggleGroupItem 
              value="alcoholic" 
              className="data-[state=on]:bg-white data-[state=on]:shadow-sm rounded-md px-4 py-2 text-sm font-medium flex items-center gap-2"
              data-testid="filter-alcoholic"
            >
              <Wine className="w-4 h-4 text-purple-500" />
              Alcoholic
            </ToggleGroupItem>
            <ToggleGroupItem 
              value="non-alcoholic" 
              className="data-[state=on]:bg-white data-[state=on]:shadow-sm rounded-md px-4 py-2 text-sm font-medium flex items-center gap-2"
              data-testid="filter-non-alcoholic"
            >
              <GlassWater className="w-4 h-4 text-teal-500" />
              Non-Alcoholic
            </ToggleGroupItem>
          </ToggleGroup>
        </div>

        {/* Cocktail Grid */}
        {filteredCocktails.length > 0 ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredCocktails.map((cocktail) => (
              <Link 
                key={cocktail.id} 
                to={`/recipes/${cocktail.id}`}
                className="fresh-card-hover group"
                data-testid={`cocktail-card-${cocktail.id}`}
              >
                {/* Image */}
                <div className="relative aspect-[4/3] overflow-hidden rounded-t-2xl bg-gradient-to-br from-purple-100 to-purple-50">
                  {cocktail.image_url ? (
                    <img
                      src={cocktail.image_url}
                      alt={cocktail.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <GlassWater className="w-16 h-16 text-purple-300" />
                    </div>
                  )}
                  
                  {/* Alcoholic Badge */}
                  <div className={`absolute top-3 right-3 px-2 py-1 rounded-full text-xs font-medium ${
                    cocktail.is_alcoholic 
                      ? 'bg-purple-500 text-white' 
                      : 'bg-teal-500 text-white'
                  }`}>
                    {cocktail.is_alcoholic ? 'Alcoholic' : 'Non-Alcoholic'}
                  </div>
                </div>
                
                {/* Content */}
                <div className="p-4">
                  <h3 className="font-semibold text-[#1A2E1A] text-lg group-hover:text-purple-600 transition-colors line-clamp-2">
                    {cocktail.name}
                  </h3>
                  
                  <div className="flex items-center gap-4 mt-3 text-sm text-stone-500">
                    {cocktail.ingredients?.length > 0 && (
                      <span className="flex items-center gap-1">
                        {cocktail.ingredients.length} ingredients
                      </span>
                    )}
                    {cocktail.average_rating > 0 && (
                      <span className="flex items-center gap-1 text-amber-500">
                        <Star className="w-4 h-4 fill-current" />
                        {cocktail.average_rating.toFixed(1)}
                      </span>
                    )}
                  </div>
                  
                  {/* Preview ingredients */}
                  {cocktail.ingredients?.length > 0 && (
                    <p className="mt-2 text-xs text-stone-400 line-clamp-1">
                      {cocktail.ingredients.slice(0, 3).map(ing => ing.name).join(', ')}
                      {cocktail.ingredients.length > 3 && '...'}
                    </p>
                  )}
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="fresh-card-static p-12 text-center">
            <GlassWater className="w-16 h-16 text-stone-300 mx-auto mb-4" />
            <h3 className="font-display text-xl font-semibold text-[#1A2E1A] mb-2">
              No Cocktails Yet
            </h3>
            <p className="text-stone-500 mb-6">
              {searchQuery || alcoholicFilter !== "all" 
                ? "No cocktails match your filters. Try adjusting your search."
                : "Start building your cocktail collection by adding your first recipe!"
              }
            </p>
            {!searchQuery && alcoholicFilter === "all" && (
              <Link to="/add-recipe?type=cocktail">
                <Button className="btn-primary">
                  <Plus className="w-4 h-4 mr-2" />
                  Add First Cocktail
                </Button>
              </Link>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
