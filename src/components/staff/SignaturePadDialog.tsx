import { useRef, useState } from "react";
import SignatureCanvas from "react-signature-canvas";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Eraser, Check } from "lucide-react";

interface SignaturePadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSign: (signatureDataUrl: string) => void;
  staffName: string;
  isPending?: boolean;
}

export function SignaturePadDialog({ open, onOpenChange, onSign, staffName, isPending }: SignaturePadDialogProps) {
  const sigCanvasRef = useRef<SignatureCanvas | null>(null);
  const [isEmpty, setIsEmpty] = useState(true);

  const handleClear = () => {
    sigCanvasRef.current?.clear();
    setIsEmpty(true);
  };

  const handleConfirm = () => {
    if (sigCanvasRef.current && !sigCanvasRef.current.isEmpty()) {
      const dataUrl = sigCanvasRef.current.getTrimmedCanvas().toDataURL("image/png");
      onSign(dataUrl);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-heading">Sign Document</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Please draw your signature in the box below, <strong>{staffName}</strong>.
          </p>
          <div className="border-2 border-dashed border-border rounded-lg bg-white overflow-hidden">
            <SignatureCanvas
              ref={sigCanvasRef}
              penColor="black"
              canvasProps={{
                className: "w-full",
                width: 460,
                height: 200,
                style: { width: "100%", height: "200px" },
              }}
              onEnd={() => setIsEmpty(false)}
            />
          </div>
          <div className="flex items-center justify-between">
            <Button variant="outline" size="sm" onClick={handleClear}>
              <Eraser className="mr-1 h-4 w-4" /> Clear
            </Button>
            <Button
              size="sm"
              disabled={isEmpty || isPending}
              onClick={handleConfirm}
            >
              <Check className="mr-1 h-4 w-4" />
              {isPending ? "Signing..." : "Confirm Signature"}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground text-center">
            Your signature, timestamp, and IP address will be recorded for verification purposes.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
