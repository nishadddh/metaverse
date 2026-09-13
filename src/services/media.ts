export interface MediaState {
  micEnabled: boolean;
  camEnabled: boolean;
  screenSharing: boolean;
  audioStream: MediaStream | null;
  videoStream: MediaStream | null;
  screenStream: MediaStream | null;
}

class MediaStreamService {
  private audioStream: MediaStream | null = null;
  private videoStream: MediaStream | null = null;
  private screenStream: MediaStream | null = null;

  async requestMicrophone(): Promise<MediaStream | null> {
    try {
      if (this.audioStream && this.audioStream.active) return this.audioStream;
      this.audioStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      return this.audioStream;
    } catch (err) {
      console.warn('Microphone access denied or unavailable:', err);
      return null;
    }
  }

  async requestCamera(): Promise<MediaStream | null> {
    try {
      if (this.videoStream && this.videoStream.active) return this.videoStream;
      this.videoStream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 }, audio: false });
      return this.videoStream;
    } catch (err) {
      console.warn('Camera access denied or unavailable:', err);
      return null;
    }
  }

  async requestScreenShare(): Promise<MediaStream | null> {
    try {
      if (this.screenStream && this.screenStream.active) return this.screenStream;
      this.screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
      return this.screenStream;
    } catch (err) {
      console.warn('Screen share cancelled or unsupported:', err);
      return null;
    }
  }

  stopVideo() {
    if (this.videoStream) {
      this.videoStream.getTracks().forEach(track => track.stop());
      this.videoStream = null;
    }
  }

  stopAudio() {
    if (this.audioStream) {
      this.audioStream.getTracks().forEach(track => track.stop());
      this.audioStream = null;
    }
  }

  stopScreen() {
    if (this.screenStream) {
      this.screenStream.getTracks().forEach(track => track.stop());
      this.screenStream = null;
    }
  }

  getVideoStream(): MediaStream | null {
    return this.videoStream;
  }

  getAudioStream(): MediaStream | null {
    return this.audioStream;
  }

  getScreenStream(): MediaStream | null {
    return this.screenStream;
  }

  getCombinedStream(): MediaStream | null {
    const tracks: MediaStreamTrack[] = [];
    if (this.audioStream) tracks.push(...this.audioStream.getAudioTracks());
    if (this.videoStream) tracks.push(...this.videoStream.getVideoTracks());
    if (this.screenStream) tracks.push(...this.screenStream.getVideoTracks());
    if (tracks.length === 0) return null;
    return new MediaStream(tracks);
  }

  stopAll() {
    this.stopAudio();
    this.stopVideo();
    this.stopScreen();
  }
}

export const mediaService = new MediaStreamService();
