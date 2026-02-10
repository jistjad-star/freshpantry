import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { 
  Leaf, 
  ChefHat, 
  Clock, 
  Users, 
  Download, 
  Loader2, 
  Check, 
  AlertCircle,
  ShieldCheck,
  Lock,
  Timer,
  Camera
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import api from "@/lib/api";
import { useAuth } from "@/lib/AuthContext";

export default function SharedRecipes() {
  const { shareId } = useParams();
  const navigate = useNavigate();
  const { user, login } = useAuth();
  const [shareInfo, setShareInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState(null);
  const [imported, setImported] = useState(false);

  useEffect(() => {
    const fetchShareInfo = async () => {
      try {
        const response = await api.getSharedRecipes(shareId);
        setShareInfo(response.data);
      } catch (err) {
        if (err.response?.status === 410) {
          setError(err.response?.data?.detail || "This link has expired or already been used");
        } else {
          setError("Link not found or expired");
        }
      } finally {
        setLoading(false);
      }
    };
    fetchShareInfo();
  }, [shareId]);

  const handleImport = async () => {
    if (!user) {
      toast.error("Please sign in to import recipes");
      login();
      return;
    }

    setImporting(true);
    try {
      const response = await api.importSharedRecipes(shareId);
      setImported(true);
      toast.success(response.data.message || `Imported ${response.data.count} recipes!`);
      
      // Show the notice about adding photos
      if (response.data.notice) {
        setTimeout(() => {
          toast.info(response.data.notice, { duration: 5000 });
        }, 1000);
      }
      
      // Navigate after a brief delay to show success
      setTimeout(() => navigate("/recipes"), 2000);
    } catch (err) {
      const errorMsg = err.response?.data?.detail || "Failed to import recipes";
      toast.error(errorMsg);
      if (err.response?.status === 410) {
        setError(errorMsg);
      }
    } finally {
      setImporting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FAFAF9] flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-[#4A7C59] mx-auto mb-4 animate-spin" />
          <p className="text-stone-500">Validating share link...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#FAFAF9] flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          <AlertCircle className="w-16 h-16 text-[#E07A5F] mx-auto mb-4" />
          <h1 className="text-2xl font-semibold text-[#1A2E1A] mb-2">Link Not Available</h1>
          <p className="text-stone-500 mb-6">{error}</p>
          <p className="text-sm text-stone-400 mb-6">
            Private import links expire after 15 minutes and can only be used once.
            Ask the sender to create a new link.
          </p>
          <Button onClick={() => navigate("/")} className="btn-primary">
            Go to Fresh Pantry
          </Button>
        </div>
      </div>
    );
  }

  if (imported) {
    return (
      <div className="min-h-screen bg-[#FAFAF9] flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          <div className="w-20 h-20 rounded-full bg-[#4A7C59]/10 flex items-center justify-center mx-auto mb-6">
            <Check className="w-10 h-10 text-[#4A7C59]" />
          </div>
          <h1 className="text-2xl font-semibold text-[#1A2E1A] mb-2">Recipes Imported!</h1>
          <p className="text-stone-500 mb-4">
            Your recipes have been added to your private library.
          </p>
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6 text-left">
            <div className="flex items-center gap-2 text-amber-700 font-medium mb-2">
              <Camera className="w-4 h-4" />
              Add Your Photos
            </div>
            <p className="text-sm text-amber-600">
              Imported recipes don't include images. Add your own photos when you cook them!
            </p>
          </div>
          <Button onClick={() => navigate("/recipes")} className="btn-primary">
            View My Recipes
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAFAF9]">
      {/* Header */}
      <header className="bg-white border-b border-stone-200 py-4">
        <div className="max-w-4xl mx-auto px-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#4A7C59]/10 flex items-center justify-center">
              <Leaf className="w-5 h-5 text-[#4A7C59]" />
            </div>
            <div>
              <h1 className="font-display text-xl font-semibold text-[#1A2E1A]">Fresh Pantry</h1>
              <p className="text-xs text-stone-500">Private Recipe Import</p>
            </div>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-lg mx-auto px-4 py-12">
        <div className="text-center mb-8">
          {/* Lock Icon */}
          <div className="w-16 h-16 rounded-full bg-[#4A7C59]/10 flex items-center justify-center mx-auto mb-6">
            <Lock className="w-8 h-8 text-[#4A7C59]" />
          </div>
          
          <h2 className="text-2xl font-semibold text-[#1A2E1A] mb-2">
            Private Recipe Share
          </h2>
          
          <p className="text-stone-500 mb-6">
            Someone wants to share {shareInfo?.recipe_count || 'some'} recipe{shareInfo?.recipe_count !== 1 ? 's' : ''} with you
          </p>

          {/* Info Cards */}
          <div className="space-y-3 mb-8 text-left">
            <div className="bg-white rounded-xl border border-stone-200 p-4 flex items-start gap-3">
              <ShieldCheck className="w-5 h-5 text-[#4A7C59] mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium text-[#1A2E1A] text-sm">Copyright Respectful</p>
                <p className="text-xs text-stone-500">
                  Recipes contain ingredients (facts) and originally-worded instructions. 
                  No third-party images or text.
                </p>
              </div>
            </div>
            
            <div className="bg-white rounded-xl border border-stone-200 p-4 flex items-start gap-3">
              <Timer className="w-5 h-5 text-orange-500 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium text-[#1A2E1A] text-sm">Limited Time Link</p>
                <p className="text-xs text-stone-500">
                  This link expires in 15 minutes and can only be used once.
                </p>
              </div>
            </div>
            
            <div className="bg-white rounded-xl border border-stone-200 p-4 flex items-start gap-3">
              <Lock className="w-5 h-5 text-blue-500 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium text-[#1A2E1A] text-sm">Private Import</p>
                <p className="text-xs text-stone-500">
                  Recipes will be added to your private library only.
                </p>
              </div>
            </div>
          </div>

          {/* Import Button */}
          {user ? (
            <Button 
              onClick={handleImport} 
              disabled={importing} 
              className="btn-primary w-full py-6 text-lg"
              data-testid="import-shared-btn"
            >
              {importing ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin mr-2" />
                  Importing...
                </>
              ) : (
                <>
                  <Download className="w-5 h-5 mr-2" />
                  Import to My Library
                </>
              )}
            </Button>
          ) : (
            <div className="space-y-4">
              <Button onClick={login} className="btn-primary w-full py-6 text-lg">
                Sign in to Import
              </Button>
              <p className="text-xs text-stone-400">
                Sign in to import these recipes to your private library
              </p>
            </div>
          )}

          {/* Legal Notice */}
          <p className="text-xs text-stone-400 mt-6">
            {shareInfo?.legal_notice || "We only show ingredients (facts) and originally-worded instructions to respect creators' rights."}
          </p>
        </div>
      </main>
    </div>
  );
}
