import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { Alert, AlertType, AlertButton } from '../components/ui/Alert';

interface AlertOptions {
  type?: AlertType;
  title: string;
  message?: string;
  buttons?: AlertButton[];
  dismissable?: boolean;
}

interface AlertContextType {
  // Simple methods
  alert: (title: string, message?: string) => Promise<void>;
  success: (title: string, message?: string) => Promise<void>;
  error: (title: string, message?: string) => Promise<void>;
  warning: (title: string, message?: string) => Promise<void>;
  info: (title: string, message?: string) => Promise<void>;

  // Confirm with boolean return
  confirm: (title: string, message?: string) => Promise<boolean>;

  // Custom alert with full options
  showAlert: (options: AlertOptions) => Promise<void>;

  // Hide current alert
  hideAlert: () => void;
}

const AlertContext = createContext<AlertContextType | undefined>(undefined);

interface AlertProviderProps {
  children: ReactNode;
}

interface AlertState extends AlertOptions {
  visible: boolean;
  resolve?: (value: any) => void;
}

export function AlertProvider({ children }: AlertProviderProps) {
  const [alertState, setAlertState] = useState<AlertState>({
    visible: false,
    title: '',
  });

  const hideAlert = useCallback(() => {
    setAlertState((prev) => ({ ...prev, visible: false }));
  }, []);

  const showAlert = useCallback((options: AlertOptions): Promise<void> => {
    return new Promise((resolve) => {
      setAlertState({
        ...options,
        visible: true,
        resolve: () => resolve(),
      });
    });
  }, []);

  const alert = useCallback((title: string, message?: string): Promise<void> => {
    return showAlert({
      type: 'info',
      title,
      message,
      buttons: [{ text: 'OK' }],
    });
  }, [showAlert]);

  const success = useCallback((title: string, message?: string): Promise<void> => {
    return showAlert({
      type: 'success',
      title,
      message,
      buttons: [{ text: 'OK' }],
    });
  }, [showAlert]);

  const error = useCallback((title: string, message?: string): Promise<void> => {
    return showAlert({
      type: 'error',
      title,
      message,
      buttons: [{ text: 'OK' }],
    });
  }, [showAlert]);

  const warning = useCallback((title: string, message?: string): Promise<void> => {
    return showAlert({
      type: 'warning',
      title,
      message,
      buttons: [{ text: 'OK' }],
    });
  }, [showAlert]);

  const info = useCallback((title: string, message?: string): Promise<void> => {
    return showAlert({
      type: 'info',
      title,
      message,
      buttons: [{ text: 'OK' }],
    });
  }, [showAlert]);

  const confirm = useCallback((title: string, message?: string): Promise<boolean> => {
    return new Promise((resolve) => {
      setAlertState({
        type: 'confirm',
        title,
        message,
        visible: true,
        dismissable: false,
        buttons: [
          {
            text: 'Annuler',
            style: 'cancel',
            onPress: () => resolve(false),
          },
          {
            text: 'Confirmer',
            onPress: () => resolve(true),
          },
        ],
      });
    });
  }, []);

  const handleClose = useCallback(() => {
    alertState.resolve?.(undefined);
    hideAlert();
  }, [alertState.resolve, hideAlert]);

  return (
    <AlertContext.Provider
      value={{
        alert,
        success,
        error,
        warning,
        info,
        confirm,
        showAlert,
        hideAlert,
      }}
    >
      {children}
      <Alert
        visible={alertState.visible}
        type={alertState.type}
        title={alertState.title}
        message={alertState.message}
        buttons={alertState.buttons}
        dismissable={alertState.dismissable}
        onClose={handleClose}
      />
    </AlertContext.Provider>
  );
}

export function useAlert(): AlertContextType {
  const context = useContext(AlertContext);
  if (!context) {
    throw new Error('useAlert must be used within an AlertProvider');
  }
  return context;
}
