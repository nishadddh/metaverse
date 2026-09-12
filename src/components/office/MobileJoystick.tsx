import React, { useState } from 'react';
import { 
  ChevronUp, 
  ChevronDown, 
  ChevronLeft, 
  ChevronRight,
  Navigation
} from 'lucide-react';

interface MobileJoystickProps {
  onDirectionChange: (direction: 'up' | 'down' | 'left' | 'right' | null) => void;
  onSitToggle?: () => void;
}

export const MobileJoystick: React.FC<MobileJoystickProps> = ({
  onDirectionChange,
  onSitToggle
}) => {
  const [activeDir, setActiveDir] = useState<'up' | 'down' | 'left' | 'right' | null>(null);

  const handlePressStart = (dir: 'up' | 'down' | 'left' | 'right') => {
    setActiveDir(dir);
    onDirectionChange(dir);
  };

  const handlePressEnd = () => {
    setActiveDir(null);
    onDirectionChange(null);
  };

  return (
    <div className="fixed bottom-24 left-4 z-40 md:hidden select-none touch-none">
      <div className="relative h-36 w-36 rounded-full border border-slate-700/80 bg-slate-900/80 backdrop-blur-xl shadow-2xl p-2 flex items-center justify-center">
        {/* Up Button */}
        <button
          onTouchStart={(e) => { e.preventDefault(); handlePressStart('up'); }}
          onTouchEnd={(e) => { e.preventDefault(); handlePressEnd(); }}
          onMouseDown={() => handlePressStart('up')}
          onMouseUp={handlePressEnd}
          onMouseLeave={handlePressEnd}
          className={`absolute top-1 left-1/2 -translate-x-1/2 h-10 w-12 rounded-t-2xl flex items-center justify-center transition active:scale-95 ${
            activeDir === 'up' ? 'bg-blue-600 text-white shadow-lg' : 'bg-slate-800/80 text-slate-300 active:bg-blue-600'
          }`}
          title="Move Up"
        >
          <ChevronUp className="w-6 h-6" />
        </button>

        {/* Down Button */}
        <button
          onTouchStart={(e) => { e.preventDefault(); handlePressStart('down'); }}
          onTouchEnd={(e) => { e.preventDefault(); handlePressEnd(); }}
          onMouseDown={() => handlePressStart('down')}
          onMouseUp={handlePressEnd}
          onMouseLeave={handlePressEnd}
          className={`absolute bottom-1 left-1/2 -translate-x-1/2 h-10 w-12 rounded-b-2xl flex items-center justify-center transition active:scale-95 ${
            activeDir === 'down' ? 'bg-blue-600 text-white shadow-lg' : 'bg-slate-800/80 text-slate-300 active:bg-blue-600'
          }`}
          title="Move Down"
        >
          <ChevronDown className="w-6 h-6" />
        </button>

        {/* Left Button */}
        <button
          onTouchStart={(e) => { e.preventDefault(); handlePressStart('left'); }}
          onTouchEnd={(e) => { e.preventDefault(); handlePressEnd(); }}
          onMouseDown={() => handlePressStart('left')}
          onMouseUp={handlePressEnd}
          onMouseLeave={handlePressEnd}
          className={`absolute left-1 top-1/2 -translate-y-1/2 h-12 w-10 rounded-l-2xl flex items-center justify-center transition active:scale-95 ${
            activeDir === 'left' ? 'bg-blue-600 text-white shadow-lg' : 'bg-slate-800/80 text-slate-300 active:bg-blue-600'
          }`}
          title="Move Left"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>

        {/* Right Button */}
        <button
          onTouchStart={(e) => { e.preventDefault(); handlePressStart('right'); }}
          onTouchEnd={(e) => { e.preventDefault(); handlePressEnd(); }}
          onMouseDown={() => handlePressStart('right')}
          onMouseUp={handlePressEnd}
          onMouseLeave={handlePressEnd}
          className={`absolute right-1 top-1/2 -translate-y-1/2 h-12 w-10 rounded-r-2xl flex items-center justify-center transition active:scale-95 ${
            activeDir === 'right' ? 'bg-blue-600 text-white shadow-lg' : 'bg-slate-800/80 text-slate-300 active:bg-blue-600'
          }`}
          title="Move Right"
        >
          <ChevronRight className="w-6 h-6" />
        </button>

        {/* Center Action Button */}
        <button
          onClick={onSitToggle}
          className="h-10 w-10 rounded-full bg-blue-600/30 border border-blue-500/50 flex items-center justify-center text-blue-300 active:bg-blue-600 active:text-white transition"
          title="Tap to walk or interact"
        >
          <Navigation className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
