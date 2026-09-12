import React, { useEffect, useRef, useState } from 'react';
import type { Office, ObjectType, RoomType } from '../../types/office';
import { BuilderEngine } from '../../game/BuilderEngine';
import type { BuilderTool } from '../../game/BuilderEngine';
import { dbService } from '../../services/database';
import { 
  MousePointer, 
  Square, 
  DoorClosed, 
  Grid, 
  Armchair, 
  Eraser, 
  RotateCw, 
  Trash2, 
  Save, 
  ArrowLeft, 
  Sparkles, 
  Sliders
} from 'lucide-react';

interface OfficeBuilderViewProps {
  office: Office;
  onSaveSuccess: (updatedOffice: Office) => void;
  onCancel: () => void;
}

const FURNITURE_CATALOG: { type: ObjectType; name: string; icon: string }[] = [
  { type: 'desk', name: 'Workstation Desk', icon: '💻' },
  { type: 'table', name: 'Conference Table', icon: '🗣️' },
  { type: 'chair', name: 'Office Chair', icon: '🪑' },
  { type: 'sofa', name: 'VIP Sofa', icon: '🛋️' },
  { type: 'computer', name: 'Desktop Workstation', icon: '🖥️' },
  { type: 'whiteboard', name: 'Strategy Whiteboard', icon: '📋' },
  { type: 'coffee_machine', name: 'Espresso Maker', icon: '☕' },
  { type: 'plant', name: 'Monstera Plant', icon: '🪴' },
  { type: 'tree', name: 'Garden Tree', icon: '🌳' },
  { type: 'bench', name: 'Park Bench', icon: '🪵' }
];

const ROOM_TYPES_CATALOG: { type: RoomType; name: string; icon: string }[] = [
  { type: 'meeting', name: 'Meeting Room', icon: '📊' },
  { type: 'manager_cabin', name: 'Manager Cabin', icon: '👔' },
  { type: 'team_room', name: 'Team Workspace', icon: '👥' },
  { type: 'tea_area', name: 'Tea & Break Lounge', icon: '☕' },
  { type: 'reception', name: 'Reception Area', icon: '🏢' }
];

export const OfficeBuilderView: React.FC<OfficeBuilderViewProps> = ({
  office,
  onSaveSuccess,
  onCancel
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const builderRef = useRef<BuilderEngine | null>(null);

  const [activeTool, setActiveTool] = useState<BuilderTool>('select');
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [layoutVersion, setLayoutVersion] = useState(office.layout.version || 1);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!canvasRef.current) return;

    const builder = new BuilderEngine(
      canvasRef.current,
      office.layout,
      {
        onSelectionChange: (sel) => {
          setSelectedItem(sel);
        },
        onLayoutChange: (updatedLayout) => {
          setLayoutVersion((updatedLayout.version || 1));
        }
      }
    );

    builderRef.current = builder;

    return () => {
      builder.destroy();
    };
  }, [office.id]);

  const handleToolSelect = (tool: BuilderTool) => {
    setActiveTool(tool);
    if (builderRef.current) {
      builderRef.current.setTool(tool);
    }
  };

  const handleSelectFurniture = (item: { type: ObjectType; icon: string }) => {
    if (builderRef.current) {
      builderRef.current.selectedFurnitureType = item.type;
      builderRef.current.selectedFurnitureIcon = item.icon;
      handleToolSelect('furniture');
    }
  };

  const handleSelectRoomType = (rt: RoomType) => {
    if (builderRef.current) {
      builderRef.current.selectedRoomType = rt;
      handleToolSelect('room');
    }
  };

  const handleRotate = () => {
    if (builderRef.current) {
      builderRef.current.rotateSelectedObject();
    }
  };

  const handleDelete = () => {
    if (builderRef.current) {
      builderRef.current.deleteSelected();
    }
  };

  const handleSave = () => {
    if (!builderRef.current) return;
    const finalLayout = builderRef.current.getLayout();
    dbService.saveOfficeLayout(office.id, finalLayout);
    
    const updatedOffice = dbService.getOfficeById(office.id);
    if (updatedOffice) {
      dbService.logAction(office.createdBy, 'Office Builder', 'UPDATE_LAYOUT', `Saved layout version v${updatedOffice.layout.version} for ${office.name}`);
      showToast(`Saved layout version v${updatedOffice.layout.version}`);
      onSaveSuccess(updatedOffice);
    }
  };

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  return (
    <div className="h-screen w-screen bg-slate-950 flex flex-col overflow-hidden text-slate-100 font-sans select-none">
      <header className="flex h-16 items-center justify-between border-b border-slate-800 bg-slate-900 px-6">
        <div className="flex items-center gap-4">
          <button
            onClick={onCancel}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white transition"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h1 className="text-base font-bold text-white flex items-center gap-2">
              Visual Level Editor <span className="text-xs font-normal text-amber-400">v{layoutVersion}</span>
            </h1>
            <p className="text-xs text-slate-400">{office.name}</p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 rounded-xl border border-slate-800 bg-slate-950 p-1.5">
          <button
            onClick={() => handleToolSelect('select')}
            className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
              activeTool === 'select' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <MousePointer className="w-3.5 h-3.5" /> Select / Move
          </button>

          <button
            onClick={() => handleToolSelect('wall')}
            className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
              activeTool === 'wall' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Grid className="w-3.5 h-3.5" /> Draw Wall
          </button>

          <button
            onClick={() => handleToolSelect('door')}
            className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
              activeTool === 'door' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <DoorClosed className="w-3.5 h-3.5" /> Place Door
          </button>

          <button
            onClick={() => handleToolSelect('eraser')}
            className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
              activeTool === 'eraser' ? 'bg-red-600 text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Eraser className="w-3.5 h-3.5" /> Eraser
          </button>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleSave}
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-500 shadow-lg shadow-emerald-600/30 transition"
          >
            <Save className="w-4 h-4" /> Save Layout
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <aside className="w-72 border-r border-slate-800 bg-slate-900/60 p-4 space-y-6 overflow-y-auto">
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
              <Armchair className="w-4 h-4 text-blue-400" /> Furniture & Tech Catalog
            </h3>
            <div className="grid grid-cols-2 gap-2">
              {FURNITURE_CATALOG.map(f => (
                <button
                  key={f.type}
                  onClick={() => handleSelectFurniture(f)}
                  className="flex flex-col items-center justify-center p-3 rounded-xl border border-slate-800 bg-slate-950/60 text-slate-300 hover:border-blue-500/50 hover:bg-blue-500/10 transition group text-center"
                >
                  <span className="text-2xl group-hover:scale-110 transition">{f.icon}</span>
                  <span className="text-[10px] font-semibold mt-1 text-slate-400 group-hover:text-blue-300">{f.name}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-3 border-t border-slate-800 pt-4">
            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
              <Square className="w-4 h-4 text-purple-400" /> Custom Room Zones
            </h3>
            <div className="space-y-2">
              {ROOM_TYPES_CATALOG.map(rt => (
                <button
                  key={rt.type}
                  onClick={() => handleSelectRoomType(rt.type)}
                  className="w-full flex items-center gap-3 p-2.5 rounded-xl border border-slate-800 bg-slate-950/60 text-xs text-slate-300 hover:border-purple-500/50 hover:bg-purple-500/10 transition"
                >
                  <span className="text-lg">{rt.icon}</span>
                  <span className="font-semibold">{rt.name}</span>
                </button>
              ))}
            </div>
          </div>
        </aside>

        <main className="flex-1 flex items-center justify-center bg-slate-950 relative p-4 overflow-auto">
          <canvas
            ref={canvasRef}
            width={office.layout.dimensions.width || 1600}
            height={office.layout.dimensions.height || 1000}
            className="cursor-crosshair rounded-xl border border-slate-800 shadow-2xl"
          />

          {toast && (
            <div className="absolute top-6 left-1/2 -translate-x-1/2 z-50 rounded-xl border border-emerald-500/40 bg-slate-900/90 px-4 py-2 text-xs font-semibold text-emerald-300 shadow-2xl backdrop-blur-xl flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-emerald-400" /> {toast}
            </div>
          )}
        </main>

        <aside className="w-72 border-l border-slate-800 bg-slate-900/60 p-4 space-y-6 overflow-y-auto">
          <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
            <Sliders className="w-4 h-4 text-amber-400" /> Property Inspector
          </h3>

          {selectedItem ? (
            <div className="space-y-4 text-xs">
              <div className="rounded-xl border border-slate-800 bg-slate-950 p-3 space-y-2">
                <span className="text-[10px] text-slate-500 uppercase font-mono block">TYPE: {selectedItem.type}</span>
                <p className="font-bold text-sm text-slate-100">{selectedItem.item.name || selectedItem.item.type}</p>
              </div>

              {selectedItem.type === 'object' && (
                <div className="space-y-3">
                  <div>
                    <label className="text-[11px] font-semibold text-slate-400">Object Label Name</label>
                    <input
                      type="text"
                      value={selectedItem.item.name || ''}
                      onChange={e => {
                        if (builderRef.current) builderRef.current.updateSelectedObjectProps({ name: e.target.value });
                      }}
                      className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-1.5 text-xs text-slate-100 focus:outline-none"
                    />
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={handleRotate}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 py-2 text-xs font-semibold hover:bg-slate-700"
                    >
                      <RotateCw className="w-3.5 h-3.5" /> Rotate 90°
                    </button>
                    <button
                      onClick={handleDelete}
                      className="inline-flex items-center justify-center p-2 rounded-lg border border-red-500/40 bg-red-500/10 text-red-400 hover:bg-red-500/20"
                      title="Delete Selected"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}

              {selectedItem.type === 'room' && (
                <div className="space-y-3">
                  <div>
                    <label className="text-[11px] font-semibold text-slate-400">Room Name</label>
                    <input
                      type="text"
                      value={selectedItem.item.name || ''}
                      onChange={e => {
                        if (builderRef.current) builderRef.current.updateSelectedRoomProps({ name: e.target.value });
                      }}
                      className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-1.5 text-xs text-slate-100 focus:outline-none"
                    />
                  </div>

                  <div className="flex items-center justify-between border-t border-slate-800 pt-3">
                    <label className="text-[11px] font-semibold text-slate-400">Restricted Privacy</label>
                    <input
                      type="checkbox"
                      checked={Boolean(selectedItem.item.isPrivate)}
                      onChange={e => {
                        if (builderRef.current) builderRef.current.updateSelectedRoomProps({ isPrivate: e.target.checked });
                      }}
                      className="h-4 w-4 rounded accent-blue-600"
                    />
                  </div>

                  <button
                    onClick={handleDelete}
                    className="w-full inline-flex items-center justify-center gap-2 rounded-lg border border-red-500/40 bg-red-500/10 py-2 text-xs font-semibold text-red-400 hover:bg-red-500/20 mt-2"
                  >
                    <Trash2 className="w-4 h-4" /> Delete Room Zone
                  </button>
                </div>
              )}
            </div>
          ) : (
            <p className="text-xs text-slate-500 italic">
              Click any element on the canvas to inspect and edit its properties.
            </p>
          )}
        </aside>
      </div>
    </div>
  );
};
