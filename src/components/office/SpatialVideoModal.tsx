import React, { useEffect, useRef } from 'react';
import type { UserProfile, UserPosition } from '../../types/office';
import type { ProximityPeer } from '../../services/audio';
import { 
  X, 
  Mic, 
  MicOff, 
  Video, 
  VideoOff, 
  Monitor, 
  Maximize2, 
  Minimize2,
  Radio
} from 'lucide-react';

interface SpatialVideoModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserProfile;
  allUsers: UserProfile[];
  proximityPeers: ProximityPeer[];
  positions: UserPosition[];
  isMicOn: boolean;
  isCamOn: boolean;
  isScreenSharing: boolean;
  videoStream: MediaStream | null;
  screenStream: MediaStream | null;
  remoteStreams?: Map<string, MediaStream>;
  firebaseVideoFeeds?: Map<string, string>;
  onToggleMic: () => void;
  onToggleCam: () => void;
  onToggleScreen: () => void;
}

const RemoteVideoPlayer: React.FC<{
  stream?: MediaStream | null;
  firebaseFrame?: string;
  volume: number;
  profile: UserProfile;
  isPeerMicOn: boolean;
  isPeerCamOn: boolean;
  distance: number;
}> = ({ stream, firebaseFrame, volume, profile, isPeerMicOn, isPeerCamOn, distance }) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
      videoRef.current.volume = Math.max(0, Math.min(1.0, volume));
      videoRef.current.play().catch(() => {});
    }
  }, [stream, volume]);

  const hasWebRTCVideo = stream && stream.getVideoTracks().length > 0;

  return (
    <div className="relative rounded-xl border border-slate-800 bg-slate-950 overflow-hidden flex flex-col justify-between min-h-[160px]">
      {hasWebRTCVideo ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          className="w-full h-full object-cover"
        />
      ) : firebaseFrame ? (
        <img
          src={firebaseFrame}
          alt={profile.fullName}
          className="w-full h-full object-cover"
        />
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center bg-slate-900/70 p-4 text-center">
          {stream && (
            <audio
              ref={el => {
                if (el && stream) {
                  el.srcObject = stream;
                  el.volume = Math.max(0, Math.min(1.0, volume));
                  el.play().catch(() => {});
                }
              }}
              autoPlay
            />
          )}
          <div className="relative mb-2">
            <span className="text-4xl p-3 rounded-full bg-slate-800 border border-slate-700 block shadow-inner">
              {profile.avatar}
            </span>
            {isPeerMicOn && (
              <span className="absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full bg-emerald-500 border-2 border-slate-900 animate-pulse" />
            )}
          </div>
          <span className="text-xs font-bold text-slate-200">{profile.fullName}</span>
          <span className="text-[10px] text-sky-400 font-mono mt-0.5 font-bold">
            {Math.round(volume * 100)}% Audio Vol • {distance < 9000 ? `${distance}px away` : 'Same Room'}
          </span>
        </div>
      )}

      {/* User Info Overlay Bar */}
      <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between text-[11px] font-medium bg-slate-950/85 backdrop-blur-md px-2.5 py-1 rounded-lg border border-slate-800 z-10">
        <span className="text-slate-200 font-semibold truncate">{profile.fullName}</span>
        <div className="flex items-center gap-1.5 shrink-0">
          {isPeerMicOn ? (
            <Mic className="w-3 h-3 text-emerald-400" />
          ) : (
            <MicOff className="w-3 h-3 text-red-400" />
          )}
          {isPeerCamOn || firebaseFrame ? (
            <Video className="w-3 h-3 text-blue-400" />
          ) : (
            <VideoOff className="w-3 h-3 text-slate-500" />
          )}
        </div>
      </div>
    </div>
  );
};

export const SpatialVideoModal: React.FC<SpatialVideoModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  allUsers,
  proximityPeers,
  positions,
  isMicOn,
  isCamOn,
  isScreenSharing,
  videoStream,
  screenStream,
  remoteStreams,
  firebaseVideoFeeds,
  onToggleMic,
  onToggleCam,
  onToggleScreen
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const screenRef = useRef<HTMLVideoElement | null>(null);
  const [isExpanded, setIsExpanded] = React.useState(false);

  // Bind local camera stream to <video> element
  useEffect(() => {
    if (videoRef.current && videoStream) {
      videoRef.current.srcObject = videoStream;
    }
  }, [videoStream, isCamOn]);

  // Bind local screen share stream to <video> element
  useEffect(() => {
    if (screenRef.current && screenStream) {
      screenRef.current.srcObject = screenStream;
    }
  }, [screenStream, isScreenSharing]);

  if (!isOpen) return null;

  // Filter teammates: Include only in-range teammates OR teammates with active video
  const activeProximityUsers = proximityPeers.map(peer => {
    const profile = allUsers.find(u => u.id === peer.userId);
    const pos = positions.find(p => p.userId === peer.userId);
    return { peer, profile, pos };
  }).filter(item => {
    if (!item.profile) return false;
    const hasVideo = (remoteStreams && remoteStreams.has(item.profile.id)) || (firebaseVideoFeeds && firebaseVideoFeeds.has(item.profile.id)) || item.pos?.isCamOn;
    return item.peer.inRange || hasVideo;
  });

  return (
    <div className={`fixed z-50 transition-all duration-300 font-sans ${
      isExpanded 
        ? 'inset-3 sm:inset-6 bg-slate-950/95 backdrop-blur-2xl rounded-3xl border border-slate-800 shadow-2xl p-4 sm:p-6 flex flex-col justify-between' 
        : 'bottom-20 inset-x-3 sm:inset-auto sm:right-6 sm:w-96 max-w-[96vw] sm:max-w-[90vw] bg-slate-900/95 backdrop-blur-xl rounded-2xl border border-slate-800 shadow-2xl p-3.5 flex flex-col gap-3'
    }`}>
      {/* Top Header */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-600/20 text-blue-400 border border-blue-500/30">
            <Radio className="w-4 h-4 animate-pulse" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-white flex items-center gap-1.5">
              Spatial Proximity Video
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/20 px-2 py-0.5 text-[9px] font-extrabold text-emerald-400 border border-emerald-500/30">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-ping" /> LIVE
              </span>
            </h3>
            <p className="text-[10px] text-slate-400">
              {activeProximityUsers.length + 1} User(s) Broadcasting in Proximity Zone
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition"
            title={isExpanded ? "Collapse View" : "Expand Fullscreen Screen"}
          >
            {isExpanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition"
            title="Close Video Screen"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Video Viewports Container */}
      <div className={`grid gap-3 ${
        isExpanded 
          ? 'flex-1 grid-cols-1 sm:grid-cols-2 md:grid-cols-3 overflow-y-auto my-3' 
          : 'max-h-64 grid-cols-1 overflow-y-auto'
      }`}>
        {/* Local Screen Share Viewport (If Active) */}
        {isScreenSharing && (
          <div className="relative rounded-xl border border-indigo-500/50 bg-slate-950 overflow-hidden flex flex-col justify-between group min-h-[160px]">
            {screenStream ? (
              <video
                ref={screenRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center bg-indigo-950/40 p-4 text-center">
                <Monitor className="w-8 h-8 text-indigo-400 animate-pulse mb-1" />
                <span className="text-xs font-semibold text-indigo-200">Screen Share Broadcasting</span>
              </div>
            )}
            <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between text-[11px] font-medium bg-slate-950/80 backdrop-blur-md px-2.5 py-1 rounded-lg border border-slate-800">
              <span className="text-indigo-300 font-bold flex items-center gap-1">
                <Monitor className="w-3 h-3 text-indigo-400" /> Your Desktop Screen Share
              </span>
            </div>
          </div>
        )}

        {/* Local User Camera Feed */}
        <div className="relative rounded-xl border border-slate-800 bg-slate-950 overflow-hidden flex flex-col justify-between group min-h-[160px]">
          {isCamOn && videoStream ? (
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover scale-x-[-1]"
            />
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center bg-slate-900/80 p-4 text-center">
              <div className="relative mb-2">
                <span className="text-4xl p-3 rounded-full bg-slate-800 border border-slate-700 block shadow-inner">
                  {currentUser.avatar}
                </span>
                {isMicOn && (
                  <span className="absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full bg-emerald-500 border-2 border-slate-900 animate-pulse" />
                )}
              </div>
              <span className="text-xs font-bold text-slate-200">{currentUser.fullName}</span>
              <span className="text-[10px] text-slate-400 font-medium mt-0.5">
                {isCamOn ? 'Camera Active' : 'Camera Off'}
              </span>
            </div>
          )}

          {/* User Status Bar */}
          <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between text-[11px] font-medium bg-slate-950/85 backdrop-blur-md px-2.5 py-1 rounded-lg border border-slate-800">
            <span className="text-slate-200 font-semibold truncate">
              {currentUser.fullName} (You)
            </span>
            <div className="flex items-center gap-1.5 shrink-0">
              {isMicOn ? (
                <Mic className="w-3 h-3 text-emerald-400" />
              ) : (
                <MicOff className="w-3 h-3 text-red-400" />
              )}
              {isCamOn ? (
                <Video className="w-3 h-3 text-blue-400" />
              ) : (
                <VideoOff className="w-3 h-3 text-slate-500" />
              )}
            </div>
          </div>
        </div>

        {/* Nearby Teammates Video Tiles */}
        {activeProximityUsers.map(({ peer, profile, pos }) => {
          if (!profile) return null;
          const isPeerCamOn = pos?.isCamOn ?? false;
          const isPeerMicOn = pos?.isMicOn ?? true;
          const remoteStream = remoteStreams?.get(profile.id);
          const firebaseFrame = firebaseVideoFeeds?.get(profile.id);

          return (
            <RemoteVideoPlayer
              key={profile.id}
              stream={remoteStream}
              firebaseFrame={firebaseFrame}
              volume={peer.volume}
              profile={profile}
              isPeerMicOn={isPeerMicOn}
              isPeerCamOn={isPeerCamOn}
              distance={peer.distance}
            />
          );
        })}
      </div>

      {/* Control Bar at Bottom */}
      <div className="flex items-center justify-between border-t border-slate-800 pt-2.5">
        <div className="text-[10px] text-slate-400 font-mono hidden sm:block">
          Proximity Media Pipeline: <span className="text-emerald-400 font-bold">Active</span>
        </div>

        <div className="flex items-center gap-2 mx-auto sm:mx-0">
          <button
            onClick={onToggleMic}
            className={`flex h-9 w-9 items-center justify-center rounded-xl transition ${
              isMicOn 
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30' 
                : 'bg-red-600/20 text-red-400 border border-red-500/40'
            }`}
            title={isMicOn ? "Mute Microphone" : "Unmute Microphone"}
          >
            {isMicOn ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
          </button>

          <button
            onClick={onToggleCam}
            className={`flex h-9 w-9 items-center justify-center rounded-xl transition ${
              isCamOn 
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30' 
                : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
            }`}
            title={isCamOn ? "Turn Off Camera" : "Turn On Camera"}
          >
            {isCamOn ? <Video className="w-4 h-4" /> : <VideoOff className="w-4 h-4" />}
          </button>

          <button
            onClick={onToggleScreen}
            className={`flex h-9 w-9 items-center justify-center rounded-xl transition ${
              isScreenSharing 
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30' 
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
            title={isScreenSharing ? "Stop Screen Share" : "Start Screen Share"}
          >
            <Monitor className="w-4 h-4" />
          </button>

          <button
            onClick={onClose}
            className="flex items-center gap-1.5 rounded-xl bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-700 transition ml-2"
          >
            Hide Window
          </button>
        </div>
      </div>
    </div>
  );
};
