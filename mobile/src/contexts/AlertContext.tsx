import React, { createContext, useContext, useState, useCallback, ReactNode, useEffect } from 'react';
import { Alert, AlertType, AlertButton } from '../components/ui/Alert';
import { PromptModal, PromptModalOptions } from '../components/ui/PromptModal';

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

  // Prompt with text return
  prompt: (title: string, message?: string, options?: PromptModalOptions) => Promise<string | null>;

  // Custom alert with full options
  showAlert: (options: AlertOptions) => Promise<void>;

  // Hide current alert
  hideAlert: () => void;
}

const AlertContext = createContext<AlertContextType | undefined>(undefined);

let globalAlerts: AlertContextType | null = null;

export const alertsGlobal = {
  alert: (title: string, message?: string) => {
    if (!globalAlerts) throw new Error('alertsGlobal.alert called before AlertProvider is mounted');
    return globalAlerts.alert(title, message);
  },
  success: (title: string, message?: string) => {
    if (!globalAlerts) throw new Error('alertsGlobal.success called before AlertProvider is mounted');
    return globalAlerts.success(title, message);
  },
  error: (title: string, message?: string) => {
    if (!globalAlerts) throw new Error('alertsGlobal.error called before AlertProvider is mounted');
    return globalAlerts.error(title, message);
  },
  warning: (title: string, message?: string) => {
    if (!globalAlerts) throw new Error('alertsGlobal.warning called before AlertProvider is mounted');
    return globalAlerts.warning(title, message);
  },
  info: (title: string, message?: string) => {
    if (!globalAlerts) throw new Error('alertsGlobal.info called before AlertProvider is mounted');
    return globalAlerts.info(title, message);
  },
  confirm: (title: string, message?: string) => {
    if (!globalAlerts) throw new Error('alertsGlobal.confirm called before AlertProvider is mounted');
    return globalAlerts.confirm(title, message);
  },
  prompt: (title: string, message?: string, options?: PromptModalOptions) => {
    if (!globalAlerts) throw new Error('alertsGlobal.prompt called before AlertProvider is mounted');
    return globalAlerts.prompt(title, message, options);
  },
  showAlert: (options: AlertOptions) => {
    if (!globalAlerts) throw new Error('alertsGlobal.showAlert called before AlertProvider is mounted');
    return globalAlerts.showAlert(options);
  },
};

interface AlertProviderProps {
  children: ReactNode;
}

interface AlertState extends AlertOptions {
  visible: boolean;
  resolve?: (value: any) => void;
}

interface PromptState extends PromptModalOptions {
  visible: boolean;
  title: string;
  message?: string;
  resolve?: (value: string | null) => void;
}

export function AlertProvider({ children }: AlertProviderProps) {
  const [alertState, setAlertState] = useState<AlertState>({
    visible: false,
    title: '',
  });
  const [promptState, setPromptState] = useState<PromptState>({
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

  const prompt = useCallback((title: string, message?: string, options?: PromptModalOptions): Promise<string | null> => {
    return new Promise((resolve) => {
      setPromptState({
        visible: true,
        title,
        message,
        ...(options || {}),
        resolve,
      });
    });
  }, []);

  const handleClose = useCallback(() => {
    alertState.resolve?.(undefined);
    hideAlert();
  }, [alertState.resolve, hideAlert]);

  const handlePromptCancel = useCallback(() => {
    promptState.resolve?.(null);
    setPromptState((prev) => ({ ...prev, visible: false }));
  }, [promptState.resolve]);

  const handlePromptConfirm = useCallback((value: string) => {
    promptState.resolve?.(value);
    setPromptState((prev) => ({ ...prev, visible: false }));
  }, [promptState.resolve]);

  useEffect(() => {
    globalAlerts = {
      alert,
      success,
      error,
      warning,
      info,
      confirm,
      prompt,
      showAlert,
      hideAlert,
    };
    return () => {
      globalAlerts = null;
    };
  }, [alert, success, error, warning, info, confirm, prompt, showAlert, hideAlert]);

  return (
    <AlertContext.Provider
      value={{
        alert,
        success,
        error,
        warning,
        info,
        confirm,
        prompt,
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
      <PromptModal
        visible={promptState.visible}
        title={promptState.title}
        message={promptState.message}
        placeholder={promptState.placeholder}
        defaultValue={promptState.defaultValue}
        confirmText={promptState.confirmText}
        cancelText={promptState.cancelText}
        multiline={promptState.multiline}
        keyboardType={promptState.keyboardType}
        onCancel={handlePromptCancel}
        onConfirm={handlePromptConfirm}
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
