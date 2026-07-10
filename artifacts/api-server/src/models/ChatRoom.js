import mongoose from 'mongoose';
import crypto from 'crypto';

const chatRoomSchema = new mongoose.Schema(
  {
    roomId: {
      type: String,
      default: () => crypto.randomUUID(),
      unique: true,
    },
    participants: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    active: {
      type: Boolean,
      default: true,
    },
    endedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    endedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

export default mongoose.model('ChatRoom', chatRoomSchema);
