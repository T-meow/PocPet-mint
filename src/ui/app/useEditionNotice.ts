import { useEffect, useState } from 'react';
import { editionNoticeKey, readEditionNotice, recordEditionNoticeShown, shouldShowEditionNotice } from '../../core/editionNotice';

export const useEditionNotice = (enabled = true) => {
  const [visible, setVisible] = useState(() => enabled && document.visibilityState === 'visible' && shouldShowEditionNotice(readEditionNotice()));
  useEffect(() => {
    if (!enabled) return;
    const inspect = () => {
      if (document.visibilityState === 'visible' && shouldShowEditionNotice(readEditionNotice())) setVisible(true);
    };
    const onStorage = (event: StorageEvent) => {
      if (event.key === editionNoticeKey || event.key === null) inspect();
    };
    inspect();
    const timer = window.setInterval(inspect, 30_000);
    document.addEventListener('visibilitychange', inspect);
    window.addEventListener('focus', inspect);
    window.addEventListener('storage', onStorage);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', inspect);
      window.removeEventListener('focus', inspect);
      window.removeEventListener('storage', onStorage);
    };
  }, [enabled]);
  const dismiss = () => {
    // A dialog left open across midnight also counts for the day it is closed.
    recordEditionNoticeShown();
    setVisible(false);
  };
  return { visible, dismiss };
};
