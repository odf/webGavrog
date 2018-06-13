const white = { hue: 0, saturation: 0, lightness: 1 };
const black = { hue: 0, saturation: 0, lightness: 0 };


const hue = angleDeg => ({
  hue: angleDeg / 180.0 * Math.PI,
  saturation: 1.0,
  lightness: 0.5
});


const baseMaterial = {
  ambientColor: white,
  diffuseColor: white,
  specularColor: white,
  ka: 0.1,
  kd: 1.0,
  ks: 0.2,
  shininess: 20.0
};


const vertices = [
  { pos: [ -0.45, -0.45, -0.5 ], normal: [ 0, 0, -1 ] },
  { pos: [ 0.45, -0.45, -0.5 ], normal: [ 0, 0, -1 ] },
  { pos: [ 0.45, 0.45, -0.5 ], normal: [ 0, 0, -1 ] },
  { pos: [ -0.45, 0.45, -0.5 ], normal: [ 0, 0, -1 ] },
  { pos: [ -0.45, -0.45, 0.5 ], normal: [ 0, 0, 1 ] },
  { pos: [ 0.45, -0.45, 0.5 ], normal: [ 0, 0, 1 ] },
  { pos: [ 0.45, 0.45, 0.5 ], normal: [ 0, 0, 1 ] },
  { pos: [ -0.45, 0.45, 0.5 ], normal: [ 0, 0, 1 ] },
  { pos: [ -0.45, -0.5, -0.45 ], normal: [ 0, -1, 0 ] },
  { pos: [ -0.45, -0.5, 0.45 ], normal: [ 0, -1, 0 ] },
  { pos: [ 0.45, -0.5, 0.45 ], normal: [ 0, -1, 0 ] },
  { pos: [ 0.45, -0.5, -0.45 ], normal: [ 0, -1, 0 ] },
  { pos: [ -0.45, 0.5, -0.45 ], normal: [ 0, 1, 0 ] },
  { pos: [ -0.45, 0.5, 0.45 ], normal: [ 0, 1, 0 ] },
  { pos: [ 0.45, 0.5, 0.45 ], normal: [ 0, 1, 0 ] },
  { pos: [ 0.45, 0.5, -0.45 ], normal: [ 0, 1, 0 ] },
  { pos: [ -0.5, -0.45, -0.45 ], normal: [ -1, 0, 0 ] },
  { pos: [ -0.5, 0.45, -0.45 ], normal: [ -1, 0, 0 ] },
  { pos: [ -0.5, 0.45, 0.45 ], normal: [ -1, 0, 0 ] },
  { pos: [ -0.5, -0.45, 0.45 ], normal: [ -1, 0, 0 ] },
  { pos: [ 0.5, -0.45, -0.45 ], normal: [ 1, 0, 0 ] },
  { pos: [ 0.5, 0.45, -0.45 ], normal: [ 1, 0, 0 ] },
  { pos: [ 0.5, 0.45, 0.45 ], normal: [ 1, 0, 0 ] },
  { pos: [ 0.5, -0.45, 0.45 ], normal: [ 1, 0, 0 ] }
];


const faces = [
  { vertices: [ 0, 1, 2, 3 ], color: white },
  { vertices: [ 4, 7, 6, 5 ], color: white },
  { vertices: [ 8, 9, 10, 11 ], color: white },
  { vertices: [ 12, 15, 14, 13 ], color: white },
  { vertices: [ 16, 17, 18, 19 ], color: white },
  { vertices: [ 20, 23, 22, 21 ], color: white }
];


export const sceneSpec = {
  meshes: [
    { vertices: vertices, faces: faces, isWireframe: false },
    { vertices: vertices, faces: faces, isWireframe: true }
  ],
  instances: [
    { meshIndex: 1,
      material: Object.assign({}, baseMaterial, { diffuseColor: black }),
      transform: {
        basis: [ [ 1, 0, 0 ], [ 0, 1, 0 ], [ 0, 0, 1 ] ],
        shift: [ 0, 0, 0 ]
      }
    },
    { meshIndex: 0,
      material: Object.assign({}, baseMaterial, { diffuseColor: hue(60) }),
      transform: {
        basis: [ [ 1, 0, 0 ], [ 0, 1, 0 ], [ 0, 0, 1 ] ],
        shift: [ 0, 0, 0 ]
      }
    },
    { meshIndex: 0,
      material: Object.assign({}, baseMaterial, { diffuseColor: hue(180) }),
      transform: {
        basis: [ [ -1, 0, 0 ], [ 0, 0, 1 ], [ 0, -1, 0 ] ],
        shift: [ 1.2, 0, 0 ]
      }
    },
    { meshIndex: 0,
      material: Object.assign({}, baseMaterial, { diffuseColor: hue(300) }),
      transform: {
        basis: [ [ -1, 0, 0 ], [ 0, 0, -1 ], [ 0, 1, 0 ] ],
        shift: [ -1.2, 0, 0 ]
      }
    }
  ]
};
