import { useEffect, useState } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Tooltip,
  Typography,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import AddIcon from '@mui/icons-material/Add';
import type { SaveData } from '../lib/saveData';
import { deleteSaveSlot, getAllSaveSlots } from '../lib/saveDataDB';

const SLOT_COUNT = 3;

interface Props {
  onNewGame: (slotId: number) => void;
  onContinue: (save: SaveData) => void;
}

export default function StartScreen({ onNewGame, onContinue }: Props) {
  const [slots, setSlots] = useState<(SaveData | null)[]>(Array(SLOT_COUNT).fill(null));
  const [loading, setLoading] = useState(true);
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; slotId: number | null }>({ open: false, slotId: null });

  const reload = async () => {
    setLoading(true);
    setSlots(await getAllSaveSlots());
    setLoading(false);
  };

  useEffect(() => { reload(); }, []);

  const handleDelete = async () => {
    if (!deleteDialog.slotId) return;
    await deleteSaveSlot(deleteDialog.slotId);
    setDeleteDialog({ open: false, slotId: null });
    await reload();
  };

  return (
    <Box sx={{ minHeight: '100vh', background: 'linear-gradient(135deg, #0d0d1a 0%, #1a1a3e 60%, #0d1a2e 100%)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4, p: 3 }}>
      <Typography variant="h2" sx={{ color: '#e8d5a3', fontWeight: 'bold', letterSpacing: '0.15em', textShadow: '0 0 30px rgba(232,213,163,0.5)', mb: 1 }}>
        AKIRA YABO
      </Typography>
      <Typography variant="subtitle1" sx={{ color: '#8899aa', letterSpacing: '0.3em', mb: 2 }}>
        ─ セーブデータを選択 ─
      </Typography>

      {loading ? (
        <CircularProgress sx={{ color: '#e8d5a3' }} />
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, width: '100%', maxWidth: 520 }}>
          {slots.map((save, i) => {
            const slotId = i + 1;
            return (
              <Card key={slotId} sx={{ background: save ? 'linear-gradient(135deg, #1e2a3a 0%, #2a3a4e 100%)' : 'rgba(255,255,255,0.04)', border: save ? '1px solid #3a5a7a' : '1px dashed #334', borderRadius: 2, transition: 'box-shadow 0.2s', '&:hover': { boxShadow: '0 0 20px rgba(100,160,220,0.2)' } }}>
                <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2, p: 2, '&:last-child': { pb: 2 } }}>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography variant="caption" sx={{ color: '#556677' }}>スロット {slotId}</Typography>
                    {save ? (
                      <>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Typography variant="h6" sx={{ color: '#cce0f5', lineHeight: 1.2 }}>{save.playerName}</Typography>
                          <Typography variant="caption" sx={{ color: '#557799', fontSize: '0.7rem' }}>
                            {save.ownedProvinces.length}国支配
                          </Typography>
                        </Box>
                        <Typography variant="body2" sx={{ color: '#8899aa' }}>
                          {save.year}年{save.month}月 ／ 兵士:{save.soldiers.toLocaleString()} ／ 金:{save.gold.toLocaleString()}
                        </Typography>
                        <Typography variant="caption" sx={{ color: '#445566' }}>
                          プレイ時間: {save.playtimeFormatted} ／ {save.updatedAt.toLocaleString('ja-JP')}
                        </Typography>
                      </>
                    ) : (
                      <Typography variant="body2" sx={{ color: '#445566', mt: 0.5 }}>─ 空きスロット ─</Typography>
                    )}
                  </Box>

                  <Box sx={{ display: 'flex', gap: 1 }}>
                    {save ? (
                      <>
                        <Tooltip title="続きから再開">
                          <Button variant="contained" size="small" onClick={() => onContinue(save)}
                            sx={{ minWidth: 0, px: 1.5, background: '#2a5a8a', '&:hover': { background: '#3a7abc' } }}>
                            <PlayArrowIcon fontSize="small" />
                          </Button>
                        </Tooltip>
                        <Tooltip title="削除">
                          <Button variant="outlined" size="small" color="error"
                            onClick={() => setDeleteDialog({ open: true, slotId })}
                            sx={{ minWidth: 0, px: 1.5, borderColor: '#5a2a2a', color: '#cc6666', '&:hover': { borderColor: '#cc4444' } }}>
                            <DeleteIcon fontSize="small" />
                          </Button>
                        </Tooltip>
                      </>
                    ) : (
                      <Tooltip title="新しいゲーム（大名選択へ）">
                        <Button variant="outlined" size="small" onClick={() => onNewGame(slotId)}
                          sx={{ minWidth: 0, px: 1.5, borderColor: '#3a5a3a', color: '#66aa66', '&:hover': { borderColor: '#44aa44' } }}>
                          <AddIcon fontSize="small" />
                        </Button>
                      </Tooltip>
                    )}
                  </Box>
                </CardContent>
              </Card>
            );
          })}
        </Box>
      )}

      <Dialog open={deleteDialog.open} onClose={() => setDeleteDialog({ open: false, slotId: null })}>
        <DialogTitle>セーブデータを削除</DialogTitle>
        <DialogContent>
          <DialogContentText>スロット {deleteDialog.slotId} のデータを削除しますか？この操作は元に戻せません。</DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialog({ open: false, slotId: null })}>キャンセル</Button>
          <Button onClick={handleDelete} color="error" variant="contained">削除</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
