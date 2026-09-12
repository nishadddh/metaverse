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
      if (this.audioStream) return this.audioStream;
      this.audioStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      return this.audioStream;
    } catch (err) {
      console.warn('Microphone access denied or unavailable:', err);
      return null;
    }
  }

  async requestCamera(): Promise<MediaStream | null> {
    try {
      if (this.videoStream) return this.videoStream;
      this.videoStream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 }, audio: false });
      return this.videoStream;
    } catch (err) {
      console.warn('Camera access denied or unavailable:', err);
      return null;
    }
  }

  async requestScreenShare(): Promise<MediaStream | null> {
    try {
      if (this.screenStream) return this.screenStream;
      this.screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
      return this.screenStream;
    } catch (err) {
      console.warn('Screen share cancelled or unsupported:', err);
      return null;
    }
  }

  stopAll() {
    [this.audioStream, this.videoStream, this.screenStream].forEach(stream => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    });
    this.audioStream = null;
    this.videoStream = null;
    this.screenStream = null;
  }
}

export const mediaService = new MediaStreamService();
