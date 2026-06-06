import { useState, useEffect, useRef } from 'react';
import { syncDataToCloud, loadDataFromCloud, subscribeToCloudData } from '../lib/firebase';
import { FavoriteItem, SessionData, Message } from '../types';

export function useStorage() {
  const [favorites, setFavorites] = useState<FavoriteItem[]>([]);
  const [pastConversations, setPastConversations] = useState<SessionData[]>([]);
  const [initialMessages, setInitialMessages] = useState<Message[] | null>(null);
  const [streak, setStreak] = useState(0);
  const [isLoaded, setIsLoaded] = useState(false);

  // Use a ref to track if we're currently processing a local save,
  // to avoid infinite sync loops when writing to Firebase triggers the snapshot
  const isLocalUpdateRef = useRef(false);

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;

    const initData = async () => {
      const cloudData = await loadDataFromCloud();

      const getLocalArray = (key: string) => {
        try {
          const val = localStorage.getItem(key);
          if (val) {
            const parsed = JSON.parse(val);
            if (Array.isArray(parsed)) return parsed;
          }
        } catch (e) {}
        return [];
      };

      const mergeArrays = (cloudArr: any[], localArr: any[]) => {
        const merged = [...(cloudArr || [])];
        let hasNew = false;
        if (Array.isArray(localArr)) {
          localArr.forEach(item => {
            // Find by id (loose equality in case id is string/number mismatch)
            if (!merged.find(c => c.id == item.id)) {
              merged.push(item);
              hasNew = true;
            }
          });
        }
        return { merged, hasNew };
      };

      // 1. Merge Favorites
      const cloudFavs = cloudData?.favorites || [];
      const localFavs = getLocalArray('favorites');
      const { merged: mergedFavs, hasNew: newFavsAdded } = mergeArrays(cloudFavs, localFavs);
      
      setFavorites(mergedFavs);
      localStorage.setItem('favorites', JSON.stringify(mergedFavs));
      if (newFavsAdded || !cloudData?.favorites) {
        await syncDataToCloud({ favorites: mergedFavs });
      }

      // 2. Merge Past Conversations
      const cloudPast = cloudData?.pastConversations || [];
      const localPast = getLocalArray('pastConversations');
      const { merged: mergedPast, hasNew: newPastAdded } = mergeArrays(cloudPast, localPast);
      
      setPastConversations(mergedPast);
      localStorage.setItem('pastConversations', JSON.stringify(mergedPast));
      if (newPastAdded || !cloudData?.pastConversations) {
        await syncDataToCloud({ pastConversations: mergedPast });
      }

      // 3. Handle Chat History (Prefer cloud, fallback to local)
      let initialChat = cloudData?.chatHistory;
      let newChatAdded = false;
      if (!initialChat || initialChat.length === 0) {
        const localChat = getLocalArray('chatHistory');
        if (localChat.length > 0) {
          initialChat = localChat;
          newChatAdded = true;
        } else {
          initialChat = [];
        }
      }
      
      if (initialChat && initialChat.length > 0) {
        setInitialMessages(initialChat);
      }
      localStorage.setItem('chatHistory', JSON.stringify(initialChat || []));
      if (newChatAdded || !cloudData?.chatHistory) {
        await syncDataToCloud({ chatHistory: initialChat || [] });
      }

      // 4. Handle Streak
      let initialStreak = cloudData?.streak;
      let initialLastActiveDate = cloudData?.lastActiveDate;

      if (initialStreak === undefined) {
        initialStreak = parseInt(localStorage.getItem('streak') || '0', 10);
      }
      if (!initialLastActiveDate) {
        initialLastActiveDate = localStorage.getItem('lastActiveDate');
      }

      const today = new Date().toLocaleDateString('en-CA');
      if (initialLastActiveDate === today) {
        setStreak(initialStreak);
      } else if (initialLastActiveDate) {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toLocaleDateString('en-CA');

        let newStreak = 1;
        if (initialLastActiveDate === yesterdayStr) {
          newStreak = initialStreak + 1;
        }

        setStreak(newStreak);
        localStorage.setItem('lastActiveDate', today);
        localStorage.setItem('streak', newStreak.toString());
        await syncDataToCloud({ streak: newStreak, lastActiveDate: today });
      } else {
        setStreak(1);
        localStorage.setItem('lastActiveDate', today);
        localStorage.setItem('streak', '1');
        await syncDataToCloud({ streak: 1, lastActiveDate: today });
      }
      
      setIsLoaded(true);

      // Start listening for real-time changes from other devices
      unsubscribe = subscribeToCloudData((data) => {
        // If we are currently processing a local save, ignore the echo
        if (isLocalUpdateRef.current) return;

        if (data.favorites) {
          setFavorites(data.favorites);
          localStorage.setItem('favorites', JSON.stringify(data.favorites));
        }
        if (data.pastConversations) {
          setPastConversations(data.pastConversations);
          localStorage.setItem('pastConversations', JSON.stringify(data.pastConversations));
        }
        if (data.chatHistory) {
          setInitialMessages(data.chatHistory); // Allow hot-swapping chat across devices
          localStorage.setItem('chatHistory', JSON.stringify(data.chatHistory));
        }
        if (data.streak !== undefined) {
          setStreak(data.streak);
          localStorage.setItem('streak', data.streak.toString());
        }
      });
    };

    initData();

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  const saveFavorites = (favsOrUpdater: FavoriteItem[] | ((prev: FavoriteItem[]) => FavoriteItem[])) => {
    isLocalUpdateRef.current = true;
    if (typeof favsOrUpdater === 'function') {
      setFavorites(prev => {
        const newFavs = favsOrUpdater(prev);
        localStorage.setItem('favorites', JSON.stringify(newFavs));
        syncDataToCloud({ favorites: newFavs }).then(() => { isLocalUpdateRef.current = false; });
        return newFavs;
      });
    } else {
      setFavorites(favsOrUpdater);
      localStorage.setItem('favorites', JSON.stringify(favsOrUpdater));
      syncDataToCloud({ favorites: favsOrUpdater }).then(() => { isLocalUpdateRef.current = false; });
    }
  };

  const savePastConversations = (past: SessionData[]) => {
    isLocalUpdateRef.current = true;
    setPastConversations(past);
    localStorage.setItem('pastConversations', JSON.stringify(past));
    syncDataToCloud({ pastConversations: past }).then(() => { isLocalUpdateRef.current = false; });
  };

  const saveMessages = (msgs: Message[]) => {
    isLocalUpdateRef.current = true;
    localStorage.setItem('chatHistory', JSON.stringify(msgs));
    syncDataToCloud({ chatHistory: msgs }).then(() => { isLocalUpdateRef.current = false; });
  };

  const clearMessages = () => {
    isLocalUpdateRef.current = true;
    localStorage.removeItem('chatHistory');
    syncDataToCloud({ chatHistory: [] }).then(() => { isLocalUpdateRef.current = false; });
  };

  return {
    favorites,
    saveFavorites,
    pastConversations,
    savePastConversations,
    initialMessages,
    saveMessages,
    clearMessages,
    streak,
    isLoaded
  };
}
