import { useState, useEffect, useRef } from "react";
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
  ArrowRight,
  Bell,
  Sparkles,
  CalendarClock,
  Clock,
  Receipt,
  Camera,
  Upload,
  FileImage,
  Layers
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
import { Checkbox } from "@/components/ui/checkbox";
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

// Suggested essentials with default thresholds
const SUGGESTED_ESSENTIALS = [
  { name: "Milk", category: "dairy", unit: "L", typical_purchase: 2, min_threshold: 0.5 },
  { name: "Eggs", category: "dairy", unit: "eggs", typical_purchase: 12, min_threshold: 3 },
  { name: "Butter", category: "dairy", unit: "g", typical_purchase: 250, min_threshold: 50 },
  { name: "Bread", category: "grains", unit: "loaf", typical_purchase: 1, min_threshold: 0 },
  { name: "Olive Oil", category: "pantry", unit: "ml", typical_purchase: 500, min_threshold: 100 },
  { name: "Salt", category: "spices", unit: "g", typical_purchase: 500, min_threshold: 100 },
  { name: "Pepper", category: "spices", unit: "g", typical_purchase: 100, min_threshold: 20 },
  { name: "Garlic", category: "produce", unit: "heads", typical_purchase: 2, min_threshold: 0 },
  { name: "Onions", category: "produce", unit: "pieces", typical_purchase: 5, min_threshold: 1 },
  { name: "Pasta", category: "grains", unit: "g", typical_purchase: 500, min_threshold: 100 },
  { name: "Rice", category: "grains", unit: "g", typical_purchase: 1000, min_threshold: 200 },
  { name: "Chicken Stock", category: "pantry", unit: "ml", typical_purchase: 1000, min_threshold: 250 },
  { name: "Tinned Tomatoes", category: "pantry", unit: "cans", typical_purchase: 4, min_threshold: 1 },
  { name: "Flour", category: "pantry", unit: "g", typical_purchase: 1000, min_threshold: 200 },
  { name: "Sugar", category: "pantry", unit: "g", typical_purchase: 500, min_threshold: 100 },
];

export default function Pantry() {
  const [pantry, setPantry] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [essentialsDialogOpen, setEssentialsDialogOpen] = useState(false);
  const [alertDialogOpen, setAlertDialogOpen] = useState(false);
  const [expiryDialogOpen, setExpiryDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [alertItem, setAlertItem] = useState(null);
  const [expiryItem, setExpiryItem] = useState(null);
  const [selectedEssentials, setSelectedEssentials] = useState([]);
  const [expiringItems, setExpiringItems] = useState([]);
  const [expiredItems, setExpiredItems] = useState([]);
  
  // Consolidate state
  const [consolidating, setConsolidating] = useState(false);
  
  // Receipt scanning state
  const [receiptDialogOpen, setReceiptDialogOpen] = useState(false);
  const [scanningReceipt, setScanningReceipt] = useState(false);
  const [extractedItems, setExtractedItems] = useState([]);
  const [selectedExtractedItems, setSelectedExtractedItems] = useState([]);
  const receiptInputRef = useRef(null);
  
  // New item form
  const [newItem, setNewItem] = useState({
    name: "",
    quantity: "",
    unit: "",
    category: "other",
    min_threshold: "",
    typical_purchase: "",
    expiry_date: ""
  });

  useEffect(() => {
    fetchPantry();
    fetchExpiringItems();
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

  const fetchExpiringItems = async () => {
    try {
      const response = await api.getExpiringItems();
      setExpiringItems(response.data.expiring_items || []);
      setExpiredItems(response.data.expired_items || []);
    } catch (error) {
      console.error("Error fetching expiring items:", error);
    }
  };
  
  // Receipt scanning functions
  const handleReceiptUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setScanningReceipt(true);
    setExtractedItems([]);
    setSelectedExtractedItems([]);
    
    try {
      const response = await api.scanReceipt(file);
      const items = response.data.extracted_items || [];
      setExtractedItems(items);
      setSelectedExtractedItems(items.map((_, i) => i)); // Select all by default
      
      if (items.length === 0) {
        toast.error("No items found on receipt. Try a clearer image.");
      } else {
        toast.success(`Found ${items.length} items on receipt!`);
      }
    } catch (error) {
      console.error("Error scanning receipt:", error);
      toast.error("Failed to scan receipt. Please try again.");
    } finally {
      setScanningReceipt(false);
      if (receiptInputRef.current) receiptInputRef.current.value = '';
    }
  };
  
  const addExtractedItemsToPantry = async () => {
    if (selectedExtractedItems.length === 0) {
      toast.error("Select at least one item to add");
      return;
    }
    
    setSaving(true);
    try {
      const itemsToAdd = selectedExtractedItems.map(i => extractedItems[i]);
      const response = await api.addFromReceipt(itemsToAdd);
      toast.success(`Added ${response.data.added} new items, updated ${response.data.updated} existing`);
      setReceiptDialogOpen(false);
      setExtractedItems([]);
      setSelectedExtractedItems([]);
      fetchPantry();
    } catch (error) {
      console.error("Error adding items:", error);
      toast.error("Failed to add items to pantry");
    } finally {
      setSaving(false);
    }
  };
  
  const toggleExtractedItem = (index) => {
    setSelectedExtractedItems(prev => 
      prev.includes(index) 
        ? prev.filter(i => i !== index)
        : [...prev, index]
    );
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
        typical_purchase: parseFloat(newItem.typical_purchase) || parseFloat(newItem.quantity) || 0,
        expiry_date: newItem.expiry_date || null
      });
      
      toast.success("Item added to pantry");
      setNewItem({ name: "", quantity: "", unit: "", category: "other", min_threshold: "", typical_purchase: "", expiry_date: "" });
      setDialogOpen(false);
      fetchPantry();
      fetchExpiringItems();
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

  const addEssentials = async () => {
    if (selectedEssentials.length === 0) {
      toast.error("Select at least one essential");
      return;
    }
    
    setSaving(true);
    try {
      for (const essential of selectedEssentials) {
        const item = SUGGESTED_ESSENTIALS.find(e => e.name === essential);
        if (item) {
          await api.addPantryItem({
            name: item.name,
            quantity: item.typical_purchase,
            unit: item.unit,
            category: item.category,
            min_threshold: item.min_threshold,
            typical_purchase: item.typical_purchase
          });
        }
      }
      
      toast.success(`Added ${selectedEssentials.length} essentials to pantry`);
      setSelectedEssentials([]);
      setEssentialsDialogOpen(false);
      fetchPantry();
    } catch (error) {
      console.error("Error adding essentials:", error);
      toast.error("Failed to add essentials");
    } finally {
      setSaving(false);
    }
  };

  const updateItemAlert = async (itemId, minThreshold) => {
    try {
      await api.updatePantryItem(itemId, { min_threshold: parseFloat(minThreshold) || 0 });
      fetchPantry();
      setAlertDialogOpen(false);
      setAlertItem(null);
      toast.success("Alert updated");
    } catch (error) {
      console.error("Error updating alert:", error);
      toast.error("Failed to update alert");
    }
  };

  const openAlertDialog = (item) => {
    setAlertItem(item);
    setAlertDialogOpen(true);
  };

  const openExpiryDialog = (item) => {
    setExpiryItem(item);
    setExpiryDialogOpen(true);
  };

  const updateItemExpiry = async (itemId, expiryDate) => {
    try {
      // Use clear_expiry_date flag when removing expiry date
      const updateData = expiryDate 
        ? { expiry_date: expiryDate }
        : { clear_expiry_date: true };
      await api.updatePantryItem(itemId, updateData);
      fetchPantry();
      fetchExpiringItems();
      setExpiryDialogOpen(false);
      setExpiryItem(null);
      toast.success(expiryDate ? "Expiry date set" : "Expiry date removed");
    } catch (error) {
      console.error("Error updating expiry:", error);
      toast.error("Failed to update expiry date");
    }
  };

  // Get days until expiry for an item
  const getDaysUntilExpiry = (item) => {
    if (!item.expiry_date) return null;
    try {
      const expiry = new Date(item.expiry_date);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      expiry.setHours(0, 0, 0, 0);
      return Math.ceil((expiry - today) / (1000 * 60 * 60 * 24));
    } catch {
      return null;
    }
  };

  const getExpiryStatus = (daysUntil) => {
    if (daysUntil === null) return null;
    if (daysUntil < 0) return { label: 'Expired', color: 'bg-red-100 text-red-700', urgent: true };
    if (daysUntil === 0) return { label: 'Today', color: 'bg-red-100 text-red-700', urgent: true };
    if (daysUntil === 1) return { label: 'Tomorrow', color: 'bg-orange-100 text-orange-700', urgent: true };
    if (daysUntil <= 3) return { label: `${daysUntil} days`, color: 'bg-orange-100 text-orange-700', urgent: true };
    if (daysUntil <= 7) return { label: `${daysUntil} days`, color: 'bg-amber-100 text-amber-700', urgent: false };
    return { label: `${daysUntil} days`, color: 'bg-stone-100 text-stone-600', urgent: false };
  };

  // Get items already in pantry to exclude from essentials
  const existingItemNames = pantry?.items?.map(i => i.name.toLowerCase()) || [];
  const availableEssentials = SUGGESTED_ESSENTIALS.filter(
    e => !existingItemNames.includes(e.name.toLowerCase())
  );

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
          
          <div className="flex flex-wrap items-center gap-3">
            <Button
              onClick={addFromShopping}
              disabled={saving}
              className="btn-secondary"
              data-testid="add-from-shopping-btn"
            >
              <ShoppingCart className="w-4 h-4 mr-2" />
              Add from Shopping List
            </Button>
            
            {/* Receipt Scan Dialog */}
            <Dialog open={receiptDialogOpen} onOpenChange={setReceiptDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" className="border-orange-400 text-orange-600 hover:bg-orange-50" data-testid="scan-receipt-btn">
                  <Receipt className="w-4 h-4 mr-2" />
                  Scan Receipt
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-white border-stone-200 max-w-lg max-h-[85vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle className="text-[#1A2E1A] font-display flex items-center gap-2">
                    <Receipt className="w-5 h-5 text-orange-500" />
                    Scan Receipt to Pantry
                  </DialogTitle>
                  <DialogDescription className="text-stone-500">
                    Upload a photo or PDF of your supermarket receipt to quickly add items
                  </DialogDescription>
                </DialogHeader>
                
                <div className="space-y-4 pt-4">
                  {/* Upload Area */}
                  {extractedItems.length === 0 && (
                    <div className="border-2 border-dashed border-stone-200 rounded-xl p-8 text-center hover:border-orange-300 transition-colors">
                      <input
                        ref={receiptInputRef}
                        type="file"
                        accept="image/*,application/pdf"
                        onChange={handleReceiptUpload}
                        className="hidden"
                        id="receipt-upload"
                      />
                      <input
                        type="file"
                        accept="image/*"
                        capture="environment"
                        onChange={handleReceiptUpload}
                        className="hidden"
                        id="receipt-camera"
                      />
                      
                      {scanningReceipt ? (
                        <div className="py-4">
                          <Loader2 className="w-10 h-10 text-orange-500 animate-spin mx-auto mb-3" />
                          <p className="text-orange-600 font-medium">Scanning receipt...</p>
                          <p className="text-sm text-stone-500 mt-1">Extracting items with AI</p>
                        </div>
                      ) : (
                        <>
                          <FileImage className="w-12 h-12 text-stone-300 mx-auto mb-4" />
                          <p className="text-stone-600 mb-4">Upload a receipt image, screenshot, or PDF</p>
                          <div className="flex flex-wrap justify-center gap-3">
                            <Button 
                              variant="outline" 
                              className="border-orange-300 text-orange-600 hover:bg-orange-50"
                              onClick={() => receiptInputRef.current?.click()}
                              data-testid="upload-receipt-btn"
                            >
                              <Upload className="w-4 h-4 mr-2" />
                              Upload Image/PDF
                            </Button>
                            <Button 
                              className="bg-orange-500 hover:bg-orange-600 text-white"
                              onClick={() => document.getElementById('receipt-camera')?.click()}
                              data-testid="camera-receipt-btn"
                            >
                              <Camera className="w-4 h-4 mr-2" />
                              Take Photo
                            </Button>
                          </div>
                          <p className="text-xs text-stone-400 mt-4">
                            Supports: JPEG, PNG, screenshots, PDF receipts
                          </p>
                        </>
                      )}
                    </div>
                  )}
                  
                  {/* Extracted Items */}
                  {extractedItems.length > 0 && (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <p className="font-medium text-[#1A2E1A]">
                          Found {extractedItems.length} items
                        </p>
                        <div className="flex gap-2">
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => setSelectedExtractedItems(extractedItems.map((_, i) => i))}
                            className="text-xs"
                          >
                            Select All
                          </Button>
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => setSelectedExtractedItems([])}
                            className="text-xs"
                          >
                            Clear
                          </Button>
                        </div>
                      </div>
                      
                      <div className="max-h-[300px] overflow-y-auto space-y-2">
                        {extractedItems.map((item, index) => {
                          const catInfo = CATEGORIES.find(c => c.value === item.category);
                          const isSelected = selectedExtractedItems.includes(index);
                          return (
                            <label
                              key={index}
                              className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                                isSelected 
                                  ? 'border-orange-400 bg-orange-50' 
                                  : 'border-stone-200 hover:border-orange-200'
                              }`}
                            >
                              <Checkbox
                                checked={isSelected}
                                onCheckedChange={() => toggleExtractedItem(index)}
                                className="border-stone-300 data-[state=checked]:bg-orange-500 data-[state=checked]:border-orange-500"
                              />
                              <span className="text-lg">{catInfo?.emoji || '📦'}</span>
                              <div className="flex-1">
                                <p className="font-medium text-[#1A2E1A]">{item.name}</p>
                                <p className="text-xs text-stone-500">
                                  {item.quantity} {item.unit} • {catInfo?.label || 'Other'}
                                </p>
                              </div>
                            </label>
                          );
                        })}
                      </div>
                      
                      <div className="flex gap-2 pt-2">
                        <Button
                          variant="outline"
                          onClick={() => {
                            setExtractedItems([]);
                            setSelectedExtractedItems([]);
                          }}
                          className="flex-1"
                        >
                          Scan Another
                        </Button>
                        <Button
                          onClick={addExtractedItemsToPantry}
                          disabled={saving || selectedExtractedItems.length === 0}
                          className="flex-1 bg-orange-500 hover:bg-orange-600 text-white"
                          data-testid="add-receipt-items-btn"
                        >
                          {saving ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            `Add ${selectedExtractedItems.length} Items`
                          )}
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </DialogContent>
            </Dialog>
            
            {/* Essentials Dialog */}
            <Dialog open={essentialsDialogOpen} onOpenChange={setEssentialsDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" className="border-[#4A7C59] text-[#4A7C59] hover:bg-[#4A7C59]/10" data-testid="add-essentials-btn">
                  <Sparkles className="w-4 h-4 mr-2" />
                  Add Essentials
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-white border-stone-200 max-w-md max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle className="text-[#1A2E1A] font-display">Add Kitchen Essentials</DialogTitle>
                  <DialogDescription className="text-stone-500">
                    Quick-add common pantry staples with pre-set alerts
                  </DialogDescription>
                </DialogHeader>
                
                <div className="space-y-3 pt-4">
                  {availableEssentials.length > 0 ? (
                    <>
                      {availableEssentials.map(essential => {
                        const catInfo = CATEGORIES.find(c => c.value === essential.category);
                        return (
                          <label 
                            key={essential.name} 
                            className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                              selectedEssentials.includes(essential.name) 
                                ? 'border-[#4A7C59] bg-[#4A7C59]/5' 
                                : 'border-stone-200 hover:border-[#4A7C59]/50'
                            }`}
                          >
                            <Checkbox 
                              checked={selectedEssentials.includes(essential.name)}
                              onCheckedChange={(checked) => {
                                setSelectedEssentials(prev => 
                                  checked 
                                    ? [...prev, essential.name]
                                    : prev.filter(n => n !== essential.name)
                                );
                              }}
                              className="border-stone-300 data-[state=checked]:bg-[#4A7C59] data-[state=checked]:border-[#4A7C59]"
                            />
                            <span className="text-lg">{catInfo?.emoji}</span>
                            <div className="flex-1">
                              <p className="font-medium text-[#1A2E1A]">{essential.name}</p>
                              <p className="text-xs text-stone-500">
                                {essential.typical_purchase} {essential.unit} • Alert at {essential.min_threshold} {essential.unit}
                              </p>
                            </div>
                          </label>
                        );
                      })}
                      
                      <div className="flex gap-2 pt-2">
                        <Button
                          variant="outline"
                          onClick={() => setSelectedEssentials(availableEssentials.map(e => e.name))}
                          className="flex-1"
                        >
                          Select All
                        </Button>
                        <Button
                          onClick={addEssentials}
                          disabled={saving || selectedEssentials.length === 0}
                          className="flex-1 btn-primary"
                        >
                          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : `Add ${selectedEssentials.length} Items`}
                        </Button>
                      </div>
                    </>
                  ) : (
                    <div className="text-center py-6">
                      <Check className="w-10 h-10 text-[#4A7C59] mx-auto mb-2" />
                      <p className="text-stone-500">You have all essentials in your pantry!</p>
                    </div>
                  )}
                </div>
              </DialogContent>
            </Dialog>
            
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
                      <Label className="text-[#1A2E1A]">Sell By Date</Label>
                      <Input
                        type="date"
                        value={newItem.expiry_date}
                        onChange={(e) => setNewItem(prev => ({ ...prev, expiry_date: e.target.value }))}
                        className="fresh-input"
                        data-testid="pantry-item-expiry"
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
                              <div>
                                <p className="text-sm text-stone-500">
                                  <span className={`font-medium ${lowStock ? 'text-[#E07A5F]' : 'text-[#4A7C59]'}`}>
                                    {item.quantity}
                                  </span>
                                  {" "}{item.unit}
                                  {item.min_threshold > 0 && (
                                    <span className="text-stone-400"> / min {item.min_threshold}</span>
                                  )}
                                </p>
                                {/* Expiry date badge */}
                                {(() => {
                                  const daysUntil = getDaysUntilExpiry(item);
                                  const status = getExpiryStatus(daysUntil);
                                  if (!status) return null;
                                  return (
                                    <span className={`inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded mt-1 ${status.color}`}>
                                      <CalendarClock className="w-3 h-3" />
                                      {status.label}
                                    </span>
                                  );
                                })()}
                              </div>
                            )}
                          </div>
                          
                          {!isEditing && (
                            <div className="flex items-center gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => openExpiryDialog(item)}
                                className={`h-8 w-8 p-0 ${item.expiry_date ? 'text-orange-500' : 'text-stone-400'} hover:text-orange-600`}
                                title="Set sell by date"
                                data-testid={`expiry-item-${item.id}`}
                              >
                                <CalendarClock className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => openAlertDialog(item)}
                                className={`h-8 w-8 p-0 ${item.min_threshold > 0 ? 'text-[#4A7C59]' : 'text-stone-400'} hover:text-[#4A7C59]`}
                                title="Set low stock alert"
                                data-testid={`alert-item-${item.id}`}
                              >
                                <Bell className="w-4 h-4" />
                              </Button>
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

        {/* Alert Dialog */}
        <Dialog open={alertDialogOpen} onOpenChange={setAlertDialogOpen}>
          <DialogContent className="bg-white border-stone-200 max-w-sm">
            <DialogHeader>
              <DialogTitle className="text-[#1A2E1A] font-display flex items-center gap-2">
                <Bell className="w-5 h-5 text-[#4A7C59]" />
                Set Low Stock Alert
              </DialogTitle>
              <DialogDescription className="text-stone-500">
                {alertItem && `Alert when ${alertItem.name} drops below a certain amount`}
              </DialogDescription>
            </DialogHeader>
            
            {alertItem && (
              <div className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label className="text-[#1A2E1A]">Alert when below</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      defaultValue={alertItem.min_threshold || 0}
                      id="alert-threshold-input"
                      placeholder="0"
                      className="fresh-input flex-1"
                      data-testid="alert-threshold-input"
                    />
                    <span className="text-stone-500">{alertItem.unit}</span>
                  </div>
                  <p className="text-xs text-stone-400">
                    Current quantity: {alertItem.quantity} {alertItem.unit}
                  </p>
                </div>
                
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      const input = document.getElementById('alert-threshold-input');
                      if (input) updateItemAlert(alertItem.id, 0);
                    }}
                    className="flex-1"
                  >
                    Remove Alert
                  </Button>
                  <Button
                    onClick={() => {
                      const input = document.getElementById('alert-threshold-input');
                      if (input) updateItemAlert(alertItem.id, input.value);
                    }}
                    className="flex-1 btn-primary"
                  >
                    Save Alert
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Expiry Date Dialog */}
        <Dialog open={expiryDialogOpen} onOpenChange={setExpiryDialogOpen}>
          <DialogContent className="bg-white border-stone-200 max-w-sm">
            <DialogHeader>
              <DialogTitle className="text-[#1A2E1A] font-display flex items-center gap-2">
                <CalendarClock className="w-5 h-5 text-orange-500" />
                Set Sell By Date
              </DialogTitle>
              <DialogDescription className="text-stone-500">
                {expiryItem && `Track when ${expiryItem.name} expires`}
              </DialogDescription>
            </DialogHeader>
            
            {expiryItem && (
              <div className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label className="text-[#1A2E1A]">Sell By / Use By Date</Label>
                  <Input
                    type="date"
                    defaultValue={expiryItem.expiry_date ? expiryItem.expiry_date.split('T')[0] : ''}
                    id="expiry-date-input"
                    className="fresh-input"
                    data-testid="expiry-date-input"
                  />
                  {expiryItem.expiry_date && (
                    <p className="text-xs text-stone-400">
                      {(() => {
                        const daysUntil = getDaysUntilExpiry(expiryItem);
                        if (daysUntil === null) return '';
                        if (daysUntil < 0) return `Expired ${Math.abs(daysUntil)} days ago`;
                        if (daysUntil === 0) return 'Expires today!';
                        return `Expires in ${daysUntil} days`;
                      })()}
                    </p>
                  )}
                </div>
                
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => updateItemExpiry(expiryItem.id, null)}
                    className="flex-1"
                  >
                    Remove Date
                  </Button>
                  <Button
                    onClick={() => {
                      const input = document.getElementById('expiry-date-input');
                      if (input) updateItemExpiry(expiryItem.id, input.value);
                    }}
                    className="flex-1 btn-primary"
                  >
                    Save Date
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
