// screens/JobDetailScreen.js
import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  Image,
  ScrollView,
  Platform,
  Linking,
  StyleSheet,
} from 'react-native';
import { check, request, PERMISSIONS, RESULTS } from 'react-native-permissions';
import AudioRecorderPlayer from 'react-native-audio-recorder-player';
import { launchCamera, launchImageLibrary } from 'react-native-image-picker';
import { apiFetch } from '../lib/api';

const audioRecorderPlayer = new AudioRecorderPlayer();

export default function JobDetailScreen({ route, navigation }) {
  const { job } = route.params;
  const [status, setStatus] = useState(job.status);
  const [textReport, setTextReport] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [audioPath, setAudioPath] = useState(null);
  const [images, setImages] = useState([]); // [{ uri, type, fileName }]
  const [submitting, setSubmitting] = useState(false);

  // ---- Permissions ----
  // Declares are also required in AndroidManifest.xml / Info.plist — see README.
  async function ensurePermission(permission, friendlyName) {
    const status = await check(permission);
    if (status === RESULTS.GRANTED) return true;

    if (status === RESULTS.BLOCKED) {
      Alert.alert(
        `${friendlyName} blocked`,
        `Please enable ${friendlyName} access in Settings to continue. कृपया सेटिंग्स में अनुमति दें।`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Open Settings', onPress: () => Linking.openSettings() },
        ]
      );
      return false;
    }

    const requested = await request(permission);
    if (requested !== RESULTS.GRANTED) {
      Alert.alert(
        `${friendlyName} required`,
        `We need ${friendlyName} access for this feature. ${friendlyName} की अनुमति चाहिए।`
      );
      return false;
    }
    return true;
  }

  const micPermission = Platform.OS === 'android' ? PERMISSIONS.ANDROID.RECORD_AUDIO : PERMISSIONS.IOS.MICROPHONE;
  const cameraPermission = Platform.OS === 'android' ? PERMISSIONS.ANDROID.CAMERA : PERMISSIONS.IOS.CAMERA;

  // ---- Audio recording ----
  async function startRecording() {
    const ok = await ensurePermission(micPermission, 'Microphone');
    if (!ok) return;
    try {
      const path = Platform.select({
        ios: 'report.m4a',
        android: `${Date.now()}_report.m4a`,
      });
      await audioRecorderPlayer.startRecorder(path);
      setIsRecording(true);
      setAudioPath(path);
    } catch (e) {
      Alert.alert('Error', 'Could not start recording / रिकॉर्डिंग शुरू नहीं हो सकी');
    }
  }

  async function stopRecording() {
    try {
      const uri = await audioRecorderPlayer.stopRecorder();
      setIsRecording(false);
      setAudioPath(uri);
    } catch (e) {
      Alert.alert('Error', 'Could not stop recording');
    }
  }

  // ---- Images ----
  async function captureImage() {
    const ok = await ensurePermission(cameraPermission, 'Camera');
    if (!ok) return;
    const result = await launchCamera({ mediaType: 'photo', quality: 0.7 });
    if (result.assets?.length) {
      setImages((prev) => [...prev, ...result.assets]);
    }
  }

  async function pickFromLibrary() {
    const result = await launchImageLibrary({ mediaType: 'photo', quality: 0.7, selectionLimit: 5 });
    if (result.assets?.length) {
      setImages((prev) => [...prev, ...result.assets]);
    }
  }

  function removeImage(idx) {
    setImages((prev) => prev.filter((_, i) => i !== idx));
  }

  // ---- Job status ----
  async function updateStatus(newStatus) {
    try {
      const data = await apiFetch(`/jobs/${job.id}/status`, {
        method: 'PUT',
        body: { status: newStatus },
      });
      setStatus(data.job.status);
    } catch (e) {
      Alert.alert('Error', e.message);
    }
  }

  // ---- Submit report ----
  async function submitReport() {
    if (!textReport.trim() && !audioPath) {
      Alert.alert('Missing report / अधूरी रिपोर्ट', 'Please add text or record audio for the report.');
      return;
    }

    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('textReport', textReport);

      if (audioPath) {
        formData.append('audio', {
          uri: Platform.OS === 'android' ? `file://${audioPath}` : audioPath,
          type: 'audio/m4a',
          name: 'report_audio.m4a',
        });
      }

      images.forEach((img, idx) => {
        formData.append('images', {
          uri: img.uri,
          type: img.type || 'image/jpeg',
          name: img.fileName || `image_${idx}_${Date.now()}.jpg`,
        });
      });

      await apiFetch(`/reports/jobs/${job.id}`, { method: 'POST', body: formData });

      Alert.alert('Success / सफल', 'Report submitted successfully / रिपोर्ट सफलतापूर्वक जमा हुई', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (e) {
      Alert.alert('Error', e.message || 'Could not submit report');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 16 }}>
      <Text style={styles.title}>{job.customer_name}</Text>
      <Text style={styles.subtitle}>{job.address}, {job.city}</Text>

      <View style={styles.statusRow}>
        {['in_progress', 'completed'].map((s) => (
          <TouchableOpacity
            key={s}
            onPress={() => updateStatus(s)}
            style={[styles.statusBtn, status === s && styles.statusBtnActive]}
          >
            <Text style={[styles.statusBtnText, status === s && { color: '#fff' }]}>
              {s === 'in_progress' ? 'Start Work / शुरू करें' : 'Mark Complete / पूर्ण करें'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.label}>Type Report / रिपोर्ट लिखें</Text>
      <TextInput
        style={styles.textArea}
        multiline
        numberOfLines={4}
        value={textReport}
        onChangeText={setTextReport}
        placeholder="यहाँ रिपोर्ट लिखें / Write report here"
      />

      <Text style={styles.label}>Audio Report / ऑडियो रिपोर्ट</Text>
      <TouchableOpacity
        onPress={isRecording ? stopRecording : startRecording}
        style={[styles.bigMicButton, isRecording && { backgroundColor: '#dc2626' }]}
      >
        <Text style={styles.bigMicText}>{isRecording ? '⏹ Stop' : '🎤 Record'}</Text>
      </TouchableOpacity>
      {audioPath && !isRecording && <Text style={styles.hint}>✓ Audio recorded / ऑडियो रिकॉर्ड हो गया</Text>}

      <Text style={styles.label}>Photos / फोटो</Text>
      <View style={{ flexDirection: 'row', marginBottom: 8 }}>
        <TouchableOpacity onPress={captureImage} style={styles.smallBtn}>
          <Text style={styles.smallBtnText}>📷 Camera</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={pickFromLibrary} style={[styles.smallBtn, { marginLeft: 8 }]}>
          <Text style={styles.smallBtnText}>🖼 Gallery</Text>
        </TouchableOpacity>
      </View>

      {images.length > 0 && (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 12 }}>
          {images.map((img, idx) => (
            <TouchableOpacity key={idx} onLongPress={() => removeImage(idx)}>
              <Image source={{ uri: img.uri }} style={styles.thumb} />
            </TouchableOpacity>
          ))}
        </View>
      )}

      <TouchableOpacity
        onPress={submitReport}
        disabled={submitting}
        style={[styles.submitBtn, submitting && { opacity: 0.6 }]}
      >
        <Text style={styles.submitBtnText}>
          {submitting ? 'Submitting... / जमा हो रहा है...' : 'Submit Report / रिपोर्ट जमा करें'}
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  title: { fontSize: 20, fontWeight: '700' },
  subtitle: { color: '#666', marginBottom: 12 },
  statusRow: { flexDirection: 'row', marginBottom: 20 },
  statusBtn: { borderWidth: 1, borderColor: '#2563eb', borderRadius: 8, padding: 10, marginRight: 8 },
  statusBtnActive: { backgroundColor: '#2563eb' },
  statusBtnText: { color: '#2563eb', fontWeight: '600' },
  label: { fontWeight: '600', marginBottom: 6, marginTop: 10 },
  textArea: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 10, minHeight: 100, textAlignVertical: 'top' },
  bigMicButton: { backgroundColor: '#2563eb', borderRadius: 50, paddingVertical: 18, alignItems: 'center', marginBottom: 6 },
  bigMicText: { color: '#fff', fontSize: 18, fontWeight: '700' },
  hint: { color: '#16a34a', marginBottom: 10 },
  smallBtn: { backgroundColor: '#eee', padding: 10, borderRadius: 8 },
  smallBtnText: { fontWeight: '600' },
  thumb: { width: 80, height: 80, borderRadius: 8, marginRight: 8, marginBottom: 8 },
  submitBtn: { backgroundColor: '#16a34a', borderRadius: 10, padding: 16, alignItems: 'center', marginTop: 10, marginBottom: 40 },
  submitBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
