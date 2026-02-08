import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { 
  PlusCircle, 
  Link as LinkIcon, 
  Sparkles,
  Loader2,
  Trash2,
  Plus,
  ClipboardPaste,
  Wand2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import api from "@/lib/api";

const CATEGORIES = [
  { value: "produce", label: "Produce" },
  { value: "dairy", label: "Dairy" },
  { value: "protein", label: "Protein" },
  { value: "grains", label: "Grains" },
  { value: "pantry", label: "Pantry" },
  { value: "spices", label: "Spices" },
  { value: "frozen", label: "Frozen" },
  { value: "other", label: "Other" },
];

export default function AddRecipe() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [importUrl, setImportUrl] = useState("");
  
  // Paste form state
  const [pasteName, setPasteName] = useState("");
  const [pasteIngredients, setPasteIngredients] = useState("");
  const [pasteInstructions, setPasteInstructions] = useState("");
  const [parsedIngredients, setParsedIngredients] = useState([]);
  const [parsedInstructions, setParsedInstructions] = useState([]);
  const [isParsed, setIsParsed] = useState(false);
  
  // Manual form state
  const [recipe, setRecipe] = useState({
    name: "",
    description: "",
    servings: 2,
    prep_time: "",
    cook_time: "",
    ingredients: [],
    instructions: [],
    image_url: ""
  });

  const [newIngredient, setNewIngredient] = useState({
    name: "",
    quantity: "",
    unit: "",
    category: "other"
  });

  const [newInstruction, setNewInstruction] = useState("");

  const handleImportUrl = async () => {
    if (!importUrl.trim()) {
      toast.error("Please enter a URL");
      return;
    }

    setLoading(true);
    try {
      const response = await api.importRecipe(importUrl);
      toast.success("Recipe imported successfully!");
      navigate(`/recipes/${response.data.id}`);
    } catch (error) {
      console.error("Import error:", error);
      toast.error(error.response?.data?.detail || "Failed to import recipe. Try paste or manual entry.");
    } finally {
      setLoading(false);
    }
  };

  // Parse pasted ingredients with AI
  const handleParseIngredients = async () => {
    if (!pasteName.trim()) {
      toast.error("Please enter a recipe name");
      return;
    }
    if (!pasteIngredients.trim()) {
      toast.error("Please paste some ingredients");
      return;
    }

    setLoading(true);
    try {
      const response = await api.parseIngredients(pasteName, pasteIngredients, pasteInstructions);
      setParsedIngredients(response.data.ingredients || []);
      setParsedInstructions(response.data.instructions || []);
      setIsParsed(true);
      toast.success(`Parsed ${response.data.ingredients?.length || 0} ingredients!`);
    } catch (error) {
      console.error("Parse error:", error);
      toast.error("Failed to parse ingredients. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Save parsed recipe
  const handleSaveParsedRecipe = async () => {
    if (!pasteName.trim()) {
      toast.error("Recipe name is required");
      return;
    }

    setLoading(true);
    try {
      const recipeData = {
        name: pasteName,
        description: "",
        servings: 2,
        prep_time: "",
        cook_time: "",
        ingredients: parsedIngredients,
        instructions: parsedInstructions,
        image_url: ""
      };
      
      const response = await api.createRecipe(recipeData);
      toast.success("Recipe saved successfully!");
      navigate(`/recipes/${response.data.id}`);
    } catch (error) {
      console.error("Save error:", error);
      toast.error("Failed to save recipe");
    } finally {
      setLoading(false);
    }
  };

  // Remove parsed ingredient
  const removeParsedIngredient = (index) => {
    setParsedIngredients(prev => prev.filter((_, i) => i !== index));
  };

  // Remove parsed instruction
  const removeParsedInstruction = (index) => {
    setParsedInstructions(prev => prev.filter((_, i) => i !== index));
  };

  const addIngredient = () => {
    if (!newIngredient.name.trim()) {
      toast.error("Ingredient name is required");
      return;
    }
    
    setRecipe(prev => ({
      ...prev,
      ingredients: [...prev.ingredients, { ...newIngredient, checked: false }]
    }));
    setNewIngredient({ name: "", quantity: "", unit: "", category: "other" });
  };

  const removeIngredient = (index) => {
    setRecipe(prev => ({
      ...prev,
      ingredients: prev.ingredients.filter((_, i) => i !== index)
    }));
  };

  const addInstruction = () => {
    if (!newInstruction.trim()) return;
    
    setRecipe(prev => ({
      ...prev,
      instructions: [...prev.instructions, newInstruction.trim()]
    }));
    setNewInstruction("");
  };

  const removeInstruction = (index) => {
    setRecipe(prev => ({
      ...prev,
      instructions: prev.instructions.filter((_, i) => i !== index)
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!recipe.name.trim()) {
      toast.error("Recipe name is required");
      return;
    }

    setLoading(true);
    try {
      const response = await api.createRecipe(recipe);
      toast.success("Recipe created successfully!");
      navigate(`/recipes/${response.data.id}`);
    } catch (error) {
      console.error("Create error:", error);
      toast.error("Failed to create recipe");
    } finally {
      setLoading(false);
    }
  };

  const categoryColors = {
    produce: "category-produce",
    dairy: "category-dairy",
    protein: "category-protein",
    grains: "category-grains",
    pantry: "category-pantry",
    spices: "category-spices",
    frozen: "category-frozen",
    other: "category-other"
  };

  return (
    <div className="min-h-screen py-8" data-testid="add-recipe-page">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="font-display text-3xl font-bold text-white mb-2">
            Add New Recipe
          </h1>
          <p className="text-zinc-500">
            Paste from Green Chef, import from URL, or create manually
          </p>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="paste" className="space-y-8">
          <TabsList className="glass-card p-1 w-full md:w-auto grid grid-cols-3 md:flex">
            <TabsTrigger 
              value="paste" 
              className="data-[state=active]:bg-[#39ff14]/10 data-[state=active]:text-[#39ff14]"
              data-testid="tab-paste"
            >
              <ClipboardPaste className="w-4 h-4 mr-2" />
              Paste from Green Chef
            </TabsTrigger>
            <TabsTrigger 
              value="import" 
              className="data-[state=active]:bg-[#39ff14]/10 data-[state=active]:text-[#39ff14]"
              data-testid="tab-import"
            >
              <LinkIcon className="w-4 h-4 mr-2" />
              Import URL
            </TabsTrigger>
            <TabsTrigger 
              value="manual"
              className="data-[state=active]:bg-[#39ff14]/10 data-[state=active]:text-[#39ff14]"
              data-testid="tab-manual"
            >
              <PlusCircle className="w-4 h-4 mr-2" />
              Manual Entry
            </TabsTrigger>
          </TabsList>

          {/* Paste Tab - NEW */}
          <TabsContent value="paste" className="animate-fade-in-up">
            <div className="glass-card p-8 space-y-6">
              <div className="flex items-start gap-4 p-4 rounded-lg bg-[#39ff14]/5 border border-[#39ff14]/20">
                <Wand2 className="w-5 h-5 text-[#39ff14] mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-white">Copy & Paste from Green Chef</p>
                  <p className="text-sm text-zinc-400 mt-1">
                    1. Log into your Green Chef account<br/>
                    2. Open any recipe and copy the ingredient list<br/>
                    3. Paste it below and our AI will parse & categorize everything!
                  </p>
                </div>
              </div>

              {!isParsed ? (
                // Input Form
                <div className="space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="paste-name" className="text-white">Recipe Name *</Label>
                    <Input
                      id="paste-name"
                      placeholder="e.g., Honey Garlic Chicken"
                      value={pasteName}
                      onChange={(e) => setPasteName(e.target.value)}
                      className="bg-zinc-900 border-zinc-800 focus:border-[#39ff14] text-white"
                      data-testid="paste-recipe-name"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="paste-ingredients" className="text-white">
                      Paste Ingredients *
                    </Label>
                    <Textarea
                      id="paste-ingredients"
                      placeholder="Paste your ingredient list here...

Example:
2 Chicken Breasts
1 tbsp Olive Oil
3 cloves Garlic, minced
2 tbsp Honey
1/4 cup Soy Sauce
1 cup Jasmine Rice"
                      value={pasteIngredients}
                      onChange={(e) => setPasteIngredients(e.target.value)}
                      className="bg-zinc-900 border-zinc-800 focus:border-[#39ff14] text-white min-h-[200px] font-mono text-sm"
                      data-testid="paste-ingredients-input"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="paste-instructions" className="text-white">
                      Paste Instructions (optional)
                    </Label>
                    <Textarea
                      id="paste-instructions"
                      placeholder="Paste cooking instructions here (optional)..."
                      value={pasteInstructions}
                      onChange={(e) => setPasteInstructions(e.target.value)}
                      className="bg-zinc-900 border-zinc-800 focus:border-[#39ff14] text-white min-h-[120px] font-mono text-sm"
                      data-testid="paste-instructions-input"
                    />
                  </div>

                  <Button
                    onClick={handleParseIngredients}
                    disabled={loading}
                    className="btn-witch bg-[#39ff14] text-black hover:bg-[#32D712] w-full py-6"
                    data-testid="parse-btn"
                  >
                    {loading ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <>
                        <Sparkles className="w-5 h-5 mr-2" />
                        Parse with AI Magic
                      </>
                    )}
                  </Button>
                </div>
              ) : (
                // Parsed Results
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <h3 className="font-display text-xl font-bold text-white">
                      {pasteName}
                    </h3>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setIsParsed(false);
                        setParsedIngredients([]);
                        setParsedInstructions([]);
                      }}
                      className="border-zinc-700 text-zinc-400 hover:bg-zinc-800"
                      data-testid="edit-paste-btn"
                    >
                      Edit
                    </Button>
                  </div>

                  {/* Parsed Ingredients */}
                  <div className="space-y-3">
                    <h4 className="text-sm font-medium text-zinc-400 uppercase tracking-wider">
                      Ingredients ({parsedIngredients.length})
                    </h4>
                    {parsedIngredients.length > 0 ? (
                      <div className="space-y-2">
                        {parsedIngredients.map((ing, index) => (
                          <div 
                            key={index}
                            className="flex items-center justify-between p-3 rounded-lg bg-zinc-900/50 border border-zinc-800"
                            data-testid={`parsed-ingredient-${index}`}
                          >
                            <div className="flex items-center gap-3">
                              <span className={`category-badge ${categoryColors[ing.category] || categoryColors.other}`}>
                                {ing.category}
                              </span>
                              <span className="text-white">
                                <span className="text-[#39ff14] font-medium">
                                  {ing.quantity} {ing.unit}
                                </span>
                                {" "}{ing.name}
                              </span>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => removeParsedIngredient(index)}
                              className="text-zinc-500 hover:text-red-500"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-zinc-500 text-sm">No ingredients parsed</p>
                    )}
                  </div>

                  {/* Parsed Instructions */}
                  {parsedInstructions.length > 0 && (
                    <div className="space-y-3">
                      <h4 className="text-sm font-medium text-zinc-400 uppercase tracking-wider">
                        Instructions ({parsedInstructions.length} steps)
                      </h4>
                      <div className="space-y-2">
                        {parsedInstructions.map((step, index) => (
                          <div 
                            key={index}
                            className="flex items-start gap-4 p-3 rounded-lg bg-zinc-900/50 border border-zinc-800"
                          >
                            <span className="flex-shrink-0 w-7 h-7 rounded-full bg-[#39ff14]/10 text-[#39ff14] flex items-center justify-center text-sm font-bold">
                              {index + 1}
                            </span>
                            <p className="text-white flex-1 pt-0.5">{step}</p>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => removeParsedInstruction(index)}
                              className="text-zinc-500 hover:text-red-500"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <Button
                    onClick={handleSaveParsedRecipe}
                    disabled={loading || parsedIngredients.length === 0}
                    className="btn-witch bg-[#39ff14] text-black hover:bg-[#32D712] w-full py-6"
                    data-testid="save-parsed-recipe-btn"
                  >
                    {loading ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <>
                        <Sparkles className="w-5 h-5 mr-2" />
                        Save Recipe
                      </>
                    )}
                  </Button>
                </div>
              )}
            </div>
          </TabsContent>

          {/* Import Tab */}
          <TabsContent value="import" className="animate-fade-in-up">
            <div className="glass-card p-8 space-y-6">
              <div className="flex items-start gap-4 p-4 rounded-lg bg-[#FFB7E3]/5 border border-[#FFB7E3]/20">
                <LinkIcon className="w-5 h-5 text-[#FFB7E3] mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-white">URL Import</p>
                  <p className="text-sm text-zinc-400 mt-1">
                    Paste a public recipe URL. Works best with sites that have 
                    structured recipe data. For Green Chef, use the "Paste" tab instead.
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                <Label htmlFor="import-url" className="text-white">Recipe URL</Label>
                <div className="flex gap-3">
                  <Input
                    id="import-url"
                    placeholder="https://www.example.com/recipe/..."
                    value={importUrl}
                    onChange={(e) => setImportUrl(e.target.value)}
                    className="flex-1 bg-zinc-900 border-zinc-800 focus:border-[#39ff14] text-white"
                    data-testid="import-url-input"
                  />
                  <Button
                    onClick={handleImportUrl}
                    disabled={loading}
                    className="btn-witch bg-[#39ff14] text-black hover:bg-[#32D712]"
                    data-testid="import-btn"
                  >
                    {loading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4 mr-2" />
                        Import
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </TabsContent>

          {/* Manual Entry Tab */}
          <TabsContent value="manual" className="animate-fade-in-up">
            <form onSubmit={handleSubmit} className="space-y-8">
              {/* Basic Info */}
              <div className="glass-card p-8 space-y-6">
                <h2 className="font-display text-xl font-bold text-white">Basic Information</h2>
                
                <div className="grid gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="name" className="text-white">Recipe Name *</Label>
                    <Input
                      id="name"
                      placeholder="e.g., Honey Garlic Chicken"
                      value={recipe.name}
                      onChange={(e) => setRecipe(prev => ({ ...prev, name: e.target.value }))}
                      className="bg-zinc-900 border-zinc-800 focus:border-[#39ff14] text-white"
                      data-testid="recipe-name-input"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="description" className="text-white">Description</Label>
                    <Textarea
                      id="description"
                      placeholder="A brief description of your recipe..."
                      value={recipe.description}
                      onChange={(e) => setRecipe(prev => ({ ...prev, description: e.target.value }))}
                      className="bg-zinc-900 border-zinc-800 focus:border-[#39ff14] text-white min-h-[100px]"
                      data-testid="recipe-description-input"
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="servings" className="text-white">Servings</Label>
                      <Input
                        id="servings"
                        type="number"
                        min="1"
                        value={recipe.servings}
                        onChange={(e) => setRecipe(prev => ({ ...prev, servings: parseInt(e.target.value) || 2 }))}
                        className="bg-zinc-900 border-zinc-800 focus:border-[#39ff14] text-white"
                        data-testid="recipe-servings-input"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="prep_time" className="text-white">Prep Time</Label>
                      <Input
                        id="prep_time"
                        placeholder="15 min"
                        value={recipe.prep_time}
                        onChange={(e) => setRecipe(prev => ({ ...prev, prep_time: e.target.value }))}
                        className="bg-zinc-900 border-zinc-800 focus:border-[#39ff14] text-white"
                        data-testid="recipe-prep-time-input"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="cook_time" className="text-white">Cook Time</Label>
                      <Input
                        id="cook_time"
                        placeholder="30 min"
                        value={recipe.cook_time}
                        onChange={(e) => setRecipe(prev => ({ ...prev, cook_time: e.target.value }))}
                        className="bg-zinc-900 border-zinc-800 focus:border-[#39ff14] text-white"
                        data-testid="recipe-cook-time-input"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="image_url" className="text-white">Image URL (optional)</Label>
                    <Input
                      id="image_url"
                      placeholder="https://..."
                      value={recipe.image_url}
                      onChange={(e) => setRecipe(prev => ({ ...prev, image_url: e.target.value }))}
                      className="bg-zinc-900 border-zinc-800 focus:border-[#39ff14] text-white"
                      data-testid="recipe-image-url-input"
                    />
                  </div>
                </div>
              </div>

              {/* Ingredients */}
              <div className="glass-card p-8 space-y-6">
                <h2 className="font-display text-xl font-bold text-white">Ingredients</h2>
                
                {/* Add Ingredient Form */}
                <div className="grid grid-cols-12 gap-3">
                  <div className="col-span-3">
                    <Input
                      placeholder="Qty"
                      value={newIngredient.quantity}
                      onChange={(e) => setNewIngredient(prev => ({ ...prev, quantity: e.target.value }))}
                      className="bg-zinc-900 border-zinc-800 focus:border-[#39ff14] text-white"
                      data-testid="ingredient-qty-input"
                    />
                  </div>
                  <div className="col-span-2">
                    <Input
                      placeholder="Unit"
                      value={newIngredient.unit}
                      onChange={(e) => setNewIngredient(prev => ({ ...prev, unit: e.target.value }))}
                      className="bg-zinc-900 border-zinc-800 focus:border-[#39ff14] text-white"
                      data-testid="ingredient-unit-input"
                    />
                  </div>
                  <div className="col-span-3">
                    <Input
                      placeholder="Ingredient name"
                      value={newIngredient.name}
                      onChange={(e) => setNewIngredient(prev => ({ ...prev, name: e.target.value }))}
                      className="bg-zinc-900 border-zinc-800 focus:border-[#39ff14] text-white"
                      data-testid="ingredient-name-input"
                    />
                  </div>
                  <div className="col-span-3">
                    <Select
                      value={newIngredient.category}
                      onValueChange={(value) => setNewIngredient(prev => ({ ...prev, category: value }))}
                    >
                      <SelectTrigger className="bg-zinc-900 border-zinc-800 text-white" data-testid="ingredient-category-select">
                        <SelectValue placeholder="Category" />
                      </SelectTrigger>
                      <SelectContent className="bg-zinc-900 border-zinc-800">
                        {CATEGORIES.map(cat => (
                          <SelectItem key={cat.value} value={cat.value} className="text-white hover:bg-zinc-800">
                            {cat.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-1">
                    <Button
                      type="button"
                      onClick={addIngredient}
                      className="w-full bg-[#39ff14]/10 text-[#39ff14] hover:bg-[#39ff14]/20 border-0"
                      data-testid="add-ingredient-btn"
                    >
                      <Plus className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                {/* Ingredients List */}
                {recipe.ingredients.length > 0 && (
                  <div className="space-y-2">
                    {recipe.ingredients.map((ing, index) => (
                      <div 
                        key={index}
                        className="flex items-center justify-between p-3 rounded-lg bg-zinc-900/50 border border-zinc-800"
                        data-testid={`ingredient-item-${index}`}
                      >
                        <div className="flex items-center gap-3">
                          <span className={`category-badge category-${ing.category}`}>
                            {ing.category}
                          </span>
                          <span className="text-white">
                            {ing.quantity} {ing.unit} {ing.name}
                          </span>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeIngredient(index)}
                          className="text-zinc-500 hover:text-red-500"
                          data-testid={`remove-ingredient-${index}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Instructions */}
              <div className="glass-card p-8 space-y-6">
                <h2 className="font-display text-xl font-bold text-white">Instructions</h2>
                
                {/* Add Instruction */}
                <div className="flex gap-3">
                  <Textarea
                    placeholder="Add a step..."
                    value={newInstruction}
                    onChange={(e) => setNewInstruction(e.target.value)}
                    className="bg-zinc-900 border-zinc-800 focus:border-[#39ff14] text-white min-h-[80px]"
                    data-testid="instruction-input"
                  />
                  <Button
                    type="button"
                    onClick={addInstruction}
                    className="bg-[#39ff14]/10 text-[#39ff14] hover:bg-[#39ff14]/20 border-0 self-end"
                    data-testid="add-instruction-btn"
                  >
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>

                {/* Instructions List */}
                {recipe.instructions.length > 0 && (
                  <div className="space-y-3">
                    {recipe.instructions.map((step, index) => (
                      <div 
                        key={index}
                        className="flex items-start gap-4 p-4 rounded-lg bg-zinc-900/50 border border-zinc-800"
                        data-testid={`instruction-item-${index}`}
                      >
                        <span className="flex-shrink-0 w-8 h-8 rounded-full bg-[#39ff14]/10 text-[#39ff14] flex items-center justify-center text-sm font-bold">
                          {index + 1}
                        </span>
                        <p className="text-white flex-1">{step}</p>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeInstruction(index)}
                          className="text-zinc-500 hover:text-red-500"
                          data-testid={`remove-instruction-${index}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Submit */}
              <div className="flex justify-end gap-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate("/recipes")}
                  className="border-zinc-700 text-zinc-400 hover:bg-zinc-800"
                  data-testid="cancel-btn"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={loading}
                  className="btn-witch bg-[#39ff14] text-black hover:bg-[#32D712] px-8"
                  data-testid="save-recipe-btn"
                >
                  {loading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 mr-2" />
                      Save Recipe
                    </>
                  )}
                </Button>
              </div>
            </form>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
