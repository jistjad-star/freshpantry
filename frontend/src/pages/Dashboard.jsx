import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { 
  Leaf, 
  BookOpen, 
  Calendar, 
  ShoppingCart, 
  PlusCircle,
  ArrowRight,
  ChefHat,
  Package,
  AlertTriangle,
  Sparkles,
  Utensils
} from "lucide-react";
import { Button } from "@/components/ui/button";
import api from "@/lib/api";

export default function Dashboard() {
  const [recipes, setRecipes] = useState([]);
  const [shoppingList, setShoppingList] = useState(null);
  const [lowStock, setLowStock] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [recipesRes, listRes, lowStockRes] = await Promise.all([
          api.getRecipes(),
          api.getShoppingList(),
          api.getLowStockItems()
        ]);
        setRecipes(recipesRes.data || []);
        setShoppingList(listRes.data);
        setLowStock(lowStockRes.data?.low_stock_items || []);
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
      description: "Screenshot, paste, or type",
      path: "/add-recipe",
      color: "primary"
    },
    {
      icon: ShoppingCart,
      label: "Shopping List",
      description: "View & edit your list",
      path: "/shopping-list",
      color: "shop"
    },
    {
      icon: Calendar,
      label: "Plan Meals",
      description: "Organize your week",
      path: "/planner",
      color: "secondary"
    },
    {
      icon: Package,
      label: "My Pantry",
      description: "Track what you have",
      path: "/pantry",
      color: "accent"
    },
  ];

  const uncheckedItems = shoppingList?.items?.filter(item => !item.checked)?.length || 0;

  return (
    <div className="min-h-screen" data-testid="dashboard">
      {/* Hero Section */}
      <section className="hero-gradient">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-16">
          <div className="grid md:grid-cols-12 gap-8 items-center">
            {/* Text */}
            <div className="md:col-span-7 space-y-6 animate-fade-in-up">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#4A7C59]/10 text-[#4A7C59]">
                <Leaf className="w-4 h-4" />
                <span className="text-sm font-medium">Fresh & Organized</span>
              </div>
              
              <h1 className="font-display text-4xl sm:text-5xl font-bold text-[#1A2E1A] leading-tight">
                Your Kitchen,
                <span className="block text-[#4A7C59]">Simplified</span>
              </h1>
              
              <p className="text-lg text-stone-600 max-w-xl">
                Add recipes from screenshots or text, track your pantry, and create smart 
                shopping lists that know what you need.
              </p>

              <div className="flex flex-col sm:flex-row items-start gap-4 pt-2">
                <Link to="/add-recipe">
                  <Button 
                    className="btn-primary px-8 py-6 text-base"
                    data-testid="cta-add-recipe"
                  >
                    <PlusCircle className="w-5 h-5 mr-2" />
                    Add Recipe
                  </Button>
                </Link>
                <Link to="/suggestions">
                  <Button 
                    className="bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white px-8 py-6 text-base shadow-lg"
                    data-testid="cta-eat-now"
                  >
                    <Utensils className="w-5 h-5 mr-2" />
                    Eat Now
                  </Button>
                </Link>
                <Link to="/pantry">
                  <Button 
                    className="btn-secondary px-8 py-6 text-base"
                    data-testid="cta-pantry"
                  >
                    <Package className="w-5 h-5 mr-2" />
                    View Pantry
                  </Button>
                </Link>
              </div>
            </div>

            {/* Hero Image */}
            <div className="md:col-span-5 animate-fade-in-up stagger-2">
              <div 
                className="aspect-square rounded-3xl bg-cover bg-center shadow-xl"
                style={{
                  backgroundImage: `url('https://images.unsplash.com/photo-1612196856228-304d9a8ed9b1?crop=entropy&cs=srgb&fm=jpg&w=800&q=80')`
                }}
              />
            </div>
          </div>
        </div>
      </section>

      {/* Low Stock Alert */}
      {lowStock.length > 0 && (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-4">
          <div className="fresh-card-static p-4 border-[#E07A5F]/30 bg-[#E07A5F]/5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[#E07A5F]/10 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-[#E07A5F]" />
              </div>
              <div className="flex-1">
                <p className="font-medium text-[#E07A5F]">
                  {lowStock.length} item{lowStock.length !== 1 ? 's' : ''} running low
                </p>
                <p className="text-sm text-stone-600">
                  {lowStock.slice(0, 3).map(i => i.name).join(', ')}
                  {lowStock.length > 3 && ` +${lowStock.length - 3} more`}
                </p>
              </div>
              <Link to="/pantry">
                <Button variant="ghost" className="text-[#E07A5F] hover:bg-[#E07A5F]/10" data-testid="view-low-stock">
                  View All
                </Button>
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* Stats Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Recipes", value: recipes.length, icon: BookOpen, color: "text-[#4A7C59]", path: "/recipes" },
            { label: "To Shop", value: uncheckedItems, icon: ShoppingCart, color: "text-[#E07A5F]", path: "/shopping-list" },
            { label: "Low Stock", value: lowStock.length, icon: AlertTriangle, color: "text-amber-500", path: "/pantry" },
            { label: "This Week", value: "0", icon: Calendar, color: "text-blue-500", path: "/planner" },
          ].map((stat, i) => (
            <Link 
              key={stat.label}
              to={stat.path}
              className={`animate-fade-in-up stagger-${i + 1}`}
              data-testid={`stat-${stat.label.toLowerCase().replace(' ', '-')}`}
            >
              <div className="fresh-card p-5 h-full group cursor-pointer">
                <stat.icon className={`w-5 h-5 ${stat.color} mb-3 group-hover:scale-110 transition-transform`} />
                <p className="text-3xl font-bold text-[#1A2E1A] font-display group-hover:text-[#4A7C59] transition-colors">{stat.value}</p>
                <p className="text-sm text-stone-500">{stat.label}</p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Quick Actions */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h2 className="font-display text-2xl font-semibold text-[#1A2E1A] mb-6">Quick Actions</h2>
        
        <div className="grid md:grid-cols-4 gap-6">
          {quickActions.map((action, i) => (
            <Link 
              key={action.path} 
              to={action.path}
              className={`animate-fade-in-up stagger-${i + 1}`}
              data-testid={`action-${action.label.toLowerCase().replace(' ', '-')}`}
            >
              <div className="fresh-card p-6 h-full group cursor-pointer">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 transition-colors ${
                  action.color === 'primary' ? 'bg-[#4A7C59]/10 group-hover:bg-[#4A7C59]/20' :
                  action.color === 'shop' ? 'bg-[#E07A5F]/10 group-hover:bg-[#E07A5F]/20' :
                  action.color === 'secondary' ? 'bg-blue-50 group-hover:bg-blue-100' :
                  'bg-amber-50 group-hover:bg-amber-100'
                }`}>
                  <action.icon className={`w-6 h-6 ${
                    action.color === 'primary' ? 'text-[#4A7C59]' :
                    action.color === 'shop' ? 'text-[#E07A5F]' :
                    action.color === 'secondary' ? 'text-blue-500' :
                    'text-amber-600'
                  }`} />
                </div>
                
                <h3 className="text-lg font-semibold text-[#1A2E1A] mb-1 group-hover:text-[#4A7C59] transition-colors">
                  {action.label}
                </h3>
                <p className="text-sm text-stone-500 mb-4">{action.description}</p>
                
                <div className="flex items-center gap-2 text-sm text-stone-400 group-hover:text-[#4A7C59] transition-colors">
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
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-12">
          <div className="flex items-center justify-between mb-6">
            <h2 className="font-display text-2xl font-semibold text-[#1A2E1A]">Recent Recipes</h2>
            <Link to="/recipes" className="text-sm text-[#4A7C59] hover:underline font-medium">
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
                <div className="fresh-card overflow-hidden group">
                  {recipe.image_url ? (
                    <div 
                      className="h-40 bg-cover bg-center transition-transform duration-300 group-hover:scale-105"
                      style={{ backgroundImage: `url(${recipe.image_url})` }}
                    />
                  ) : (
                    <div className="h-40 bg-stone-100 flex items-center justify-center">
                      <ChefHat className="w-12 h-12 text-stone-300" />
                    </div>
                  )}
                  <div className="p-5">
                    <h3 className="font-semibold text-[#1A2E1A] group-hover:text-[#4A7C59] transition-colors line-clamp-1">
                      {recipe.name}
                    </h3>
                    <p className="text-sm text-stone-500 mt-1">
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
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-12">
          <div className="fresh-card-static p-12 text-center">
            <div 
              className="w-32 h-32 mx-auto mb-6 rounded-full bg-cover bg-center"
              style={{
                backgroundImage: `url('https://images.unsplash.com/photo-1598404148538-f0bc11a5515c?crop=entropy&cs=srgb&fm=jpg&w=300&q=80')`
              }}
            />
            <h3 className="font-display text-xl font-semibold text-[#1A2E1A] mb-2">
              Ready to Get Started?
            </h3>
            <p className="text-stone-500 mb-6">
              Add your first recipe to start building your kitchen companion
            </p>
            <Link to="/add-recipe">
              <Button className="btn-primary">
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
