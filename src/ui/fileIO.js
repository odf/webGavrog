import { floatMatrices as opsF } from '../arithmetic/types';


export const fileLoader = (accept, multiple=false, binary=false) => {
  const input = document.createElement('input');
  let callback = () => {};

  input.type = 'file';
  input.accept = accept;
  input.multiple = multiple;

  input.addEventListener('change', event => {
    const files = event.target.files;

    for (let i = 0; i < files.length; ++i) {
      const file = files[i];
      const reader = new FileReader();

      reader.onload = event => callback({ file, data: event.target.result });

      if (binary)
        reader.readAsDataURL(file);
      else
        reader.readAsText(file);
    }
  });

  return (onData) => {
    callback = onData;
    input.click();
  };
};


export const fileSaver = () => {
  const link = document.createElement('a');

  link.style.display = 'none';
  document.body.appendChild(link);

  return (blob, filename) => {
    link.download = filename;
    link.href = URL.createObjectURL(blob);
    link.click();
  }
};


export const saveStructure = (config, model) => {
  const structure = model.structures[model.index];

  if (structure.type == 'tiling') {
    const mod = model.options.tilingModifier;
    const ds = structure.symbol;

    const text =
          mod == 'dual' ? derived.dual(ds).toString() :
          mod == 't-analog' ? derived.tAnalog(ds).toString() :
          ds.toString();

    const blob = new Blob([text], { type: 'text/plain' });
    config.saveFile(blob, 'gavrog.ds');
  }
  else
    config.log(`ERROR: not yet implemented for '${structure.type}'`);
};


export const saveScreenshot = (config, options) => {
  const srcCanvas =
     document.querySelector('#main-3d-canvas canvas') ||
     document.querySelector('canvas#main-3d-canvas')

  if (srcCanvas) {
    window.requestAnimationFrame(() => {
      const canvas = document.createElement("canvas");
      canvas.width = srcCanvas.width;
      canvas.height = srcCanvas.height;

      const ctx = canvas.getContext('2d');
      ctx.fillStyle = options.backgroundColor;
      ctx.fillRect(0, 0, srcCanvas.width, srcCanvas.height);
      ctx.drawImage(srcCanvas, 0, 0);

      if (canvas.toBlob)
        canvas.toBlob(blob => config.saveFile(blob, 'gavrog.png'));
      else {
        const binStr = atob(canvas.toDataURL().split(',')[1]);

        const len = binStr.length;
        const arr = new Uint8Array(len);
        for (let i = 0; i < len; i++ )
          arr[i] = binStr.charCodeAt(i);

        const blob = new Blob([arr], { type: 'image/png' });
        config.saveFile(blob, 'gavrog.png');
      }

      config.log('Screenshot taken.');
    });
  }
  else
    config.log('ERROR: could not save screenshot - no canvas element found');
};


export const saveSceneOBJ = (config, model) => {
  const { meshes, instances } = model.scene;

  const lines = [];
  let offset = 1;

  for (let i = 0; i < instances.length; ++i) {
    const inst = instances[i];
    const basis = inst.transform.basis;
    const shift = opsF.plus(inst.transform.shift, inst.extraShift);
    const mesh = meshes[inst.meshIndex];

    const colorIndex = model.options.colorByTranslations ?
          inst.latticeIndex : inst.classIndex;

    lines.push(`o c${inst.classIndex}-m${inst.meshIndex}-i${i}`);

    if (inst.meshType == 'tileFace')
      lines.push(`usemtl tileFace-${colorIndex}`);
    else if (inst.meshType == 'tileEdges')
      lines.push(`usemtl tileEdges-${colorIndex}`);
    else
      lines.push(`usemtl ${inst.meshType}`);

    for (const v of mesh.vertices) {
      const pos = opsF.plus(opsF.times(v.pos, basis), shift);
      lines.push('v ' + pos.join(' '));
    }

    for (const v of mesh.vertices) {
      const normal = opsF.times(v.normal, basis);
      lines.push('vn ' + normal.join(' '));
    }

    for (const f of mesh.faces) {
      const vs = f.map(v => v + offset);
      lines.push('f ' + vs.map(v => `${v}//${v}`).join(' '));
    }

    offset += mesh.vertices.length;
  }

  const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
  config.saveFile(blob, 'gavrog.obj');
};
