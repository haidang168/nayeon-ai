import { useState, useEffect } from 'react';
import { syncDataToCloud, loadDataFromCloud } from '../lib/firebase';
import { FavoriteItem, SessionData, Message } from '../types';

export function useStorage() {
  const [favorites, setFavorites] = useState<FavoriteItem[]>([]);
  const [pastConversations, setPastConversations] = useState<SessionData[]>([]);
  const [initialMessages, setInitialMessages] = useState<Message[] | null>(null);
  const [streak, setStreak] = useState(0);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const initData = async () => {
      const cloudData = await loadDataFromCloud();

      let initialFavs = cloudData?.favorites;
      let initialPast = cloudData?.pastConversations;
      let initialChat = cloudData?.chatHistory;
      let initialStreak = cloudData?.streak;
      let initialLastActiveDate = cloudData?.lastActiveDate;

      if (!initialFavs) {
        const savedFavs = localStorage.getItem('favorites');
        if (savedFavs) { try { initialFavs = JSON.parse(savedFavs); } catch (e) { } }
      }
      if (!initialPast) {
        const savedPast = localStorage.getItem('pastConversations');
        if (savedPast) { try { initialPast = JSON.parse(savedPast); } catch (e) { } }
      }
      if (!initialChat) {
        const savedChat = localStorage.getItem('chatHistory');
        if (savedChat) { try { initialChat = JSON.parse(savedChat); } catch (e) { } }
      }
      if (initialStreak === undefined) {
        initialStreak = parseInt(localStorage.getItem('streak') || '0', 10);
      }
      if (!initialLastActiveDate) {
        initialLastActiveDate = localStorage.getItem('lastActiveDate');
      }

      if (initialFavs) setFavorites(initialFavs);
      if (initialPast) setPastConversations(initialPast);
      if (initialChat && initialChat.length > 0) setInitialMessages(initialChat);

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
        syncDataToCloud({ streak: newStreak, lastActiveDate: today });
      } else {
        setStreak(1);
        localStorage.setItem('lastActiveDate', today);
        localStorage.setItem('streak', '1');
        syncDataToCloud({ streak: 1, lastActiveDate: today });
      }
      setIsLoaded(true);
    };

    initData();
  }, []);

  const saveFavorites = (favs: FavoriteItem[]) => {
    setFavorites(favs);
    localStorage.setItem('favorites', JSON.stringify(favs));
    syncDataToCloud({ favorites: favs });
  };

  const savePastConversations = (past: SessionData[]) => {
    setPastConversations(past);
    localStorage.setItem('pastConversations', JSON.stringify(past));
    syncDataToCloud({ pastConversations: past });
  };

  const saveMessages = (msgs: Message[]) => {
    localStorage.setItem('chatHistory', JSON.stringify(msgs));
    syncDataToCloud({ chatHistory: msgs });
  };

  const clearMessages = () => {
    localStorage.removeItem('chatHistory');
    syncDataToCloud({ chatHistory: [] });
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
