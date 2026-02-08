import { Outlet, NavLink, useLocation } from "react-router-dom";
import { 
  Leaf, 
  BookOpen, 
  Calendar, 
  ShoppingCart, 
  PlusCircle,
  Home,
  LogIn,
  LogOut,
  User,
  Package
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
  { path: "/", icon: Home, label: "Home" },
  { path: "/add-recipe", icon: PlusCircle, label: "Add Recipe" },
  { path: "/recipes", icon: BookOpen, label: "Recipes" },
  { path: "/weekly-planner", icon: Calendar, label: "Planner" },
  { path: "/pantry", icon: Package, label: "Pantry" },
  { path: "/shopping-list", icon: ShoppingCart, label: "Shop" },
];

export default function Layout() {
  const location = useLocation();
  const { user, loading, login, logout } = useAuth();

  return (
    <div className="min-h-screen bg-[#FAFAF9] flex flex-col">
      {/* Header */}
      <header className="glass-nav sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <NavLink to="/" className="flex items-center gap-3 group" data-testid="logo-link">
              <div className="w-10 h-10 rounded-xl bg-[#4A7C59]/10 flex items-center justify-center group-hover:bg-[#4A7C59]/20 transition-colors">
                <Leaf className="w-5 h-5 text-[#4A7C59]" />
              </div>
              <div>
                <h1 className="font-display text-xl font-semibold text-[#1A2E1A] tracking-tight">
                  Fresh Pantry
                </h1>
                <p className="text-[10px] text-stone-500 font-medium tracking-wide">
                  Your Kitchen Companion
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
                    className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-full transition-all duration-200 ${
                      isActive
                        ? "text-[#4A7C59] bg-[#4A7C59]/10"
                        : "text-stone-600 hover:text-[#4A7C59] hover:bg-stone-100"
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
                        className="flex items-center gap-2 text-stone-600 hover:text-[#4A7C59] rounded-full"
                        data-testid="user-menu-btn"
                      >
                        {user.picture ? (
                          <img 
                            src={user.picture} 
                            alt={user.name} 
                            className="w-8 h-8 rounded-full"
                          />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-[#4A7C59]/10 flex items-center justify-center">
                            <User className="w-4 h-4 text-[#4A7C59]" />
                          </div>
                        )}
                        <span className="hidden sm:inline text-sm">{user.name?.split(' ')[0]}</span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="bg-white border-stone-200" align="end">
                      <div className="px-3 py-2">
                        <p className="text-sm font-medium text-[#1A2E1A]">{user.name}</p>
                        <p className="text-xs text-stone-500">{user.email}</p>
                      </div>
                      <DropdownMenuSeparator className="bg-stone-100" />
                      <DropdownMenuItem 
                        onClick={logout}
                        className="text-[#E07A5F] hover:bg-stone-50 cursor-pointer"
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
                    className="btn-primary"
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
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-stone-200">
        <div className="flex items-center justify-around py-2">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                data-testid={`mobile-nav-${item.label.toLowerCase().replace(' ', '-')}`}
                className={`flex flex-col items-center gap-1 px-3 py-2 transition-colors ${
                  isActive ? "text-[#4A7C59]" : "text-stone-400"
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
