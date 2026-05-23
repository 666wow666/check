import { useState, useRef, useEffect } from 'react';
import { Camera, X } from 'lucide-react';
import { Card } from '../common/Card';
import { Button } from '../common/Button';

interface CameraModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCapture: (photoData: string) => void;
}

export const CameraModal = ({ isOpen, onClose, onCapture }: CameraModalProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    if (isOpen) {
      startCamera();
    } else {
      stopCamera();
    }
    return () => stopCamera();
  }, [isOpen]);

  const startCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: 640, height: 480 },
        audio: false
      });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
      setError('');
    } catch (err) {
      setError('无法访问相机，请检查权限设置');
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
  };

  const compressImage = (dataUrl: string, quality: number = 0.3): string => {
    const img = new Image();
    img.src = dataUrl;
    
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    const maxWidth = 320;
    const maxHeight = 240;
    let width = img.width;
    let height = img.height;
    
    if (width > height) {
      if (width > maxWidth) {
        height *= maxWidth / width;
        width = maxWidth;
      }
    } else {
      if (height > maxHeight) {
        width *= maxHeight / height;
        height = maxHeight;
      }
    }
    
    canvas.width = width;
    canvas.height = height;
    
    if (ctx) {
      ctx.drawImage(img, 0, 0, width, height);
    }
    
    return canvas.toDataURL('image/jpeg', quality);
  };

  const handleCapture = () => {
    if (videoRef.current && canvasRef.current) {
      const canvas = canvasRef.current;
      const video = videoRef.current;
      
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0);
        
        const fullSizeDataUrl = canvas.toDataURL('image/jpeg', 0.8);
        const compressedData = compressImage(fullSizeDataUrl, 0.3);
        
        onCapture(compressedData);
        stopCamera();
        onClose();
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black flex flex-col z-50">
      <div className="absolute top-4 right-4 z-10">
        <button
          onClick={() => { stopCamera(); onClose(); }}
          className="p-2 bg-white/20 rounded-full"
        >
          <X size={24} className="text-white" />
        </button>
      </div>
      
      <div className="flex-1 flex items-center justify-center bg-black">
        {error ? (
          <div className="text-center text-white p-8">
            <Camera size={48} className="mx-auto mb-4 opacity-50" />
            <p>{error}</p>
          </div>
        ) : (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full max-h-full object-cover"
          />
        )}
      </div>
      
      <canvas ref={canvasRef} className="hidden" />
      
      <div className="p-6 bg-black/80">
        <Button
          onClick={handleCapture}
          disabled={!!error || !stream}
          className="w-full"
          size="lg"
        >
          <Camera size={20} />
          拍照打卡
        </Button>
      </div>
    </div>
  );
};
