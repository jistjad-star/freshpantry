import { Outlet, NavLink, useLocation } from "react-router-dom";
import { 
  Sparkles, 
  BookOpen, 
  Calendar, 
  ShoppingCart, 
  PlusCircle,
  Home,
  LogIn,
  LogOut,
  User
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/lib/AuthContext";

const navItems = [
  { path: "/", icon: Home, label: "Dashboard" },
  { path: "/add-recipe", icon: PlusCircle, label: "Add Recipe" },
  { path: "/recipes", icon: BookOpen, label: "Recipes" },
  { path: "/weekly-planner", icon: Calendar, label: "Weekly Plan" },
  { path: "/shopping-list", icon: ShoppingCart, label: "Shopping List" },
];

export default function Layout() {
  const location = useLocation();
  const { user, loading, login, logout } = useAuth();

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
                  </NavLink>
                );
              })}
            </nav>

            {/* User Menu */}
            <div className="flex items-center gap-3">
              {!loading && (
                user ? (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button 
                        variant="ghost" 
                        className="flex items-center gap-2 text-zinc-400 hover:text-white"
                        data-testid="user-menu-btn"
                      >
                        {user.picture ? (
                          <img 
                            src={user.picture} 
                            alt={user.name} 
                            className="w-8 h-8 rounded-full"
                          />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-[#39ff14]/20 flex items-center justify-center">
                            <User className="w-4 h-4 text-[#39ff14]" />
                          </div>
                        )}
                        <span className="hidden sm:inline text-sm">{user.name?.split(' ')[0]}</span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="bg-zinc-900 border-zinc-800" align="end">
                      <div className="px-3 py-2">
                        <p className="text-sm font-medium text-white">{user.name}</p>
                        <p className="text-xs text-zinc-500">{user.email}</p>
                      </div>
                      <DropdownMenuSeparator className="bg-zinc-800" />
                      <DropdownMenuItem 
                        onClick={logout}
                        className="text-red-400 hover:text-red-300 hover:bg-zinc-800 cursor-pointer"
                        data-testid="logout-btn"
                      >
                        <LogOut className="w-4 h-4 mr-2" />
                        Sign Out
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                ) : (
                  <Button
                    onClick={login}
                    variant="outline"
                    className="border-[#39ff14]/50 text-[#39ff14] hover:bg-[#39ff14]/10"
                    data-testid="login-btn"
                  >
                    <LogIn className="w-4 h-4 mr-2" />
                    Sign In
                  </Button>
                )
              )}
            </div>
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
