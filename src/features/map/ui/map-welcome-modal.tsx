import { Compass } from "lucide-react";
import { Button } from "#/shared/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "#/shared/ui/dialog";

type MapWelcomeModalProps = {
  open: boolean;
  onClose: () => void;
  onLocateNearbyMasjids: () => void;
};

export function MapWelcomeModal({ open, onClose, onLocateNearbyMasjids }: MapWelcomeModalProps) {
  return (
    <Dialog open={open} onOpenChange={(nextOpen) => (nextOpen ? undefined : onClose())}>
      <DialogContent className="map-welcome-modal">
        <div className="map-welcome-copy">
          <DialogTitle className="map-welcome-title">Temukan masjid dekat Anda</DialogTitle>
          <DialogDescription className="map-welcome-description">
            Jelajahi peta, lihat QRIS yang sudah tersedia, atau bantu tambahkan QRIS untuk masjid
            yang belum punya.
          </DialogDescription>
        </div>

        <Button className="map-welcome-cta" size="lg" onClick={onLocateNearbyMasjids}>
          <Compass className="h-4 w-4" />
          <span>Lihat masjid dekat saya</span>
        </Button>
      </DialogContent>
    </Dialog>
  );
}
