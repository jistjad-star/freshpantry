import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, Trash2, Plus, Camera, Upload, Sparkles, Leaf, ChefHat } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import api from "@/lib/api";

const RECIPE_SOURCES = [
  { value: "green-chef", label: "Green Chef" },
  { value: "gousto", label: "Gousto" },
  { value: "hello-fresh", label: "Hello Fresh" },
  { value: "other", label: "Other" },
  { value: "url", label: "From URL" },
];

const INGREDIENT_CATEGORIES = [
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
  const fileInputRef = useRef(null);
  const instructionsFileInputRef = useRef(null);
  
  // Core state
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1); // 1: Basic Info, 2: Ingredients, 3: Instructions
  
  // Recipe data
  const [recipeName, setRecipeName] = useState("");
  const [source, setSource] = useState("");
  const [sourceOther, setSourceOther] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [servings, setServings] = useState(2);
  const [prepTime, setPrepTime] = useState("");
  const [cookTime, setCookTime] = useState("");
  
  // Ingredients
  const [ingredients, setIngredients] = useState([]);
  const [ingredientImages, setIngredientImages] = useState([]);
  const [ingredientPreviews, setIngredientPreviews] = useState([]);
  const [pasteIngredients, setPasteIngredients] = useState("");
  const [inputMode, setInputMode] = useState("paste"); // paste, screenshot, manual
  
  // Instructions
  const [instructions, setInstructions] = useState([]);
  const [instructionImages, setInstructionImages] = useState([]);
  const [instructionPreviews, setInstructionPreviews] = useState([]);
  const [pasteInstructions, setPasteInstructions] = useState("");

  // Handle URL import
  const handleUrlImport = async () => {
    if (!sourceUrl.trim()) {
      toast.error("Please enter a URL");
      return;
    }
    setLoading(true);
    try {
      const response = await api.importRecipe(sourceUrl);
      toast.success("Recipe imported!");
      navigate(`/recipes/${response.data.id}`);
    } catch (error) {
      console.error("Import error:", error);
      toast.error("Couldn't import from URL. Try screenshot or paste instead.");
    } finally {
      setLoading(false);
    }
  };

  // Handle image uploads for ingredients
  const handleIngredientImages = (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      setIngredientImages(prev => [...prev, ...files]);
      setIngredientPreviews(prev => [...prev, ...files.map(f => URL.createObjectURL(f))]);
    }
  };

  const removeIngredientImage = (index) => {
    setIngredientImages(prev => prev.filter((_, i) => i !== index));
    setIngredientPreviews(prev => prev.filter((_, i) => i !== index));
  };

  // Handle image uploads for instructions
  const handleInstructionImages = (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      setInstructionImages(prev => [...prev, ...files]);
      setInstructionPreviews(prev => [...prev, ...files.map(f => URL.createObjectURL(f))]);
    }
  };

  const removeInstructionImage = (index) => {
    setInstructionImages(prev => prev.filter((_, i) => i !== index));
    setInstructionPreviews(prev => prev.filter((_, i) => i !== index));
  };

  // Parse ingredients from images or text
  const parseIngredients = async () => {
    if (!recipeName.trim()) {
      toast.error("Enter a recipe name first");
      return;
    }
    
    setLoading(true);
    try {
      let parsedIngredients = [];
      let estimatedPrepTime = "";
      let estimatedCookTime = "";
      
      if (inputMode === "screenshot" && ingredientImages.length > 0) {
        // Parse from images
        for (const file of ingredientImages) {
          const response = await api.parseImage(file);
          parsedIngredients = [...parsedIngredients, ...(response.data.ingredients || [])];
          if (response.data.prep_time) estimatedPrepTime = response.data.prep_time;
          if (response.data.cook_time) estimatedCookTime = response.data.cook_time;
        }
      } else if (inputMode === "paste" && pasteIngredients.trim()) {
        // Parse from text
        const response = await api.parseIngredients(recipeName, pasteIngredients, "");
        parsedIngredients = response.data.ingredients || [];
        estimatedPrepTime = response.data.prep_time || "";
        estimatedCookTime = response.data.cook_time || "";
      }
      
      // Remove duplicates
      const unique = parsedIngredients.reduce((acc, ing) => {
        if (!acc.find(i => i.name.toLowerCase() === ing.name.toLowerCase())) {
          acc.push(ing);
        }
        return acc;
      }, []);
      
      setIngredients(unique);
      
      // Auto-set times if not already set
      if (estimatedPrepTime && !prepTime) setPrepTime(estimatedPrepTime);
      if (estimatedCookTime && !cookTime) setCookTime(estimatedCookTime);
      
      if (unique.length > 0) {
        toast.success(`Found ${unique.length} ingredients!`);
        setStep(3);
      } else {
        toast.error("No ingredients found. Try again.");
      }
    } catch (error) {
      console.error("Parse error:", error);
      toast.error("Failed to parse ingredients");
    } finally {
      setLoading(false);
    }
  };

  // Parse instructions from images or text
  const parseInstructions = async () => {
    setLoading(true);
    try {
      let parsedInstructions = [];
      let foundPrepTime = "";
      let foundCookTime = "";
      
      if (instructionImages.length > 0) {
        for (const file of instructionImages) {
          const response = await api.parseInstructionsImage(file);
          parsedInstructions = [...parsedInstructions, ...(response.data.instructions || [])];
          if (!foundPrepTime && response.data.prep_time) foundPrepTime = response.data.prep_time;
          if (!foundCookTime && response.data.cook_time) foundCookTime = response.data.cook_time;
        }
      } else if (pasteInstructions.trim()) {
        // Split by newlines and numbered steps
        parsedInstructions = pasteInstructions
          .split(/\n/)
          .map(s => s.replace(/^\d+[\.\)]\s*/, '').trim())
          .filter(s => s.length > 10);
      }
      
      setInstructions(parsedInstructions);
      if (foundPrepTime) setPrepTime(foundPrepTime);
      if (foundCookTime) setCookTime(foundCookTime);
      
      if (parsedInstructions.length > 0) {
        toast.success(`Found ${parsedInstructions.length} steps!`);
      }
    } catch (error) {
      console.error("Parse error:", error);
      toast.error("Failed to parse instructions");
    } finally {
      setLoading(false);
    }
  };

  // Remove ingredient
  const removeIngredient = (index) => {
    setIngredients(prev => prev.filter((_, i) => i !== index));
  };

  // Remove instruction
  const removeInstruction = (index) => {
    setInstructions(prev => prev.filter((_, i) => i !== index));
  };

  // Save recipe
  const saveRecipe = async () => {
    if (!recipeName.trim()) {
      toast.error("Recipe name is required");
      return;
    }
    if (ingredients.length === 0) {
      toast.error("Add at least one ingredient");
      return;
    }
    
    setLoading(true);
    try {
      const recipeSource = source === "other" ? sourceOther : 
                          source === "url" ? sourceUrl : 
                          RECIPE_SOURCES.find(s => s.value === source)?.label || "";
      
      const recipeData = {
        name: recipeName,
        description: "",
        servings,
        prep_time: prepTime,
        cook_time: cookTime,
        ingredients,
        instructions,
        source_url: recipeSource,
        image_url: ""
      };
      
      const response = await api.createRecipe(recipeData);
      toast.success("Recipe saved!");
      navigate(`/recipes/${response.data.id}`);
    } catch (error) {
      console.error("Save error:", error);
      toast.error("Failed to save recipe");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen py-8" data-testid="add-recipe-page">
      <div className="max-w-2xl mx-auto px-4">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-[#4A7C59]/10 flex items-center justify-center mx-auto mb-4">
            <ChefHat className="w-8 h-8 text-[#4A7C59]" />
          </div>
          <h1 className="font-display text-2xl font-bold text-[#1A2E1A]">Add Recipe</h1>
          <p className="text-stone-500 text-sm mt-1">Step {step} of 3</p>
        </div>

        {/* Progress bar */}
        <div className="flex gap-2 mb-8">
          {[1, 2, 3].map(s => (
            <div 
              key={s} 
              className={`h-1.5 flex-1 rounded-full transition-colors ${s <= step ? 'bg-[#4A7C59]' : 'bg-stone-200'}`}
            />
          ))}
        </div>

        {/* Step 1: Basic Info */}
        {step === 1 && (
          <div className="fresh-card-static p-6 space-y-6 animate-fade-in-up">
            <div className="space-y-2">
              <Label className="text-[#1A2E1A]">Recipe Name *</Label>
              <Input
                placeholder="e.g., Honey Garlic Chicken"
                value={recipeName}
                onChange={(e) => setRecipeName(e.target.value)}
                className="fresh-input text-lg"
                data-testid="recipe-name-input"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-[#1A2E1A]">Source (optional)</Label>
              <Select value={source} onValueChange={setSource}>
                <SelectTrigger className="fresh-input">
                  <SelectValue placeholder="Where is this recipe from?" />
                </SelectTrigger>
                <SelectContent className="bg-white">
                  {RECIPE_SOURCES.map(s => (
                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              {source === "other" && (
                <Input
                  placeholder="Enter source name"
                  value={sourceOther}
                  onChange={(e) => setSourceOther(e.target.value)}
                  className="fresh-input mt-2"
                />
              )}
              
              {source === "url" && (
                <div className="flex gap-2 mt-2">
                  <Input
                    placeholder="https://example.com/recipe"
                    value={sourceUrl}
                    onChange={(e) => setSourceUrl(e.target.value)}
                    className="fresh-input flex-1"
                  />
                  <Button 
                    onClick={handleUrlImport} 
                    disabled={loading}
                    className="btn-primary"
                  >
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Import"}
                  </Button>
                </div>
              )}
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label className="text-[#1A2E1A]">Servings</Label>
                <Select value={servings.toString()} onValueChange={(v) => setServings(parseInt(v))}>
                  <SelectTrigger className="fresh-input">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-white">
                    {[1,2,3,4,5,6,8,10,12].map(n => (
                      <SelectItem key={n} value={n.toString()}>{n}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-[#1A2E1A]">Prep Time</Label>
                <Input
                  placeholder="15 min"
                  value={prepTime}
                  onChange={(e) => setPrepTime(e.target.value)}
                  className="fresh-input"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-[#1A2E1A]">Cook Time</Label>
                <Input
                  placeholder="30 min"
                  value={cookTime}
                  onChange={(e) => setCookTime(e.target.value)}
                  className="fresh-input"
                />
              </div>
            </div>

            <Button 
              onClick={() => setStep(2)} 
              disabled={!recipeName.trim()}
              className="btn-primary w-full py-6"
            >
              Next: Add Ingredients
            </Button>
          </div>
        )}

        {/* Step 2: Ingredients */}
        {step === 2 && (
          <div className="fresh-card-static p-6 space-y-6 animate-fade-in-up">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-[#1A2E1A]">Ingredients</h2>
              <Button variant="ghost" size="sm" onClick={() => setStep(1)}>
                ← Back
              </Button>
            </div>

            {/* Input mode toggle */}
            <div className="flex rounded-xl bg-stone-100 p-1">
              <button
                onClick={() => setInputMode("paste")}
                className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors ${
                  inputMode === "paste" ? "bg-white shadow text-[#1A2E1A]" : "text-stone-500"
                }`}
              >
                Paste Text
              </button>
              <button
                onClick={() => setInputMode("screenshot")}
                className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors ${
                  inputMode === "screenshot" ? "bg-white shadow text-[#1A2E1A]" : "text-stone-500"
                }`}
              >
                Screenshot
              </button>
            </div>

            {inputMode === "paste" ? (
              <Textarea
                placeholder="Paste your ingredients here...

2 chicken breasts
1 tbsp olive oil
3 cloves garlic, minced
2 tbsp honey"
                value={pasteIngredients}
                onChange={(e) => setPasteIngredients(e.target.value)}
                className="fresh-input min-h-[200px] font-mono text-sm"
              />
            ) : (
              <div className="space-y-4">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleIngredientImages}
                  accept="image/*"
                  multiple
                  className="hidden"
                />
                
                {ingredientPreviews.length > 0 ? (
                  <div className="grid grid-cols-3 gap-3">
                    {ingredientPreviews.map((preview, i) => (
                      <div key={i} className="relative group">
                        <img src={preview} alt="" className="w-full h-24 object-cover rounded-lg" />
                        <button
                          onClick={() => removeIngredientImage(i)}
                          className="absolute top-1 right-1 bg-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <Trash2 className="w-3 h-3 text-red-500" />
                        </button>
                      </div>
                    ))}
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="h-24 border-2 border-dashed border-stone-300 rounded-lg flex items-center justify-center hover:border-[#4A7C59] transition-colors"
                    >
                      <Plus className="w-6 h-6 text-stone-400" />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full py-12 border-2 border-dashed border-stone-300 rounded-xl hover:border-[#4A7C59] transition-colors"
                  >
                    <Camera className="w-10 h-10 text-stone-400 mx-auto mb-2" />
                    <p className="text-stone-500">Upload ingredient screenshots</p>
                  </button>
                )}
              </div>
            )}

            <Button 
              onClick={parseIngredients} 
              disabled={loading || (inputMode === "paste" ? !pasteIngredients.trim() : ingredientImages.length === 0)}
              className="btn-primary w-full py-6"
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <><Sparkles className="w-5 h-5 mr-2" />Parse Ingredients</>
              )}
            </Button>
          </div>
        )}

        {/* Step 3: Review & Instructions */}
        {step === 3 && (
          <div className="space-y-6 animate-fade-in-up">
            {/* Ingredients Review */}
            <div className="fresh-card-static p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold text-[#1A2E1A]">
                  Ingredients ({ingredients.length})
                </h2>
                <Button variant="ghost" size="sm" onClick={() => setStep(2)}>
                  ← Edit
                </Button>
              </div>
              
              <div className="space-y-2 max-h-[300px] overflow-y-auto">
                {ingredients.map((ing, i) => (
                  <div key={i} className="flex items-center justify-between p-3 bg-stone-50 rounded-lg">
                    <span className="text-sm">
                      <span className="text-[#4A7C59] font-medium">{ing.quantity} {ing.unit}</span>{" "}
                      {ing.name}
                    </span>
                    <button onClick={() => removeIngredient(i)} className="text-stone-400 hover:text-red-500">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Instructions */}
            <div className="fresh-card-static p-6 space-y-4">
              <h2 className="font-semibold text-[#1A2E1A]">Instructions (optional)</h2>
              
              <div className="flex rounded-xl bg-stone-100 p-1">
                <button
                  onClick={() => setInputMode("paste")}
                  className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors ${
                    inputMode === "paste" ? "bg-white shadow text-[#1A2E1A]" : "text-stone-500"
                  }`}
                >
                  Paste
                </button>
                <button
                  onClick={() => setInputMode("screenshot")}
                  className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors ${
                    inputMode === "screenshot" ? "bg-white shadow text-[#1A2E1A]" : "text-stone-500"
                  }`}
                >
                  Screenshot
                </button>
              </div>

              {inputMode === "paste" ? (
                <Textarea
                  placeholder="Paste instructions (optional)..."
                  value={pasteInstructions}
                  onChange={(e) => setPasteInstructions(e.target.value)}
                  className="fresh-input min-h-[120px] font-mono text-sm"
                />
              ) : (
                <div className="space-y-3">
                  <input
                    type="file"
                    ref={instructionsFileInputRef}
                    onChange={handleInstructionImages}
                    accept="image/*"
                    multiple
                    className="hidden"
                  />
                  
                  {instructionPreviews.length > 0 ? (
                    <div className="grid grid-cols-3 gap-3">
                      {instructionPreviews.map((preview, i) => (
                        <div key={i} className="relative group">
                          <img src={preview} alt="" className="w-full h-20 object-cover rounded-lg" />
                          <button
                            onClick={() => removeInstructionImage(i)}
                            className="absolute top-1 right-1 bg-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <Trash2 className="w-3 h-3 text-red-500" />
                          </button>
                        </div>
                      ))}
                      <button
                        onClick={() => instructionsFileInputRef.current?.click()}
                        className="h-20 border-2 border-dashed border-stone-300 rounded-lg flex items-center justify-center"
                      >
                        <Plus className="w-5 h-5 text-stone-400" />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => instructionsFileInputRef.current?.click()}
                      className="w-full py-8 border-2 border-dashed border-stone-300 rounded-xl hover:border-[#4A7C59] transition-colors"
                    >
                      <Upload className="w-8 h-8 text-stone-400 mx-auto mb-2" />
                      <p className="text-stone-500 text-sm">Upload instruction screenshots</p>
                    </button>
                  )}
                </div>
              )}

              {(pasteInstructions.trim() || instructionImages.length > 0) && instructions.length === 0 && (
                <Button 
                  onClick={parseInstructions} 
                  disabled={loading}
                  variant="outline"
                  className="w-full"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Parse Instructions"}
                </Button>
              )}

              {instructions.length > 0 && (
                <div className="space-y-2 max-h-[200px] overflow-y-auto">
                  {instructions.map((step, i) => (
                    <div key={i} className="flex items-start gap-3 p-3 bg-stone-50 rounded-lg">
                      <span className="w-6 h-6 rounded-full bg-[#4A7C59]/10 text-[#4A7C59] flex items-center justify-center text-xs font-bold flex-shrink-0">
                        {i + 1}
                      </span>
                      <p className="text-sm flex-1">{step}</p>
                      <button onClick={() => removeInstruction(i)} className="text-stone-400 hover:text-red-500">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Save Button */}
            <Button 
              onClick={saveRecipe} 
              disabled={loading}
              className="btn-primary w-full py-6"
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <><Leaf className="w-5 h-5 mr-2" />Save Recipe</>
              )}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
