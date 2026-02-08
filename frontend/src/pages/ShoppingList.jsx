import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { 
  ShoppingCart, 
  Check, 
  Plus, 
  Trash2, 
  Download,
  Share2,
  Loader2,
  ChefHat,
  Sparkles
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import api from "@/lib/api";

const CATEGORIES = [
  { value: "produce", label: "Produce", emoji: "🥬" },
  { value: "dairy", label: "Dairy", emoji: "🥛" },
  { value: "protein", label: "Protein", emoji: "🍗" },
  { value: "grains", label: "Grains", emoji: "🍞" },
  { value: "pantry", label: "Pantry", emoji: "🥫" },
  { value: "spices", label: "Spices", emoji: "🧂" },
  { value: "frozen", label: "Frozen", emoji: "❄️" },
  { value: "other", label: "Other", emoji: "📦" },
];

const CATEGORY_ORDER = ["produce", "dairy", "protein", "grains", "pantry", "spices", "frozen", "other"];

export default function ShoppingList() {
  const [shoppingList, setShoppingList] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // New item form
  const [newItem, setNewItem] = useState({
    name: "",
    quantity: "",
    unit: "",
    category: "other"
  });

  useEffect(() => {
    fetchShoppingList();
  }, []);

  const fetchShoppingList = async () => {
    try {
      const response = await api.getShoppingList();
      setShoppingList(response.data);
    } catch (error) {
      console.error("Error fetching shopping list:", error);
    } finally {
      setLoading(false);
    }
  };

  const toggleItem = async (itemId) => {
    if (!shoppingList) return;
    
    const updatedItems = shoppingList.items.map(item =>
      item.id === itemId ? { ...item, checked: !item.checked } : item
    );
    
    setShoppingList(prev => ({ ...prev, items: updatedItems }));
    
    try {
      await api.updateShoppingList(updatedItems);
    } catch (error) {
      console.error("Error updating list:", error);
      // Revert on error
      fetchShoppingList();
    }
  };

  const addItem = async () => {
    if (!newItem.name.trim()) {
      toast.error("Item name is required");
      return;
    }
    
    setSaving(true);
    try {
      const response = await api.addShoppingItem({
        ...newItem,
        checked: false
      });
      setShoppingList(response.data);
      setNewItem({ name: "", quantity: "", unit: "", category: "other" });
      toast.success("Item added");
    } catch (error) {
      console.error("Error adding item:", error);
      toast.error("Failed to add item");
    } finally {
      setSaving(false);
    }
  };

  const deleteItem = async (itemId) => {
    try {
      await api.deleteShoppingItem(itemId);
      setShoppingList(prev => ({
        ...prev,
        items: prev.items.filter(item => item.id !== itemId)
      }));
      toast.success("Item removed");
    } catch (error) {
      console.error("Error deleting item:", error);
      toast.error("Failed to remove item");
    }
  };

  const clearChecked = async () => {
    if (!shoppingList) return;
    
    const uncheckedItems = shoppingList.items.filter(item => !item.checked);
    
    try {
      await api.updateShoppingList(uncheckedItems);
      setShoppingList(prev => ({ ...prev, items: uncheckedItems }));
      toast.success("Checked items cleared");
    } catch (error) {
      console.error("Error clearing items:", error);
      toast.error("Failed to clear items");
    }
  };

  const exportList = (format) => {
    if (!shoppingList?.items?.length) {
      toast.error("No items to export");
      return;
    }

    const groupedItems = groupByCategory(shoppingList.items.filter(i => !i.checked));
    
    if (format === 'text') {
      let text = "🧙‍♀️ THE EMERALD PANTRY - Shopping List\n";
      text += "═".repeat(40) + "\n\n";
      
      CATEGORY_ORDER.forEach(cat => {
        if (groupedItems[cat]?.length) {
          const catInfo = CATEGORIES.find(c => c.value === cat);
          text += `${catInfo.emoji} ${catInfo.label.toUpperCase()}\n`;
          text += "─".repeat(20) + "\n";
          groupedItems[cat].forEach(item => {
            text += `☐ ${item.quantity} ${item.unit} ${item.name}\n`;
          });
          text += "\n";
        }
      });
      
      navigator.clipboard.writeText(text);
      toast.success("List copied to clipboard!");
    } else if (format === 'pdf') {
      // Simple print-friendly version
      const printWindow = window.open('', '_blank');
      let html = `
        <html>
        <head>
          <title>Shopping List - The Emerald Pantry</title>
          <style>
            body { font-family: system-ui, sans-serif; padding: 40px; background: #fff; }
            h1 { color: #39ff14; margin-bottom: 8px; }
            h2 { color: #666; margin-top: 24px; margin-bottom: 12px; font-size: 14px; text-transform: uppercase; letter-spacing: 1px; }
            .item { padding: 8px 0; border-bottom: 1px solid #eee; display: flex; gap: 8px; }
            .checkbox { width: 18px; height: 18px; border: 2px solid #ccc; border-radius: 4px; }
            .quantity { color: #39ff14; font-weight: 600; min-width: 80px; }
          </style>
        </head>
        <body>
          <h1>🧙‍♀️ The Emerald Pantry</h1>
          <p style="color: #999; margin-bottom: 32px;">Shopping List - ${new Date().toLocaleDateString()}</p>
      `;
      
      CATEGORY_ORDER.forEach(cat => {
        if (groupedItems[cat]?.length) {
          const catInfo = CATEGORIES.find(c => c.value === cat);
          html += `<h2>${catInfo.emoji} ${catInfo.label}</h2>`;
          groupedItems[cat].forEach(item => {
            html += `<div class="item"><div class="checkbox"></div><span class="quantity">${item.quantity} ${item.unit}</span><span>${item.name}</span></div>`;
          });
        }
      });
      
      html += '</body></html>';
      printWindow.document.write(html);
      printWindow.document.close();
      printWindow.print();
    }
  };

  const groupByCategory = (items) => {
    return items.reduce((acc, item) => {
      const cat = item.category || 'other';
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push(item);
      return acc;
    }, {});
  };

  const totalItems = shoppingList?.items?.length || 0;
  const checkedItems = shoppingList?.items?.filter(i => i.checked).length || 0;
  const progress = totalItems > 0 ? (checkedItems / totalItems) * 100 : 0;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-[#39ff14] animate-spin" />
      </div>
    );
  }

  const groupedItems = shoppingList?.items ? groupByCategory(shoppingList.items) : {};

  return (
    <div className="min-h-screen py-8" data-testid="shopping-list-page">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
          <div>
            <h1 className="font-display text-3xl font-bold text-white mb-2">
              Shopping List
            </h1>
            <p className="text-zinc-500">
              {totalItems > 0 
                ? `${checkedItems} of ${totalItems} items checked`
                : "No items yet"}
            </p>
          </div>
          
          <div className="flex items-center gap-3">
            {checkedItems > 0 && (
              <Button
                variant="outline"
                onClick={clearChecked}
                className="border-zinc-700 text-zinc-400 hover:bg-zinc-800"
                data-testid="clear-checked-btn"
              >
                <Check className="w-4 h-4 mr-2" />
                Clear Checked
              </Button>
            )}
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  className="border-zinc-700 text-zinc-400 hover:bg-zinc-800"
                  data-testid="export-btn"
                >
                  <Share2 className="w-4 h-4 mr-2" />
                  Export
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="bg-zinc-900 border-zinc-800">
                <DropdownMenuItem 
                  onClick={() => exportList('text')}
                  className="text-white hover:bg-zinc-800 cursor-pointer"
                  data-testid="export-text"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Copy as Text
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={() => exportList('pdf')}
                  className="text-white hover:bg-zinc-800 cursor-pointer"
                  data-testid="export-pdf"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Print / PDF
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Progress Bar */}
        {totalItems > 0 && (
          <div className="glass-card p-4 mb-8">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-zinc-400">Shopping Progress</span>
              <span className="text-sm text-[#39ff14] font-medium">{Math.round(progress)}%</span>
            </div>
            <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
              <div 
                className="h-full bg-[#39ff14] transition-all duration-500 ease-out"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}

        {/* Add Item Form */}
        <div className="glass-card p-6 mb-8">
          <h3 className="font-semibold text-white mb-4 flex items-center gap-2">
            <Plus className="w-4 h-4 text-[#39ff14]" />
            Add Custom Item
          </h3>
          
          <div className="grid grid-cols-12 gap-3">
            <div className="col-span-6 md:col-span-3">
              <Input
                placeholder="Quantity"
                value={newItem.quantity}
                onChange={(e) => setNewItem(prev => ({ ...prev, quantity: e.target.value }))}
                className="bg-zinc-900 border-zinc-800 focus:border-[#39ff14] text-white"
                data-testid="new-item-qty"
              />
            </div>
            <div className="col-span-6 md:col-span-2">
              <Input
                placeholder="Unit"
                value={newItem.unit}
                onChange={(e) => setNewItem(prev => ({ ...prev, unit: e.target.value }))}
                className="bg-zinc-900 border-zinc-800 focus:border-[#39ff14] text-white"
                data-testid="new-item-unit"
              />
            </div>
            <div className="col-span-12 md:col-span-3">
              <Input
                placeholder="Item name"
                value={newItem.name}
                onChange={(e) => setNewItem(prev => ({ ...prev, name: e.target.value }))}
                className="bg-zinc-900 border-zinc-800 focus:border-[#39ff14] text-white"
                data-testid="new-item-name"
              />
            </div>
            <div className="col-span-8 md:col-span-3">
              <Select
                value={newItem.category}
                onValueChange={(value) => setNewItem(prev => ({ ...prev, category: value }))}
              >
                <SelectTrigger className="bg-zinc-900 border-zinc-800 text-white" data-testid="new-item-category">
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent className="bg-zinc-900 border-zinc-800">
                  {CATEGORIES.map(cat => (
                    <SelectItem key={cat.value} value={cat.value} className="text-white hover:bg-zinc-800">
                      {cat.emoji} {cat.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-4 md:col-span-1">
              <Button
                onClick={addItem}
                disabled={saving}
                className="w-full bg-[#39ff14] text-black hover:bg-[#32D712] h-10"
                data-testid="add-item-btn"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              </Button>
            </div>
          </div>
        </div>

        {/* Shopping List by Category */}
        {totalItems > 0 ? (
          <div className="space-y-6">
            {CATEGORY_ORDER.map(category => {
              const items = groupedItems[category];
              if (!items?.length) return null;
              
              const catInfo = CATEGORIES.find(c => c.value === category);
              const checkedInCategory = items.filter(i => i.checked).length;
              
              return (
                <div 
                  key={category}
                  className="glass-card p-6 animate-fade-in-up"
                  data-testid={`category-${category}`}
                >
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold text-white flex items-center gap-2">
                      <span className="text-xl">{catInfo.emoji}</span>
                      {catInfo.label}
                      <span className="text-sm text-zinc-500 font-normal">
                        ({checkedInCategory}/{items.length})
                      </span>
                    </h3>
                  </div>
                  
                  <div className="space-y-2">
                    {items.map((item) => (
                      <div 
                        key={item.id}
                        className={`flex items-center gap-4 p-3 rounded-lg transition-all ${
                          item.checked 
                            ? 'bg-zinc-900/30 opacity-60' 
                            : 'bg-zinc-900/50 border border-zinc-800 hover:border-zinc-700'
                        }`}
                        data-testid={`item-${item.id}`}
                      >
                        <Checkbox
                          checked={item.checked}
                          onCheckedChange={() => toggleItem(item.id)}
                          className="border-zinc-600 data-[state=checked]:bg-[#39ff14] data-[state=checked]:border-[#39ff14]"
                          data-testid={`checkbox-${item.id}`}
                        />
                        
                        <div className="flex-1">
                          <span className={`${item.checked ? 'line-through text-zinc-500' : 'text-white'}`}>
                            <span className="text-[#39ff14] font-medium">
                              {item.quantity} {item.unit}
                            </span>
                            {" "}{item.name}
                          </span>
                          {item.recipe_source && (
                            <span className="block text-xs text-zinc-600 mt-0.5">
                              From: {item.recipe_source}
                            </span>
                          )}
                        </div>
                        
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteItem(item.id)}
                          className="text-zinc-500 hover:text-red-500 opacity-0 group-hover:opacity-100"
                          data-testid={`delete-item-${item.id}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="glass-card p-12 text-center">
            <ShoppingCart className="w-16 h-16 text-zinc-700 mx-auto mb-4" />
            <h3 className="font-display text-xl font-bold text-white mb-2">
              Your List is Empty
            </h3>
            <p className="text-zinc-500 mb-6">
              Generate a list from your recipes or add items manually
            </p>
            <div className="flex items-center justify-center gap-4">
              <Link to="/weekly-planner">
                <Button className="btn-witch bg-[#39ff14] text-black hover:bg-[#32D712]">
                  <Sparkles className="w-4 h-4 mr-2" />
                  Plan Your Week
                </Button>
              </Link>
              <Link to="/recipes">
                <Button variant="outline" className="btn-glinda border-[#FFB7E3] text-[#FFB7E3] hover:bg-[#FFB7E3]/10">
                  <ChefHat className="w-4 h-4 mr-2" />
                  View Recipes
                </Button>
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
