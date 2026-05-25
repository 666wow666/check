import { X } from 'lucide-react';
import { useEffect } from 'react';

interface PhotoViewerProps {
  src: string;
  alt: string;
  onClose: () => void;
}

export const PhotoViewer = ({ src, alt, onClose }: PhotoViewerProps) => {
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'auto';
    };
  }, [onClose]);

  return (
    <div 
      className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <button
        onClick={onClose}
        className="absolute top-4 right-4 p-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors"
        aria-label="关闭"
      >
        <X className="w-6 h-6 text-white" />
      </button>
      
      <div 
        className="max-w-4xl max-h-[90vh] w-full"
        onClick={(e) => e.stopPropagation()}
      >
        <img
          src={src}
          alt={alt}
          className="w-full h-auto max-h-[90vh] object-contain rounded-lg"
        />
        <p className="text-white/70 text-center mt-4 text-sm">{alt}</p>
      </div>
    </div>
  );
};
