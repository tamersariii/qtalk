import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, FlatList, Pressable, SafeAreaView, StatusBar, StyleSheet, Text, View } from 'react-native';
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

export default function App() {
  const [active, setActive] = useState('team');
  const [talking, setTalking] = useState(false);
  const [permissionState, setPermissionState] = useState({ mic: false, notifications: false, contacts: false, bluetooth: false });
  const [nearby, setNearby] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [status, setStatus] = useState('Hazır');
  const scanRef = useRef(null);

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

  const current = useMemo(() => channels.find((item) => item.id === active) || channels[0], [active]);

  const startScan = () => {
    setActive('nearby'); setStatus('Yakın cihazlar taranıyor…'); setNearby([]);
    scanRef.current = ble.startDeviceScan(null, { allowDuplicates: false }, (error, device) => {
      if (error) { setStatus('Bluetooth taraması durdu'); return; }
      if (device?.id) setNearby((items) => items.some((x) => x.id === device.id) ? items : [...items, { id: device.id, name: device.name || 'İsimsiz QTalK cihazı' }]);
    });
    setTimeout(() => { ble.stopDeviceScan(); setStatus('Tarama tamamlandı'); }, 7000);
  };

  const toggleTalk = async () => {
    if (!permissionState.mic) return Alert.alert('Mikrofon izni gerekli', 'Bas-konuş için mikrofon erişimini Ayarlar’dan etkinleştirin.');
    setTalking((value) => !value);
    setStatus(talking ? 'Hazır' : `${current.title} kanalında konuşuyorsunuz`);
    await Notifications.scheduleNotificationAsync({ content: { title: talking ? 'QTalK' : 'Bas-konuş aktif', body: talking ? 'Kanal hazır.' : `${current.title} kanalına ses gönderiliyor.` }, trigger: null });
  };

  return <SafeAreaView style={styles.safe}>
    <StatusBar barStyle="light-content" />
    <View style={styles.header}><View><Text style={styles.eyebrow}>QTalK / GÜVENLİ İLETİŞİM</Text><Text style={styles.title}>Konuşmaya hazır.</Text></View><View style={styles.avatar}><Text style={styles.avatarText}>TS</Text></View></View>
    <View style={styles.statusRow}><View style={[styles.dot, { backgroundColor: current.color }]} /><Text style={styles.statusText}>{status}</Text><Text style={styles.encryption}>UÇTAN UCA HAZIR</Text></View>
    <FlatList data={channels} keyExtractor={(item) => item.id} horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.channelList} renderItem={({ item }) => <Pressable onPress={() => item.id === 'nearby' ? startScan() : setActive(item.id)} style={[styles.channelCard, active === item.id && styles.channelCardActive]}><View style={[styles.channelIcon, { backgroundColor: `${item.color}20` }]}><Ionicons name={item.id === 'nearby' ? 'bluetooth' : 'radio'} size={20} color={item.color} /></View><Text style={styles.channelTitle}>{item.title}</Text><Text style={styles.channelSubtitle}>{item.subtitle}</Text></Pressable>} />
    <View style={styles.talkPanel}><Text style={styles.talkLabel}>BAS-KONUŞ</Text><Text style={styles.talkChannel}>{current.title}</Text><Pressable onPress={toggleTalk} onPressIn={() => !talking && toggleTalk()} onPressOut={() => talking && toggleTalk()} style={[styles.talkButton, talking && styles.talkButtonActive]}><Ionicons name={talking ? 'radio' : 'mic'} size={42} color="#07111F" /><Text style={styles.talkButtonText}>{talking ? 'KONUŞUYOR' : 'BASILI TUT'}</Text></Pressable><Text style={styles.hint}>{talking ? 'Sesiniz kanala iletiliyor' : 'Kanalı seçin ve düğmeye basın'}</Text></View>
    {active === 'nearby' && <View style={styles.panel}><View style={styles.panelHeader}><Text style={styles.panelTitle}>Yakındaki cihazlar</Text><Pressable onPress={startScan}><Text style={styles.link}>YENİLE</Text></Pressable></View>{nearby.length === 0 ? <Text style={styles.muted}>Bluetooth ile QTalK cihazları aranıyor…</Text> : nearby.map((device) => <View key={device.id} style={styles.deviceRow}><Ionicons name="bluetooth" size={18} color="#8796FF" /><Text style={styles.deviceName}>{device.name}</Text><Pressable onPress={() => Alert.alert('Bağlantı isteği', `${device.name} cihazına istek gönderildi.`)}><Text style={styles.link}>BAĞLAN</Text></Pressable></View>)}</View>}
    <View style={styles.panel}><View style={styles.panelHeader}><Text style={styles.panelTitle}>Kişiler</Text><Text style={styles.muted}>{contacts.length} kayıt</Text></View>{contacts.slice(0, 3).map((contact, index) => <View key={contact.id || index} style={styles.deviceRow}><View style={styles.contactBubble}><Text style={styles.contactInitial}>{(contact.name || '?')[0]}</Text></View><Text style={styles.deviceName}>{contact.name || 'İsimsiz kişi'}</Text><Ionicons name="chevron-forward" size={18} color="#62738D" /></View>)}{!permissionState.contacts && <Text style={styles.muted}>Kişi listesi izni verilmedi.</Text>}</View>
    <View style={styles.permissions}><Text style={styles.permissionText}>Mikrofon {permissionState.mic ? 'aktif' : 'bekliyor'} · Bildirimler {permissionState.notifications ? 'aktif' : 'bekliyor'} · Bluetooth hazır</Text></View>
  </SafeAreaView>;
}

const styles = StyleSheet.create({ safe: { flex: 1, backgroundColor: '#07111F', paddingHorizontal: 20 }, header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 18, paddingBottom: 16 }, eyebrow: { color: '#36D6C5', fontSize: 10, letterSpacing: 1.8, fontWeight: '700' }, title: { color: '#F6F8FC', fontSize: 29, fontWeight: '800', marginTop: 6 }, avatar: { width: 42, height: 42, borderRadius: 14, backgroundColor: '#172943', justifyContent: 'center', alignItems: 'center' }, avatarText: { color: '#8DF5E7', fontWeight: '800' }, statusRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 18 }, dot: { width: 8, height: 8, borderRadius: 8, marginRight: 8 }, statusText: { color: '#B6C2D3', fontSize: 12 }, encryption: { color: '#62738D', fontSize: 9, marginLeft: 'auto', letterSpacing: 1 }, channelList: { gap: 10, paddingBottom: 18 }, channelCard: { width: 145, borderRadius: 18, padding: 14, backgroundColor: '#0D1B2E', borderWidth: 1, borderColor: '#172943' }, channelCardActive: { borderColor: '#36D6C5', backgroundColor: '#10263A' }, channelIcon: { width: 38, height: 38, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginBottom: 12 }, channelTitle: { color: '#F6F8FC', fontWeight: '700', fontSize: 14 }, channelSubtitle: { color: '#7689A4', fontSize: 11, marginTop: 5 }, talkPanel: { alignItems: 'center', backgroundColor: '#0D1B2E', borderRadius: 28, paddingVertical: 24, borderWidth: 1, borderColor: '#172943' }, talkLabel: { color: '#62738D', fontSize: 10, letterSpacing: 2, fontWeight: '700' }, talkChannel: { color: '#F6F8FC', fontSize: 18, fontWeight: '700', marginTop: 8 }, talkButton: { width: 164, height: 164, borderRadius: 82, backgroundColor: '#36D6C5', justifyContent: 'center', alignItems: 'center', marginVertical: 20, shadowColor: '#36D6C5', shadowOpacity: 0.22, shadowRadius: 22, elevation: 10 }, talkButtonActive: { backgroundColor: '#FFA76B' }, talkButtonText: { color: '#07111F', fontSize: 11, fontWeight: '900', letterSpacing: 1.5, marginTop: 6 }, hint: { color: '#7689A4', fontSize: 12 }, panel: { marginTop: 14, padding: 16, backgroundColor: '#0D1B2E', borderRadius: 18, borderWidth: 1, borderColor: '#172943' }, panelHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }, panelTitle: { color: '#F6F8FC', fontSize: 15, fontWeight: '700' }, link: { color: '#36D6C5', fontSize: 10, fontWeight: '800', letterSpacing: 1 }, muted: { color: '#7689A4', fontSize: 12 }, deviceRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 9, gap: 10 }, deviceName: { color: '#D9E2EF', fontSize: 13, flex: 1 }, contactBubble: { width: 28, height: 28, borderRadius: 10, backgroundColor: '#223956', alignItems: 'center', justifyContent: 'center' }, contactInitial: { color: '#8DF5E7', fontWeight: '700' }, permissions: { paddingVertical: 12, alignItems: 'center' }, permissionText: { color: '#52647D', fontSize: 10 }
});
