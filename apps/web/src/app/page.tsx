'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { useGameSocket } from '@/hooks/useGameSocket';
import { useSessionStore } from '@/store/sessionStore';
import { JoinScreen } from '@/components/join/JoinScreen';
import { Board } from '@/components/board/Board';
import { TopBar } from '@/components/hud/TopBar';
import { Leaderboard } from '@/components/hud/Leaderboard';
import { ActivityFeed } from '@/components/hud/ActivityFeed';
import { CooldownIndicator } from '@/components/hud/CooldownIndicator';
import { Toaster } from '@/components/ui/Toaster';

export default function Home() {
  useGameSocket();
  const joined = useSessionStore((s) => s.joined);

  return (
    <main className="relative h-dvh w-screen overflow-hidden">
      <AnimatePresence mode="wait">
        {!joined ? (
          <motion.div key="join" exit={{ opacity: 0 }} transition={{ duration: 0.3 }}>
            <JoinScreen />
          </motion.div>
        ) : (
          <motion.div key="board" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4 }}>
            <Board />
            <TopBar />
            <aside className="fixed bottom-6 right-4 top-20 z-30 hidden w-72 flex-col gap-3 lg:flex">
              <Leaderboard />
              <ActivityFeed />
            </aside>
            <CooldownIndicator />
          </motion.div>
        )}
      </AnimatePresence>
      <Toaster />
    </main>
  );
}
