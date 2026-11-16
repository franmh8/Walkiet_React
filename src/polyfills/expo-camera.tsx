import React from 'react';

export const CameraView: React.FC<any> = () => null;
export const requestCameraPermissionsAsync = async () => ({ granted: false, status: 'denied', canAskAgain: false });
export const getCameraPermissionsAsync = async () => ({ granted: false, status: 'denied', canAskAgain: false });

export const Camera = { getCameraPermissionsAsync, requestCameraPermissionsAsync };

export default {
  CameraView,
  Camera,
  requestCameraPermissionsAsync,
  getCameraPermissionsAsync,
};
