onmessage = event => {
  const { id, input: { a, b } } = event.data;
  const ok = typeof a == 'number' && typeof b == 'number' && b;
  const output = ok ? a / b : 'expected two numbers, the second one non-zero';

  postMessage({ id, output, ok });
};
