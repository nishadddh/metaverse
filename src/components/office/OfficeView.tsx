import React, { useEffect, useRef, useState } from 'react';
import type { Office, UserProfile, Room, OfficeObject, UserPosition } from '../../types/office';
import { CanvasEngine } from '../../game/CanvasEngine';
import { realtimeService } from '../../services/presence';
import { spatialAudio } from '../../services/audio';
import type { ProximityPeer } from '../../services/audio';
import { mediaService } from '../../services/media';
import { subscribeFirebaseOfficeStructure } from '../../services/firebase';
import { SpatialVideoModal } from './SpatialVideoModal';
import { MobileJoystick } from './MobileJoystick';
import { 
  Mic, 
  MicOff, 
  Video, 
  VideoOff, 
  Monitor, 
  MessageSquare, 
  PenTool, 
  Compass, 
  ArrowLeft, 
  Lock, 
  Radio,
  Tv,
  Sparkles,
  ZoomIn,
  ZoomOut,
  Maximize2
} from 'lucide-react';

interface OfficeViewProps {
  office: Office;
  currentUser: UserProfile;
  allUsers: UserProfile[];
  onBackToDashboard: () => void;
  onOpenBuilder: () => void;
  onOpenChat: () => void;
  onOpenWhiteboard: () => void;
  onJoinMeeting: (room: Room) => void;
}

export const OfficeView: React.FC<OfficeViewProps> = ({
  office,
  currentUser,
  allUsers,
  onBackToDashboard,
  onOpenBuilder,
  onOpenChat,
  onOpenWhiteboard,
  onJoinMeeting
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<CanvasEngine | null>(null);

  const [currentRoom, setCurrentRoom] = useState<Room | null>(null);
  const [positions, setPositions] = useState<UserPosition[]>([]);
  const [proximityPeers, setProximityPeers] = useState<ProximityPeer[]>([]);
  
  const [isMicOn, setIsMicOn] = useState(false);
  const [isCamOn, setIsCamOn] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isVideoModalOpen, setIsVideoModalOpen] = useState(false);

  const [videoStream, setVideoStream] = useState<MediaStream | null>(null);
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);

  const [showRadiusCircle, setShowRadiusCircle] = useState(true);
  const [proximityRadius, setProximityRadiusState] = useState(280);

  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [accessAlert, setAccessAlert] = useState<{ room: string; roles: string[] } | null>(null);

  const handleProximityRadiusChange = (radius: number) => {
    setProximityRadiusState(radius);
    spatialAudio.setProximityRadius(radius);
    if (engineRef.current) {
      engineRef.current.proximityRadius = radius;
    }
  };

  const isBuilder = currentUser.role === 'Owner' || currentUser.role === 'Office Builder';

  useEffect(() => {
    if (!canvasRef.current) return;

    const engine = new CanvasEngine(
      canvasRef.current,
      office.layout,
      currentUser,
      {
        onPositionChange: (x, y, vx, vy, direction, roomId) => {
          realtimeService.updateMyPosition(x, y, vx, vy, direction, roomId);
        },
        onRoomEnter: (room) => {
          setCurrentRoom(room);
          showToast(`Entered ${room.name}`);
        },
        onRoomLeave: (room) => {
          setCurrentRoom(null);
          showToast(`Left ${room.name}`);
        },
        onAccessDenied: (room, allowedRoles) => {
          setAccessAlert({ room: room.name, roles: allowedRoles });
          setTimeout(() => setAccessAlert(null), 4000);
        },
        onObjectInteract: (obj) => {
          handleObjectInteraction(obj);
        }
      }
    );

    engineRef.current = engine;
    engine.start();

    realtimeService.joinOffice(office.id, currentUser.id, 600, 450);

    const unsubPositions = realtimeService.subscribePositions((updatedPositions) => {
      setPositions(updatedPositions);
      engine.updateRemotePlayers(updatedPositions, allUsers);

      const myPos = updatedPositions.find(p => p.userId === currentUser.id);
      if (myPos) {
        const peers = spatialAudio.calculateProximity(myPos, updatedPositions);
        setProximityPeers(peers);
      }
    });

    const unsubStructure = subscribeFirebaseOfficeStructure(office.id, (remoteOffice) => {
      if (remoteOffice && remoteOffice.layout) {
        engine.updateLayout(remoteOffice.layout);
      }
    });

    return () => {
      unsubStructure();
      unsubPositions();
      realtimeService.leaveOffice();
      engine.destroy();
    };
  }, [office.id, currentUser.id]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleObjectInteraction = (obj: OfficeObject) => {
    if (obj.interactionType === 'meeting' && currentRoom) {
      onJoinMeeting(currentRoom);
    } else if (obj.interactionType === 'whiteboard') {
      onOpenWhiteboard();
    } else if (obj.interactionType === 'coffee') {
      showToast('☕ Grabbed a fresh espresso from the coffee lounge!');
    } else {
      showToast(`Interacted with ${obj.name}`);
    }
  };

  const toggleMic = async () => {
    const nextState = !isMicOn;
    if (nextState) {
      await mediaService.requestMicrophone();
      showToast('🎤 Microphone Unmuted & Audio Streaming Active');
    } else {
      mediaService.stopAudio();
      showToast('🔇 Microphone Muted');
    }
    setIsMicOn(nextState);
    if (engineRef.current) engineRef.current.isMicOn = nextState;
    realtimeService.updateMediaState(nextState, isCamOn, isScreenSharing);
  };

  const toggleCam = async () => {
    const nextState = !isCamOn;
    if (nextState) {
      const stream = await mediaService.requestCamera();
      setVideoStream(stream);
      setIsVideoModalOpen(true);
      showToast('📹 Camera Feed Enabled & Spatial Video Screen Opened!');
    } else {
      mediaService.stopVideo();
      setVideoStream(null);
      if (!isScreenSharing) {
        setIsVideoModalOpen(false);
      }
      showToast('📷 Camera Disabled');
    }
    setIsCamOn(nextState);
    if (engineRef.current) engineRef.current.isCamOn = nextState;
    realtimeService.updateMediaState(isMicOn, nextState, isScreenSharing);
  };

  const toggleScreen = async () => {
    const nextState = !isScreenSharing;
    if (nextState) {
      const stream = await mediaService.requestScreenShare();
      setScreenStream(stream);
      setIsVideoModalOpen(true);
      showToast('🖥️ Screen Share Started & Video Screen Opened!');
    } else {
      mediaService.stopScreen();
      setScreenStream(null);
      if (!isCamOn) {
        setIsVideoModalOpen(false);
      }
      showToast('🖥️ Screen Share Stopped');
    }
    setIsScreenSharing(nextState);
    realtimeService.updateMediaState(isMicOn, isCamOn, nextState);
  };

  const toggleProximityCircle = () => {
    const next = !showRadiusCircle;
    setShowRadiusCircle(next);
    if (engineRef.current) {
      engineRef.current.showProximityCircle = next;
    }
  };

  return (
    <div className="relative h-screen w-screen bg-slate-950 overflow-hidden select-none font-sans text-slate-100">
      <header className="absolute top-4 left-4 right-4 z-30 flex items-center justify-between gap-4 rounded-2xl border border-slate-800/80 bg-slate-900/80 p-3 backdrop-blur-xl shadow-2xl">
        <div className="flex items-center gap-3">
          <button
            onClick={onBackToDashboard}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white transition"
            title="Back to Dashboard"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>

          <div className="flex items-center gap-2">
            <span className="text-2xl">{office.icon}</span>
            <div>
              <h1 className="text-sm font-bold text-white tracking-tight">{office.name}</h1>
              <p className="text-[11px] text-slate-400 flex items-center gap-1.5">
                <span className="inline-block h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                {positions.length} Teammates Present
              </p>
            </div>
          </div>
        </div>

        <div className="hidden md:flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-950/60 px-4 py-1.5 text-xs">
          <Compass className="w-4 h-4 text-blue-400" />
          <span className="text-slate-400">Current Zone:</span>
          <span className="font-semibold text-blue-300">
            {currentRoom ? currentRoom.name : 'Main Corridor / Common Area'}
          </span>
          {currentRoom && (
            <span className="ml-2 rounded-md bg-blue-500/20 px-2 py-0.5 text-[10px] font-bold text-blue-400 uppercase">
              {currentRoom.type}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {currentRoom && currentRoom.type === 'meeting' && (
            <button
              onClick={() => onJoinMeeting(currentRoom)}
              className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-500 shadow-md shadow-indigo-600/30 transition animate-bounce"
            >
              <Tv className="w-4 h-4" /> Join Video Meeting
            </button>
          )}

          {isBuilder && (
            <button
              onClick={onOpenBuilder}
              className="inline-flex items-center gap-1.5 rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-1.5 text-xs font-semibold text-amber-300 hover:bg-amber-500/20 transition"
            >
              <PenTool className="w-3.5 h-3.5" /> Edit Office
            </button>
          )}

          <div className="flex items-center gap-2 border-l border-slate-800 pl-3">
            <span className="text-xl">{currentUser.avatar}</span>
            <div className="hidden sm:block text-left text-xs">
              <p className="font-semibold text-slate-200">{currentUser.fullName}</p>
              <p className="text-[10px] text-slate-400">{currentUser.role}</p>
            </div>
          </div>
        </div>
      </header>

      <div className="h-full w-full flex items-center justify-center bg-slate-950">
        <canvas
          ref={canvasRef}
          width={office.layout.dimensions.width || 1600}
          height={office.layout.dimensions.height || 1000}
          className="cursor-crosshair rounded-xl shadow-2xl border border-slate-800/50"
        />
      </div>

      <div className="absolute top-24 left-4 z-20 w-72 rounded-2xl border border-slate-800/80 bg-slate-900/90 p-3.5 backdrop-blur-xl space-y-3 hidden md:block shadow-2xl">
        <div className="flex items-center justify-between text-xs text-slate-400 border-b border-slate-800 pb-2">
          <span className="font-semibold text-slate-200 flex items-center gap-1.5">
            <Radio className="w-4 h-4 text-sky-400" /> Spatial Proximity Audio
          </span>
          <span className="text-[11px] text-sky-400 font-mono font-bold bg-sky-500/10 px-2 py-0.5 rounded-md border border-sky-500/20">
            {proximityRadius}px
          </span>
        </div>

        {/* Dynamic Proximity Radius Slider Control */}
        <div className="space-y-1 bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/60">
          <div className="flex items-center justify-between text-[11px] text-slate-300 font-semibold">
            <span className="flex items-center gap-1 text-slate-400">
              Adjust Range:
            </span>
            <span className="text-sky-400 font-mono font-bold">{proximityRadius}px Radius</span>
          </div>
          <input
            type="range"
            min="100"
            max="600"
            step="10"
            value={proximityRadius}
            onChange={(e) => handleProximityRadiusChange(Number(e.target.value))}
            className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-sky-400"
            title="Slide to dynamically expand or shrink spatial audio hearing range"
          />
          <div className="flex justify-between text-[9px] text-slate-500 font-mono pt-0.5">
            <span>100px (Close)</span>
            <span>600px (Wide)</span>
          </div>
        </div>

        <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1 scrollbar-thin">
          {proximityPeers.length === 0 ? (
            <p className="text-[11px] text-slate-500 italic py-2 text-center">
              No teammates nearby. Walk closer to converse!
            </p>
          ) : (
            proximityPeers.map(p => {
              const u = allUsers.find(user => user.id === p.userId);
              return (
                <div key={p.userId} className="flex items-center justify-between p-2 rounded-lg bg-slate-950/60 text-xs">
                  <div className="flex items-center gap-2 truncate">
                    <span>{u?.avatar || '👤'}</span>
                    <span className="font-medium text-slate-200 truncate">{u?.fullName}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] font-semibold text-emerald-400 block">{Math.round(p.volume * 100)}% Vol</span>
                    <span className="text-[9px] text-slate-500">{p.distance}px away</span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      <div className="absolute bottom-4 sm:bottom-6 left-1/2 -translate-x-1/2 z-30 max-w-[95vw] overflow-x-auto scrollbar-none flex items-center gap-1.5 sm:gap-2 rounded-2xl border border-slate-800/80 bg-slate-900/95 p-2 sm:p-2.5 backdrop-blur-2xl shadow-2xl">
        <button
          onClick={toggleMic}
          className={`flex h-10 w-10 sm:h-11 sm:w-11 shrink-0 items-center justify-center rounded-xl transition ${
            isMicOn 
              ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30' 
              : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white'
          }`}
          title={isMicOn ? 'Mute Microphone' : 'Unmute Microphone'}
        >
          {isMicOn ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
        </button>

        <button
          onClick={toggleCam}
          className={`flex h-10 w-10 sm:h-11 sm:w-11 shrink-0 items-center justify-center rounded-xl transition ${
            isCamOn 
              ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30' 
              : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white'
          }`}
          title={isCamOn ? 'Turn Off Camera' : 'Turn On Camera'}
        >
          {isCamOn ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
        </button>

        <button
          onClick={toggleScreen}
          className={`flex h-10 w-10 sm:h-11 sm:w-11 shrink-0 items-center justify-center rounded-xl transition ${
            isScreenSharing 
              ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30' 
              : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white'
          }`}
          title="Share Screen"
        >
          <Monitor className="w-5 h-5" />
        </button>

        <div className="h-6 w-[1px] bg-slate-800 mx-0.5 shrink-0" />

        <button
          onClick={() => setIsVideoModalOpen(!isVideoModalOpen)}
          className={`flex h-10 w-10 sm:h-11 sm:w-11 shrink-0 items-center justify-center rounded-xl transition ${
            isVideoModalOpen ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
          }`}
          title="Toggle Proximity Camera & Video Feed Screen"
        >
          <Tv className="w-5 h-5" />
        </button>

        <div className="h-6 w-[1px] bg-slate-800 mx-0.5 shrink-0" />

        <button
          onClick={onOpenChat}
          className="flex h-10 w-10 sm:h-11 sm:w-11 shrink-0 items-center justify-center rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white transition relative"
          title="Open Chat"
        >
          <MessageSquare className="w-5 h-5" />
          <span className="absolute top-2 right-2 h-2 w-2 rounded-full bg-blue-500 animate-ping" />
        </button>

        <button
          onClick={onOpenWhiteboard}
          className="flex h-10 w-10 sm:h-11 sm:w-11 shrink-0 items-center justify-center rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white transition"
          title="Open Collaborative Whiteboard"
        >
          <Sparkles className="w-5 h-5 text-amber-400" />
        </button>

        <button
          onClick={toggleProximityCircle}
          className={`flex h-10 w-10 sm:h-11 sm:w-11 shrink-0 items-center justify-center rounded-xl transition ${
            showRadiusCircle ? 'bg-sky-500/20 text-sky-400 border border-sky-500/30' : 'bg-slate-800 text-slate-400'
          }`}
          title="Toggle Proximity Audio Radius Overlay"
        >
          <Radio className="w-5 h-5" />
        </button>

        <div className="h-6 w-[1px] bg-slate-800 mx-0.5 shrink-0" />

        <button
          onClick={() => engineRef.current?.zoomIn()}
          className="flex h-10 w-10 sm:h-11 sm:w-11 shrink-0 items-center justify-center rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white transition"
          title="Zoom In"
        >
          <ZoomIn className="w-5 h-5" />
        </button>

        <button
          onClick={() => engineRef.current?.zoomOut()}
          className="flex h-10 w-10 sm:h-11 sm:w-11 shrink-0 items-center justify-center rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white transition"
          title="Zoom Out"
        >
          <ZoomOut className="w-5 h-5" />
        </button>

        <button
          onClick={() => engineRef.current?.resetZoom()}
          className="flex h-10 w-10 sm:h-11 sm:w-11 shrink-0 items-center justify-center rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white transition text-xs font-semibold"
          title="Reset Zoom to 100%"
        >
          <Maximize2 className="w-4 h-4" />
        </button>
      </div>

      {toastMessage && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-40 rounded-xl border border-blue-500/40 bg-slate-900/90 px-4 py-2 text-xs font-semibold text-blue-300 shadow-2xl backdrop-blur-xl animate-fade-in flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-blue-400" /> {toastMessage}
        </div>
      )}

      {accessAlert && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-50 rounded-xl border border-red-500/50 bg-red-950/90 px-5 py-3 text-xs text-red-200 shadow-2xl backdrop-blur-xl flex items-center gap-3 animate-bounce">
          <Lock className="w-5 h-5 text-red-400" />
          <div>
            <p className="font-bold">Access Restricted to {accessAlert.room}</p>
            <p className="text-[11px] text-red-300">Requires Role: {accessAlert.roles.join(', ')}</p>
          </div>
        </div>
      )}

      {/* On-screen Mobile Touch D-Pad Joystick Overlay */}
      <MobileJoystick
        onDirectionChange={(dir) => engineRef.current?.setVirtualDirection(dir)}
      />

      {/* Spatial Camera & Media Screen Overlay */}
      <SpatialVideoModal
        isOpen={isVideoModalOpen}
        onClose={() => setIsVideoModalOpen(false)}
        currentUser={currentUser}
        allUsers={allUsers}
        proximityPeers={proximityPeers}
        positions={positions}
        isMicOn={isMicOn}
        isCamOn={isCamOn}
        isScreenSharing={isScreenSharing}
        videoStream={videoStream}
        screenStream={screenStream}
        onToggleMic={toggleMic}
        onToggleCam={toggleCam}
        onToggleScreen={toggleScreen}
      />
    </div>
  );
};
