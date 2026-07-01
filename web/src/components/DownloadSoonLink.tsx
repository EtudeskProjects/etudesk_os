'use client';

import React, { useEffect, useState } from 'react';
import { ANDROID_URL, IOS_URL } from '../lib/site';

type Platform = 'ios' | 'android' | 'download';

interface Props {
  children: React.ReactNode;
  className?: string;
  platform?: Platform;
  onClick?: () => void;
}

declare global {
  interface Window {
    plausible?: (eventName: string, options?: { props?: Record<string, string> }) => void;
  }
}

function detectPlatform(): 'ios' | 'android' {
  if (typeof navigator === 'undefined') return 'ios';
  return /android/i.test(navigator.userAgent) ? 'android' : 'ios';
}

function getStoreUrl(platform: Platform, detectedPlatform: 'ios' | 'android'): string {
  if (platform === 'android') return ANDROID_URL;
  if (platform === 'download' && detectedPlatform === 'android') return ANDROID_URL;
  return IOS_URL;
}

function getTrackedPlatform(platform: Platform, detectedPlatform: 'ios' | 'android'): 'ios' | 'android' {
  if (platform === 'download') return detectedPlatform;
  return platform === 'android' ? 'android' : 'ios';
}

export default function DownloadSoonLink({ children, className, platform = 'download', onClick }: Props) {
  const [detectedPlatform, setDetectedPlatform] = useState<'ios' | 'android'>('ios');
  const trackedPlatform = getTrackedPlatform(platform, detectedPlatform);
  const href = getStoreUrl(platform, detectedPlatform);

  useEffect(() => {
    setDetectedPlatform(detectPlatform());
  }, []);

  const trackClick = () => {
    onClick?.();
    window.plausible?.('Store Download Click', {
      props: {
        platform: trackedPlatform,
        source_path: window.location.pathname,
      },
    });
  };

  return (
    <a
      href={href}
      className={className}
      target="_blank"
      rel="noopener noreferrer"
      onClick={trackClick}
      data-analytics-event="store_download_click"
      data-platform={trackedPlatform}
    >
      {children}
    </a>
  );
}
