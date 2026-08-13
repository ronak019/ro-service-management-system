// screens/JobsListScreen.js
import React, { useCallback, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, RefreshControl, ActivityIndicator } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { apiFetch, clearTokens } from '../lib/api';

const STATUS_COLORS = {
  pending: '#f59e0b',
  in_progress: '#2563eb',
  completed: '#16a34a',
  cancelled: '#6b7280',
};

export default function JobsListScreen({ navigation }) {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  async function load() {
    try {
      const data = await apiFetch('/jobs');
      setJobs(data.jobs);
    } catch (e) {
      if (e.message === 'SESSION_EXPIRED') {
        navigation.replace('Login');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useFocusEffect(
    useCallback(() => {
      load();
    }, [])
  );

  return (
    <View style={{ flex: 1, backgroundColor: '#f9fafb' }}>
      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={jobs}
          keyExtractor={(j) => String(j.id)}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                load();
              }}
            />
          }
          contentContainerStyle={{ padding: 12 }}
          ListEmptyComponent={
            <Text style={{ textAlign: 'center', marginTop: 40, color: '#666' }}>
              No jobs assigned yet / अभी तक कोई काम नहीं
            </Text>
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              onPress={() => navigation.navigate('JobDetail', { job: item })}
              style={{
                backgroundColor: '#fff',
                borderRadius: 10,
                padding: 14,
                marginBottom: 10,
                borderLeftWidth: 4,
                borderLeftColor: STATUS_COLORS[item.status] || '#999',
              }}
            >
              <Text style={{ fontWeight: '700', fontSize: 16 }}>{item.customer_name}</Text>
              <Text style={{ color: '#555' }}>{item.address}, {item.city}</Text>
              <Text style={{ color: '#888', marginTop: 4 }}>
                {new Date(item.scheduled_at).toLocaleString('en-IN')}
              </Text>
              <Text style={{ marginTop: 6, fontWeight: '600', color: STATUS_COLORS[item.status] }}>
                {item.status.replace('_', ' ').toUpperCase()}
              </Text>
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
}
