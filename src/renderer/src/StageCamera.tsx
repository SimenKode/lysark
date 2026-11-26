// The camera circle on the editor's stage: the film that was taken while
// the slide was read in, at the moment the sound panel stands at. Dragging
// it changes where it stands from that moment.
import { useState } from 'react';
import { mediaUrl } from '../../shared/api';
import { setCameraPlace } from '../../shared/audio/edit';
import type { Scene } from '../../shared/format/schema';
import {
  CAMERA_DIAMETER,
  cameraFilmAt,
  cameraOnStage,
  cameraPlaceAt,
  defaultCameraPlace,
} from '../../shared/render/clock';
import { CameraCircle } from './CameraCircle';
import { useStage, useStore } from './store';

export function StageCamera({ scene }: { scene: Scene }) {
  const assets = useStore((s) => s.project?.assets);
  const soundAt = useStore((s) => s.soundAt);
  const updateScene = useStore((s) => s.updateScene);
  const [dragged, setDragged] = useState<{ x: number; y: number } | null>(null);
  const stage = useStage();
  const t = soundAt?.t ?? 0;
  const film = assets && cameraFilmAt(scene, assets, t);
  const asset = film && assets[film.asset];
  if (!film || !asset) return null;
  const size = scene.camera?.size ?? defaultCameraPlace().size;
  const place = dragged ?? cameraPlaceAt(scene, t, undefined, stage);
  return (
    <CameraCircle
      x={place.x}
      y={place.y}
      diameter={CAMERA_DIAMETER[size]}
      film={{ url: mediaUrl(asset.file), time: film.time, playing: soundAt?.playing ?? false }}
      keyboard
      onMove={(x, y, part) => {
        if (part === 'start') return;
        const at = cameraOnStage(x, y, size, stage);
        if (part === 'move') {
          setDragged(at);
          return;
        }
        setDragged(null);
        updateScene((s) => setCameraPlace(s, t, at), `camera-${scene.id}`);
      }}
    />
  );
}
