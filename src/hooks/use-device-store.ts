'use client';

import {useSyncExternalStore} from 'react';
import {readStore, subscribeToStore, type DeviceStore} from '@/lib/device-store';

const serverSnapshot = () => null;

/** The device store, live. null during server rendering and the first client render. */
export function useDeviceStore(): DeviceStore | null {
  return useSyncExternalStore(subscribeToStore, readStore, serverSnapshot);
}
