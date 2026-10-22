import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Animated, Easing, FlatList, Pressable, SafeAreaView, StatusBar, StyleSheet, Text, View } from 'react-native';
import * as Contacts from 'expo-contacts';
import * as Notifications from 'expo-notifications';
import { Audio } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';
import { BleManager } from 'react-native-ble-plx';

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
  const scanRef = useRef(null);
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
    return () => { if (scanRef.current) scanRef.current.remove(); ble.destroy(); };
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
    setActive('nearby'); setStatus('Yakın cihazlar taranıyor…'); setNearby([]);
    scanRef.current = ble.startDeviceScan(null, { allowDuplicates: false }, (error, device) => {
      if (error) { setStatus('Bluetooth taraması durdu'); return; }
      if (device?.id) setNearby((items) => items.some((x) => x.id === device.id) ? items : [...items, { id: device.id, name: device.name || 'İsimsiz QTalK cihazı' }]);
    });
    setTimeout(() => { ble.stopDeviceScan(); setStatus('Tarama tamamlandı'); }, 7000);
  };

  const beginTalk = async () => {
    if (!permissionState.mic) return Alert.alert('Mikrofon izni gerekli', 'Bas-konuş için mikrofon erişimini Ayarlar’dan etkinleştirin.');
    setTalking(true);
    setStatus(`${current.title} kanalında konuşuyorsunuz`);
    Animated.spring(buttonScale, { toValue: 0.94, friction: 7, tension: 80, useNativeDriver: true }).start();
    await Notifications.scheduleNotificationAsync({ content: { title: 'Bas-konuş aktif', body: `${current.title} kanalına ses gönderiliyor.` }, trigger: null });
  };

  const endTalk = () => {
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
      <Text style={styles.hint}>{talking ? 'Sesiniz kanala iletiliyor' : 'Konuşmak için düğmeye basılı tutun'}</Text>
    </View>
    {active === 'nearby' && <View style={styles.panel}><View style={styles.panelHeader}><View><Text style={styles.panelTitle}>Yakındaki cihazlar</Text><Text style={styles.panelCaption}>Bluetooth keşif alanı</Text></View><Pressable style={styles.refreshButton} onPress={startScan}><Ionicons name="refresh" size={15} color="#36D6C5" /><Text style={styles.link}>YENİLE</Text></Pressable></View>{nearby.length === 0 ? <Text style={styles.muted}>Bluetooth ile QTalK cihazları aranıyor…</Text> : nearby.map((device) => <View key={device.id} style={styles.deviceRow}><Ionicons name="bluetooth" size={18} color="#8796FF" /><Text style={styles.deviceName}>{device.name}</Text><Pressable onPress={() => Alert.alert('Bağlantı isteği', `${device.name} cihazına istek gönderildi.`)}><Text style={styles.link}>BAĞLAN</Text></Pressable></View>)}</View>}
    <View style={styles.panel}><View style={styles.panelHeader}><View><Text style={styles.panelTitle}>Kişiler</Text><Text style={styles.panelCaption}>Hızlı erişim</Text></View><Text style={styles.muted}>{contacts.length} kayıt</Text></View>{contacts.slice(0, 3).map((contact, index) => <View key={contact.id || index} style={styles.deviceRow}><View style={styles.contactBubble}><Text style={styles.contactInitial}>{(contact.name || '?')[0]}</Text></View><Text style={styles.deviceName}>{contact.name || 'İsimsiz kişi'}</Text><Ionicons name="chevron-forward" size={18} color="#62738D" /></View>)}{!permissionState.contacts && <Text style={styles.muted}>Kişi listesi izni verilmedi.</Text>}</View>
    <View style={styles.permissions}><View style={styles.permissionDot} /><Text style={styles.permissionText}>Mikrofon {permissionState.mic ? 'aktif' : 'bekliyor'} · Bildirimler {permissionState.notifications ? 'aktif' : 'bekliyor'} · Bluetooth hazır</Text></View>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#07111F', paddingHorizontal: 20 }, header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 18, paddingBottom: 15 }, brandRow: { flexDirection: 'row', alignItems: 'center', gap: 7 }, brandMark: { width: 19, height: 19, borderRadius: 6, backgroundColor: '#36D6C5', alignItems: 'center', justifyContent: 'center' }, eyebrow: { color: '#36D6C5', fontSize: 9, letterSpacing: 1.8, fontWeight: '800' }, title: { color: '#F6F8FC', fontSize: 29, fontWeight: '800', marginTop: 7, letterSpacing: -0.7 }, avatar: { width: 44, height: 44, borderRadius: 15, backgroundColor: '#172943', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#27415F' }, avatarText: { color: '#8DF5E7', fontWeight: '800', fontSize: 13 }, onlineBadge: { position: 'absolute', right: -2, bottom: -1, width: 11, height: 11, borderRadius: 6, backgroundColor: '#36D6C5', borderWidth: 2, borderColor: '#07111F' }, statusRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 15 }, dot: { width: 8, height: 8, borderRadius: 8, marginRight: 8 }, statusText: { color: '#B6C2D3', fontSize: 12, flex: 1 }, securePill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 5, borderRadius: 8, backgroundColor: '#102B35' }, encryption: { color: '#36D6C5', fontSize: 8, letterSpacing: 1, fontWeight: '800' }, sectionLabel: { color: '#52647D', fontSize: 9, letterSpacing: 1.8, fontWeight: '800', marginBottom: 9 }, channelList: { gap: 10, paddingBottom: 16 }, channelCard: { width: 145, minHeight: 118, borderRadius: 19, padding: 14, backgroundColor: '#0D1B2E', borderWidth: 1, borderColor: '#172943' }, cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }, channelIcon: { width: 38, height: 38, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginBottom: 12 }, liveDot: { width: 6, height: 6, borderRadius: 4, backgroundColor: '#36D6C5', marginTop: 5 }, channelTitle: { color: '#F6F8FC', fontWeight: '700', fontSize: 14 }, channelSubtitle: { color: '#7689A4', fontSize: 11, marginTop: 5 }, talkPanel: { alignItems: 'center', backgroundColor: '#0D1B2E', borderRadius: 28, paddingHorizontal: 18, paddingTop: 19, paddingBottom: 20, borderWidth: 1, borderColor: '#172943', overflow: 'hidden' }, talkPanelHeader: { width: '100%', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, talkLabel: { color: '#62738D', fontSize: 9, letterSpacing: 1.8, fontWeight: '800' }, talkChannel: { color: '#F6F8FC', fontSize: 19, fontWeight: '800', marginTop: 6 }, channelSignal: { alignItems: 'flex-end', flexDirection: 'row', gap: 3 }, signalBar: { width: 4, borderRadius: 3, backgroundColor: '#36D6C5' }, signalText: { color: '#36D6C5', fontSize: 8, letterSpacing: 1, fontWeight: '800', marginLeft: 5 }, buttonStage: { width: 230, height: 215, alignItems: 'center', justifyContent: 'center', marginVertical: 4 }, pulseRing: { position: 'absolute', borderWidth: 1.5 }, talkButtonHalo: { position: 'absolute', width: 182, height: 182, borderRadius: 91 }, talkButton: { width: 154, height: 154, borderRadius: 77, backgroundColor: '#36D6C5', justifyContent: 'center', alignItems: 'center', shadowColor: '#36D6C5', shadowOpacity: 0.3, shadowRadius: 24, elevation: 12 }, talkButtonActive: { backgroundColor: '#FFA76B', shadowColor: '#FFA76B', shadowOpacity: 0.38 }, talkButtonTouch: { flex: 1, width: '100%', alignItems: 'center', justifyContent: 'center', borderRadius: 77 }, talkButtonText: { color: '#07111F', fontSize: 10, fontWeight: '900', letterSpacing: 1.35, marginTop: 7 }, wave: { height: 18, flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 9 }, waveBar: { width: 3, height: 16, borderRadius: 3 }, hint: { color: '#7689A4', fontSize: 11 }, panel: { marginTop: 12, padding: 15, backgroundColor: '#0D1B2E', borderRadius: 19, borderWidth: 1, borderColor: '#172943' }, panelHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 9 }, panelTitle: { color: '#F6F8FC', fontSize: 15, fontWeight: '750' }, panelCaption: { color: '#62738D', fontSize: 10, marginTop: 3 }, refreshButton: { flexDirection: 'row', alignItems: 'center', gap: 5 }, link: { color: '#36D6C5', fontSize: 9, fontWeight: '900', letterSpacing: 1 }, muted: { color: '#7689A4', fontSize: 12 }, deviceRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, gap: 10 }, deviceName: { color: '#D9E2EF', fontSize: 13, flex: 1 }, contactBubble: { width: 29, height: 29, borderRadius: 10, backgroundColor: '#223956', alignItems: 'center', justifyContent: 'center' }, contactInitial: { color: '#8DF5E7', fontWeight: '700' }, permissions: { paddingVertical: 10, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 6 }, permissionDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: '#36D6C5' }, permissionText: { color: '#52647D', fontSize: 9 }
});
