import { useState } from 'react';
import { CssBaseline, ThemeProvider, createTheme } from '@mui/material';
import StartScreen from './screens/StartScreen';
import DaimyoSelectScreen from './screens/DaimyoSelectScreen';
import GameScreen from './screens/GameScreen';
import MapEditorScreen from './screens/MapEditorScreen';
import { getDaimyo, DAIMYO_LIST } from './data/gameData';
import { INITIAL_PARAMS } from './data/retainerData';
import { createNewSave } from './lib/saveDataDB';
import type { SaveData } from './lib/saveData';

const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: { main: '#4a8abc' },
    background: { default: '#0d0d1a', paper: '#1a1a2e' },
  },
  typography: { fontFamily: '"Noto Sans JP", "Roboto", sans-serif' },
});

type Screen =
  | { type: 'start' }
  | { type: 'daimyo-select'; slotId: number }
  | { type: 'game'; save: SaveData }
  | { type: 'map-editor' };

export default function App() {
  const [screen, setScreen] = useState<Screen>({ type: 'start' });

  const handleGameStart = async (daimyoId: string) => {
    if (screen.type !== 'daimyo-select') return;
    const daimyo = getDaimyo(daimyoId)!;
    const params = INITIAL_PARAMS[daimyoId] ?? INITIAL_PARAMS['oda'];
    const save = await createNewSave(screen.slotId, daimyoId, daimyo.name, {
      ...params,
      homeProvinceId: daimyo.homeProvinceId,
    });
    setScreen({ type: 'game', save });
  };

  // playerName から daimyoId を復元する（旧フォーマットのセーブ対応）
  const handleContinue = (save: SaveData) => {
    const matched = DAIMYO_LIST.find((d) => d.name === save.playerName);
    if (matched) save.daimyoId = matched.id;
    setScreen({ type: 'game', save });
  };

  const wrap = (child: React.ReactNode) => (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      {child}
    </ThemeProvider>
  );

  switch (screen.type) {
    case 'start':
      return wrap(
        <StartScreen
          onNewGame={(slotId) => setScreen({ type: 'daimyo-select', slotId })}
          onContinue={handleContinue}
          onOpenMapEditor={() => setScreen({ type: 'map-editor' })}
        />,
      );
    case 'daimyo-select':
      return wrap(
        <DaimyoSelectScreen
          onBack={() => setScreen({ type: 'start' })}
          onStart={handleGameStart}
        />,
      );
    case 'game':
      return wrap(
        <GameScreen
          save={screen.save}
          onReturnToTitle={() => setScreen({ type: 'start' })}
        />,
      );
    case 'map-editor':
      return wrap(
        <MapEditorScreen
          onBack={() => setScreen({ type: 'start' })}
        />,
      );
  }
}
