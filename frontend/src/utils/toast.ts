import { toast } from 'react-toastify';

/**
 * File messages ("Saved to Documents: x.pdf", "Result sheet downloaded") often
 * arrive together: the download helper announces the save and the page then
 * says what it was. They share one toast that is updated in place, so the user
 * sees a single message, not two stacked ones.
 */
const FILE_TOAST_ID = 'file-download';
const isFileMessage = (m: string) => /\b(download(ed|ing)?|export(ed)?|saved to documents)\b/i.test(m);

/**
 * How long a toast stays (ms). Short, so they never pile up; errors stay a little
 * longer to be read. Hovering a toast pauses its timer, and the close button is always there.
 */
const DURATION = { success: 2500, info: 3000, warning: 5000, error: 6000 } as const;

export const showToast = {
  success: (message: string) => {
    if (isFileMessage(message)) {
      if (toast.isActive(FILE_TOAST_ID)) {
        toast.update(FILE_TOAST_ID, { render: message, type: 'success', autoClose: DURATION.success, updateId: Date.now() });
        return FILE_TOAST_ID;
      }
      return toast.success(message, { autoClose: DURATION.success, position: 'top-right', toastId: FILE_TOAST_ID });
    }
    return toast.success(message, { autoClose: DURATION.success, position: 'top-right' });
  },
  error: (message: string) =>
    toast.error(message, { autoClose: DURATION.error, position: 'top-right' }),
  warning: (message: string) =>
    toast.warning(message, { autoClose: DURATION.warning, position: 'top-right' }),
  info: (message: string) =>
    toast.info(message, { autoClose: DURATION.info, position: 'top-right' }),
  saved: (entityName: string) =>
    showToast.success(`${entityName} saved successfully.`),
  deleted: (entityName: string) =>
    showToast.success(`${entityName} deleted successfully.`),
  apiError: (message?: string) =>
    showToast.error(message ?? 'Something went wrong. Please try again.'),
};

export default showToast;
