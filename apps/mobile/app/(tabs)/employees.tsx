import { useEffect, useState } from 'react';
import { FlatList, View, Text, Pressable, ActivityIndicator, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { apiJson } from '../../lib/api';

interface Employee {
  id: string;
  name: string;
  description: string;
}

export default function EmployeesTab() {
  const [items, setItems] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const router = useRouter();

  async function load() {
    try {
      const j = await apiJson<{ employees: Employee[] }>('/api/employees');
      setItems(j.employees ?? []);
    } catch { /* leave empty */ } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => { void load(); }, []);

  if (loading) return <View style={{ flex: 1, justifyContent: 'center', backgroundColor: '#fafaf7' }}><ActivityIndicator /></View>;

  return (
    <FlatList
      style={{ backgroundColor: '#fafaf7' }}
      data={items}
      keyExtractor={(e) => e.id}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(); }} />}
      ListEmptyComponent={<Text style={{ padding: 32, color: '#7b6043' }}>No AI Employees yet.</Text>}
      renderItem={({ item }) => (
        <Pressable
          onPress={() => router.push(`/run/${item.id}`)}
          style={{ paddingHorizontal: 24, paddingVertical: 18, borderBottomWidth: 1, borderBottomColor: '#e8e3d8' }}
        >
          <Text style={{ fontSize: 16, color: '#2d2a26' }}>{item.name}</Text>
          <Text style={{ fontSize: 13, color: '#7b6043', marginTop: 4 }} numberOfLines={2}>
            {item.description}
          </Text>
        </Pressable>
      )}
    />
  );
}
