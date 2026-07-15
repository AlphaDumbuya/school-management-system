import { toast } from 'react-toastify';

export const showToast = {
  success: (message: string) =>
    toast.success(message, { autoClose: 4000, position: 'top-right' }),

  error: (message: string) =>
    toast.error(message, { autoClose: false, position: 'top-right' }),

  warning: (message: string) =>
    toast.warning(message, { autoClose: false, position: 'top-right' }),

  info: (message: string) =>
    toast.info(message, { autoClose: 4000, position: 'top-right' }),

  saved: (entityName: string) =>
    showToast.success(`${entityName} saved successfully.`),

  deleted: (entityName: string) =>
    showToast.success(`${entityName} deleted successfully.`),

  apiError: (message?: string) =>
    showToast.error(message ?? 'Something went wrong. Please try again.'),
};

export default showToast;
