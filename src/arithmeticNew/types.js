const a = require('./base').arithmetic()

a.register(require('./integers').methods());

export const integers = a.ops();

a.register(require('./fractions').methods(
  integers, ['Integer', 'LongInt'], 'Fraction'
));

export const rationals = a.ops();

a.register(require('./floats').methods(
  rationals, ['Integer', 'LongInt', 'Fraction']
));

export const reals = a.ops();


if (require.main == module) {
  console.log(`${reals.div(2,3)}`);
  console.log(`${reals.plus(reals.div(2,3), 0.1)}`);
}
