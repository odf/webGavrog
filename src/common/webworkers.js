export function create(source) {
  let   lastId    = 0;
  const callbacks = {};
  const worker    = new Worker(source);

  worker.onmessage = event => {
    const { id, output, ok } = event.data;
    const cb = callbacks[id];

    if (cb) {
      if (ok)
        cb(null, output);
      else
        cb(output);
    }

    delete callbacks[id];
  };

  return (input, cb) => {
    const id = ++lastId;
    callbacks[id] = cb || null;
    worker.postMessage({ id, input });
  };
};
