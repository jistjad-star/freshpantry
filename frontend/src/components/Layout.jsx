import { Outlet, NavLink, useLocation } from "react-router-dom";
import { 
  Sparkles, 
  BookOpen, 
  Calendar, 
  ShoppingCart, 
  PlusCircle,
  Home
} from "lucide-react";

const navItems = [
  { path: "/", icon: Home, label: "Dashboard" },
  { path: "/add-recipe", icon: PlusCircle, label: "Add Recipe" },
  { path: "/recipes", icon: BookOpen, label: "Recipes" },
  { path: "/weekly-planner", icon: Calendar, label: "Weekly Plan" },
  { path: "/shopping-list", icon: ShoppingCart, label: "Shopping List" },
];

export default function Layout() {
  const location = useLocation();

  return (
    <div className="min-h-screen bg-[#050505] flex flex-col">
      {/* Header */}
      <header className="glass sticky top-0 z-50 border-b border-white/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <NavLink to="/" className="flex items-center gap-3 group" data-testid="logo-link">
              <div className="w-10 h-10 rounded-lg bg-[#39ff14]/10 flex items-center justify-center group-hover:bg-[#39ff14]/20 transition-colors">
                <Sparkles className="w-5 h-5 text-[#39ff14]" />
              </div>
              <div>
                <h1 className="font-display text-xl font-bold text-white tracking-tight">
                  The Emerald Pantry
                </h1>
                <p className="text-[10px] text-zinc-500 font-accent tracking-widest uppercase">
                  Wicked Good Shopping
                </p>
              </div>
            </NavLink>

            {/* Navigation */}
            <nav className="hidden md:flex items-center gap-1">
              {navItems.map((item) => {
                const isActive = location.pathname === item.path;
                return (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    data-testid={`nav-${item.label.toLowerCase().replace(' ', '-')}`}
                    className={`flex items-center gap-2 px-4 py-2 text-sm font-medium transition-all duration-200 ${
                      isActive
                        ? "text-[#39ff14] bg-[#39ff14]/10"
                        : "text-zinc-400 hover:text-white hover:bg-white/5"
                    }`}
                  >
                    <item.icon className="w-4 h-4" />
                    <span>{item.label}</span>
                    {isActive && (
                      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-[#39ff14]" />
                    )}
                  </NavLink>
                );
              })}
            </nav>
          </div>
        </div>
      </header>

      {/* Mobile Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 glass border-t border-white/5">
        <div className="flex items-center justify-around py-2">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                data-testid={`mobile-nav-${item.label.toLowerCase().replace(' ', '-')}`}
                className={`flex flex-col items-center gap-1 px-3 py-2 transition-colors ${
                  isActive ? "text-[#39ff14]" : "text-zinc-500"
                }`}
              >
                <item.icon className="w-5 h-5" />
                <span className="text-[10px] font-medium">{item.label}</span>
              </NavLink>
            );
          })}
        </div>
      </nav>

      {/* Main Content */}
      <main className="flex-1 pb-20 md:pb-0">
        <Outlet />
      </main>
    </div>
  );
}
