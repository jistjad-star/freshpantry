import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { 
  PlusCircle, 
  Link as LinkIcon, 
  Loader2,
  Trash2,
  Plus,
  ClipboardPaste,
  Camera,
  Upload,
  Sparkles,
  Leaf
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
  const fileInputRef = useRef(null);
  const instructionsFileInputRef = useRef(null);
  
  // Image upload state
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [imageName, setImageName] = useState("");
  const [imageIngredients, setImageIngredients] = useState([]);
  const [imageRawText, setImageRawText] = useState("");
  const [isImageParsed, setIsImageParsed] = useState(false);
  
  // Instructions image upload state
  const [instructionsImageFile, setInstructionsImageFile] = useState(null);
  const [instructionsImagePreview, setInstructionsImagePreview] = useState(null);
  const [imageInstructions, setImageInstructions] = useState([]);
  const [instructionsRawText, setInstructionsRawText] = useState("");
  const [isInstructionsParsed, setIsInstructionsParsed] = useState(false);
  const [instructionsLoading, setInstructionsLoading] = useState(false);
  
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

  // Image upload handlers
  const handleImageSelect = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
      setIsImageParsed(false);
      setImageIngredients([]);
      setImageRawText("");
    }
  };

  // Instructions image handlers
  const handleInstructionsImageSelect = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setInstructionsImageFile(file);
      setInstructionsImagePreview(URL.createObjectURL(file));
      setIsInstructionsParsed(false);
      setImageInstructions([]);
      setInstructionsRawText("");
    }
  };

  const handleInstructionsParse = async () => {
    if (!instructionsImageFile) {
      toast.error("Please select an instructions image first");
      return;
    }

    setInstructionsLoading(true);
    try {
      const response = await api.parseInstructionsImage(instructionsImageFile);
      setInstructionsRawText(response.data.instructions_text || "");
      setImageInstructions(response.data.instructions || []);
      setIsInstructionsParsed(true);
      
      if (response.data.instructions?.length > 0) {
        toast.success(`Extracted ${response.data.instructions.length} steps!`);
      } else {
        toast.warning("No instructions found. Try a clearer image.");
      }
    } catch (error) {
      console.error("Instructions parse error:", error);
      toast.error("Failed to extract instructions.");
    } finally {
      setInstructionsLoading(false);
    }
  };

  const removeImageInstruction = (index) => {
    setImageInstructions(prev => prev.filter((_, i) => i !== index));
  };

  const handleImageParse = async () => {
    if (!imageFile) {
      toast.error("Please select an image first");
      return;
    }
    if (!imageName.trim()) {
      toast.error("Please enter a recipe name");
      return;
    }

    setLoading(true);
    try {
      const response = await api.parseImage(imageFile);
      setImageRawText(response.data.ingredients_text || "");
      setImageIngredients(response.data.ingredients || []);
      setIsImageParsed(true);
      
      if (response.data.ingredients?.length > 0) {
        toast.success(`Extracted ${response.data.ingredients.length} ingredients!`);
      } else {
        toast.warning("No ingredients found. Try a clearer image or use paste instead.");
      }
    } catch (error) {
      console.error("Image parse error:", error);
      toast.error("Failed to extract ingredients. Try paste instead.");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveImageRecipe = async () => {
    if (!imageName.trim()) {
      toast.error("Recipe name is required");
      return;
    }

    setLoading(true);
    try {
      const recipeData = {
        name: imageName,
        description: "",
        servings: 2,
        prep_time: "",
        cook_time: "",
        ingredients: imageIngredients,
        instructions: imageInstructions,
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

  const removeImageIngredient = (index) => {
    setImageIngredients(prev => prev.filter((_, i) => i !== index));
  };

  const handleImportUrl = async () => {
    if (!importUrl.trim()) {
      toast.error("Please enter a URL");
      return;
    }

    setLoading(true);
    try {
      const response = await api.importRecipe(importUrl);
      toast.success("Recipe imported!");
      navigate(`/recipes/${response.data.id}`);
    } catch (error) {
      console.error("Import error:", error);
      toast.error("Failed to import. Try paste instead.");
    } finally {
      setLoading(false);
    }
  };

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
      toast.error("Failed to parse ingredients");
    } finally {
      setLoading(false);
    }
  };

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
      toast.success("Recipe saved!");
      navigate(`/recipes/${response.data.id}`);
    } catch (error) {
      console.error("Save error:", error);
      toast.error("Failed to save recipe");
    } finally {
      setLoading(false);
    }
  };

  const removeParsedIngredient = (index) => {
    setParsedIngredients(prev => prev.filter((_, i) => i !== index));
  };

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
      toast.success("Recipe created!");
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
          <h1 className="font-display text-3xl font-bold text-[#1A2E1A] mb-2">
            Add Recipe
          </h1>
          <p className="text-stone-500">
            Screenshot, paste, or enter manually
          </p>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="paste" className="space-y-8">
          <TabsList className="fresh-card-static p-1 w-full grid grid-cols-2 md:grid-cols-4 h-auto">
            <TabsTrigger 
              value="screenshot" 
              className="data-[state=active]:bg-[#4A7C59]/10 data-[state=active]:text-[#4A7C59] rounded-lg py-3"
              data-testid="tab-image"
            >
              <Camera className="w-4 h-4 mr-2" />
              Screenshot
            </TabsTrigger>
            <TabsTrigger 
              value="paste" 
              className="data-[state=active]:bg-[#4A7C59]/10 data-[state=active]:text-[#4A7C59] rounded-lg py-3"
              data-testid="tab-paste"
            >
              <ClipboardPaste className="w-4 h-4 mr-2" />
              Paste
            </TabsTrigger>
            <TabsTrigger 
              value="import" 
              className="data-[state=active]:bg-[#4A7C59]/10 data-[state=active]:text-[#4A7C59] rounded-lg py-3"
              data-testid="tab-import"
            >
              <LinkIcon className="w-4 h-4 mr-2" />
              URL
            </TabsTrigger>
            <TabsTrigger 
              value="manual"
              className="data-[state=active]:bg-[#4A7C59]/10 data-[state=active]:text-[#4A7C59] rounded-lg py-3"
              data-testid="tab-manual"
            >
              <PlusCircle className="w-4 h-4 mr-2" />
              Manual
            </TabsTrigger>
          </TabsList>

          {/* Screenshot Tab */}
          <TabsContent value="screenshot" className="animate-fade-in-up">
            <div className="fresh-card-static p-8 space-y-6">
              <div className="flex items-start gap-4 p-4 rounded-xl bg-[#4A7C59]/5 border border-[#4A7C59]/20">
                <Camera className="w-5 h-5 text-[#4A7C59] mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-[#1A2E1A]">Screenshot Upload</p>
                  <p className="text-sm text-stone-500 mt-1">
                    Take a screenshot of your recipe ingredients and our AI will extract them.
                  </p>
                </div>
              </div>

              {!isImageParsed ? (
                <div className="space-y-6">
                  <div className="space-y-2">
                    <Label className="text-[#1A2E1A]">Recipe Name *</Label>
                    <Input
                      placeholder="e.g., Honey Garlic Chicken"
                      value={imageName}
                      onChange={(e) => setImageName(e.target.value)}
                      className="fresh-input"
                      data-testid="image-recipe-name"
                    />
                  </div>

                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleImageSelect}
                    accept="image/*"
                    className="hidden"
                  />
                  
                  {!imagePreview ? (
                    <div 
                      onClick={() => fileInputRef.current?.click()}
                      className="border-2 border-dashed border-stone-300 rounded-2xl p-12 text-center cursor-pointer hover:border-[#4A7C59]/50 transition-colors"
                      data-testid="image-upload-area"
                    >
                      <Upload className="w-12 h-12 text-stone-400 mx-auto mb-4" />
                      <p className="text-stone-600 mb-2">Click to upload screenshot</p>
                      <p className="text-sm text-stone-400">PNG, JPG up to 10MB</p>
                    </div>
                  ) : (
                    <div className="relative">
                      <img 
                        src={imagePreview} 
                        alt="Recipe screenshot" 
                        className="w-full max-h-80 object-contain rounded-xl bg-stone-100"
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => { setImageFile(null); setImagePreview(null); }}
                        className="absolute top-2 right-2 bg-white"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  )}

                  <Button
                    onClick={handleImageParse}
                    disabled={loading || !imageFile}
                    className="btn-primary w-full py-6"
                    data-testid="parse-image-btn"
                  >
                    {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : (
                      <><Sparkles className="w-5 h-5 mr-2" />Extract Ingredients</>
                    )}
                  </Button>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <h3 className="font-display text-xl font-semibold text-[#1A2E1A]">{imageName}</h3>
                    <Button variant="outline" onClick={() => { setIsImageParsed(false); setImageIngredients([]); }}>
                      Try Again
                    </Button>
                  </div>

                  {imageRawText && (
                    <div className="p-4 rounded-xl bg-stone-50 border border-stone-200">
                      <p className="text-xs text-stone-500 mb-2">Extracted text:</p>
                      <p className="text-sm text-stone-600 whitespace-pre-wrap">{imageRawText}</p>
                    </div>
                  )}

                  <div className="space-y-3">
                    <h4 className="text-sm font-medium text-stone-500 uppercase tracking-wider">
                      Ingredients ({imageIngredients.length})
                    </h4>
                    {imageIngredients.length > 0 ? (
                      <div className="space-y-2">
                        {imageIngredients.map((ing, index) => (
                          <div key={index} className="flex items-center justify-between p-3 rounded-xl bg-stone-50 border border-stone-200">
                            <div className="flex items-center gap-3">
                              <span className={`category-badge ${categoryColors[ing.category] || categoryColors.other}`}>
                                {ing.category}
                              </span>
                              <span className="text-[#1A2E1A]">
                                <span className="text-[#4A7C59] font-medium">{ing.quantity} {ing.unit}</span> {ing.name}
                              </span>
                            </div>
                            <Button variant="ghost" size="sm" onClick={() => removeImageIngredient(index)} className="text-stone-400 hover:text-[#E07A5F]">
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-stone-500 text-sm">No ingredients extracted. Try a clearer image.</p>
                    )}
                  </div>

                  <Button onClick={handleSaveImageRecipe} disabled={loading || imageIngredients.length === 0} className="btn-primary w-full py-6" data-testid="save-image-recipe-btn">
                    {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : (<><Leaf className="w-5 h-5 mr-2" />Save Recipe</>)}
                  </Button>
                </div>
              )}
            </div>
          </TabsContent>

          {/* Paste Tab */}
          <TabsContent value="paste" className="animate-fade-in-up">
            <div className="fresh-card-static p-8 space-y-6">
              <div className="flex items-start gap-4 p-4 rounded-xl bg-[#4A7C59]/5 border border-[#4A7C59]/20">
                <ClipboardPaste className="w-5 h-5 text-[#4A7C59] mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-[#1A2E1A]">Paste from Green Chef</p>
                  <p className="text-sm text-stone-500 mt-1">
                    Copy ingredients from your Green Chef recipe and paste them here.
                  </p>
                </div>
              </div>

              {!isParsed ? (
                <div className="space-y-6">
                  <div className="space-y-2">
                    <Label className="text-[#1A2E1A]">Recipe Name *</Label>
                    <Input
                      placeholder="e.g., Honey Garlic Chicken"
                      value={pasteName}
                      onChange={(e) => setPasteName(e.target.value)}
                      className="fresh-input"
                      data-testid="paste-recipe-name"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-[#1A2E1A]">Paste Ingredients *</Label>
                    <Textarea
                      placeholder="2 Chicken Breasts
1 tbsp Olive Oil
3 cloves Garlic
2 tbsp Honey..."
                      value={pasteIngredients}
                      onChange={(e) => setPasteIngredients(e.target.value)}
                      className="fresh-input min-h-[200px] font-mono text-sm"
                      data-testid="paste-ingredients-input"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-[#1A2E1A]">Instructions (optional)</Label>
                    <Textarea
                      placeholder="Paste cooking instructions..."
                      value={pasteInstructions}
                      onChange={(e) => setPasteInstructions(e.target.value)}
                      className="fresh-input min-h-[120px] font-mono text-sm"
                    />
                  </div>

                  <Button onClick={handleParseIngredients} disabled={loading} className="btn-primary w-full py-6" data-testid="parse-btn">
                    {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : (<><Sparkles className="w-5 h-5 mr-2" />Parse Ingredients</>)}
                  </Button>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <h3 className="font-display text-xl font-semibold text-[#1A2E1A]">{pasteName}</h3>
                    <Button variant="outline" onClick={() => { setIsParsed(false); setParsedIngredients([]); setParsedInstructions([]); }}>
                      Edit
                    </Button>
                  </div>

                  <div className="space-y-3">
                    <h4 className="text-sm font-medium text-stone-500 uppercase tracking-wider">Ingredients ({parsedIngredients.length})</h4>
                    {parsedIngredients.map((ing, index) => (
                      <div key={index} className="flex items-center justify-between p-3 rounded-xl bg-stone-50 border border-stone-200">
                        <div className="flex items-center gap-3">
                          <span className={`category-badge ${categoryColors[ing.category] || categoryColors.other}`}>{ing.category}</span>
                          <span className="text-[#1A2E1A]">
                            <span className="text-[#4A7C59] font-medium">{ing.quantity} {ing.unit}</span> {ing.name}
                          </span>
                        </div>
                        <Button variant="ghost" size="sm" onClick={() => removeParsedIngredient(index)} className="text-stone-400 hover:text-[#E07A5F]">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                  </div>

                  {parsedInstructions.length > 0 && (
                    <div className="space-y-3">
                      <h4 className="text-sm font-medium text-stone-500 uppercase tracking-wider">Instructions ({parsedInstructions.length})</h4>
                      {parsedInstructions.map((step, index) => (
                        <div key={index} className="flex items-start gap-4 p-3 rounded-xl bg-stone-50 border border-stone-200">
                          <span className="flex-shrink-0 w-7 h-7 rounded-full bg-[#4A7C59]/10 text-[#4A7C59] flex items-center justify-center text-sm font-bold">{index + 1}</span>
                          <p className="text-[#1A2E1A] flex-1 pt-0.5">{step}</p>
                          <Button variant="ghost" size="sm" onClick={() => removeParsedInstruction(index)} className="text-stone-400 hover:text-[#E07A5F]">
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}

                  <Button onClick={handleSaveParsedRecipe} disabled={loading || parsedIngredients.length === 0} className="btn-primary w-full py-6">
                    {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : (<><Leaf className="w-5 h-5 mr-2" />Save Recipe</>)}
                  </Button>
                </div>
              )}
            </div>
          </TabsContent>

          {/* Import URL Tab */}
          <TabsContent value="import" className="animate-fade-in-up">
            <div className="fresh-card-static p-8 space-y-6">
              <div className="flex items-start gap-4 p-4 rounded-xl bg-stone-100 border border-stone-200">
                <LinkIcon className="w-5 h-5 text-stone-600 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-[#1A2E1A]">URL Import</p>
                  <p className="text-sm text-stone-500 mt-1">
                    Works with public recipe pages. For Green Chef, use Paste instead.
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                <Label className="text-[#1A2E1A]">Recipe URL</Label>
                <div className="flex gap-3">
                  <Input
                    placeholder="https://example.com/recipe/..."
                    value={importUrl}
                    onChange={(e) => setImportUrl(e.target.value)}
                    className="flex-1 fresh-input"
                    data-testid="import-url-input"
                  />
                  <Button onClick={handleImportUrl} disabled={loading} className="btn-primary" data-testid="import-btn">
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : (<><Sparkles className="w-4 h-4 mr-2" />Import</>)}
                  </Button>
                </div>
              </div>
            </div>
          </TabsContent>

          {/* Manual Entry Tab */}
          <TabsContent value="manual" className="animate-fade-in-up">
            <form onSubmit={handleSubmit} className="space-y-8">
              <div className="fresh-card-static p-8 space-y-6">
                <h2 className="font-display text-xl font-semibold text-[#1A2E1A]">Basic Info</h2>
                
                <div className="grid gap-6">
                  <div className="space-y-2">
                    <Label className="text-[#1A2E1A]">Recipe Name *</Label>
                    <Input
                      placeholder="e.g., Honey Garlic Chicken"
                      value={recipe.name}
                      onChange={(e) => setRecipe(prev => ({ ...prev, name: e.target.value }))}
                      className="fresh-input"
                      data-testid="recipe-name-input"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-[#1A2E1A]">Description</Label>
                    <Textarea
                      placeholder="Brief description..."
                      value={recipe.description}
                      onChange={(e) => setRecipe(prev => ({ ...prev, description: e.target.value }))}
                      className="fresh-input min-h-[100px]"
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label className="text-[#1A2E1A]">Servings</Label>
                      <Input type="number" min="1" value={recipe.servings} onChange={(e) => setRecipe(prev => ({ ...prev, servings: parseInt(e.target.value) || 2 }))} className="fresh-input" />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[#1A2E1A]">Prep Time</Label>
                      <Input placeholder="15 min" value={recipe.prep_time} onChange={(e) => setRecipe(prev => ({ ...prev, prep_time: e.target.value }))} className="fresh-input" />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[#1A2E1A]">Cook Time</Label>
                      <Input placeholder="30 min" value={recipe.cook_time} onChange={(e) => setRecipe(prev => ({ ...prev, cook_time: e.target.value }))} className="fresh-input" />
                    </div>
                  </div>
                </div>
              </div>

              <div className="fresh-card-static p-8 space-y-6">
                <h2 className="font-display text-xl font-semibold text-[#1A2E1A]">Ingredients</h2>
                
                <div className="grid grid-cols-12 gap-3">
                  <div className="col-span-3">
                    <Input placeholder="Qty" value={newIngredient.quantity} onChange={(e) => setNewIngredient(prev => ({ ...prev, quantity: e.target.value }))} className="fresh-input" />
                  </div>
                  <div className="col-span-2">
                    <Input placeholder="Unit" value={newIngredient.unit} onChange={(e) => setNewIngredient(prev => ({ ...prev, unit: e.target.value }))} className="fresh-input" />
                  </div>
                  <div className="col-span-3">
                    <Input placeholder="Ingredient" value={newIngredient.name} onChange={(e) => setNewIngredient(prev => ({ ...prev, name: e.target.value }))} className="fresh-input" />
                  </div>
                  <div className="col-span-3">
                    <Select value={newIngredient.category} onValueChange={(value) => setNewIngredient(prev => ({ ...prev, category: value }))}>
                      <SelectTrigger className="fresh-input"><SelectValue /></SelectTrigger>
                      <SelectContent className="bg-white">
                        {CATEGORIES.map(cat => (<SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-1">
                    <Button type="button" onClick={addIngredient} className="w-full h-full btn-secondary">
                      <Plus className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                {recipe.ingredients.length > 0 && (
                  <div className="space-y-2">
                    {recipe.ingredients.map((ing, index) => (
                      <div key={index} className="flex items-center justify-between p-3 rounded-xl bg-stone-50 border border-stone-200">
                        <div className="flex items-center gap-3">
                          <span className={`category-badge category-${ing.category}`}>{ing.category}</span>
                          <span className="text-[#1A2E1A]">{ing.quantity} {ing.unit} {ing.name}</span>
                        </div>
                        <Button type="button" variant="ghost" size="sm" onClick={() => removeIngredient(index)} className="text-stone-400 hover:text-[#E07A5F]">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="fresh-card-static p-8 space-y-6">
                <h2 className="font-display text-xl font-semibold text-[#1A2E1A]">Instructions</h2>
                
                <div className="flex gap-3">
                  <Textarea placeholder="Add a step..." value={newInstruction} onChange={(e) => setNewInstruction(e.target.value)} className="fresh-input min-h-[80px]" />
                  <Button type="button" onClick={addInstruction} className="btn-secondary self-end">
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>

                {recipe.instructions.length > 0 && (
                  <div className="space-y-3">
                    {recipe.instructions.map((step, index) => (
                      <div key={index} className="flex items-start gap-4 p-4 rounded-xl bg-stone-50 border border-stone-200">
                        <span className="flex-shrink-0 w-8 h-8 rounded-full bg-[#4A7C59]/10 text-[#4A7C59] flex items-center justify-center text-sm font-bold">{index + 1}</span>
                        <p className="text-[#1A2E1A] flex-1">{step}</p>
                        <Button type="button" variant="ghost" size="sm" onClick={() => removeInstruction(index)} className="text-stone-400 hover:text-[#E07A5F]">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-4">
                <Button type="button" variant="outline" onClick={() => navigate("/recipes")}>Cancel</Button>
                <Button type="submit" disabled={loading} className="btn-primary px-8">
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : (<><Leaf className="w-4 h-4 mr-2" />Save Recipe</>)}
                </Button>
              </div>
            </form>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
