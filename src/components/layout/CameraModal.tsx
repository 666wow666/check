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
    if (!isOpen) return;
    
    const initCamera = async () => {
      try {
        setError(null);
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { 
            facingMode: 'environment',
            width: { ideal: 640 },
            height: { ideal: 480 }
          },
          audio: false
        });
        
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          setStream(stream);
        }
      } catch (err: any) {
        console.error('Camera error:', err);
        if (err.name === 'NotAllowedError') {
          setError('请允许相机权限以便拍照打卡');
        } else if (err.name === 'NotFoundError') {
          setError('未找到相机设备');
        } else {
          setError('无法访问相机: ' + err.message);
        }
      }
    };
    
    initCamera();
    
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [isOpen]);

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
  };

  const handleCapture = () => {
    if (videoRef.current && canvasRef.current) {
      const canvas = canvasRef.current;
      const video = videoRef.current;
      
      const maxWidth = 320;
      const maxHeight = 240;
      let width = video.videoWidth;
      let height = video.videoHeight;
      
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
      
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, width, height);
        
        const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.5);
        onCapture(compressedDataUrl);
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
