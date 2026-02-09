import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { ShoppingCart, Check, Plus, Trash2, Download, Share2, Loader2, ChefHat, Package, PoundSterling, Store, TrendingDown, Pencil, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
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

// UK Supermarket search URLs
const SUPERMARKETS = [
  { name: "Tesco", color: "bg-blue-600", searchUrl: (q) => `https://www.tesco.com/groceries/en-GB/search?query=${encodeURIComponent(q)}` },
  { name: "Sainsbury's", color: "bg-orange-500", searchUrl: (q) => `https://www.sainsburys.co.uk/gol-ui/SearchResults/${encodeURIComponent(q)}` },
  { name: "Asda", color: "bg-green-600", searchUrl: (q) => `https://groceries.asda.com/search/${encodeURIComponent(q)}` },
  { name: "Morrisons", color: "bg-yellow-500", searchUrl: (q) => `https://groceries.morrisons.com/search?q=${encodeURIComponent(q)}` },
  { name: "Aldi", color: "bg-sky-600", searchUrl: (q) => `https://groceries.aldi.co.uk/en-GB/Search?keywords=${encodeURIComponent(q)}` },
  { name: "Ocado", color: "bg-purple-600", searchUrl: (q) => `https://www.ocado.com/search?entry=${encodeURIComponent(q)}` },
];

export default function ShoppingList() {
  const [shoppingList, setShoppingList] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newItem, setNewItem] = useState({ name: "", quantity: "", unit: "", category: "other" });
  const [costEstimate, setCostEstimate] = useState(null);
  const [loadingCosts, setLoadingCosts] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [editQuantity, setEditQuantity] = useState("");
  const [editUnit, setEditUnit] = useState("");

  useEffect(() => { fetchShoppingList(); }, []);

  const fetchShoppingList = async () => {
    try {
      const response = await api.getShoppingList();
      setShoppingList(response.data);
    } catch (error) {
      console.error("Error:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchCostEstimate = async () => {
    setLoadingCosts(true);
    try {
      const response = await api.estimateShoppingCosts();
      setCostEstimate(response.data);
    } catch (error) {
      console.error("Error fetching costs:", error);
      toast.error("Failed to estimate costs");
    } finally {
      setLoadingCosts(false);
    }
  };

  const toggleItem = async (itemId) => {
    if (!shoppingList) return;
    const updatedItems = shoppingList.items.map(item => item.id === itemId ? { ...item, checked: !item.checked } : item);
    setShoppingList(prev => ({ ...prev, items: updatedItems }));
    try { await api.updateShoppingList(updatedItems); } catch (error) { fetchShoppingList(); }
  };

  const startEditing = (item) => {
    setEditingItem(item.id);
    setEditQuantity(item.quantity || "");
    setEditUnit(item.unit || "");
  };

  const saveEdit = async (itemId) => {
    if (!shoppingList) return;
    const updatedItems = shoppingList.items.map(item => 
      item.id === itemId ? { ...item, quantity: editQuantity, unit: editUnit } : item
    );
    setShoppingList(prev => ({ ...prev, items: updatedItems }));
    setEditingItem(null);
    try { 
      await api.updateShoppingList(updatedItems); 
      toast.success("Updated");
    } catch (error) { 
      fetchShoppingList(); 
      toast.error("Failed to update");
    }
  };

  const cancelEdit = () => {
    setEditingItem(null);
    setEditQuantity("");
    setEditUnit("");
  };

  const addItem = async () => {
    if (!newItem.name.trim()) { toast.error("Item name required"); return; }
    setSaving(true);
    try {
      const response = await api.addShoppingItem({ ...newItem, checked: false });
      setShoppingList(response.data);
      setNewItem({ name: "", quantity: "", unit: "", category: "other" });
      toast.success("Item added");
    } catch (error) { toast.error("Failed to add"); } finally { setSaving(false); }
  };

  const deleteItem = async (itemId) => {
    try {
      await api.deleteShoppingItem(itemId);
      setShoppingList(prev => ({ ...prev, items: prev.items.filter(item => item.id !== itemId) }));
      toast.success("Removed");
    } catch (error) { toast.error("Failed"); }
  };

  const clearChecked = async () => {
    if (!shoppingList) return;
    const uncheckedItems = shoppingList.items.filter(item => !item.checked);
    try {
      await api.updateShoppingList(uncheckedItems);
      setShoppingList(prev => ({ ...prev, items: uncheckedItems }));
      toast.success("Cleared");
    } catch (error) { toast.error("Failed"); }
  };

  const addToPantry = async () => {
    setSaving(true);
    try {
      const response = await api.addFromShopping();
      toast.success(`Added ${response.data.added} items to pantry`);
    } catch (error) { toast.error("Failed"); } finally { setSaving(false); }
  };

  const exportList = (format) => {
    if (!shoppingList?.items?.length) { toast.error("No items"); return; }
    const groupedItems = groupByCategory(shoppingList.items.filter(i => !i.checked));
    if (format === 'text') {
      let text = "🥬 Fresh Pantry - Shopping List\n" + "═".repeat(35) + "\n\n";
      CATEGORY_ORDER.forEach(cat => {
        if (groupedItems[cat]?.length) {
          const catInfo = CATEGORIES.find(c => c.value === cat);
          text += `${catInfo.emoji} ${catInfo.label.toUpperCase()}\n` + "─".repeat(20) + "\n";
          groupedItems[cat].forEach(item => { text += `☐ ${item.quantity} ${item.unit} ${item.name}\n`; });
          text += "\n";
        }
      });
      navigator.clipboard.writeText(text);
      toast.success("Copied!");
    } else if (format === 'pdf') {
      const printWindow = window.open('', '_blank');
      let html = `<html><head><title>Shopping List</title><style>body{font-family:system-ui;padding:40px}h1{color:#4A7C59}h2{color:#666;margin-top:24px;font-size:14px;text-transform:uppercase}.item{padding:8px 0;border-bottom:1px solid #eee;display:flex;gap:8px}.checkbox{width:18px;height:18px;border:2px solid #ccc;border-radius:4px}.quantity{color:#4A7C59;font-weight:600;min-width:80px}</style></head><body><h1>🥬 Fresh Pantry</h1><p style="color:#999">Shopping List - ${new Date().toLocaleDateString()}</p>`;
      CATEGORY_ORDER.forEach(cat => {
        if (groupedItems[cat]?.length) {
          const catInfo = CATEGORIES.find(c => c.value === cat);
          html += `<h2>${catInfo.emoji} ${catInfo.label}</h2>`;
          groupedItems[cat].forEach(item => { html += `<div class="item"><div class="checkbox"></div><span class="quantity">${item.quantity} ${item.unit}</span><span>${item.name}</span></div>`; });
        }
      });
      html += '</body></html>';
      printWindow.document.write(html);
      printWindow.document.close();
      printWindow.print();
    }
  };

  const groupByCategory = (items) => items.reduce((acc, item) => { const cat = item.category || 'other'; if (!acc[cat]) acc[cat] = []; acc[cat].push(item); return acc; }, {});

  // Get estimated price for an item from costEstimate
  const getItemPrice = (itemName) => {
    if (!costEstimate?.items) return null;
    const found = costEstimate.items.find(e => e.name.toLowerCase() === itemName.toLowerCase());
    return found ? found.estimated_price : null;
  };

  const totalItems = shoppingList?.items?.length || 0;
  const checkedItems = shoppingList?.items?.filter(i => i.checked).length || 0;
  const progress = totalItems > 0 ? (checkedItems / totalItems) * 100 : 0;

  // Open all unchecked items in a supermarket
  const shopAllAt = async (store) => {
    const uncheckedItems = shoppingList?.items?.filter(i => !i.checked) || [];
    if (uncheckedItems.length === 0) {
      toast.error("No items to shop for");
      return;
    }
    
    // Open first tab immediately (allowed by browser)
    window.open(store.searchUrl(uncheckedItems[0].name), '_blank');
    
    // Open remaining tabs with small delays to avoid popup blocker
    for (let i = 1; i < Math.min(uncheckedItems.length, 10); i++) {
      await new Promise(resolve => setTimeout(resolve, 300));
      window.open(store.searchUrl(uncheckedItems[i].name), '_blank');
    }
    
    if (uncheckedItems.length > 10) {
      const remaining = uncheckedItems.slice(10).map(i => i.name).join(', ');
      toast.info(`Opened 10 tabs. Remaining: ${remaining}`, { duration: 8000 });
    } else {
      toast.success(`Opened ${uncheckedItems.length} items in ${store.name}`);
    }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 text-[#4A7C59] animate-spin" /></div>;

  const groupedItems = shoppingList?.items ? groupByCategory(shoppingList.items) : {};

  return (
    <div className="min-h-screen py-8" data-testid="shopping-list-page">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
          <div>
            <h1 className="font-display text-3xl font-bold text-[#1A2E1A] mb-2">Shopping List</h1>
            <p className="text-stone-500">{totalItems > 0 ? `${checkedItems} of ${totalItems} items` : "No items yet"}</p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            {totalItems > checkedItems && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button className="btn-primary" data-testid="shop-all-btn">
                    <Store className="w-4 h-4 mr-2" />Shop All
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="bg-white" align="end">
                  {SUPERMARKETS.map(store => (
                    <DropdownMenuItem 
                      key={store.name}
                      onClick={() => shopAllAt(store)}
                      className="cursor-pointer"
                    >
                      <span className={`w-2 h-2 rounded-full ${store.color} mr-2`}></span>
                      {store.name}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            {checkedItems > 0 && (
              <>
                <Button onClick={addToPantry} disabled={saving} className="btn-secondary" data-testid="add-to-pantry-btn">
                  <Package className="w-4 h-4 mr-2" />Add to Pantry
                </Button>
                <Button variant="outline" onClick={clearChecked} className="border-stone-200"><Check className="w-4 h-4 mr-2" />Clear Checked</Button>
              </>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild><Button variant="outline" className="border-stone-200"><Share2 className="w-4 h-4 mr-2" />Export</Button></DropdownMenuTrigger>
              <DropdownMenuContent className="bg-white">
                <DropdownMenuItem onClick={() => exportList('text')} className="cursor-pointer"><Download className="w-4 h-4 mr-2" />Copy as Text</DropdownMenuItem>
                <DropdownMenuItem onClick={() => exportList('pdf')} className="cursor-pointer"><Download className="w-4 h-4 mr-2" />Print / PDF</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {totalItems > 0 && (
          <div className="fresh-card-static p-4 mb-8">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-stone-500">Progress</span>
              <span className="text-sm text-[#4A7C59] font-medium">{Math.round(progress)}%</span>
            </div>
            <div className="h-2 bg-stone-100 rounded-full overflow-hidden">
              <div className="h-full bg-[#4A7C59] transition-all duration-500" style={{ width: `${progress}%` }} />
            </div>
          </div>
        )}

        {/* Cost Estimate Section */}
        {totalItems > 0 && (
          <div className="fresh-card-static p-6 mb-8 bg-gradient-to-br from-blue-50/50 to-stone-50" data-testid="cost-estimate-section">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-[#1A2E1A] flex items-center gap-2">
                <PoundSterling className="w-5 h-5 text-blue-600" />
                Estimated Cost (UK)
              </h3>
              <Button 
                variant="outline" 
                size="sm"
                onClick={fetchCostEstimate}
                disabled={loadingCosts}
                className="border-blue-200 text-blue-700 hover:bg-blue-50"
                data-testid="estimate-costs-btn"
              >
                {loadingCosts ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Store className="w-4 h-4 mr-2" />}
                {costEstimate ? 'Update Estimate' : 'Get Estimate'}
              </Button>
            </div>
            
            {costEstimate && costEstimate.cheapest_store && (
              <div className="space-y-4">
                {/* Best Store Recommendation */}
                <div className="p-4 rounded-xl bg-green-50 border border-green-200">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-full bg-green-100">
                      <TrendingDown className="w-5 h-5 text-green-600" />
                    </div>
                    <div>
                      <p className="font-semibold text-green-800">
                        Best Value: {costEstimate.cheapest_store.name}
                        {costEstimate.cheapest_store.has_loyalty && (
                          <span className="ml-2 text-xs bg-green-200 text-green-800 px-2 py-0.5 rounded-full">
                            With Loyalty Card
                          </span>
                        )}
                      </p>
                      <p className="text-sm text-green-700">
                        Estimated total: <span className="font-bold">£{costEstimate.cheapest_store.total.toFixed(2)}</span>
                        {costEstimate.cheapest_store.savings_vs_most_expensive > 0 && (
                          <span className="ml-2 text-green-600">
                            (Save £{costEstimate.cheapest_store.savings_vs_most_expensive.toFixed(2)} vs most expensive)
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Standard Prices */}
                <div>
                  <p className="text-xs font-medium text-stone-500 uppercase mb-2">Standard Prices</p>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {Object.entries(costEstimate.totals)
                      .sort((a, b) => a[1] - b[1])
                      .map(([store, total], index) => {
                        const displayNames = {
                          tesco: "Tesco", sainsburys: "Sainsbury's", aldi: "Aldi",
                          lidl: "Lidl", asda: "Asda", morrisons: "Morrisons"
                        };
                        return (
                          <div 
                            key={store} 
                            className={`p-3 rounded-lg border ${
                              index === 0 && !costEstimate.cheapest_store.has_loyalty
                                ? 'bg-green-50 border-green-200' 
                                : 'bg-white border-stone-200'
                            }`}
                          >
                            <p className="text-xs text-stone-500">{displayNames[store] || store}</p>
                            <p className={`font-semibold ${index === 0 && !costEstimate.cheapest_store.has_loyalty ? 'text-green-700' : 'text-stone-700'}`}>
                              £{total.toFixed(2)}
                            </p>
                          </div>
                        );
                      })}
                  </div>
                </div>

                {/* Loyalty Card Prices */}
                {costEstimate.loyalty_totals && (
                  <div>
                    <p className="text-xs font-medium text-stone-500 uppercase mb-2">With Loyalty Cards 💳</p>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      {[
                        { key: 'tesco_clubcard', name: 'Tesco Clubcard', color: 'blue' },
                        { key: 'sainsburys_nectar', name: "Sainsbury's Nectar", color: 'orange' },
                        { key: 'morrisons_more', name: 'Morrisons More', color: 'yellow' },
                      ].map(({ key, name, color }) => {
                        const total = costEstimate.loyalty_totals[key];
                        const isCheapest = costEstimate.cheapest_store.key === key;
                        return (
                          <div 
                            key={key} 
                            className={`p-3 rounded-lg border ${
                              isCheapest 
                                ? 'bg-green-50 border-green-200' 
                                : 'bg-white border-stone-200'
                            }`}
                          >
                            <p className="text-xs text-stone-500">{name}</p>
                            <p className={`font-semibold ${isCheapest ? 'text-green-700' : 'text-stone-700'}`}>
                              £{total?.toFixed(2) || '0.00'}
                            </p>
                            {costEstimate.totals[key.split('_')[0]] && (
                              <p className="text-xs text-green-600 mt-0.5">
                                Save £{(costEstimate.totals[key.split('_')[0]] - total).toFixed(2)}
                              </p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
                
                <p className="text-xs text-stone-400 text-center">
                  * Estimates based on average UK supermarket prices. Actual prices may vary.
                </p>
              </div>
            )}
            
            {!costEstimate && !loadingCosts && (
              <p className="text-sm text-stone-500 text-center py-4">
                Click "Get Estimate" to see price comparison across UK supermarkets
              </p>
            )}
          </div>
        )}

        <div className="fresh-card-static p-6 mb-8">
          <h3 className="font-semibold text-[#1A2E1A] mb-4 flex items-center gap-2"><Plus className="w-4 h-4 text-[#4A7C59]" />Add Item</h3>
          <div className="grid grid-cols-12 gap-3">
            <div className="col-span-6 md:col-span-3"><Input placeholder="Quantity" value={newItem.quantity} onChange={(e) => setNewItem(prev => ({ ...prev, quantity: e.target.value }))} className="fresh-input" /></div>
            <div className="col-span-6 md:col-span-2"><Input placeholder="Unit" value={newItem.unit} onChange={(e) => setNewItem(prev => ({ ...prev, unit: e.target.value }))} className="fresh-input" /></div>
            <div className="col-span-12 md:col-span-3"><Input placeholder="Item name" value={newItem.name} onChange={(e) => setNewItem(prev => ({ ...prev, name: e.target.value }))} className="fresh-input" /></div>
            <div className="col-span-8 md:col-span-3">
              <Select value={newItem.category} onValueChange={(value) => setNewItem(prev => ({ ...prev, category: value }))}>
                <SelectTrigger className="fresh-input"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-white">{CATEGORIES.map(cat => <SelectItem key={cat.value} value={cat.value}>{cat.emoji} {cat.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="col-span-4 md:col-span-1"><Button onClick={addItem} disabled={saving} className="w-full h-full btn-primary">{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}</Button></div>
          </div>
        </div>

        {totalItems > 0 ? (
          <div className="space-y-6">
            {CATEGORY_ORDER.map(category => {
              const items = groupedItems[category];
              if (!items?.length) return null;
              const catInfo = CATEGORIES.find(c => c.value === category);
              const checkedInCategory = items.filter(i => i.checked).length;
              return (
                <div key={category} className="fresh-card-static p-6 animate-fade-in-up" data-testid={`category-${category}`}>
                  <h3 className="font-semibold text-[#1A2E1A] flex items-center gap-2 mb-4">
                    <span className="text-xl">{catInfo.emoji}</span>{catInfo.label}
                    <span className="text-sm text-stone-500 font-normal">({checkedInCategory}/{items.length})</span>
                  </h3>
                  <div className="space-y-2">
                    {items.map((item) => {
                      const itemPrice = getItemPrice(item.name);
                      const searchTerm = `${item.name}`;
                      return (
                        <div key={item.id} className={`flex items-center gap-4 p-3 rounded-xl transition-all ${item.checked ? 'bg-stone-50 opacity-60' : 'bg-white border border-stone-100 hover:border-[#4A7C59]/30'}`} data-testid={`item-${item.id}`}>
                          <Checkbox checked={item.checked} onCheckedChange={() => toggleItem(item.id)} className="border-stone-300 data-[state=checked]:bg-[#4A7C59] data-[state=checked]:border-[#4A7C59]" />
                          <div className="flex-1">
                            <span className={item.checked ? 'line-through text-stone-400' : 'text-[#1A2E1A]'}>
                              <span className="text-[#4A7C59] font-medium">{item.quantity} {item.unit}</span> {item.name}
                            </span>
                            {item.recipe_source && <span className="block text-xs text-stone-400 mt-0.5">From: {item.recipe_source}</span>}
                          </div>
                          {itemPrice !== null && (
                            <span className={`text-sm font-medium px-2 py-0.5 rounded-full ${item.checked ? 'bg-stone-100 text-stone-400' : 'bg-blue-50 text-blue-700'}`}>
                              ~£{itemPrice.toFixed(2)}
                            </span>
                          )}
                          {/* Shop buttons */}
                          {!item.checked && (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="outline" size="sm" className="text-xs border-stone-200 hover:border-[#4A7C59] hover:text-[#4A7C59]">
                                  <Store className="w-3 h-3 mr-1" /> Shop
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent className="bg-white" align="end">
                                {SUPERMARKETS.map(store => (
                                  <DropdownMenuItem 
                                    key={store.name}
                                    onClick={() => window.open(store.searchUrl(searchTerm), '_blank')}
                                    className="cursor-pointer"
                                  >
                                    <span className={`w-2 h-2 rounded-full ${store.color} mr-2`}></span>
                                    {store.name}
                                  </DropdownMenuItem>
                                ))}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )}
                          <Button variant="ghost" size="sm" onClick={() => deleteItem(item.id)} className="text-stone-400 hover:text-[#E07A5F]"><Trash2 className="w-4 h-4" /></Button>
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
            <ShoppingCart className="w-16 h-16 text-stone-300 mx-auto mb-4" />
            <h3 className="font-display text-xl font-semibold text-[#1A2E1A] mb-2">List is Empty</h3>
            <p className="text-stone-500 mb-6">Generate from recipes or add manually</p>
            <div className="flex items-center justify-center gap-4">
              <Link to="/weekly-planner"><Button className="btn-primary">Plan Your Week</Button></Link>
              <Link to="/recipes"><Button variant="outline" className="border-stone-200"><ChefHat className="w-4 h-4 mr-2" />View Recipes</Button></Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
