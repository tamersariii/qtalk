import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Animated, Easing, FlatList, Pressable, SafeAreaView, StatusBar, StyleSheet, Text, View } from 'react-native';
import * as Contacts from 'expo-contacts';
import * as Notifications from 'expo-notifications';
import { Audio } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';
import { BleManager } from 'react-native-ble-plx';
import { createPushToTalkSession } from './src/webrtc';

const ble = new BleManager();
const channels = [
  { id: 'team', title: 'Saha Ekibi', subtitle: '4 kişi çevrimiçi', color: '#36D6C5', online: true },
  { id: 'dispatch', title: 'Merkez', subtitle: 'Güvenli kanal', color: '#FFA76B', online: true },
  { id: 'nearby', title: 'Yakındaki cihazlar', subtitle: 'Bluetooth taraması', color: '#8796FF', online: false }
];

function PulseRing({ size, color, scale, opacity }) {
  return <Animated.View pointerEvents="none" style={[styles.pulseRing, { width: size, height: size, borderRadius: size / 2, borderColor: color, transform: [{ scale }], opacity }]} />;
}

function WaveBars({ active }) {
  const bars = useRef(Array.from({ length: 5 }, () => new Animated.Value(0.45))).current;
  useEffect(() => {
    const animations = bars.map((bar, index) => Animated.loop(Animated.sequence([
      Animated.timing(bar, { toValue: active ? 1 : 0.45 + (index % 2) * 0.08, duration: 260 + index * 38, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      Animated.timing(bar, { toValue: active ? 0.35 : 0.45, duration: 260 + index * 28, easing: Easing.inOut(Easing.ease), useNativeDriver: true })
    ])));
    animations.forEach((animation) => animation.start());
    return () => animations.forEach((animation) => animation.stop());
  }, [active, bars]);
  return <View style={styles.wave}>{bars.map((bar, index) => <Animated.View key={index} style={[styles.waveBar, { backgroundColor: active ? '#07111F' : '#36D6C5', transform: [{ scaleY: bar }] }]} />)}</View>;
}

export default function App() {
  const [active, setActive] = useState('team');
  const [talking, setTalking] = useState(false);
  const [permissionState, setPermissionState] = useState({ mic: false, notifications: false, contacts: false, bluetooth: false });
  const [nearby, setNearby] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [status, setStatus] = useState('Hazır');
  const [scanning, setScanning] = useState(false);
  const [pairingId, setPairingId] = useState(null);
  const [connectedDevice, setConnectedDevice] = useState(null);
  const [bluetoothMessage, setBluetoothMessage] = useState('Yakındaki QTalK cihazlarını keşfedin');
  const [webrtcStatus, setWebrtcStatus] = useState('Ses bağlantısı hazır');
  const scanRef = useRef(null);
  const scanTimerRef = useRef(null);
  const audioSessionRef = useRef(null);
  const userIdRef = useRef(`user-${Math.random().toString(36).slice(2, 10)}`);
  const buttonScale = useRef(new Animated.Value(1)).current;
  const ringOne = useRef(new Animated.Value(0.86)).current;
  const ringTwo = useRef(new Animated.Value(0.72)).current;
  const idleGlow = useRef(new Animated.Value(0.96)).current;

  useEffect(() => {
    (async () => {
      const mic = await Audio.requestPermissionsAsync();
      const notifications = await Notifications.requestPermissionsAsync();
      const contactsPermission = await Contacts.requestPermissionsAsync();
      setPermissionState({ mic: mic.granted, notifications: notifications.granted, contacts: contactsPermission.granted, bluetooth: true });
      if (contactsPermission.granted) {
        const result = await Contacts.getContactsAsync({ fields: [Contacts.Fields.Name, Contacts.Fields.PhoneNumbers] });
        setContacts(result.data.slice(0, 8));
      }
    })();
    return () => { ble.stopDeviceScan(); if (scanTimerRef.current) clearTimeout(scanTimerRef.current); audioSessionRef.current?.close(); ble.destroy(); };
  }, []);

  useEffect(() => {
    const idle = Animated.loop(Animated.sequence([
      Animated.timing(idleGlow, { toValue: 1, duration: 1900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      Animated.timing(idleGlow, { toValue: 0.96, duration: 1900, easing: Easing.inOut(Easing.ease), useNativeDriver: true })
    ]));
    idle.start();
    return () => idle.stop();
  }, [idleGlow]);

  useEffect(() => {
    if (!talking) {
      ringOne.stopAnimation(); ringTwo.stopAnimation();
      ringOne.setValue(0.86); ringTwo.setValue(0.72);
      return undefined;
    }
    const pulse = (value, duration, delay = 0) => Animated.loop(Animated.sequence([
      Animated.delay(delay),
      Animated.timing(value, { toValue: 1.22, duration, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(value, { toValue: 0.86, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true })
    ]));
    const first = pulse(ringOne, 1300);
    const second = pulse(ringTwo, 1500, 260);
    first.start(); second.start();
    return () => { first.stop(); second.stop(); };
  }, [talking, ringOne, ringTwo]);

  const current = useMemo(() => channels.find((item) => item.id === active) || channels[0], [active]);

  const startScan = () => {
    if (scanning) return;
    setActive('nearby'); setScanning(true); setStatus('Yakın cihazlar taranıyor…'); setBluetoothMessage('Cihaz kimlikleri ve sinyal güçleri okunuyor'); setNearby([]);
    ble.stopDeviceScan();
    scanRef.current = ble.startDeviceScan(null, { allowDuplicates: false }, (error, device) => {
      if (error) { setScanning(false); setStatus('Bluetooth taraması durdu'); setBluetoothMessage('Bluetooth iznini ve cihaz ayarlarını kontrol edin'); return; }
      if (device?.id) setNearby((items) => {
        const next = { id: device.id, name: device.name || device.localName || 'İsimsiz QTalK cihazı', rssi: device.rssi ?? -100, serviceUUIDs: device.serviceUUIDs || [], manufacturerData: device.manufacturerData };
        const existing = items.findIndex((item) => item.id === device.id);
        if (existing === -1) return [...items, next];
        const copy = [...items]; copy[existing] = { ...copy[existing], ...next }; return copy;
      });
    });
    scanTimerRef.current = setTimeout(() => { ble.stopDeviceScan(); setScanning(false); setStatus('Tarama tamamlandı'); setBluetoothMessage('Bağlanmak için bir cihaz seçin'); }, 9000);
  };

  const stopScan = () => {
    ble.stopDeviceScan();
    if (scanTimerRef.current) clearTimeout(scanTimerRef.current);
    setScanning(false); setStatus('Tarama durduruldu'); setBluetoothMessage('Yeni cihaz aramak için taramayı başlatın');
  };

  const connectNearby = async (device) => {
    if (pairingId) return;
    stopScan(); setPairingId(device.id); setBluetoothMessage(`${device.name} cihazına bağlantı isteği gönderiliyor`);
    try {
      const connected = await ble.connectToDevice(device.id, { timeout: 10000, autoConnect: false });
      await connected.discoverAllServicesAndCharacteristics();
      setConnectedDevice({ ...device, id: connected.id, name: connected.name || device.name });
      setPairingId(null); setStatus('Bluetooth bağlantısı hazır'); setBluetoothMessage(`${connected.name || device.name} ile güvenli kanal hazır`);
    } catch (error) {
      setPairingId(null); setStatus('Bağlantı kurulamadı'); setBluetoothMessage('Cihaz erişilebilir değil veya bağlantı isteğini reddetti');
    }
  };

  const disconnectNearby = async () => {
    if (!connectedDevice) return;
    try { await ble.cancelDeviceConnection(connectedDevice.id); } catch {}
    setConnectedDevice(null); setStatus('Hazır'); setBluetoothMessage('Bağlantı kesildi');
  };

  const signalLabel = (rssi) => rssi >= -60 ? 'Çok güçlü' : rssi >= -75 ? 'Güçlü' : rssi >= -90 ? 'Orta' : 'Zayıf';
  const signalColor = (rssi) => rssi >= -60 ? '#36D6C5' : rssi >= -75 ? '#BDEB72' : rssi >= -90 ? '#FFA76B' : '#FF7C91';

  const beginTalk = async () => {
    if (!permissionState.mic) return Alert.alert('Mikrofon izni gerekli', 'Bas-konuş için mikrofon erişimini Ayarlar’dan etkinleştirin.');
    try {
      if (!audioSessionRef.current) audioSessionRef.current = createPushToTalkSession({ apiUrl: 'https://qtalk-api.1onplayer.workers.dev', channelId: current.id, userId: userIdRef.current, name: 'QTalK kullanıcısı', onStatus: setWebrtcStatus });
      await audioSessionRef.current.beginTalk();
      setTalking(true);
      setStatus(`${current.title} kanalında konuşuyorsunuz`);
      Animated.spring(buttonScale, { toValue: 0.94, friction: 7, tension: 80, useNativeDriver: true }).start();
      await Notifications.scheduleNotificationAsync({ content: { title: 'Bas-konuş aktif', body: `${current.title} kanalına WebRTC sesi gönderiliyor.` }, trigger: null });
    } catch (error) {
      setWebrtcStatus('Ses bağlantısı kurulamadı');
      Alert.alert('Ses bağlantısı kurulamadı', 'Mikrofon veya internet bağlantınızı kontrol edip tekrar deneyin.');
    }
  };
  const endTalk = () => {
    audioSessionRef.current?.endTalk();
    setTalking(false); setStatus('Hazır');
    Animated.spring(buttonScale, { toValue: 1, friction: 5, tension: 80, useNativeDriver: true }).start();
  };

  return <SafeAreaView style={styles.safe}>
    <StatusBar barStyle="light-content" />
    <View style={styles.header}>
      <View><View style={styles.brandRow}><View style={styles.brandMark}><Ionicons name="radio" size={13} color="#07111F" /></View><Text style={styles.eyebrow}>QTALK / GÜVENLİ İLETİŞİM</Text></View><Text style={styles.title}>Konuşmaya hazır.</Text></View>
      <Pressable style={styles.avatar} onPress={() => Alert.alert('Profil', 'Tamer Sarı')}><Text style={styles.avatarText}>TS</Text><View style={styles.onlineBadge} /></Pressable>
    </View>
    <View style={styles.statusRow}><View style={[styles.dot, { backgroundColor: current.color }]} /><Text style={styles.statusText}>{status}</Text><View style={styles.securePill}><Ionicons name="shield-checkmark" size={11} color="#36D6C5" /><Text style={styles.encryption}>GÜVENLİ</Text></View></View>
    <Text style={styles.sectionLabel}>KANALLAR</Text>
    <FlatList data={channels} keyExtractor={(item) => item.id} horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.channelList} renderItem={({ item }) => <Pressable onPress={() => item.id === 'nearby' ? startScan() : setActive(item.id)} style={[styles.channelCard, active === item.id && { borderColor: item.color, backgroundColor: `${item.color}12` }]}><View style={styles.cardTop}><View style={[styles.channelIcon, { backgroundColor: `${item.color}20` }]}><Ionicons name={item.id === 'nearby' ? 'bluetooth' : 'radio'} size={19} color={item.color} /></View>{item.online && <View style={styles.liveDot} />}</View><Text style={styles.channelTitle}>{item.title}</Text><Text style={styles.channelSubtitle}>{item.subtitle}</Text></Pressable>} />
    <View style={styles.talkPanel}><View style={styles.talkPanelHeader}><View><Text style={styles.talkLabel}>AKTİF KANAL</Text><Text style={styles.talkChannel}>{current.title}</Text></View><View style={styles.channelSignal}><View style={[styles.signalBar, { height: 8 }]} /><View style={[styles.signalBar, { height: 13 }]} /><View style={[styles.signalBar, { height: 18 }]} /><Text style={styles.signalText}>GÜÇLÜ</Text></View></View>
      <View style={styles.buttonStage}><PulseRing size={205} color={talking ? '#FFA76B' : '#36D6C5'} scale={ringTwo} opacity={talking ? 0.13 : 0.06} /><PulseRing size={184} color={talking ? '#FFA76B' : '#36D6C5'} scale={ringOne} opacity={talking ? 0.25 : 0.1} /><Animated.View style={[styles.talkButtonHalo, { transform: [{ scale: idleGlow }], backgroundColor: talking ? '#FFA76B18' : '#36D6C518' }]} /><Animated.View style={[styles.talkButton, talking && styles.talkButtonActive, { transform: [{ scale: buttonScale }] }]}><Pressable onPressIn={beginTalk} onPressOut={endTalk} style={styles.talkButtonTouch}><Ionicons name={talking ? 'radio' : 'mic'} size={38} color="#07111F" /><Text style={styles.talkButtonText}>{talking ? 'KONUŞUYOR' : 'BASILI TUT'}</Text><WaveBars active={talking} /></Pressable></Animated.View></View>
      <Text style={styles.hint}>{talking ? 'Sesiniz WebRTC ile kanala iletiliyor' : 'Konuşmak için düğmeye basılı tutun'}</Text><View style={styles.audioStatus}><View style={[styles.audioStatusDot, { backgroundColor: webrtcStatus === 'talking' ? '#FFA76B' : webrtcStatus === 'connected' ? '#36D6C5' : '#52647D' }]} /><Text style={styles.audioStatusText}>{webrtcStatus}</Text></View>
    </View>
    {active === 'nearby' && <View style={styles.bluetoothPanel}>
      <View style={styles.panelHeader}><View><Text style={styles.panelTitle}>Yakındaki cihazlar</Text><Text style={styles.panelCaption}>Bluetooth keşif ve eşleşme alanı</Text></View><Pressable style={[styles.scanButton, scanning && styles.scanButtonActive]} onPress={scanning ? stopScan : startScan}><Ionicons name={scanning ? 'stop' : 'scan'} size={15} color={scanning ? '#FFA76B' : '#07111F'} /><Text style={[styles.scanButtonText, scanning && styles.scanButtonTextActive]}>{scanning ? 'DURDUR' : 'TARAMA BAŞLAT'}</Text></Pressable></View>
      <View style={styles.bluetoothSummary}><View style={[styles.bluetoothOrb, scanning && styles.bluetoothOrbActive]}><Ionicons name="bluetooth" size={27} color={scanning ? '#FFA76B' : '#8796FF'} /></View><View style={styles.bluetoothSummaryText}><Text style={styles.bluetoothMessage}>{bluetoothMessage}</Text><Text style={styles.bluetoothMeta}>{nearby.length} cihaz bulundu · {scanning ? 'tarama aktif' : 'tarama hazır'}</Text></View><View style={styles.scanPulse}><View style={[styles.scanPulseDot, { backgroundColor: scanning ? '#FFA76B' : '#36D6C5' }]} /><Text style={styles.scanPulseText}>{scanning ? 'CANLI' : 'HAZIR'}</Text></View></View>
      {connectedDevice && <View style={styles.connectedCard}><View style={styles.connectedIcon}><Ionicons name="link" size={17} color="#07111F" /></View><View style={styles.deviceNameBlock}><Text style={styles.connectedLabel}>BAĞLI CİHAZ</Text><Text style={styles.deviceName}>{connectedDevice.name}</Text><Text style={styles.deviceId}>{connectedDevice.id}</Text></View><Pressable onPress={disconnectNearby} style={styles.disconnectButton}><Text style={styles.disconnectText}>KES</Text></Pressable></View>}
      {nearby.length === 0 ? <View style={styles.emptyBluetooth}><Ionicons name="radio-outline" size={24} color="#52647D" /><Text style={styles.muted}>{scanning ? 'QTalK cihazları aranıyor…' : 'Tarama başlatarak yakındaki cihazları görün'}</Text><Text style={styles.emptyHint}>Cihazınızın Bluetooth’u açık ve görünür olmalı</Text></View> : <View style={styles.deviceList}>{[...nearby].sort((a, b) => b.rssi - a.rssi).map((device) => <View key={device.id} style={styles.nearbyDeviceCard}><View style={[styles.nearbyDeviceIcon, { backgroundColor: `${signalColor(device.rssi)}20` }]}><Ionicons name="bluetooth" size={19} color={signalColor(device.rssi)} /></View><View style={styles.deviceNameBlock}><Text style={styles.deviceName}>{device.name}</Text><Text style={styles.deviceId}>{device.id}</Text><View style={styles.rssiRow}><View style={styles.rssiBars}><View style={[styles.rssiBar, { height: 5, backgroundColor: signalColor(device.rssi) }]} /><View style={[styles.rssiBar, { height: 9, backgroundColor: device.rssi >= -90 ? signalColor(device.rssi) : '#263A53' }]} /><View style={[styles.rssiBar, { height: 13, backgroundColor: device.rssi >= -75 ? signalColor(device.rssi) : '#263A53' }]} /><View style={[styles.rssiBar, { height: 17, backgroundColor: device.rssi >= -60 ? signalColor(device.rssi) : '#263A53' }]} /></View><Text style={[styles.rssiText, { color: signalColor(device.rssi) }]}>{device.rssi} dBm · {signalLabel(device.rssi)}</Text></View></View><Pressable disabled={pairingId === device.id || Boolean(connectedDevice)} onPress={() => connectNearby(device)} style={[styles.connectButton, pairingId === device.id && styles.connectButtonBusy, connectedDevice && styles.connectButtonDisabled]}><Ionicons name={pairingId === device.id ? 'sync' : 'link-outline'} size={14} color={pairingId === device.id ? '#07111F' : '#36D6C5'} /><Text style={styles.connectText}>{pairingId === device.id ? 'İSTEK…' : 'BAĞLAN'}</Text></Pressable></View>)}</View>}
    </View>}
    <View style={styles.panel}><View style={styles.panelHeader}><View><Text style={styles.panelTitle}>Kişiler</Text><Text style={styles.panelCaption}>Hızlı erişim</Text></View><Text style={styles.muted}>{contacts.length} kayıt</Text></View>{contacts.slice(0, 3).map((contact, index) => <View key={contact.id || index} style={styles.deviceRow}><View style={styles.contactBubble}><Text style={styles.contactInitial}>{(contact.name || '?')[0]}</Text></View><Text style={styles.deviceName}>{contact.name || 'İsimsiz kişi'}</Text><Ionicons name="chevron-forward" size={18} color="#62738D" /></View>)}{!permissionState.contacts && <Text style={styles.muted}>Kişi listesi izni verilmedi.</Text>}</View>
    <View style={styles.permissions}><View style={styles.permissionDot} /><Text style={styles.permissionText}>Mikrofon {permissionState.mic ? 'aktif' : 'bekliyor'} · Bildirimler {permissionState.notifications ? 'aktif' : 'bekliyor'} · Bluetooth hazır</Text></View>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#07111F', paddingHorizontal: 20 }, header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 18, paddingBottom: 15 }, brandRow: { flexDirection: 'row', alignItems: 'center', gap: 7 }, brandMark: { width: 19, height: 19, borderRadius: 6, backgroundColor: '#36D6C5', alignItems: 'center', justifyContent: 'center' }, eyebrow: { color: '#36D6C5', fontSize: 9, letterSpacing: 1.8, fontWeight: '800' }, title: { color: '#F6F8FC', fontSize: 29, fontWeight: '800', marginTop: 7, letterSpacing: -0.7 }, avatar: { width: 44, height: 44, borderRadius: 15, backgroundColor: '#172943', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#27415F' }, avatarText: { color: '#8DF5E7', fontWeight: '800', fontSize: 13 }, onlineBadge: { position: 'absolute', right: -2, bottom: -1, width: 11, height: 11, borderRadius: 6, backgroundColor: '#36D6C5', borderWidth: 2, borderColor: '#07111F' }, statusRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 15 }, dot: { width: 8, height: 8, borderRadius: 8, marginRight: 8 }, statusText: { color: '#B6C2D3', fontSize: 12, flex: 1 }, securePill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 5, borderRadius: 8, backgroundColor: '#102B35' }, encryption: { color: '#36D6C5', fontSize: 8, letterSpacing: 1, fontWeight: '800' }, sectionLabel: { color: '#52647D', fontSize: 9, letterSpacing: 1.8, fontWeight: '800', marginBottom: 9 }, channelList: { gap: 10, paddingBottom: 16 }, channelCard: { width: 145, minHeight: 118, borderRadius: 19, padding: 14, backgroundColor: '#0D1B2E', borderWidth: 1, borderColor: '#172943' }, cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }, channelIcon: { width: 38, height: 38, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginBottom: 12 }, liveDot: { width: 6, height: 6, borderRadius: 4, backgroundColor: '#36D6C5', marginTop: 5 }, channelTitle: { color: '#F6F8FC', fontWeight: '700', fontSize: 14 }, channelSubtitle: { color: '#7689A4', fontSize: 11, marginTop: 5 }, talkPanel: { alignItems: 'center', backgroundColor: '#0D1B2E', borderRadius: 28, paddingHorizontal: 18, paddingTop: 19, paddingBottom: 20, borderWidth: 1, borderColor: '#172943', overflow: 'hidden' }, talkPanelHeader: { width: '100%', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, talkLabel: { color: '#62738D', fontSize: 9, letterSpacing: 1.8, fontWeight: '800' }, talkChannel: { color: '#F6F8FC', fontSize: 19, fontWeight: '800', marginTop: 6 }, channelSignal: { alignItems: 'flex-end', flexDirection: 'row', gap: 3 }, signalBar: { width: 4, borderRadius: 3, backgroundColor: '#36D6C5' }, signalText: { color: '#36D6C5', fontSize: 8, letterSpacing: 1, fontWeight: '800', marginLeft: 5 }, buttonStage: { width: 230, height: 215, alignItems: 'center', justifyContent: 'center', marginVertical: 4 }, pulseRing: { position: 'absolute', borderWidth: 1.5 }, talkButtonHalo: { position: 'absolute', width: 182, height: 182, borderRadius: 91 }, talkButton: { width: 154, height: 154, borderRadius: 77, backgroundColor: '#36D6C5', justifyContent: 'center', alignItems: 'center', shadowColor: '#36D6C5', shadowOpacity: 0.3, shadowRadius: 24, elevation: 12 }, talkButtonActive: { backgroundColor: '#FFA76B', shadowColor: '#FFA76B', shadowOpacity: 0.38 }, talkButtonTouch: { flex: 1, width: '100%', alignItems: 'center', justifyContent: 'center', borderRadius: 77 }, talkButtonText: { color: '#07111F', fontSize: 10, fontWeight: '900', letterSpacing: 1.35, marginTop: 7 }, wave: { height: 18, flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 9 }, waveBar: { width: 3, height: 16, borderRadius: 3 }, hint: { color: '#7689A4', fontSize: 11 }, audioStatus: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 8 }, audioStatusDot: { width: 5, height: 5, borderRadius: 3 }, audioStatusText: { color: '#52647D', fontSize: 9 }, panel: { marginTop: 12, padding: 15, backgroundColor: '#0D1B2E', borderRadius: 19, borderWidth: 1, borderColor: '#172943' }, bluetoothPanel: { marginTop: 12, padding: 15, backgroundColor: '#0D1B2E', borderRadius: 21, borderWidth: 1, borderColor: '#243B59' }, panelHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 9 }, panelTitle: { color: '#F6F8FC', fontSize: 15, fontWeight: '750' }, panelCaption: { color: '#62738D', fontSize: 10, marginTop: 3 }, refreshButton: { flexDirection: 'row', alignItems: 'center', gap: 5 }, scanButton: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 9, paddingVertical: 8, borderRadius: 10, backgroundColor: '#36D6C5' }, scanButtonActive: { backgroundColor: '#FFA76B' }, scanButtonText: { color: '#07111F', fontSize: 8, fontWeight: '900', letterSpacing: 0.7 }, scanButtonTextActive: { color: '#07111F' }, bluetoothSummary: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 11, borderRadius: 15, backgroundColor: '#101F34', marginBottom: 11 }, bluetoothOrb: { width: 49, height: 49, borderRadius: 17, backgroundColor: '#202E5B', alignItems: 'center', justifyContent: 'center' }, bluetoothOrbActive: { backgroundColor: '#4B302C' }, bluetoothSummaryText: { flex: 1, marginLeft: 11 }, bluetoothMessage: { color: '#D9E2EF', fontSize: 12, fontWeight: '700' }, bluetoothMeta: { color: '#62738D', fontSize: 10, marginTop: 4 }, scanPulse: { alignItems: 'center', marginLeft: 7 }, scanPulseDot: { width: 7, height: 7, borderRadius: 4, marginBottom: 4 }, scanPulseText: { color: '#7689A4', fontSize: 8, fontWeight: '900', letterSpacing: 0.8 }, connectedCard: { flexDirection: 'row', alignItems: 'center', padding: 10, borderRadius: 14, backgroundColor: '#163436', borderWidth: 1, borderColor: '#2C6E66', marginBottom: 11 }, connectedIcon: { width: 32, height: 32, borderRadius: 10, backgroundColor: '#36D6C5', alignItems: 'center', justifyContent: 'center' }, connectedLabel: { color: '#36D6C5', fontSize: 8, fontWeight: '900', letterSpacing: 1 }, disconnectButton: { paddingHorizontal: 9, paddingVertical: 7, borderRadius: 8, backgroundColor: '#27494A' }, disconnectText: { color: '#8DF5E7', fontSize: 9, fontWeight: '900' }, deviceList: { gap: 8 }, nearbyDeviceCard: { flexDirection: 'row', alignItems: 'center', padding: 10, borderRadius: 14, backgroundColor: '#101F34', borderWidth: 1, borderColor: '#1A304A' }, nearbyDeviceIcon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginRight: 9 }, deviceNameBlock: { flex: 1 }, deviceId: { color: '#52647D', fontSize: 9, marginTop: 3 }, rssiRow: { flexDirection: 'row', alignItems: 'center', marginTop: 6 }, rssiBars: { flexDirection: 'row', alignItems: 'flex-end', gap: 2, height: 17, marginRight: 6 }, rssiBar: { width: 3, borderRadius: 2 }, rssiText: { fontSize: 9, fontWeight: '700' }, connectButton: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 8, borderRadius: 9, borderWidth: 1, borderColor: '#245E5A' }, connectButtonBusy: { backgroundColor: '#FFA76B', borderColor: '#FFA76B' }, connectButtonDisabled: { opacity: 0.4 }, connectText: { color: '#36D6C5', fontSize: 8, fontWeight: '900' }, emptyBluetooth: { alignItems: 'center', gap: 7, paddingVertical: 21 }, emptyHint: { color: '#52647D', fontSize: 10 }, muted: { color: '#7689A4', fontSize: 12 }, deviceRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, gap: 10 }, deviceName: { color: '#D9E2EF', fontSize: 13, flex: 1 }, contactBubble: { width: 29, height: 29, borderRadius: 10, backgroundColor: '#223956', alignItems: 'center', justifyContent: 'center' }, contactInitial: { color: '#8DF5E7', fontWeight: '700' }, permissions: { paddingVertical: 10, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 6 }, permissionDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: '#36D6C5' }, permissionText: { color: '#52647D', fontSize: 9 }
});
