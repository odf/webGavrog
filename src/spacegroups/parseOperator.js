import { affineTransformationsQ as ops } from '../geometry/types';


const parseOperator = s => {
  const parts = s.replace(/\s+/g, '').split(',');
  const d = parts.length;

  if (d > 3)
    throw new Error('only up to 3 coordinates are recognized');

  const M = ops.matrix(d, d);
  const v = ops.vector(d);

  for (let i = 0; i < d; ++i) {
    for (const term of parts[i].split(/(?=[+-])/)) {
      const [matched, sign, coeff, axis] = (
        term.match(/^([+-])?(\d+(?:\/\d+)?)?(?:\*?([xyz]))?$/) || []
      );

      if (!matched)
        throw new Error(`illegal term ${term} in coordinate ${i}`);

      let val;
      if (coeff)
        val = ops.rational(coeff);
      else
        val = 1;
      if (sign == '-')
        val = ops.negative(val);

      if (axis) {
        const j = 'xyz'.indexOf(axis);
        if (j >= d)
          throw new Error(`no ${axis}-axis in ${d}-dimensional operator`);
        M[i][j] = ops.plus(M[i][j], val);
      }
      else
        v[i] = ops.plus(v[i], val);
    }
  }

  return ops.affineTransformation(M, v);
};


export default parseOperator;


if (require.main == module) {
  const test = s => {
    console.log(`'${s}' =>`);
    try {
      console.log('    ' + parseOperator(s));
    }
    catch(ex) {
      console.log('    ' + ex);
    }
  };

  test('-x + 3*y + z, 5x, x - 3/2');
  test('-x + 3*y + z, 5x, x - 3/2, z');
  test('-x*x + 3*y + z, 5x, x - 3/2');
  test('-x + 3*y + z, 5x');
}
