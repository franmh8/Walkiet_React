import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Modal, View, Text, TouchableOpacity, Platform } from 'react-native';
import { TrashIcon, AlertTriangleIcon, CheckCircleIcon, ShieldIcon } from '../icons';

export function useNativeFeedback(isBusy = false) {
  // Modal de Alerta y Confirmación Táctica C5i (reemplaza window.confirm y Alert.alert)
  const [tacticalAlertModal, setTacticalAlertModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    type: 'confirm_delete' | 'warning' | 'info' | 'success';
    confirmText?: string;
    cancelText?: string;
    onConfirm?: () => void;
    onCancel?: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    type: 'info',
  });

  const showTacticalAlert = useCallback((
    title: string,
    message: string,
    options?: {
      type?: 'confirm_delete' | 'warning' | 'info' | 'success';
      confirmText?: string;
      cancelText?: string;
      onConfirm?: () => void;
      onCancel?: () => void;
    }
  ) => {
    setTacticalAlertModal({
      isOpen: true,
      title,
      message,
      type: options?.type || 'info',
      confirmText: options?.confirmText || (options?.onConfirm ? 'Confirmar' : 'Entendido'),
      cancelText: options?.cancelText || (options?.onConfirm ? 'Cancelar' : undefined),
      onConfirm: options?.onConfirm,
      onCancel: options?.onCancel,
    });
  }, []);

  // Notificación Toast flotante táctica C5i
  const [tacticalToast, setTacticalToast] = useState<{
    visible: boolean;
    message: string;
    type: 'success' | 'info' | 'warning';
  }>({
    visible: false,
    message: '',
    type: 'info',
  });
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (toastTimerRef.current) clearTimeout(toastTimerRef.current); }, []);

  const showTacticalToast = useCallback((message: string, type: 'success' | 'info' | 'warning' = 'success') => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setTacticalToast({ visible: true, message, type });
    toastTimerRef.current = setTimeout(() => {
      setTacticalToast((prev) => ({ ...prev, visible: false }));
    }, 2800);
  }, []);


  const closeAlert = () => setTacticalAlertModal(prev => ({ ...prev, isOpen: false }));
  const feedback = (<>
      {/* 8b. MODAL DE ALERTA Y CONFIRMACIÓN TÁCTICA C5I (REEMPLAZA ALERT.ALERT Y WINDOW.CONFIRM) */}
      {tacticalAlertModal.isOpen && (
      <Modal
        visible={tacticalAlertModal.isOpen}
        animationType="fade"
        transparent
        onRequestClose={() => {
          if (isBusy) return;
          tacticalAlertModal.onCancel?.();
          setTacticalAlertModal((prev) => ({ ...prev, isOpen: false }));
        }}
      >
        <View style={{
          flex: 1,
          backgroundColor: 'rgba(15, 23, 42, 0.75)',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 24,
        }}>
          <View style={{
            width: '100%',
            maxWidth: 380,
            backgroundColor: '#ffffff',
            borderRadius: 24,
            padding: 24,
            alignItems: 'center',
            shadowColor: '#000000',
            shadowOffset: { width: 0, height: 10 },
            shadowOpacity: 0.25,
            shadowRadius: 20,
            elevation: 10,
            borderWidth: 1,
            borderColor: tacticalAlertModal.type === 'confirm_delete' ? '#fecdd3' : '#e2e8f0',
          }}>
            {/* Tactical Badge Icon */}
            <View style={{
              width: 64,
              height: 64,
              borderRadius: 32,
              backgroundColor: tacticalAlertModal.type === 'confirm_delete' ? '#fee2e2' : '#fdf2f4',
              borderWidth: 2,
              borderColor: tacticalAlertModal.type === 'confirm_delete' ? '#fca5a5' : '#fbcfe8',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 16,
            }}>
              {tacticalAlertModal.type === 'confirm_delete' ? (
                <TrashIcon size={30} color="#dc2626" strokeWidth={2.2} />
              ) : tacticalAlertModal.type === 'warning' ? (
                <AlertTriangleIcon size={30} color="#d97706" strokeWidth={2.2} />
              ) : tacticalAlertModal.type === 'success' ? (
                <CheckCircleIcon size={30} color="#059669" strokeWidth={2.2} />
              ) : (
                <ShieldIcon size={30} color="#6b1d2f" strokeWidth={2.2} />
              )}
            </View>

            {/* Title */}
            <Text style={{
              fontSize: 18,
              fontWeight: '800',
              color: '#0f172a',
              textAlign: 'center',
              marginBottom: 8,
              letterSpacing: -0.3,
            }}>
              {tacticalAlertModal.title}
            </Text>

            {/* Message */}
            <Text style={{
              fontSize: 14,
              lineHeight: 20,
              color: '#475569',
              textAlign: 'center',
              marginBottom: 22,
            }}>
              {tacticalAlertModal.message}
            </Text>

            {/* Buttons */}
            <View style={{ width: '100%', gap: 10 }}>
              {tacticalAlertModal.onConfirm ? (
                <>
                  <TouchableOpacity
                    style={{
                      width: '100%',
                      backgroundColor: tacticalAlertModal.type === 'confirm_delete' ? '#dc2626' : '#6b1d2f',
                      paddingVertical: 13,
                      borderRadius: 14,
                      alignItems: 'center',
                      justifyContent: 'center',
                      shadowColor: tacticalAlertModal.type === 'confirm_delete' ? '#dc2626' : '#6b1d2f',
                      shadowOpacity: 0.3,
                      shadowRadius: 6,
                      elevation: 3,
                    }}
                    accessibilityLabel="Confirmar acción"
                    disabled={isBusy}
                    onPress={() => {
                      if (!isBusy) tacticalAlertModal.onConfirm?.();
                    }}
                    activeOpacity={0.85}
                  >
                    <Text style={{ color: '#ffffff', fontWeight: '800', fontSize: 14 }}>
                      {isBusy ? 'Eliminando…' : tacticalAlertModal.confirmText || 'Confirmar'}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={{
                      width: '100%',
                      backgroundColor: '#f8fafc',
                      borderWidth: 1,
                      borderColor: '#e2e8f0',
                      paddingVertical: 12,
                      borderRadius: 14,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                    disabled={isBusy}
                    onPress={() => {
                      if (isBusy) return;
                      tacticalAlertModal.onCancel?.();
                      setTacticalAlertModal((prev) => ({ ...prev, isOpen: false }));
                    }}
                    activeOpacity={0.7}
                  >
                    <Text style={{ color: '#64748b', fontWeight: '700', fontSize: 14 }}>
                      {tacticalAlertModal.cancelText || 'Cancelar'}
                    </Text>
                  </TouchableOpacity>
                </>
              ) : (
                <TouchableOpacity
                  style={{
                    width: '100%',
                    backgroundColor: '#6b1d2f',
                    paddingVertical: 13,
                    borderRadius: 14,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                  onPress={() => {
                    setTacticalAlertModal((prev) => ({ ...prev, isOpen: false }));
                  }}
                  activeOpacity={0.85}
                >
                  <Text style={{ color: '#ffffff', fontWeight: '800', fontSize: 14 }}>
                    {tacticalAlertModal.confirmText || 'Entendido'}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
      </Modal>
      )}

      {/* 8c. TOAST TÁCTICO FLOTANTE C5I */}
      {tacticalToast.visible && (
        <View style={{
          position: 'absolute',
          top: Platform.OS === 'web' ? 24 : 50,
          left: 20,
          right: 20,
          zIndex: 999999,
          alignItems: 'center',
          pointerEvents: 'none',
        }}>
          <View style={{
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: tacticalToast.type === 'warning' ? '#991b1b' : '#0f172a',
            paddingHorizontal: 18,
            paddingVertical: 11,
            borderRadius: 30,
            gap: 10,
            shadowColor: '#000000',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.35,
            shadowRadius: 10,
            elevation: 8,
            borderWidth: 1,
            borderColor: tacticalToast.type === 'warning' ? '#f87171' : '#334155',
          }}>
            {tacticalToast.type === 'warning' ? (
              <TrashIcon size={16} color="#fca5a5" strokeWidth={2.4} />
            ) : (
              <CheckCircleIcon size={16} color="#34d399" strokeWidth={2.4} />
            )}
            <Text style={{ color: '#ffffff', fontSize: 13, fontWeight: '700' }}>
              {tacticalToast.message}
            </Text>
          </View>
        </View>
      )}


  </>);
  return { showTacticalAlert, showTacticalToast, closeAlert, feedback };
}
