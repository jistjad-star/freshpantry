import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Plus, Trash2, Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import api from "@/lib/api";

const CATEGORIES = [
  { value: "produce", label: "Produce" },
  { value: "dairy", label: "Dairy" },
  { value: "protein", label: "Protein" },
  { value: "grains", label: "Grains" },
  { value: "spices", label: "Spices" },
  { value: "pantry", label: "Pantry" },
  { value: "other", label: "Other" },
];

export default function EditRecipe() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [servings, setServings] = useState(2);
  const [prepTime, setPrepTime] = useState("");
  const [cookTime, setCookTime] = useState("");
  const [ingredients, setIngredients] = useState([]);
  const [instructions, setInstructions] = useState([""]);

  useEffect(() => {
    const fetchRecipe = async () => {
      try {
        const response = await api.getRecipe(id);
        const recipe = response.data;
        setName(recipe.name || "");
        setDescription(recipe.description || "");
        setServings(recipe.servings || 2);
        setPrepTime(recipe.prep_time || "");
        setCookTime(recipe.cook_time || "");
        setIngredients(recipe.ingredients || []);
        setInstructions(recipe.instructions?.length ? recipe.instructions : [""]);
      } catch (error) {
        toast.error("Recipe not found");
        navigate("/recipes");
      } finally {
        setLoading(false);
      }
    };
    fetchRecipe();
  }, [id, navigate]);

  const addIngredient = () => {
    setIngredients([...ingredients, { name: "", quantity: "", unit: "", category: "other" }]);
  };

  const updateIngredient = (index, field, value) => {
    const updated = [...ingredients];
    updated[index] = { ...updated[index], [field]: value };
    setIngredients(updated);
  };

  const removeIngredient = (index) => {
    setIngredients(ingredients.filter((_, i) => i !== index));
  };

  const addInstruction = () => {
    setInstructions([...instructions, ""]);
  };

  const updateInstruction = (index, value) => {
    const updated = [...instructions];
    updated[index] = value;
    setInstructions(updated);
  };

  const removeInstruction = (index) => {
    if (instructions.length > 1) {
      setInstructions(instructions.filter((_, i) => i !== index));
    }
  };

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error("Recipe name is required");
      return;
    }

    setSaving(true);
    try {
      const validIngredients = ingredients.filter(ing => ing.name.trim());
      const validInstructions = instructions.filter(inst => inst.trim());

      await api.updateRecipe(id, {
        name: name.trim(),
        description: description.trim(),
        servings,
        prep_time: prepTime.trim(),
        cook_time: cookTime.trim(),
        ingredients: validIngredients,
        instructions: validInstructions,
      });

      toast.success("Recipe updated!");
      navigate(`/recipes/${id}`);
    } catch (error) {
      toast.error("Failed to update recipe");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-[#4A7C59]" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-4">
        <Button variant="ghost" onClick={() => navigate(`/recipes/${id}`)} className="hover:bg-[#4A7C59]/10">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <h1 className="font-display text-2xl font-bold text-[#1A2E1A]">Edit Recipe</h1>
      </div>

      <div className="fresh-card-static p-6 space-y-6">
        {/* Basic Info */}
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">Recipe Name *</label>
            <Input 
              value={name} 
              onChange={(e) => setName(e.target.value)} 
              className="fresh-input"
              placeholder="Enter recipe name"
              data-testid="edit-recipe-name"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">Description</label>
            <Textarea 
              value={description} 
              onChange={(e) => setDescription(e.target.value)} 
              className="fresh-input min-h-[80px]"
              placeholder="Brief description of the recipe"
              data-testid="edit-recipe-description"
            />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">Servings</label>
              <Input 
                type="number" 
                min="1"
                value={servings} 
                onChange={(e) => setServings(parseInt(e.target.value) || 1)} 
                className="fresh-input"
                data-testid="edit-recipe-servings"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">Prep Time</label>
              <Input 
                value={prepTime} 
                onChange={(e) => setPrepTime(e.target.value)} 
                className="fresh-input"
                placeholder="e.g., 15 min"
                data-testid="edit-recipe-prep-time"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">Cook Time</label>
              <Input 
                value={cookTime} 
                onChange={(e) => setCookTime(e.target.value)} 
                className="fresh-input"
                placeholder="e.g., 30 min"
                data-testid="edit-recipe-cook-time"
              />
            </div>
          </div>
        </div>

        {/* Ingredients */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <label className="block text-sm font-medium text-stone-700">Ingredients</label>
            <Button variant="ghost" size="sm" onClick={addIngredient} className="text-[#4A7C59] hover:bg-[#4A7C59]/10">
              <Plus className="w-4 h-4 mr-1" /> Add
            </Button>
          </div>
          <div className="space-y-2">
            {ingredients.map((ing, index) => (
              <div key={index} className="flex items-center gap-2" data-testid={`ingredient-row-${index}`}>
                <Input
                  value={ing.quantity}
                  onChange={(e) => updateIngredient(index, 'quantity', e.target.value)}
                  className="fresh-input w-20"
                  placeholder="Qty"
                />
                <Input
                  value={ing.unit}
                  onChange={(e) => updateIngredient(index, 'unit', e.target.value)}
                  className="fresh-input w-24"
                  placeholder="Unit"
                />
                <Input
                  value={ing.name}
                  onChange={(e) => updateIngredient(index, 'name', e.target.value)}
                  className="fresh-input flex-1"
                  placeholder="Ingredient name"
                />
                <select
                  value={ing.category || 'other'}
                  onChange={(e) => updateIngredient(index, 'category', e.target.value)}
                  className="fresh-input w-28 text-sm"
                >
                  {CATEGORIES.map(cat => (
                    <option key={cat.value} value={cat.value}>{cat.label}</option>
                  ))}
                </select>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeIngredient(index)}
                  className="text-[#E07A5F] hover:bg-[#E07A5F]/10 p-2"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            ))}
            {ingredients.length === 0 && (
              <p className="text-sm text-stone-400 italic py-2">No ingredients yet. Click "Add" to add one.</p>
            )}
          </div>
        </div>

        {/* Instructions */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <label className="block text-sm font-medium text-stone-700">Instructions</label>
            <Button variant="ghost" size="sm" onClick={addInstruction} className="text-[#4A7C59] hover:bg-[#4A7C59]/10">
              <Plus className="w-4 h-4 mr-1" /> Add Step
            </Button>
          </div>
          <div className="space-y-2">
            {instructions.map((inst, index) => (
              <div key={index} className="flex items-start gap-2" data-testid={`instruction-row-${index}`}>
                <span className="text-sm font-medium text-stone-500 mt-2.5 w-6">{index + 1}.</span>
                <Textarea
                  value={inst}
                  onChange={(e) => updateInstruction(index, e.target.value)}
                  className="fresh-input flex-1 min-h-[60px]"
                  placeholder={`Step ${index + 1}`}
                />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeInstruction(index)}
                  disabled={instructions.length === 1}
                  className="text-[#E07A5F] hover:bg-[#E07A5F]/10 p-2 mt-1"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            ))}
          </div>
        </div>

        {/* Save Button */}
        <div className="flex justify-end gap-3 pt-4 border-t border-stone-200">
          <Button variant="outline" onClick={() => navigate(`/recipes/${id}`)} className="border-stone-200">
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving} className="btn-primary" data-testid="save-recipe-btn">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Save className="w-4 h-4 mr-2" />Save Changes</>}
          </Button>
        </div>
      </div>
    </div>
  );
}
