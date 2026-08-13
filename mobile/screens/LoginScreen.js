// screens/LoginScreen.js
import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { API_BASE_URL, saveTokens } from '../lib/api';

export default function LoginScreen({ navigation }) {
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    if (!phone || !password) {
      Alert.alert('Missing info / जानकारी अधूरी है', 'Enter phone and password.');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Login failed');
      if (data.user.role !== 'technician') {
        throw new Error('This app is for technicians only / यह ऐप केवल तकनीशियनों के लिए है');
      }
      await saveTokens(data.accessToken, data.refreshToken);
      navigation.replace('JobsList');
    } catch (e) {
      Alert.alert('Login failed / लॉगिन विफल', e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={{ flex: 1, justifyContent: 'center', padding: 24, backgroundColor: '#fff' }}>
      <Text style={{ fontSize: 24, fontWeight: 'bold', marginBottom: 4 }}>Technician Login</Text>
      <Text style={{ fontSize: 14, color: '#666', marginBottom: 24 }}>तकनीशियन लॉगिन</Text>

      <TextInput
        placeholder="Phone / फ़ोन नंबर"
        value={phone}
        onChangeText={setPhone}
        keyboardType="phone-pad"
        style={{ borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 12, marginBottom: 12 }}
      />
      <TextInput
        placeholder="Password / पासवर्ड"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        style={{ borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 12, marginBottom: 20 }}
      />

      <TouchableOpacity
        onPress={handleLogin}
        disabled={loading}
        style={{ backgroundColor: '#2563eb', padding: 14, borderRadius: 8, alignItems: 'center', opacity: loading ? 0.6 : 1 }}
      >
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#fff', fontWeight: '600' }}>Login / लॉगिन करें</Text>}
      </TouchableOpacity>
    </View>
  );
}
