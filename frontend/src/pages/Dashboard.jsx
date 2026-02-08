import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { 
  Sparkles, 
  BookOpen, 
  Calendar, 
  ShoppingCart, 
  PlusCircle,
  ArrowRight,
  ChefHat,
  Wand2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import api from "@/lib/api";

export default function Dashboard() {
  const [recipes, setRecipes] = useState([]);
  const [shoppingList, setShoppingList] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [recipesRes, listRes] = await Promise.all([
          api.getRecipes(),
          api.getShoppingList()
        ]);
        setRecipes(recipesRes.data || []);
        setShoppingList(listRes.data);
      } catch (error) {
        console.error("Error fetching data:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const quickActions = [
    {
      icon: PlusCircle,
      label: "Add Recipe",
      description: "Manual entry or import from URL",
      path: "/add-recipe",
      color: "primary"
    },
    {
      icon: Calendar,
      label: "Plan Your Week",
      description: "Organize meals by day",
      path: "/weekly-planner",
      color: "secondary"
    },
    {
      icon: ShoppingCart,
      label: "Shopping List",
      description: "Generate from your recipes",
      path: "/shopping-list",
      color: "accent"
    },
  ];

  const uncheckedItems = shoppingList?.items?.filter(item => !item.checked)?.length || 0;

  return (
    <div className="min-h-screen" data-testid="dashboard">
      {/* Hero Section */}
      <section className="relative overflow-hidden">
        {/* Background Image */}
        <div 
          className="absolute inset-0 bg-cover bg-center opacity-20"
          style={{
            backgroundImage: `url('https://images.unsplash.com/photo-1726241966213-3eb9a93722f9?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NTYxODd8MHwxfHNlYXJjaHw0fHxmcmVzaCUyMGdyZWVuJTIwdmVnZXRhYmxlcyUyMGRhcmslMjBiYWNrZ3JvdW5kJTIwYWVzdGhldGljfGVufDB8fHx8MTc3MDU1OTY2M3ww&ixlib=rb-4.1.0&q=85')`
          }}
        />
        {/* Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#050505] via-transparent to-[#050505]" />
        {/* Glow Effect */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-[#39ff14]/5 rounded-full blur-3xl" />
        
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 md:py-32">
          <div className="text-center space-y-6 animate-fade-in-up">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#39ff14]/10 border border-[#39ff14]/20 mb-4">
              <Wand2 className="w-4 h-4 text-[#39ff14]" />
              <span className="text-sm font-medium text-[#39ff14]">Defying Grocery Lists</span>
            </div>
            
            <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl font-bold text-white tracking-tight">
              Turn Recipes Into
              <span className="block text-[#39ff14] text-glow">Shopping Magic</span>
            </h1>
            
            <p className="text-lg text-zinc-400 max-w-2xl mx-auto">
              Import your Green Chef recipes, plan your week, and generate consolidated 
              shopping lists with AI-powered ingredient organization.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
              <Link to="/add-recipe">
                <Button 
                  className="btn-witch bg-[#39ff14] text-black hover:bg-[#32D712] px-8 py-6 text-base glow-green"
                  data-testid="cta-add-recipe"
                >
                  <PlusCircle className="w-5 h-5 mr-2" />
                  Add Your First Recipe
                </Button>
              </Link>
              <Link to="/recipes">
                <Button 
                  variant="outline" 
                  className="btn-glinda border-[#FFB7E3] text-[#FFB7E3] hover:bg-[#FFB7E3]/10 px-8 py-6 text-base"
                  data-testid="cta-browse-recipes"
                >
                  <BookOpen className="w-5 h-5 mr-2" />
                  Browse Recipes
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-8">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Recipes Saved", value: recipes.length, icon: BookOpen },
            { label: "Items to Shop", value: uncheckedItems, icon: ShoppingCart },
            { label: "Meals Planned", value: "0", icon: Calendar },
            { label: "Time Saved", value: "∞", icon: Sparkles },
          ].map((stat, i) => (
            <div 
              key={stat.label}
              className={`glass-card p-6 animate-fade-in-up stagger-${i + 1}`}
              data-testid={`stat-${stat.label.toLowerCase().replace(' ', '-')}`}
            >
              <stat.icon className="w-5 h-5 text-[#39ff14] mb-3" />
              <p className="text-3xl font-bold text-white font-display">{stat.value}</p>
              <p className="text-sm text-zinc-500">{stat.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Quick Actions */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <h2 className="font-display text-2xl font-bold text-white mb-8">Quick Actions</h2>
        
        <div className="grid md:grid-cols-3 gap-6">
          {quickActions.map((action, i) => (
            <Link 
              key={action.path} 
              to={action.path}
              className={`animate-fade-in-up stagger-${i + 1}`}
              data-testid={`action-${action.label.toLowerCase().replace(' ', '-')}`}
            >
              <div className="glass-card p-8 h-full group cursor-pointer">
                <div className={`w-12 h-12 rounded-lg flex items-center justify-center mb-4 transition-colors ${
                  action.color === 'primary' ? 'bg-[#39ff14]/10 group-hover:bg-[#39ff14]/20' :
                  action.color === 'secondary' ? 'bg-[#FFB7E3]/10 group-hover:bg-[#FFB7E3]/20' :
                  'bg-[#9D00FF]/10 group-hover:bg-[#9D00FF]/20'
                }`}>
                  <action.icon className={`w-6 h-6 ${
                    action.color === 'primary' ? 'text-[#39ff14]' :
                    action.color === 'secondary' ? 'text-[#FFB7E3]' :
                    'text-[#9D00FF]'
                  }`} />
                </div>
                
                <h3 className="text-lg font-semibold text-white mb-2 group-hover:text-[#39ff14] transition-colors">
                  {action.label}
                </h3>
                <p className="text-sm text-zinc-500 mb-4">{action.description}</p>
                
                <div className="flex items-center gap-2 text-sm text-zinc-400 group-hover:text-[#39ff14] transition-colors">
                  <span>Get started</span>
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Recent Recipes */}
      {recipes.length > 0 && (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
          <div className="flex items-center justify-between mb-8">
            <h2 className="font-display text-2xl font-bold text-white">Recent Recipes</h2>
            <Link to="/recipes" className="text-sm text-[#39ff14] hover:underline">
              View all →
            </Link>
          </div>
          
          <div className="grid md:grid-cols-3 gap-6">
            {recipes.slice(0, 3).map((recipe, i) => (
              <Link 
                key={recipe.id} 
                to={`/recipes/${recipe.id}`}
                className={`animate-fade-in-up stagger-${i + 1}`}
                data-testid={`recipe-card-${recipe.id}`}
              >
                <div className="glass-card overflow-hidden group">
                  {recipe.image_url ? (
                    <div 
                      className="h-40 bg-cover bg-center"
                      style={{ backgroundImage: `url(${recipe.image_url})` }}
                    />
                  ) : (
                    <div className="h-40 bg-zinc-900 flex items-center justify-center">
                      <ChefHat className="w-12 h-12 text-zinc-700" />
                    </div>
                  )}
                  <div className="p-6">
                    <h3 className="font-semibold text-white group-hover:text-[#39ff14] transition-colors line-clamp-1">
                      {recipe.name}
                    </h3>
                    <p className="text-sm text-zinc-500 mt-1">
                      {recipe.ingredients?.length || 0} ingredients
                    </p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Empty State */}
      {!loading && recipes.length === 0 && (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
          <div className="glass-card p-12 text-center">
            <div 
              className="w-48 h-48 mx-auto mb-6 rounded-xl bg-cover bg-center opacity-60"
              style={{
                backgroundImage: `url('https://images.unsplash.com/photo-1766232315004-25980447bb19?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NDk1NzZ8MHwxfHNlYXJjaHwyfHxtYWdpY2FsJTIwa2l0Y2hlbiUyMGNvb2tpbmclMjBjb25jZXB0fGVufDB8fHx8MTc3MDU1OTY3MXww&ixlib=rb-4.1.0&q=85')`
              }}
            />
            <h3 className="font-display text-xl font-bold text-white mb-2">
              Your Spellbook is Empty
            </h3>
            <p className="text-zinc-500 mb-6">
              Add your first recipe to start creating magical shopping lists
            </p>
            <Link to="/add-recipe">
              <Button className="btn-witch bg-[#39ff14] text-black hover:bg-[#32D712]">
                <PlusCircle className="w-4 h-4 mr-2" />
                Add Recipe
              </Button>
            </Link>
          </div>
        </section>
      )}
    </div>
  );
}
