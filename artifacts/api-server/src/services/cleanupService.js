import fs from 'fs';
import Message from '../models/Message.js';
import ChatRoom from '../models/ChatRoom.js';
import ConnectionRequest from '../models/ConnectionRequest.js';
import File from '../models/File.js';

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

const runCleanup = async () => {
  const cutoff = new Date(Date.now() - ONE_DAY_MS);
  console.log(`[Cleanup] Running — deleting data older than ${cutoff.toISOString()}`);

  try {
    // Delete physical files first, then DB records
    const oldFiles = await File.find({ createdAt: { $lt: cutoff } });
    let deletedFiles = 0;
    for (const file of oldFiles) {
      try {
        if (fs.existsSync(file.filepath)) fs.unlinkSync(file.filepath);
        deletedFiles++;
      } catch (e) {
        console.warn(`[Cleanup] Could not delete file on disk: ${file.filepath}`);
      }
    }
    await File.deleteMany({ createdAt: { $lt: cutoff } });

    const [msgs, rooms, conns] = await Promise.all([
      Message.deleteMany({ createdAt: { $lt: cutoff } }),
      ChatRoom.deleteMany({ createdAt: { $lt: cutoff } }),
      ConnectionRequest.deleteMany({ createdAt: { $lt: cutoff } }),
    ]);

    console.log(
      `[Cleanup] Done — messages: ${msgs.deletedCount}, rooms: ${rooms.deletedCount}, ` +
      `connections: ${conns.deletedCount}, files: ${deletedFiles}`
    );
  } catch (err) {
    console.error('[Cleanup] Error during cleanup:', err.message);
  }
};

export const startCleanupService = () => {
  // Run once after a short delay (let DB connect first)
  setTimeout(() => {
    runCleanup();
    // Then run every 24 hours
    setInterval(runCleanup, ONE_DAY_MS);
  }, 10_000);
};
