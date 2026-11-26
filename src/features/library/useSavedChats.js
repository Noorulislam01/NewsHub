import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../../shared/supabase/client.js';

const TABLE = 'saved_chats';
const CHAT_COLUMNS = 'id,title,messages,created_at,updated_at';

function describeChatError(error, action) {
  if (error?.code === 'PGRST205') {
    return `Could not ${action} chats: the public.saved_chats table is missing from this Supabase project. Run supabase/migrations/202611260001_saved_chats.sql in this project's SQL Editor.`;
  }
  return `Could not ${action} chats: ${error?.message || 'request failed'}`;
}

export function useSavedChats(auth) {
  const [savedChats, setSavedChats] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const activeUserId = useRef(auth.user?.id || null);
  const requestId = useRef(0);

  useEffect(() => {
    if (auth.loading) return;
    const request = ++requestId.current;
    const userId = auth.user?.id || null;
    activeUserId.current = userId;
    setError('');

    if (!userId || !supabase) {
      setSavedChats([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    async function loadChats() {
      try {
        const { data, error: loadError } = await supabase
          .from(TABLE)
          .select(CHAT_COLUMNS)
          .eq('user_id', userId)
          .order('updated_at', { ascending: false });
        if (loadError) throw loadError;
        if (request === requestId.current) setSavedChats(data || []);
      } catch (loadError) {
        if (request === requestId.current) setError(describeChatError(loadError, 'load'));
      } finally {
        if (request === requestId.current) setLoading(false);
      }
    }
    loadChats();
  }, [auth.loading, auth.user?.id]);

  const saveChat = useCallback(async chat => {
    const userId = activeUserId.current;
    if (!userId || !supabase) return null;
    try {
      const { data, error: saveError } = await supabase
        .from(TABLE)
        .upsert({
          id: chat.id,
          user_id: userId,
          title: String(chat.title || 'News chat').slice(0, 180),
          messages: chat.messages,
          updated_at: new Date().toISOString()
        })
        .select(CHAT_COLUMNS)
        .single();
      if (saveError) throw saveError;
      if (activeUserId.current === userId) {
        setSavedChats(current => [data, ...current.filter(item => item.id !== data.id)]
          .sort((left, right) => Date.parse(right.updated_at) - Date.parse(left.updated_at)));
        setError('');
      }
      return data;
    } catch (saveError) {
      if (activeUserId.current === userId) setError(describeChatError(saveError, 'save'));
      return null;
    }
  }, []);

  return { savedChats, loading, error, saveChat };
}
