import { mediaDevices, RTCPeerConnection, RTCIceCandidate, RTCSessionDescription } from 'react-native-webrtc';
import { createQTalkSocket } from './realtime';

const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun.cloudflare.com:3478' }
];

export function createPushToTalkSession({ apiUrl, channelId, userId, name, onStatus = () => {}, onRemoteTrack = () => {} }) {
  let transport;
  let localStream;
  let active = false;
  const peers = new Map();
  const knownPeers = new Set();

  const status = (value) => onStatus(value);

  const createPeer = (peerId, initiator = false) => {
    if (peers.has(peerId)) return peers.get(peerId);
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    peers.set(peerId, pc);

    pc.onicecandidate = (event) => {
      if (event.candidate) transport?.send('ice', event.candidate.toJSON ? event.candidate.toJSON() : event.candidate, peerId);
    };
    pc.ontrack = (event) => {
      const stream = event.streams?.[0];
      if (stream) onRemoteTrack(stream, peerId);
    };
    pc.onconnectionstatechange = () => {
      if (['failed', 'closed', 'disconnected'].includes(pc.connectionState)) {
        peers.delete(peerId);
        status('peer-disconnected');
      }
    };

    if (localStream) localStream.getTracks().forEach((track) => pc.addTrack(track, localStream));
    if (initiator) negotiate(peerId, pc);
    return pc;
  };

  const negotiate = async (peerId, pc = createPeer(peerId, false)) => {
    try {
      const offer = await pc.createOffer({ offerToReceiveAudio: true });
      await pc.setLocalDescription(offer);
      transport?.send('offer', { type: offer.type, sdp: offer.sdp }, peerId);
    } catch (error) {
      status('offer-failed');
    }
  };

  const handleSignal = async (message) => {
    if (!message || !message.from || message.from === userId) return;
    if (message.type === 'presence') {
      if (message.event === 'joined') {
        knownPeers.add(message.userId);
        if (active) negotiate(message.userId, createPeer(message.userId, false));
      }
      if (message.event === 'left') {
        knownPeers.delete(message.userId);
        peers.get(message.userId)?.close();
        peers.delete(message.userId);
      }
      return;
    }
    const peerId = message.from;
    const pc = createPeer(peerId, false);
    try {
      if (message.type === 'offer') {
        await pc.setRemoteDescription(new RTCSessionDescription(message.data));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        transport?.send('answer', { type: answer.type, sdp: answer.sdp }, peerId);
      } else if (message.type === 'answer') {
        await pc.setRemoteDescription(new RTCSessionDescription(message.data));
      } else if (message.type === 'ice' && message.data) {
        await pc.addIceCandidate(new RTCIceCandidate(message.data));
      }
    } catch (error) {
      status('signaling-failed');
    }
  };

  return {
    async start() {
      if (transport) return;
      status('connecting');
      localStream = await mediaDevices.getUserMedia({ audio: true, video: false });
      transport = createQTalkSocket({ apiUrl, channelId, userId, name, onSignal: handleSignal, onStatus: status });
      status('connected');
    },
    async beginTalk() {
      if (!transport) await this.start();
      active = true;
      if (localStream) localStream.getAudioTracks().forEach((track) => { track.enabled = true; });
      for (const peerId of knownPeers) negotiate(peerId, createPeer(peerId, false));
      transport?.send('talk-start', { channelId });
      status('talking');
    },
    endTalk() {
      active = false;
      if (localStream) localStream.getAudioTracks().forEach((track) => { track.enabled = false; });
      transport?.send('talk-stop', { channelId });
      status('connected');
    },
    close() {
      active = false;
      localStream?.getTracks().forEach((track) => track.stop());
      peers.forEach((pc) => pc.close());
      peers.clear();
      transport?.close();
      transport = undefined;
      localStream = undefined;
    },
    get isTalking() { return active; }
  };
}
