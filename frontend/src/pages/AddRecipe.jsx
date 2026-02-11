import { useState, useRef, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Loader2, Trash2, Plus, Camera, Link2, FileText, Sparkles, ChefHat, Clock, Users, ImageIcon, ImageOff, Upload, GlassWater, Wine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import api from "@/lib/api";

export default function AddRecipe() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);
  const photoInputRef = useRef(null);
  
  // Form state
  const [loading, setLoading] = useState(false);
  const [inputMethod, setInputMethod] = useState(null); // 'url', 'screenshot', 'paste'
  
  // Recipe type: 'meal' or 'cocktail'
  const [recipeType, setRecipeType] = useState('meal');
  const [isAlcoholic, setIsAlcoholic] = useState(true); // For cocktails
  
  // Check URL param for cocktail mode
  useEffect(() => {
    if (searchParams.get('type') === 'cocktail') {
      setRecipeType('cocktail');
    }
  }, [searchParams]);
  
  // Recipe data
  const [recipeName, setRecipeName] = useState("");
  const [isOwnRecipe, setIsOwnRecipe] = useState(false);  // Simple checkbox instead of dropdown
  const [servings, setServings] = useState(2);
  const [prepTime, setPrepTime] = useState("");
  const [cookTime, setCookTime] = useState("");
  
  // Image choice: 'ai', 'own', 'none'
  const [imageChoice, setImageChoice] = useState('ai');
  const [ownPhoto, setOwnPhoto] = useState(null);
  const [ownPhotoPreview, setOwnPhotoPreview] = useState(null);
  
  // Input data
  const [urlInput, setUrlInput] = useState("");
  const [pasteIngredients, setPasteIngredients] = useState("");
  const [pasteInstructions, setPasteInstructions] = useState("");
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
      let suggestedName = "";
      
      for (const file of images) {
        console.log(`Processing image: ${file.name}, size: ${file.size}, type: ${file.type}`);
        
        // Try parsing as ingredients
        try {
          const ingResponse = await api.parseImage(file);
          console.log("Ingredients response:", ingResponse.data);
          if (ingResponse.data.ingredients?.length > 0) {
            allIngredients = [...allIngredients, ...ingResponse.data.ingredients];
          }
        } catch (ingError) {
          console.error("Error parsing ingredients:", ingError);
        }
        
        // Try parsing as instructions
        try {
          const instResponse = await api.parseInstructionsImage(file);
          console.log("Instructions response:", instResponse.data);
          if (instResponse.data.instructions?.length > 0) {
            allInstructions = [...allInstructions, ...instResponse.data.instructions];
          }
          if (instResponse.data.prep_time) foundPrepTime = instResponse.data.prep_time;
          if (instResponse.data.cook_time) foundCookTime = instResponse.data.cook_time;
          // Get AI-suggested name (use first one found)
          if (instResponse.data.suggested_name && !suggestedName) {
            suggestedName = instResponse.data.suggested_name;
          }
        } catch (instError) {
          console.error("Error parsing instructions:", instError);
        }
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
      
      // Set AI-suggested name if we don't have one yet
      if (suggestedName && !recipeName.trim()) {
        setRecipeName(suggestedName);
      }
      
      // Show result message
      if (uniqueIngredients.length === 0 && allInstructions.length === 0) {
        toast.error("Could not extract recipe from images. Try clearer photos of the recipe card.");
      } else if (suggestedName) {
        toast.success(`Found ${uniqueIngredients.length} ingredients, ${allInstructions.length} steps! Suggested name: "${suggestedName}"`);
      } else {
        toast.success(`Found ${uniqueIngredients.length} ingredients, ${allInstructions.length} steps!`);
      }
      
      setIsParsed(true);
    } catch (error) {
      console.error("Parse error:", error);
      toast.error("Failed to parse images: " + (error.message || "Unknown error"));
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
    if (!pasteIngredients.trim()) {
      toast.error("Paste some ingredients first");
      return;
    }
    
    setLoading(true);
    try {
      // Send ingredients and instructions separately
      const response = await api.parseIngredients(recipeName, pasteIngredients, pasteInstructions);
      
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
      // Simple source handling - either "Own Recipe" or extracted from URL/parsed
      const recipeSource = isOwnRecipe ? "Own Recipe" : (urlInput ? extractUrl(urlInput) : "Imported");
      
      // Handle image based on choice
      let imageUrl = "";
      if (imageChoice === 'own' && ownPhoto) {
        // Upload own photo (convert to base64 for storage)
        const reader = new FileReader();
        imageUrl = await new Promise((resolve) => {
          reader.onloadend = () => resolve(reader.result);
          reader.readAsDataURL(ownPhoto);
        });
      } else if (imageChoice === 'none') {
        imageUrl = ""; // No image
      }
      // If imageChoice === 'ai', leave imageUrl empty and backend will generate
      
      const recipeData = {
        name: recipeName,
        description: "",
        servings,
        prep_time: prepTime,
        cook_time: cookTime,
        ingredients,
        instructions,
        source_url: recipeSource,
        image_url: imageUrl,
        skip_image_generation: imageChoice !== 'ai' // Tell backend not to generate AI image
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
            
            {/* Own Recipe Checkbox */}
            <div className="mt-4 flex items-center gap-3">
              <Checkbox
                id="own-recipe"
                checked={isOwnRecipe}
                onCheckedChange={setIsOwnRecipe}
                className="border-stone-300 data-[state=checked]:bg-[#4A7C59] data-[state=checked]:border-[#4A7C59]"
                data-testid="own-recipe-checkbox"
              />
              <Label 
                htmlFor="own-recipe" 
                className="text-stone-600 text-sm cursor-pointer"
              >
                This is my own recipe
              </Label>
            </div>
            
            {/* Photo Choice - Always Visible */}
            <div className="mt-4 flex items-center gap-3">
              <Label className="text-stone-500 text-sm">Recipe Photo:</Label>
              <Select value={imageChoice} onValueChange={(val) => {
                setImageChoice(val);
                if (val === 'own') {
                  photoInputRef.current?.click();
                } else if (val === 'none') {
                  removeOwnPhoto();
                }
              }}>
                <SelectTrigger className="fresh-input w-[200px]" data-testid="image-choice-select">
                  <SelectValue placeholder="Choose photo option" />
                </SelectTrigger>
                <SelectContent className="bg-white">
                  <SelectItem value="ai">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-[#4A7C59]" />
                      <span>AI Generate</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="own">
                    <div className="flex items-center gap-2">
                      <Upload className="w-4 h-4 text-[#4A7C59]" />
                      <span>Upload My Photo</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="none">
                    <div className="flex items-center gap-2">
                      <ImageOff className="w-4 h-4 text-stone-400" />
                      <span>No Photo</span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
              
              {/* Hidden photo input */}
              <input
                type="file"
                ref={photoInputRef}
                onChange={handleOwnPhotoUpload}
                accept="image/*"
                className="hidden"
              />
              
              {/* Own photo preview inline */}
              {imageChoice === 'own' && ownPhotoPreview && (
                <div className="relative">
                  <img src={ownPhotoPreview} alt="Preview" className="w-12 h-12 object-cover rounded-lg" />
                  <button
                    onClick={removeOwnPhoto}
                    className="absolute -top-1 -right-1 bg-white rounded-full p-0.5 shadow hover:bg-red-50"
                  >
                    <Trash2 className="w-3 h-3 text-red-500" />
                  </button>
                </div>
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

            {/* Hidden file inputs */}
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleImageUpload}
              accept="image/*,.pdf,application/pdf"
              multiple
              className="hidden"
            />
            <input
              type="file"
              ref={cameraInputRef}
              onChange={handleImageUpload}
              accept="image/*"
              capture="environment"
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
                    {/* Add more buttons */}
                    <button
                      onClick={() => cameraInputRef.current?.click()}
                      className="aspect-square rounded-lg border-2 border-dashed border-stone-200 hover:border-[#4A7C59] flex flex-col items-center justify-center text-stone-400 hover:text-[#4A7C59] transition-colors"
                    >
                      <Camera className="w-5 h-5" />
                      <span className="text-xs mt-1">Scan</span>
                    </button>
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="aspect-square rounded-lg border-2 border-dashed border-stone-200 hover:border-[#4A7C59] flex flex-col items-center justify-center text-stone-400 hover:text-[#4A7C59] transition-colors"
                    >
                      <Upload className="w-5 h-5" />
                      <span className="text-xs mt-1">Upload</span>
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-4">
                    <button
                      onClick={() => cameraInputRef.current?.click()}
                      className="p-8 rounded-xl border-2 border-dashed border-stone-200 hover:border-[#4A7C59] text-center transition-colors group"
                    >
                      <Camera className="w-10 h-10 mx-auto mb-3 text-stone-300 group-hover:text-[#4A7C59]" />
                      <p className="text-stone-600 font-medium group-hover:text-[#4A7C59]">Take Photo</p>
                      <p className="text-xs text-stone-400 mt-1">Use camera to scan recipe card</p>
                    </button>
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="p-8 rounded-xl border-2 border-dashed border-stone-200 hover:border-[#4A7C59] text-center transition-colors group"
                    >
                      <Upload className="w-10 h-10 mx-auto mb-3 text-stone-300 group-hover:text-[#4A7C59]" />
                      <p className="text-stone-600 font-medium group-hover:text-[#4A7C59]">Upload Images</p>
                      <p className="text-xs text-stone-400 mt-1">Select screenshots or photos</p>
                    </button>
                  </div>
                )}
                
                {images.length > 0 && (
                  <Button onClick={parseFromScreenshots} disabled={loading} className="btn-primary w-full">
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Sparkles className="w-4 h-4 mr-2" />Extract from {images.length} Image{images.length > 1 ? 's' : ''}</>}
                  </Button>
                )}
              </div>
            )}

            {/* Paste Input */}
            {inputMethod === 'paste' && (
              <div className="space-y-4">
                {/* Ingredients Input */}
                <div>
                  <Label className="text-[#1A2E1A] text-sm font-medium mb-2 block">
                    Ingredients *
                  </Label>
                  <Textarea
                    placeholder="Paste ingredients here...

Example:
2 chicken breasts
1 tbsp olive oil
3 cloves garlic, minced
1 cup honey
1/4 cup soy sauce"
                    value={pasteIngredients}
                    onChange={(e) => setPasteIngredients(e.target.value)}
                    className="fresh-input min-h-[150px] font-mono text-sm"
                    data-testid="paste-ingredients-input"
                  />
                </div>
                
                {/* Instructions Input */}
                <div>
                  <Label className="text-stone-500 text-sm font-medium mb-2 block">
                    Instructions (optional)
                  </Label>
                  <Textarea
                    placeholder="Paste cooking instructions here...

Example:
1. Preheat oven to 200°C
2. Season chicken with salt and pepper
3. Heat oil in a pan over medium heat
4. Cook chicken for 25 minutes until golden"
                    value={pasteInstructions}
                    onChange={(e) => setPasteInstructions(e.target.value)}
                    className="fresh-input min-h-[150px] font-mono text-sm"
                    data-testid="paste-instructions-input"
                  />
                </div>
                
                <Button onClick={parseFromText} disabled={loading || !recipeName.trim() || !pasteIngredients.trim()} className="btn-primary w-full">
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
                    <div key={i} className="flex items-center gap-2 p-2 bg-stone-50 rounded-lg">
                      <Input
                        value={ing.quantity}
                        onChange={(e) => {
                          const updated = [...ingredients];
                          updated[i] = { ...ing, quantity: e.target.value };
                          setIngredients(updated);
                        }}
                        className="fresh-input w-16 text-sm"
                        placeholder="Qty"
                      />
                      <Input
                        value={ing.unit}
                        onChange={(e) => {
                          const updated = [...ingredients];
                          updated[i] = { ...ing, unit: e.target.value };
                          setIngredients(updated);
                        }}
                        className="fresh-input w-20 text-sm"
                        placeholder="Unit"
                      />
                      <Input
                        value={ing.name}
                        onChange={(e) => {
                          const updated = [...ingredients];
                          updated[i] = { ...ing, name: e.target.value };
                          setIngredients(updated);
                        }}
                        className="fresh-input flex-1 min-w-[180px] text-sm"
                        placeholder="Ingredient name"
                      />
                      <button onClick={() => setIngredients(prev => prev.filter((_, idx) => idx !== i))} className="text-stone-400 hover:text-red-500 p-1">
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
