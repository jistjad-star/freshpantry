import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, Trash2, Plus, Camera, Link2, FileText, Sparkles, ChefHat, Clock, Users, ImageIcon, ImageOff, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import api from "@/lib/api";

const RECIPE_SOURCES = [
  { value: "own-recipe", label: "Own Recipe" },
  { value: "green-chef", label: "Green Chef" },
  { value: "gousto", label: "Gousto" },
  { value: "hello-fresh", label: "Hello Fresh" },
  { value: "mindful-chef", label: "Mindful Chef" },
  { value: "other", label: "Other" },
];

export default function AddRecipe() {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  const photoInputRef = useRef(null);
  
  // Form state
  const [loading, setLoading] = useState(false);
  const [inputMethod, setInputMethod] = useState(null); // 'url', 'screenshot', 'paste'
  
  // Recipe data
  const [recipeName, setRecipeName] = useState("");
  const [source, setSource] = useState("");
  const [sourceOther, setSourceOther] = useState("");
  const [servings, setServings] = useState(2);
  const [prepTime, setPrepTime] = useState("");
  const [cookTime, setCookTime] = useState("");
  
  // Image choice: 'ai', 'own', 'none'
  const [imageChoice, setImageChoice] = useState('ai');
  const [ownPhoto, setOwnPhoto] = useState(null);
  const [ownPhotoPreview, setOwnPhotoPreview] = useState(null);
  
  // Input data
  const [urlInput, setUrlInput] = useState("");
  const [pasteText, setPasteText] = useState("");
  const [images, setImages] = useState([]);
  const [imagePreviews, setImagePreviews] = useState([]);
  
  // Parsed data
  const [ingredients, setIngredients] = useState([]);
  const [instructions, setInstructions] = useState([]);
  const [isParsed, setIsParsed] = useState(false);

  // Handle own photo upload
  const handleOwnPhotoUpload = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setOwnPhoto(file);
      setOwnPhotoPreview(URL.createObjectURL(file));
      setImageChoice('own');
    }
  };

  const removeOwnPhoto = () => {
    setOwnPhoto(null);
    setOwnPhotoPreview(null);
    if (photoInputRef.current) photoInputRef.current.value = '';
  };
  
  // Input data
  const [urlInput, setUrlInput] = useState("");
  const [pasteText, setPasteText] = useState("");
  const [images, setImages] = useState([]);
  const [imagePreviews, setImagePreviews] = useState([]);
  
  // Parsed data
  const [ingredients, setIngredients] = useState([]);
  const [instructions, setInstructions] = useState([]);
  const [isParsed, setIsParsed] = useState(false);

  // Extract URL from text
  const extractUrl = (text) => {
    const match = text.match(/https?:\/\/[^\s]+/);
    return match ? match[0] : text.trim();
  };

  // Handle image uploads
  const handleImageUpload = (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      setImages(prev => [...prev, ...files]);
      setImagePreviews(prev => [...prev, ...files.map(f => URL.createObjectURL(f))]);
      setInputMethod('screenshot');
    }
  };

  const removeImage = (index) => {
    setImages(prev => prev.filter((_, i) => i !== index));
    setImagePreviews(prev => prev.filter((_, i) => i !== index));
  };

  // Parse recipe from URL
  const parseFromUrl = async () => {
    const cleanUrl = extractUrl(urlInput);
    if (!cleanUrl) {
      toast.error("Please enter a valid URL");
      return;
    }
    
    setLoading(true);
    try {
      const response = await api.scrapeRecipeUrl(cleanUrl);
      const data = response.data;
      
      if (data.name) setRecipeName(data.name);
      if (data.ingredients?.length > 0) setIngredients(data.ingredients);
      if (data.instructions?.length > 0) setInstructions(data.instructions);
      if (data.prep_time) setPrepTime(data.prep_time);
      if (data.cook_time) setCookTime(data.cook_time);
      
      setIsParsed(true);
      toast.success(`Found ${data.ingredients?.length || 0} ingredients!`);
    } catch (error) {
      toast.error("Couldn't import from URL. Try screenshot or paste.");
    } finally {
      setLoading(false);
    }
  };

  // Parse recipe from screenshots
  const parseFromScreenshots = async () => {
    if (!recipeName.trim()) {
      toast.error("Enter a recipe name first");
      return;
    }
    if (images.length === 0) {
      toast.error("Upload at least one image");
      return;
    }
    
    setLoading(true);
    try {
      let allIngredients = [];
      let allInstructions = [];
      let foundPrepTime = "";
      let foundCookTime = "";
      
      for (const file of images) {
        // Try parsing as ingredients
        const ingResponse = await api.parseImage(file);
        if (ingResponse.data.ingredients?.length > 0) {
          allIngredients = [...allIngredients, ...ingResponse.data.ingredients];
        }
        
        // Try parsing as instructions
        const instResponse = await api.parseInstructionsImage(file);
        if (instResponse.data.instructions?.length > 0) {
          allInstructions = [...allInstructions, ...instResponse.data.instructions];
        }
        if (instResponse.data.prep_time) foundPrepTime = instResponse.data.prep_time;
        if (instResponse.data.cook_time) foundCookTime = instResponse.data.cook_time;
      }
      
      // Remove duplicate ingredients
      const uniqueIngredients = allIngredients.reduce((acc, ing) => {
        if (!acc.find(i => i.name.toLowerCase() === ing.name.toLowerCase())) {
          acc.push(ing);
        }
        return acc;
      }, []);
      
      setIngredients(uniqueIngredients);
      setInstructions(allInstructions);
      if (foundPrepTime) setPrepTime(foundPrepTime);
      if (foundCookTime) setCookTime(foundCookTime);
      
      setIsParsed(true);
      toast.success(`Found ${uniqueIngredients.length} ingredients, ${allInstructions.length} steps!`);
    } catch (error) {
      toast.error("Failed to parse images");
    } finally {
      setLoading(false);
    }
  };

  // Parse recipe from pasted text
  const parseFromText = async () => {
    if (!recipeName.trim()) {
      toast.error("Enter a recipe name first");
      return;
    }
    if (!pasteText.trim()) {
      toast.error("Paste some text first");
      return;
    }
    
    setLoading(true);
    try {
      const response = await api.parseIngredients(recipeName, pasteText, pasteText);
      
      setIngredients(response.data.ingredients || []);
      setInstructions(response.data.instructions || []);
      if (response.data.prep_time) setPrepTime(response.data.prep_time);
      if (response.data.cook_time) setCookTime(response.data.cook_time);
      
      setIsParsed(true);
      toast.success(`Found ${response.data.ingredients?.length || 0} ingredients!`);
    } catch (error) {
      toast.error("Failed to parse text");
    } finally {
      setLoading(false);
    }
  };

  // Calculate total time
  const getTotalTime = () => {
    const prep = parseInt(prepTime) || 0;
    const cook = parseInt(cookTime) || 0;
    return prep + cook;
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
                          RECIPE_SOURCES.find(s => s.value === source)?.label || 
                          (urlInput ? extractUrl(urlInput) : "");
      
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
      toast.error("Failed to save recipe");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen py-8" data-testid="add-recipe-page">
      <div className="max-w-3xl mx-auto px-4">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="font-display text-3xl font-bold text-[#1A2E1A] mb-2">Add Recipe</h1>
          <p className="text-stone-500">Import from URL, upload screenshots, or paste text</p>
        </div>

        <div className="space-y-6">
          {/* Recipe Name */}
          <div className="fresh-card-static p-6">
            <Label className="text-[#1A2E1A] text-lg font-medium mb-3 block">Recipe Name *</Label>
            <Input
              placeholder="e.g., Honey Garlic Chicken"
              value={recipeName}
              onChange={(e) => setRecipeName(e.target.value)}
              className="fresh-input text-lg"
              data-testid="recipe-name-input"
            />
            
            {/* Optional Source */}
            <div className="mt-4 flex items-center gap-3">
              <Label className="text-stone-500 text-sm">Source (optional):</Label>
              <Select value={source} onValueChange={setSource}>
                <SelectTrigger className="fresh-input w-[180px]">
                  <SelectValue placeholder="Select source" />
                </SelectTrigger>
                <SelectContent className="bg-white">
                  {RECIPE_SOURCES.map(s => (
                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {source === "other" && (
                <Input
                  placeholder="Enter source"
                  value={sourceOther}
                  onChange={(e) => setSourceOther(e.target.value)}
                  className="fresh-input w-[150px]"
                />
              )}
            </div>
          </div>

          {/* Input Methods */}
          <div className="fresh-card-static p-6">
            <Label className="text-[#1A2E1A] text-lg font-medium mb-4 block">Add Ingredients & Instructions</Label>
            
            {/* Method Selection */}
            <div className="grid grid-cols-3 gap-3 mb-6">
              <button
                onClick={() => setInputMethod('url')}
                className={`p-4 rounded-xl border-2 transition-all text-center ${
                  inputMethod === 'url' 
                    ? 'border-[#4A7C59] bg-[#4A7C59]/5' 
                    : 'border-stone-200 hover:border-[#4A7C59]/50'
                }`}
              >
                <Link2 className={`w-6 h-6 mx-auto mb-2 ${inputMethod === 'url' ? 'text-[#4A7C59]' : 'text-stone-400'}`} />
                <span className={`text-sm font-medium ${inputMethod === 'url' ? 'text-[#4A7C59]' : 'text-stone-600'}`}>From URL</span>
              </button>
              
              <button
                onClick={() => { setInputMethod('screenshot'); fileInputRef.current?.click(); }}
                className={`p-4 rounded-xl border-2 transition-all text-center ${
                  inputMethod === 'screenshot' 
                    ? 'border-[#4A7C59] bg-[#4A7C59]/5' 
                    : 'border-stone-200 hover:border-[#4A7C59]/50'
                }`}
              >
                <Camera className={`w-6 h-6 mx-auto mb-2 ${inputMethod === 'screenshot' ? 'text-[#4A7C59]' : 'text-stone-400'}`} />
                <span className={`text-sm font-medium ${inputMethod === 'screenshot' ? 'text-[#4A7C59]' : 'text-stone-600'}`}>Screenshots</span>
              </button>
              
              <button
                onClick={() => setInputMethod('paste')}
                className={`p-4 rounded-xl border-2 transition-all text-center ${
                  inputMethod === 'paste' 
                    ? 'border-[#4A7C59] bg-[#4A7C59]/5' 
                    : 'border-stone-200 hover:border-[#4A7C59]/50'
                }`}
              >
                <FileText className={`w-6 h-6 mx-auto mb-2 ${inputMethod === 'paste' ? 'text-[#4A7C59]' : 'text-stone-400'}`} />
                <span className={`text-sm font-medium ${inputMethod === 'paste' ? 'text-[#4A7C59]' : 'text-stone-600'}`}>Paste Text</span>
              </button>
            </div>

            {/* Hidden file input */}
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleImageUpload}
              accept="image/*"
              multiple
              className="hidden"
            />

            {/* URL Input */}
            {inputMethod === 'url' && (
              <div className="space-y-3">
                <div className="flex gap-2">
                  <Input
                    placeholder="Paste recipe URL or text containing URL"
                    value={urlInput}
                    onChange={(e) => setUrlInput(extractUrl(e.target.value))}
                    className="fresh-input flex-1"
                  />
                  <Button onClick={parseFromUrl} disabled={loading} className="btn-primary">
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Sparkles className="w-4 h-4 mr-2" />Import</>}
                  </Button>
                </div>
              </div>
            )}

            {/* Screenshot Input */}
            {inputMethod === 'screenshot' && (
              <div className="space-y-4">
                {imagePreviews.length > 0 ? (
                  <div className="grid grid-cols-4 gap-3">
                    {imagePreviews.map((preview, i) => (
                      <div key={i} className="relative group aspect-square">
                        <img src={preview} alt="" className="w-full h-full object-cover rounded-lg" />
                        <button
                          onClick={() => removeImage(i)}
                          className="absolute top-1 right-1 bg-white rounded-full p-1.5 opacity-0 group-hover:opacity-100 transition-opacity shadow"
                        >
                          <Trash2 className="w-3 h-3 text-red-500" />
                        </button>
                      </div>
                    ))}
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="aspect-square border-2 border-dashed border-stone-300 rounded-lg flex items-center justify-center hover:border-[#4A7C59] transition-colors"
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
                    <p className="text-stone-500">Click to upload recipe screenshots</p>
                    <p className="text-stone-400 text-sm">Supports multiple images</p>
                  </button>
                )}
                
                {images.length > 0 && (
                  <Button onClick={parseFromScreenshots} disabled={loading || !recipeName.trim()} className="btn-primary w-full">
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Sparkles className="w-4 h-4 mr-2" />Extract from {images.length} Image{images.length > 1 ? 's' : ''}</>}
                  </Button>
                )}
              </div>
            )}

            {/* Paste Input */}
            {inputMethod === 'paste' && (
              <div className="space-y-3">
                <Textarea
                  placeholder="Paste ingredients and instructions here...

Example:
2 chicken breasts
1 tbsp olive oil
3 cloves garlic

1. Preheat oven to 200°C
2. Season chicken with salt and pepper
3. Cook for 25 minutes"
                  value={pasteText}
                  onChange={(e) => setPasteText(e.target.value)}
                  className="fresh-input min-h-[200px] font-mono text-sm"
                />
                <Button onClick={parseFromText} disabled={loading || !recipeName.trim() || !pasteText.trim()} className="btn-primary w-full">
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Sparkles className="w-4 h-4 mr-2" />Extract Ingredients</>}
                </Button>
              </div>
            )}
          </div>

          {/* Parsed Results */}
          {isParsed && (
            <>
              {/* Time & Servings */}
              <div className="fresh-card-static p-6">
                <Label className="text-[#1A2E1A] text-lg font-medium mb-4 block">Details</Label>
                <div className="grid grid-cols-4 gap-4">
                  <div>
                    <Label className="text-stone-500 text-sm mb-1 block">Servings</Label>
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
                  <div>
                    <Label className="text-stone-500 text-sm mb-1 block">Prep Time</Label>
                    <Input value={prepTime} onChange={(e) => setPrepTime(e.target.value)} placeholder="15 min" className="fresh-input" />
                  </div>
                  <div>
                    <Label className="text-stone-500 text-sm mb-1 block">Cook Time</Label>
                    <Input value={cookTime} onChange={(e) => setCookTime(e.target.value)} placeholder="30 min" className="fresh-input" />
                  </div>
                  <div>
                    <Label className="text-stone-500 text-sm mb-1 block">Total</Label>
                    <div className="fresh-input bg-stone-50 flex items-center justify-center text-[#4A7C59] font-medium">
                      {getTotalTime() > 0 ? `${getTotalTime()} min` : '-'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Ingredients */}
              <div className="fresh-card-static p-6">
                <div className="flex items-center justify-between mb-4">
                  <Label className="text-[#1A2E1A] text-lg font-medium">Ingredients ({ingredients.length})</Label>
                </div>
                <div className="space-y-2 max-h-[300px] overflow-y-auto">
                  {ingredients.map((ing, i) => (
                    <div key={i} className="flex items-center justify-between p-3 bg-stone-50 rounded-lg">
                      <span className="text-sm">
                        <span className="text-[#4A7C59] font-medium">{ing.quantity} {ing.unit}</span> {ing.name}
                      </span>
                      <button onClick={() => setIngredients(prev => prev.filter((_, idx) => idx !== i))} className="text-stone-400 hover:text-red-500">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Instructions */}
              {instructions.length > 0 && (
                <div className="fresh-card-static p-6">
                  <Label className="text-[#1A2E1A] text-lg font-medium mb-4 block">Instructions ({instructions.length} steps)</Label>
                  <div className="space-y-2 max-h-[300px] overflow-y-auto">
                    {instructions.map((step, i) => (
                      <div key={i} className="flex items-start gap-3 p-3 bg-stone-50 rounded-lg">
                        <span className="w-6 h-6 rounded-full bg-[#4A7C59]/10 text-[#4A7C59] flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">
                          {i + 1}
                        </span>
                        <p className="text-sm flex-1">{step}</p>
                        <button onClick={() => setInstructions(prev => prev.filter((_, idx) => idx !== i))} className="text-stone-400 hover:text-red-500">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Save Button */}
              <Button onClick={saveRecipe} disabled={loading} className="btn-primary w-full py-6 text-lg">
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <><ChefHat className="w-5 h-5 mr-2" />Save Recipe</>}
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
