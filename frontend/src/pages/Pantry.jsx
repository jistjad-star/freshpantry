import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { 
  Package, 
  Plus, 
  Trash2, 
  AlertTriangle,
  ShoppingCart,
  Edit2,
  Check,
  X,
  Loader2,
  ArrowRight
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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

export default function Pantry() {
  const [pantry, setPantry] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  
  // New item form
  const [newItem, setNewItem] = useState({
    name: "",
    quantity: "",
    unit: "",
    category: "other",
    min_threshold: "",
    typical_purchase: ""
  });

  useEffect(() => {
    fetchPantry();
  }, []);

  const fetchPantry = async () => {
    try {
      const response = await api.getPantry();
      setPantry(response.data);
    } catch (error) {
      console.error("Error fetching pantry:", error);
    } finally {
      setLoading(false);
    }
  };

  const addItem = async () => {
    if (!newItem.name.trim()) {
      toast.error("Item name is required");
      return;
    }
    if (!newItem.quantity) {
      toast.error("Quantity is required");
      return;
    }

    setSaving(true);
    try {
      await api.addPantryItem({
        name: newItem.name,
        quantity: parseFloat(newItem.quantity) || 0,
        unit: newItem.unit,
        category: newItem.category,
        min_threshold: parseFloat(newItem.min_threshold) || 0,
        typical_purchase: parseFloat(newItem.typical_purchase) || parseFloat(newItem.quantity) || 0
      });
      
      toast.success("Item added to pantry");
      setNewItem({ name: "", quantity: "", unit: "", category: "other", min_threshold: "", typical_purchase: "" });
      setDialogOpen(false);
      fetchPantry();
    } catch (error) {
      console.error("Error adding item:", error);
      toast.error("Failed to add item");
    } finally {
      setSaving(false);
    }
  };

  const updateItemQuantity = async (itemId, newQuantity) => {
    try {
      await api.updatePantryItem(itemId, { quantity: parseFloat(newQuantity) || 0 });
      fetchPantry();
      setEditingItem(null);
      toast.success("Quantity updated");
    } catch (error) {
      console.error("Error updating item:", error);
      toast.error("Failed to update");
    }
  };

  const deleteItem = async (itemId) => {
    try {
      await api.deletePantryItem(itemId);
      fetchPantry();
      toast.success("Item removed");
    } catch (error) {
      console.error("Error deleting item:", error);
      toast.error("Failed to remove item");
    }
  };

  const addFromShopping = async () => {
    setSaving(true);
    try {
      const response = await api.addFromShopping();
      toast.success(`Added ${response.data.added} items to pantry`);
      fetchPantry();
    } catch (error) {
      console.error("Error adding from shopping:", error);
      toast.error("Failed to add items");
    } finally {
      setSaving(false);
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

  const isLowStock = (item) => item.quantity <= (item.min_threshold || 0);

  const totalItems = pantry?.items?.length || 0;
  const lowStockCount = pantry?.items?.filter(isLowStock).length || 0;
  const groupedItems = pantry?.items ? groupByCategory(pantry.items) : {};

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-[#4A7C59] animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen py-8" data-testid="pantry-page">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
          <div>
            <h1 className="font-display text-3xl font-bold text-[#1A2E1A] mb-2">
              My Pantry
            </h1>
            <p className="text-stone-500">
              {totalItems} item{totalItems !== 1 ? 's' : ''} • {lowStockCount} low stock
            </p>
          </div>
          
          <div className="flex items-center gap-3">
            <Button
              onClick={addFromShopping}
              disabled={saving}
              className="btn-secondary"
              data-testid="add-from-shopping-btn"
            >
              <ShoppingCart className="w-4 h-4 mr-2" />
              Add from Shopping List
            </Button>
            
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button className="btn-primary" data-testid="add-pantry-item-btn">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Item
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-white border-stone-200">
                <DialogHeader>
                  <DialogTitle className="text-[#1A2E1A] font-display">Add to Pantry</DialogTitle>
                  <DialogDescription className="text-stone-500">
                    Track what you have in your kitchen
                  </DialogDescription>
                </DialogHeader>
                
                <div className="space-y-4 pt-4">
                  <div className="space-y-2">
                    <Label className="text-[#1A2E1A]">Item Name *</Label>
                    <Input
                      placeholder="e.g., Cheddar Cheese"
                      value={newItem.name}
                      onChange={(e) => setNewItem(prev => ({ ...prev, name: e.target.value }))}
                      className="fresh-input"
                      data-testid="pantry-item-name"
                    />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-[#1A2E1A]">Quantity *</Label>
                      <Input
                        type="number"
                        placeholder="250"
                        value={newItem.quantity}
                        onChange={(e) => setNewItem(prev => ({ ...prev, quantity: e.target.value }))}
                        className="fresh-input"
                        data-testid="pantry-item-qty"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[#1A2E1A]">Unit</Label>
                      <Input
                        placeholder="g, ml, pieces"
                        value={newItem.unit}
                        onChange={(e) => setNewItem(prev => ({ ...prev, unit: e.target.value }))}
                        className="fresh-input"
                        data-testid="pantry-item-unit"
                      />
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label className="text-[#1A2E1A]">Category</Label>
                    <Select
                      value={newItem.category}
                      onValueChange={(value) => setNewItem(prev => ({ ...prev, category: value }))}
                    >
                      <SelectTrigger className="fresh-input" data-testid="pantry-item-category">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-white border-stone-200">
                        {CATEGORIES.map(cat => (
                          <SelectItem key={cat.value} value={cat.value}>
                            {cat.emoji} {cat.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-[#1A2E1A]">Low Stock Alert</Label>
                      <Input
                        type="number"
                        placeholder="When below..."
                        value={newItem.min_threshold}
                        onChange={(e) => setNewItem(prev => ({ ...prev, min_threshold: e.target.value }))}
                        className="fresh-input"
                        data-testid="pantry-item-threshold"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[#1A2E1A]">Typical Purchase</Label>
                      <Input
                        type="number"
                        placeholder="Usually buy..."
                        value={newItem.typical_purchase}
                        onChange={(e) => setNewItem(prev => ({ ...prev, typical_purchase: e.target.value }))}
                        className="fresh-input"
                        data-testid="pantry-item-typical"
                      />
                    </div>
                  </div>
                  
                  <Button
                    onClick={addItem}
                    disabled={saving}
                    className="w-full btn-primary"
                    data-testid="save-pantry-item-btn"
                  >
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Add to Pantry"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Low Stock Alert Banner */}
        {lowStockCount > 0 && (
          <div className="fresh-card-static p-4 mb-8 border-[#E07A5F]/30 bg-[#E07A5F]/5">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-[#E07A5F]" />
              <div className="flex-1">
                <p className="font-medium text-[#E07A5F]">
                  {lowStockCount} item{lowStockCount !== 1 ? 's' : ''} running low
                </p>
                <p className="text-sm text-stone-600">
                  Consider adding these to your shopping list
                </p>
              </div>
              <Link to="/shopping-list">
                <Button variant="ghost" className="text-[#E07A5F] hover:bg-[#E07A5F]/10">
                  <ShoppingCart className="w-4 h-4 mr-2" />
                  Go Shopping
                </Button>
              </Link>
            </div>
          </div>
        )}

        {/* Pantry Items by Category */}
        {totalItems > 0 ? (
          <div className="space-y-8">
            {CATEGORY_ORDER.map(category => {
              const items = groupedItems[category];
              if (!items?.length) return null;
              
              const catInfo = CATEGORIES.find(c => c.value === category);
              
              return (
                <div 
                  key={category}
                  className="fresh-card-static p-6 animate-fade-in-up"
                  data-testid={`pantry-category-${category}`}
                >
                  <h3 className="font-semibold text-[#1A2E1A] flex items-center gap-2 mb-4">
                    <span className="text-xl">{catInfo.emoji}</span>
                    {catInfo.label}
                    <span className="text-sm text-stone-500 font-normal">
                      ({items.length})
                    </span>
                  </h3>
                  
                  <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {items.map((item) => {
                      const lowStock = isLowStock(item);
                      const isEditing = editingItem === item.id;
                      
                      return (
                        <div 
                          key={item.id}
                          className={`flex items-center gap-3 p-4 rounded-xl transition-all ${
                            lowStock 
                              ? 'bg-[#E07A5F]/5 border border-[#E07A5F]/30' 
                              : 'bg-stone-50 border border-stone-100 hover:border-[#4A7C59]/30'
                          }`}
                          data-testid={`pantry-item-${item.id}`}
                        >
                          {lowStock && (
                            <AlertTriangle className="w-4 h-4 text-[#E07A5F] flex-shrink-0" />
                          )}
                          
                          <div className="flex-1 min-w-0">
                            <p className={`font-medium truncate ${lowStock ? 'text-[#E07A5F]' : 'text-[#1A2E1A]'}`}>
                              {item.name}
                            </p>
                            
                            {isEditing ? (
                              <div className="flex items-center gap-2 mt-1">
                                <Input
                                  type="number"
                                  defaultValue={item.quantity}
                                  id={`edit-input-${item.id}`}
                                  className="w-20 h-8 text-sm fresh-input"
                                  autoFocus
                                  data-testid={`edit-qty-${item.id}`}
                                />
                                <span className="text-sm text-stone-500">{item.unit}</span>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    const input = document.getElementById(`edit-input-${item.id}`);
                                    if (input) updateItemQuantity(item.id, input.value);
                                  }}
                                  className="h-8 w-8 p-0 text-[#4A7C59] hover:bg-[#4A7C59]/10"
                                  data-testid={`save-qty-${item.id}`}
                                >
                                  <Check className="w-4 h-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setEditingItem(null)}
                                  className="h-8 w-8 p-0"
                                >
                                  <X className="w-4 h-4" />
                                </Button>
                              </div>
                            ) : (
                              <p className="text-sm text-stone-500">
                                <span className={`font-medium ${lowStock ? 'text-[#E07A5F]' : 'text-[#4A7C59]'}`}>
                                  {item.quantity}
                                </span>
                                {" "}{item.unit}
                                {item.min_threshold > 0 && (
                                  <span className="text-stone-400"> / min {item.min_threshold}</span>
                                )}
                              </p>
                            )}
                          </div>
                          
                          {!isEditing && (
                            <div className="flex items-center gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setEditingItem(item.id)}
                                className="h-8 w-8 p-0 text-stone-400 hover:text-[#4A7C59]"
                                data-testid={`edit-item-${item.id}`}
                              >
                                <Edit2 className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => deleteItem(item.id)}
                                className="h-8 w-8 p-0 text-stone-400 hover:text-[#E07A5F]"
                                data-testid={`delete-item-${item.id}`}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="fresh-card-static p-12 text-center">
            <Package className="w-16 h-16 text-stone-300 mx-auto mb-4" />
            <h3 className="font-display text-xl font-semibold text-[#1A2E1A] mb-2">
              Your Pantry is Empty
            </h3>
            <p className="text-stone-500 mb-6">
              Start tracking what you have in your kitchen
            </p>
            <Button onClick={() => setDialogOpen(true)} className="btn-primary">
              <Plus className="w-4 h-4 mr-2" />
              Add First Item
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
