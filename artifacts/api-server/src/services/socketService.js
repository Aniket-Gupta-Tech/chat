// Singleton to share the io instance with non-socket modules
let _io = null;

export const setIO = (io) => {
  _io = io;
};

export const getIO = () => _io;
