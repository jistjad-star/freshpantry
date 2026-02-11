import { useState, useRef, useEffect } from "react";
import { Camera, Plus, Loader2, ScanBarcode, ScanLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import api from "@/lib/api";
import { BrowserMultiFormatReader } from "@zxing/browser";

export default function BarcodeScanner({ open, onOpenChange, onProductAdded }) {
  // All state is local to this component - fresh on every mount
  const [scanning, setScanning] = useState(false);
  const [scannedProduct, setScannedProduct] = useState(null);
  const [lookingUpBarcode, setLookingUpBarcode] = useState(false);
  const [manualBarcode, setManualBarcode] = useState("");
  const [fillLevel, setFillLevel] = useState("full");
  
  const videoRef = useRef(null);
  const codeReaderRef = useRef(null);
  const streamRef = useRef(null);
  const scannerActiveRef = useRef(false);

  // Cleanup when dialog closes or component unmounts
  useEffect(() => {
    if (!open) {
      cleanup();
    }
    return () => cleanup();
  }, [open]);

  const cleanup = () => {
    scannerActiveRef.current = false;
    
    if (codeReaderRef.current) {
      try { codeReaderRef.current.reset(); } catch (e) {}
      codeReaderRef.current = null;
    }
    
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    
    // Reset state
    setScanning(false);
    setScannedProduct(null);
    setLookingUpBarcode(false);
    setManualBarcode("");
    setFillLevel("full");
  };

  const startScanner = async () => {
    setScannedProduct(null);
    setLookingUpBarcode(false);
    scannerActiveRef.current = true;
    setScanning(true);
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } } 
      });
      
      if (!scannerActiveRef.current) {
        stream.getTracks().forEach(track => track.stop());
        return;
      }
      
      streamRef.current = stream;
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      
      const codeReader = new BrowserMultiFormatReader();
      codeReaderRef.current = codeReader;
      
      codeReader.decodeFromVideoElement(videoRef.current, (result) => {
        if (result && scannerActiveRef.current) {
          scannerActiveRef.current = false;
          const barcode = result.getText();
          stopCamera();
          lookupBarcode(barcode);
        }
      });
    } catch (error) {
      scannerActiveRef.current = false;
      setScanning(false);
      
      if (error.name === 'NotAllowedError') {
        toast.error("Camera access denied");
      } else if (error.name === 'NotFoundError') {
        toast.error("No camera found");
      } else {
        toast.error("Could not access camera");
      }
    }
  };

  const stopCamera = () => {
    if (codeReaderRef.current) {
      try { codeReaderRef.current.reset(); } catch (e) {}
      codeReaderRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setScanning(false);
  };

  const stopScanner = () => {
    scannerActiveRef.current = false;
    stopCamera();
  };

  const lookupBarcode = async (barcode) => {
    setLookingUpBarcode(true);
    try {
      const response = await api.lookupBarcode(barcode);
      setScannedProduct(response.data);
      toast.success(`Found: ${response.data.name}`);
    } catch (error) {
      if (error.response?.status === 404) {
        toast.error("Product not found. Try manual entry.");
      } else {
        toast.error("Could not look up product");
      }
    } finally {
      setLookingUpBarcode(false);
    }
  };

  const handleManualSubmit = async () => {
    if (!manualBarcode.trim()) return;
    await lookupBarcode(manualBarcode.trim());
    setManualBarcode("");
  };

  const addToPantry = async () => {
    if (!scannedProduct) return;
    
    try {
      const multipliers = { "full": 1.0, "three-quarters": 0.75, "half": 0.5, "quarter": 0.25, "nearly-empty": 0.1 };
      const adjustedQty = Math.round(scannedProduct.quantity * multipliers[fillLevel] * 10) / 10;
      
      await api.addToPantry({
        name: scannedProduct.name,
        quantity: adjustedQty,
        unit: scannedProduct.unit,
        category: scannedProduct.category || 'other'
      });
      
      toast.success(`Added ${scannedProduct.name} to pantry!`);
      onProductAdded?.();
      onOpenChange(false);
    } catch (error) {
      toast.error("Failed to add product");
    }
  };

  const scanAnother = () => {
    setScannedProduct(null);
    setFillLevel("full");
    setTimeout(() => startScanner(), 100);
  };

  const getAdjustedQuantity = () => {
    if (!scannedProduct) return 0;
    const multipliers = { "full": 1.0, "three-quarters": 0.75, "half": 0.5, "quarter": 0.25, "nearly-empty": 0.1 };
    return Math.round(scannedProduct.quantity * multipliers[fillLevel] * 10) / 10;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-white sm:max-w-sm">
        <DialogHeader className="pb-2">
          <DialogTitle className="text-[#1A2E1A] flex items-center gap-2 text-base">
            <ScanBarcode className="w-4 h-4 text-[#4A7C59]" />
            Scan Barcode
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-3">
          {/* Camera View */}
          {scanning && (
            <div className="relative rounded-lg overflow-hidden bg-black aspect-[4/3]">
              <video ref={videoRef} className="w-full h-full object-cover" playsInline autoPlay muted />
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-48 h-24 border-2 border-[#4A7C59] rounded-lg relative">
                  <ScanLine className="w-full h-1 text-[#4A7C59] absolute top-1/2 animate-pulse" />
                </div>
              </div>
              <Button onClick={stopScanner} variant="outline" className="absolute bottom-2 right-2 bg-white/90 text-xs h-7 px-2" size="sm">
                Stop
              </Button>
            </div>
          )}
          
          {/* Start Scanner Button */}
          {!scanning && !scannedProduct && !lookingUpBarcode && (
            <div className="space-y-3">
              <Button onClick={startScanner} className="w-full btn-primary h-9">
                <Camera className="w-4 h-4 mr-2" />
                Start Camera
              </Button>
              
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-stone-200" />
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="bg-white px-2 text-stone-400">or enter manually</span>
                </div>
              </div>
              
              <div className="flex gap-2">
                <Input
                  value={manualBarcode}
                  onChange={(e) => setManualBarcode(e.target.value)}
                  placeholder="Barcode number..."
                  className="flex-1 h-9 text-sm"
                  onKeyDown={(e) => e.key === 'Enter' && handleManualSubmit()}
                />
                <Button onClick={handleManualSubmit} disabled={!manualBarcode.trim()} variant="outline" className="h-9 px-3">
                  Look Up
                </Button>
              </div>
            </div>
          )}
          
          {/* Loading State */}
          {lookingUpBarcode && (
            <div className="flex flex-col items-center justify-center py-6">
              <Loader2 className="w-6 h-6 animate-spin text-[#4A7C59] mb-2" />
              <p className="text-stone-500 text-sm">Looking up product...</p>
            </div>
          )}
          
          {/* Scanned Product Result */}
          {scannedProduct && !lookingUpBarcode && (
            <div className="space-y-3">
              <div className="bg-[#4A7C59]/10 rounded-lg p-3">
                <div className="flex gap-3">
                  {scannedProduct.image_url && (
                    <img src={scannedProduct.image_url} alt={scannedProduct.name} className="w-14 h-14 object-cover rounded-lg bg-white" />
                  )}
                  <div className="flex-1 min-w-0">
                    <h4 className="font-semibold text-[#1A2E1A] text-sm truncate">{scannedProduct.name}</h4>
                    {scannedProduct.brand && <p className="text-xs text-stone-500 truncate">{scannedProduct.brand}</p>}
                    <p className="text-xs text-stone-600 mt-1">Full: {scannedProduct.quantity} {scannedProduct.unit}</p>
                  </div>
                </div>
              </div>
              
              {/* Fill Level Selector */}
              <div className="space-y-2">
                <Label className="text-xs font-medium text-[#1A2E1A]">How full?</Label>
                <div className="grid grid-cols-5 gap-1">
                  {[
                    { value: "full", label: "Full", icon: "████" },
                    { value: "three-quarters", label: "¾", icon: "███░" },
                    { value: "half", label: "½", icon: "██░░" },
                    { value: "quarter", label: "¼", icon: "█░░░" },
                    { value: "nearly-empty", label: "Low", icon: "░░░░" },
                  ].map((level) => (
                    <button
                      key={level.value}
                      onClick={() => setFillLevel(level.value)}
                      className={`p-1.5 rounded-lg border-2 text-center transition-all ${
                        fillLevel === level.value 
                          ? 'border-[#4A7C59] bg-[#4A7C59]/10 text-[#4A7C59]' 
                          : 'border-stone-200 hover:border-stone-300 text-stone-600'
                      }`}
                    >
                      <div className="text-[10px] font-mono leading-none mb-0.5">{level.icon}</div>
                      <div className="text-[10px] font-medium">{level.label}</div>
                    </button>
                  ))}
                </div>
                
                <div className="bg-stone-50 rounded-lg p-2 flex justify-between items-center">
                  <span className="text-xs text-stone-600">Adding:</span>
                  <span className="text-sm font-semibold text-[#4A7C59]">
                    {getAdjustedQuantity()} {scannedProduct.unit}
                  </span>
                </div>
              </div>
              
              <div className="flex gap-2">
                <Button onClick={scanAnother} variant="outline" className="flex-1 h-9 text-sm">
                  Scan Another
                </Button>
                <Button onClick={addToPantry} className="flex-1 btn-primary h-9 text-sm">
                  <Plus className="w-3 h-3 mr-1" />
                  Add
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
