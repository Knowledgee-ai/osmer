import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, View, Text, ActivityIndicator } from 'react-native';
import { apiJson } from '../../lib/api';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  modelUsed?: string | null;
  createdAt: string;
  senderName?: string | null;
}

export default function ConversationRead() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [msgs, setMsgs] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    apiJson<{ messages: Message[] }>(`/api/conversations/${id}/messages`)
      .then((j) => setMsgs(j.messages ?? []))
      .catch(() => { /* leave empty */ })
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <View style={{ flex: 1, justifyContent: 'center', backgroundColor: '#fafaf7' }}><ActivityIndicator /></View>;

  return (
    <ScrollView style={{ flex: 1, backgroundColor: '#fafaf7' }} contentContainerStyle={{ padding: 24 }}>
      {msgs.length === 0 ? (
        <Text style={{ color: '#7b6043' }}>No messages.</Text>
      ) : (
        msgs.map((m) => (
          <View key={m.id} style={{ marginBottom: 24 }}>
            <Text style={{ fontSize: 10, letterSpacing: 1, color: '#7b6043', marginBottom: 6 }}>
              {m.role.toUpperCase()}{m.senderName ? ` · ${m.senderName}` : ''}{m.modelUsed ? ` · ${m.modelUsed}` : ''}
            </Text>
            <Text style={{ fontSize: 15, color: '#2d2a26', lineHeight: 22 }}>{m.content}</Text>
          </View>
        ))
      )}
    </ScrollView>
  );
}
