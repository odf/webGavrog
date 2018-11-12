import * as delaney  from '../dsymbols/delaney';
import * as cgd from '../io/cgd';


const findName = data => (
  ((data.find(s => s.key == 'name') || {}).args || [])[0]);


const parseCgdBlock = text => {
  const block = Array.from(cgd.blocks(text))[0];
  return { ...block, name: findName(block.entries) };
};


export const structures = [
  parseCgdBlock(`
PERIODIC_GRAPH
  NAME bcu-net
  EDGES
      1   1     1 -1 -1
      1   1     1 -1  0
      1   1     1  0 -1
      1   1     1  0  0
END
    `),
  { name: 'bcu',
    type: 'tiling',
    symbol: delaney.parse('<1.1:2 3:2,1 2,1 2,2:4,4 2,6>')
  },
  parseCgdBlock(`
PERIODIC_GRAPH
  NAME pcu-net
  EDGES
      1   1     0  0  1
      1   1     0  1  0
      1   1     1  0  0
END
    `),
  { name: 'pcu',
    type: 'tiling',
    symbol: delaney.parse('<1.1:1 3:1,1,1,1:4,3,4>')
  },
  parseCgdBlock(`
PERIODIC_GRAPH
  NAME nbo-net
  EDGES
      1   2     1 -1 -1
      1   2     1  0 -1
      1   3     1 -1 -1
      1   3     1 -1  0
      2   3    -1  0  1
      2   3     1 -1  0
END
    `),
  { name: 'nbo',
    type: 'tiling',
    symbol: delaney.parse('<1.1:2 3:2,1 2,1 2,2:6,4 2,4>')
  },
  parseCgdBlock(`
PERIODIC_GRAPH
  NAME dia-net
  EDGES
      1   2     0 -1  1
      1   2     0  0  0
      1   2     1 -1  0
      1   2     1  0  0
END
    `),
  { name: 'dia',
    type: 'tiling',
    symbol: delaney.parse('<1.1:2 3:2,1 2,1 2,2:6,3 2,6>')
  },
  parseCgdBlock(`
PERIODIC_GRAPH
  NAME srs-net
  EDGES
      1   2     0  0  0
      1   3     1 -1  0
      1   4    -1  0  0
      2   3     0  0  0
      2   4     0  0 -1
      3   4    -1  1  0
END
    `),
  { name: 'srs',
    type: 'tiling',
    symbol: delaney.parse(`
      <1.1:10 3:2 4 6 8 10,10 3 5 7 9,10 9 8 7 6,4 3 10 9 8:10,3 2 2 2 2 3,10>
      `)
  },
  parseCgdBlock(`
CRYSTAL
  NAME fau-net
  GROUP Fd-3m:2
  CELL 7.96625 7.96625 7.96625 90.0000 90.0000 90.0000
  NODE 1 4  0.03624 0.12500 0.44747
  EDGE  0.03624 0.12500 0.44747   0.12500 0.21376 0.44747
  EDGE  0.03624 0.12500 0.44747   0.12500 0.03624 0.44747
  EDGE  0.03624 0.12500 0.44747   -0.05253 0.12500 0.53624
  EDGE  0.03624 0.12500 0.44747   -0.03624 0.05253 0.37500
END
    `),
  { name: 'fau',
    type: 'tiling',
    symbol: delaney.parse(`
<1.1:24 3:1 3 4 5 6 8 9 10 11 12 13 15 16 17 18 19 20 21 22 23 24,
2 4 6 10 9 12 14 16 18 20 22 24,5 7 8 11 10 12 17 15 18 21 23 24,
13 14 15 16 19 20 8 10 24 23 21 22:4 4 12 6 4 6 4 6 6,3 3 3 3,3 3 3 3>
      `)
  },
  { name: 'hh01',
    type: 'tiling',
    symbol: delaney.parse(`<1.1:2:1 2,1 2,2:3 6,4>`)
  },
  { name: 'hh02',
    type: 'tiling',
    symbol: delaney.parse(`<2.1:2:1 2,1 2,2:4 4,4>`)
  },
  { name: 'hh03',
    type: 'tiling',
    symbol: delaney.parse(`<3.1:2:1 2,1 2,2:3 3,6>`)
  },
  { name: 'hh04',
    type: 'tiling',
    symbol: delaney.parse(`<4.1:4:1 2 3 4,1 2 4,3 4:3 6 4,4>`)
  },
  { name: 'hh05',
    type: 'tiling',
    symbol: delaney.parse(`<5.1:6:2 3 5 6,1 3 4 6,4 5 6:3 3,4 8>`)
  },
  { name: 'hh06',
    type: 'tiling',
    symbol: delaney.parse(`<6.1:6:2 3 5 6,1 2 3 4 6,4 5 6:4 3 3,12 4>`)
  },
  { name: 'hh07',
    type: 'tiling',
    symbol: delaney.parse(`<7.1:6:2 3 5 6,1 2 3 4 6,4 5 6:4 6 3,6 4>`)
  },
  { name: 'hh08',
    type: 'tiling',
    symbol: delaney.parse(`<8.1:6:2 3 5 6,1 2 3 4 6,4 5 6:12 3 3,4 4>`)
  },
  { name: 'hh09',
    type: 'tiling',
    symbol: delaney.parse(`<9.1:6:2 3 5 6,1 2 3 4 6,4 5 6:4 4 3,8 4>`)
  },
  { name: 'hh10',
    type: 'tiling',
    symbol: delaney.parse(`<10.1:6:2 3 5 6,1 2 3 4 6,4 5 6:8 4 3,4 4>`)
  },
  { name: 'hh11',
    type: 'tiling',
    symbol: delaney.parse(`<11.1:6:2 3 5 6,1 2 3 4 6,4 5 6:6 3 3,6 4>`)
  },
  { name: 'hh12',
    type: 'tiling',
    symbol: delaney.parse(`<12.1:8:1 3 4 5 7 8,1 2 4 6 8,5 6 7 8:3 3 4,4 6>`)
  },
  { name: 'hh13',
    type: 'tiling',
    symbol: delaney.parse(`
<13.1:8:1 3 4 5 7 8,1 2 3 4 6 8,5 6 7 8:3 4 6 4,4 4>
      `)
  },
  { name: 'hh14',
    type: 'tiling',
    symbol: delaney.parse(`
<14.1:10:2 4 5 7 9 10,1 5 4 6 8 10,6 7 8 9 10:3 4 5,4 4>
      `)
  },
  { name: 'hh15',
    type: 'tiling',
    symbol: delaney.parse(`
<15.1:10:2 4 5 7 9 10,1 5 4 6 8 10,6 7 8 9 10:3 3 5,6 4>
                            `)
  },
  { name: 'hh16',
    type: 'tiling',
    symbol: delaney.parse(`
<16.1:10:2 4 5 7 9 10,1 2 3 5 6 8 10,6 7 8 9 10:4 3 5,4 4 4>
      `)
  },
  { name: 'hh17',
    type: 'tiling',
    symbol: delaney.parse(`
<17.1:12:2 4 6 8 10 12,6 3 5 12 9 11,7 8 9 10 11 12:3 3,4 6 12>
      `)
  },
  { name: 'hh18',
    type: 'tiling',
    symbol: delaney.parse(`
<18.1:12:2 4 6 8 10 12,1 2 3 5 6 12 9 11,7 8 9 10 11 12:4 4 3,8 4 4>
                            `)
  },
  { name: 'hh19',
    type: 'tiling',
    symbol: delaney.parse(`
<19.1:12:2 4 6 8 10 12,1 2 3 4 5 6 12 9 11,7 8 9 10 11 12:4 6 12 3,4 4 4>
      `)
  },
  { name: 'hh20',
    type: 'tiling',
    symbol: delaney.parse(`
<20.1:16:2 4 6 8 10 12 14 16,2 8 5 7 16 11 13 15,9 10 11 12 13 14 15 16:
3 3 4,4 4 12>
                            `)
  },
  { name: 'hh21',
    type: 'tiling',
    symbol: delaney.parse(`
<21.1:16:2 4 6 8 10 12 14 16,2 8 5 7 16 11 13 15,9 10 11 12 13 14 15 16:
6 3 4,4 4 6>
      `)
  },
  { name: 'hh22',
    type: 'tiling',
    symbol: delaney.parse(`
<22.1:16:2 4 6 8 10 12 14 16,2 8 5 7 16 11 13 15,9 10 11 12 13 14 15 16:
4 3 4,4 4 8>
      `)
  },
  { name: 'hh23',
    type: 'tiling',
    symbol: delaney.parse(`
<23.1:20:2 4 6 8 10 12 14 16 18 20,2 10 5 9 8 20 13 15 17 19,
11 12 13 14 15 16 17 18 19 20:3 3 6 5,4 4 4>
                            `)
  },
];
