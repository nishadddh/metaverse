import React, { useRef, useState, useEffect } from 'react';
import { X, Pen, Eraser, RotateCcw, Sparkles } from 'lucide-react';

interface WhiteboardModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const WhiteboardModal: React.FC<WhiteboardModalProps> = ({ isOpen, onClose }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [color, setColor] = useState('#38bdf8');
  const [tool, setTool] = useState<'pen' | 'eraser'>('pen');

  useEffect(() => {
    if (isOpen && canvasRef.current) {
      const ctx = canvasRef.current.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      }
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    setIsDrawing(true);
    draw(e);
  };

  const stopDrawing = () => {
    setIsDrawing(false);
    if (canvasRef.current) {
      const ctx = canvasRef.current.getContext('2d');
      ctx?.beginPath();
    }
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !canvasRef.current) return;
    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    ctx.lineWidth = tool === 'eraser' ? 24 : 3;
    ctx.lineCap = 'round';
    ctx.strokeStyle = tool === 'eraser' ? '#0f172a' : color;

    ctx.lineTo(x, y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const clearCanvas = () => {
    if (canvasRef.current) {
      const ctx = canvasRef.current.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 backdrop-blur-xl p-4 md:p-8 animate-fade-in font-sans text-slate-100">
      <div className="relative w-full max-w-4xl h-[80vh] rounded-3xl border border-slate-800 bg-slate-900 flex flex-col overflow-hidden shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-amber-400" />
            <h2 className="text-base font-bold text-white">Collaborative Whiteboard Canvas</h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex items-center justify-between border-b border-slate-800 bg-slate-950/60 px-6 py-2">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setTool('pen')}
              className={`p-2 rounded-lg transition ${tool === 'pen' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-slate-800'}`}
              title="Pen"
            >
              <Pen className="w-4 h-4" />
            </button>
            <button
              onClick={() => setTool('eraser')}
              className={`p-2 rounded-lg transition ${tool === 'eraser' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-slate-800'}`}
              title="Eraser"
            >
              <Eraser className="w-4 h-4" />
            </button>
            <button
              onClick={clearCanvas}
              className="p-2 rounded-lg text-slate-400 hover:text-red-400 hover:bg-slate-800 transition"
              title="Clear Canvas"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>

          <div className="flex items-center gap-2">
            {['#38bdf8', '#10b981', '#f59e0b', '#ef4444', '#a855f7', '#ffffff'].map(c => (
              <button
                key={c}
                onClick={() => { setColor(c); setTool('pen'); }}
                style={{ backgroundColor: c }}
                className={`h-6 w-6 rounded-full border-2 transition ${color === c && tool === 'pen' ? 'border-white scale-110' : 'border-transparent'}`}
              />
            ))}
          </div>
        </div>

        <div className="flex-1 bg-slate-950 flex items-center justify-center p-4">
          <canvas
            ref={canvasRef}
            width={900}
            height={500}
            onMouseDown={startDrawing}
            onMouseUp={stopDrawing}
            onMouseMove={draw}
            onMouseLeave={stopDrawing}
            className="cursor-crosshair rounded-xl border border-slate-800 shadow-xl"
          />
        </div>
      </div>
    </div>
  );
};
