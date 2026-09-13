import React, { useState, useEffect, useRef } from 'react';
import type { Room, UserProfile } from '../../types/office';
import { mediaService } from '../../services/media';
import { webrtcService } from '../../services/webrtc';
import { subscribeFirebaseVideoFeeds } from '../../services/firebase';
import { 
  X, 
  Mic, 
  MicOff, 
  Video, 
  VideoOff, 
  Monitor, 
  PhoneOff, 
  Users 
} from 'lucide-react';

interface MeetingModalProps {
  isOpen: boolean;
  onClose: () => void;
  room: Room;
  currentUser: UserProfile;
  allUsers: UserProfile[];
  remoteStreams?: Map<string, MediaStream>;
  firebaseVideoFeeds?: Map<string, string>;
}

const MeetingParticipantTile: React.FC<{
  user: UserProfile;
  isLocal: boolean;
  isCamOn: boolean;
  isMicOn: boolean;
  localVideoRef?: React.RefObject<HTMLVideoElement | null>;
  remoteStream?: MediaStream | null;
  firebaseFrame?: string;
}> = ({ user, isLocal, isCamOn, isMicOn, localVideoRef, remoteStream, firebaseFrame }) => {
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
      remoteVideoRef.current.play().catch(() => {});
    }
  }, [remoteStream]);

  const hasRemoteVideo = remoteStream && remoteStream.getVideoTracks().length > 0;

  return (
    <div className="relative rounded-2xl border border-slate-800 bg-slate-900 overflow-hidden flex flex-col items-center justify-center min-h-[220px]">
      {isLocal ? (
        isCamOn ? (
          <div className="absolute inset-0 bg-slate-950 flex items-center justify-center">
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover scale-x-[-1]"
            />
            <span className="absolute top-3 right-3 text-[10px] bg-blue-600/90 backdrop-blur-md px-2.5 py-1 rounded-lg font-bold text-white shadow-md border border-blue-400/30 flex items-center gap-1">
              <Video className="w-3 h-3 text-white" /> Your Live Camera Feed
            </span>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center gap-3">
            <span className="text-6xl p-4 rounded-full bg-slate-800/80 border border-slate-700 block shadow-inner">
              {user.avatar}
            </span>
            <span className="text-sm font-semibold text-slate-200">{user.fullName} (You)</span>
          </div>
        )
      ) : hasRemoteVideo ? (
        <div className="absolute inset-0 bg-slate-950 flex items-center justify-center">
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            className="w-full h-full object-cover"
          />
        </div>
      ) : firebaseFrame ? (
        <div className="absolute inset-0 bg-slate-950 flex items-center justify-center">
          <img
            src={firebaseFrame}
            alt={user.fullName}
            className="w-full h-full object-cover"
          />
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center gap-3">
          {remoteStream && (
            <audio
              ref={el => {
                if (el && remoteStream) {
                  el.srcObject = remoteStream;
                  el.play().catch(() => {});
                }
              }}
              autoPlay
              playsInline
            />
          )}
          <span className="text-6xl p-4 rounded-full bg-slate-800/80 border border-slate-700 block shadow-inner">
            {user.avatar}
          </span>
          <span className="text-sm font-semibold text-slate-200">{user.fullName}</span>
        </div>
      )}

      <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between text-xs font-medium bg-slate-950/80 backdrop-blur-md px-3 py-1.5 rounded-xl border border-slate-800 z-10">
        <span className="truncate">{user.fullName} {isLocal ? '(You)' : ''}</span>
        <div className="flex items-center gap-2">
          {isMicOn ? <Mic className="w-3.5 h-3.5 text-emerald-400" /> : <MicOff className="w-3.5 h-3.5 text-red-400" />}
        </div>
      </div>
    </div>
  );
};

export const MeetingModal: React.FC<MeetingModalProps> = ({
  isOpen,
  onClose,
  room,
  currentUser,
  allUsers,
  remoteStreams,
  firebaseVideoFeeds
}) => {
  const [isMicOn, setIsMicOn] = useState(true);
  const [isCamOn, setIsCamOn] = useState(true);
  const [isScreenShare, setIsScreenShare] = useState(false);
  const [videoStream, setVideoStream] = useState<MediaStream | null>(mediaService.getVideoStream());
  const [liveRemoteStreams, setLiveRemoteStreams] = useState<Map<string, MediaStream>>(remoteStreams || new Map());
  const [liveFirebaseFeeds, setLiveFirebaseFeeds] = useState<Map<string, string>>(firebaseVideoFeeds || new Map());
  const localVideoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const unsubWebRTC = webrtcService.subscribeRemoteStreams((streams) => {
      setLiveRemoteStreams(new Map(streams));
    });
    const unsubFirebaseFeeds = subscribeFirebaseVideoFeeds(room.id, (feeds) => {
      setLiveFirebaseFeeds(new Map(feeds));
    });

    return () => {
      unsubWebRTC();
      unsubFirebaseFeeds();
    };
  }, [room.id]);

  useEffect(() => {
    if (isOpen && isCamOn) {
      mediaService.requestCamera().then(stream => {
        setVideoStream(stream);
        webrtcService.setLocalStream(mediaService.getCombinedStream());
      });
    }
  }, [isOpen, isCamOn]);

  useEffect(() => {
    if (localVideoRef.current && videoStream && isCamOn) {
      localVideoRef.current.srcObject = videoStream;
    }
  }, [videoStream, isCamOn]);

  const handleToggleCam = async () => {
    const next = !isCamOn;
    if (next) {
      const stream = await mediaService.requestCamera();
      setVideoStream(stream);
    } else {
      mediaService.stopVideo();
      setVideoStream(null);
    }
    setIsCamOn(next);
    webrtcService.setLocalStream(mediaService.getCombinedStream());
  };

  const handleToggleMic = async () => {
    const next = !isMicOn;
    if (next) {
      await mediaService.requestMicrophone();
    } else {
      mediaService.stopAudio();
    }
    setIsMicOn(next);
    webrtcService.setLocalStream(mediaService.getCombinedStream());
  };

  if (!isOpen) return null;

  const participants = allUsers.slice(0, 6);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 backdrop-blur-xl p-4 md:p-8 animate-fade-in font-sans text-slate-100">
      <div className="relative w-full max-w-5xl h-[85vh] rounded-3xl border border-slate-800 bg-slate-900/95 flex flex-col overflow-hidden shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                {room.name} <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-semibold text-emerald-400">● LIVE CONFERENCE</span>
              </h2>
              <p className="text-xs text-slate-400">{participants.length} Active Participants</p>
            </div>
          </div>

          <button onClick={onClose} className="text-slate-400 hover:text-white p-2">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 p-6 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 overflow-y-auto bg-slate-950/60">
          {participants.map((user) => {
            const isLocal = user.id === currentUser.id;
            const remoteStream = liveRemoteStreams.get(user.id);
            const firebaseFrame = liveFirebaseFeeds.get(user.id);

            return (
              <MeetingParticipantTile
                key={user.id}
                user={user}
                isLocal={isLocal}
                isCamOn={isCamOn}
                isMicOn={isMicOn}
                localVideoRef={localVideoRef}
                remoteStream={remoteStream}
                firebaseFrame={firebaseFrame}
              />
            );
          })}
        </div>

        <div className="border-t border-slate-800 bg-slate-900 px-6 py-4 flex items-center justify-between">
          <div className="text-xs text-slate-400 hidden sm:block">
            Meeting Room ID: <span className="font-mono text-slate-200">{room.id}</span>
          </div>

          <div className="flex items-center gap-3 mx-auto sm:mx-0">
            <button
              onClick={handleToggleMic}
              className={`flex h-11 w-11 items-center justify-center rounded-xl transition ${
                isMicOn ? 'bg-blue-600 text-white' : 'bg-red-600/20 text-red-400 border border-red-500/40'
              }`}
            >
              {isMicOn ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
            </button>

            <button
              onClick={handleToggleCam}
              className={`flex h-11 w-11 items-center justify-center rounded-xl transition ${
                isCamOn ? 'bg-blue-600 text-white' : 'bg-red-600/20 text-red-400 border border-red-500/40'
              }`}
            >
              {isCamOn ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
            </button>

            <button
              onClick={() => setIsScreenShare(!isScreenShare)}
              className={`flex h-11 w-11 items-center justify-center rounded-xl transition ${
                isScreenShare ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              <Monitor className="w-5 h-5" />
            </button>

            <button
              onClick={onClose}
              className="flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 text-xs font-semibold text-white hover:bg-red-500 shadow-lg shadow-red-600/30 transition"
            >
              <PhoneOff className="w-4 h-4" /> Leave Meeting
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
