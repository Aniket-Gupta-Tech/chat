import api from './api';

const MAX_RETRIES = 10;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Resolves once the browser is back online (immediately if already online)
const waitForOnline = () =>
  navigator.onLine
    ? Promise.resolve()
    : new Promise((resolve) => window.addEventListener('online', resolve, { once: true }));

// Errors worth retrying: network failure, timeout, rate limit, server errors
const isRetryable = (err) => {
  const status = err.response?.status;
  return !status || status === 408 || status === 429 || status >= 500;
};

const withRetry = async (fn, signal) => {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (signal?.aborted || !isRetryable(err) || attempt >= MAX_RETRIES) throw err;
      await waitForOnline();
      await sleep(Math.min(1000 * 2 ** attempt, 30000));
    }
  }
};

/**
 * Uploads a file in chunks. Failed chunks are retried with backoff, and after a
 * dropped connection the upload continues from the bytes the server already has.
 * Resolves with the server response of the final step ({ file, message }).
 */
export async function uploadFileChunked({ file, roomId, receiverId, onProgress, signal }) {
  const { data: init } = await withRetry(
    () => api.post(`/files/upload/${roomId}/init`, {
      filename: file.name,
      fileSize: file.size,
      mimeType: file.type || 'application/octet-stream',
      receiverId,
    }, { signal }),
    signal,
  );

  const { uploadId, chunkSize } = init;
  let offset = init.received;

  try {
    while (offset < file.size) {
      const chunk = file.slice(offset, offset + chunkSize);
      const start = offset;

      offset = await withRetry(async () => {
        try {
          const { data } = await api.put(`/files/upload/${uploadId}/chunk`, chunk, {
            params: { offset: start },
            headers: { 'Content-Type': 'application/octet-stream' },
            timeout: 120000,
            signal,
            onUploadProgress: (evt) => onProgress?.(Math.min(99, Math.round(((start + evt.loaded) * 100) / file.size))),
          });
          return data.received;
        } catch (err) {
          // Server already has a different amount (e.g. the previous attempt actually landed) — resume from there
          if (err.response?.status === 409) return err.response.data.received;
          // Connection dropped: the chunk may or may not have been stored, so ask the server
          if (!err.response && !signal?.aborted) {
            await waitForOnline();
            const { data } = await api.get(`/files/upload/${uploadId}/status`, { signal }).catch(() => ({ data: null }));
            if (data && data.received !== start) return data.received;
          }
          throw err;
        }
      }, signal);

      onProgress?.(Math.min(99, Math.round((offset * 100) / file.size)));
    }

    let firstAttempt = true;
    const { data } = await withRetry(async () => {
      try {
        return await api.post(`/files/upload/${uploadId}/complete`, null, { signal });
      } catch (err) {
        // A retry got 404: the earlier attempt finished but its response was lost.
        // The message still reaches the chat through the socket.
        if (!firstAttempt && err.response?.status === 404) return { data: {} };
        throw err;
      } finally {
        firstAttempt = false;
      }
    }, signal);
    onProgress?.(100);
    return data;
  } catch (err) {
    api.delete(`/files/upload/${uploadId}`).catch(() => {});
    throw err;
  }
}
