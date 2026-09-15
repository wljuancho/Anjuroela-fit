import React, { useEffect, useState } from 'react';
import { checkForAppUpdate } from '../services/updateService';
import type { UpdateInfo } from '../services/updateService';
import UpdateModal from './UpdateModal';

// Comprueba en caliente si hay una versión nueva del APK y, si la hay,
// muestra el modal de descarga directa (sin bloquear la app).
export default function UpdateCheckManager() {
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);

  useEffect(() => {
    let active = true;
    checkForAppUpdate().then((info) => {
      if (active) setUpdateInfo(info);
    });
    return () => {
      active = false;
    };
  }, []);

  return (
    <UpdateModal
      visible={updateInfo != null}
      info={updateInfo}
      onClose={() => setUpdateInfo(null)}
    />
  );
}