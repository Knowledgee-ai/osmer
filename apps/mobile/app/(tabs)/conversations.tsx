import { useEffect, useState } from 'react';
import { FlatList, View, Text, Pressable, ActivityIndicator, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { apiJson } from '../../lib/api';

interface Conversation {
  id: string;
  title: string;
  updatedAt: string;
}

export default function ConversationsTab() {
  const [items, setItems] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const router = useRouter();

  async function load() {
    setErr(null);
    try {
      const j = await apiJson<{ conversations: Conversation[] }>('/api/conversations');
      setItems(j.conversations ?? []);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to load.');
    } finally {
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
      keyExtractor={(c) => c.id}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(); }} />}
      ListEmptyComponent={
        err ? (
          <Text style={{ padding: 32, color: '#c2683f' }}>{err}</Text>
        ) : (
          <Text style={{ padding: 32, color: '#7b6043' }}>No conversations yet.</Text>
        )
      }
      renderItem={({ item }) => (
        <Pressable
          onPress={() => router.push(`/conversation/${item.id}`)}
          style={{ paddingHorizontal: 24, paddingVertical: 18, borderBottomWidth: 1, borderBottomColor: '#e8e3d8' }}
        >
          <Text style={{ fontSize: 16, color: '#2d2a26' }} numberOfLines={1}>{item.title}</Text>
          <Text style={{ fontSize: 12, color: '#7b6043', marginTop: 4 }}>
            {new Date(item.updatedAt).toLocaleString()}
          </Text>
        </Pressable>
      )}
    />
  );
}
