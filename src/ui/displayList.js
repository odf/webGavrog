import { serialize as encode } from '../common/pickler';
import { coordinateChangesF as opsF } from '../geometry/types';


export const addTiles = (displayList, selection) => {
  const result = [];
  const seen = {};

  for (const { partIndex, neighbors, extraShiftCryst } of selection) {
    if (neighbors != null && partIndex != null) {
      const { latticeIndex, shift } = neighbors[partIndex];
      const item = {
        itemType: 'tile',
        latticeIndex,
        shift: opsF.plus(extraShiftCryst, shift)
      };
      const key = encode(item);

      if (!seen[key]) {
        result.push(item);
        seen[key] = true;
      }
    }
  }

  for (const item of displayList) {
    const key = encode({
      itemType: item.itemType,
      item: item.item,
      latticeIndex: item.latticeIndex,
      shift: item.shift
    });

    if (!seen[key]) {
      result.push(item);
      seen[key] = true;
    }
  }

  return result;
};


export const addCoronas = (displayList, selection) => {
  const result = [];
  const seen = {};

  for (const { neighbors, extraShiftCryst } of selection) {
    if (neighbors != null) {
      for (const neighbor of neighbors) {
        const item = Object.assign(
          {}, neighbor, { shift: opsF.plus(extraShiftCryst, neighbor.shift) }
        );
        const key = encode(item);

        if (!seen[key]) {
          result.push(item);
          seen[key] = true;
        }
      }
    }
  }

  for (const item of displayList) {
    const key = encode({
      itemType: item.itemType,
      item: item.item,
      latticeIndex: item.latticeIndex,
      shift: item.shift
    });

    if (!seen[key]) {
      result.push(item);
      seen[key] = true;
    }
  }

  return result;
};


export const restoreTiles = (displayList, selection) => {
  const toBeRestored = {};
  for (const inst of selection)
    toBeRestored[inst.instanceIndex] = true;

  return displayList.map(
    (item, i) =>
      toBeRestored[i] ? Object.assign({}, item, { skippedParts: {} }) : item
  );
};


export const removeTiles = (displayList, selection) => {
  const toBeRemoved = {};
  for (const inst of selection)
    toBeRemoved[inst.instanceIndex] = true;

  return displayList.filter((_, i) => !toBeRemoved[i]);
};


export const removeTileClasses = tiles => (displayList, selection) => {
  const latticesRemoved = {};
  for (const { classIndex } of selection) {
    for (let i = 0; i < tiles.length; ++i) {
      if (tiles[i].classIndex == classIndex)
        latticesRemoved[i] = true;
    }
  }

  return displayList.filter(
    ({ latticeIndex }, _) => !latticesRemoved[latticeIndex]
  );
};


export const removeElements = (displayList, selection) => {
  const toSkip = displayList.map(item => Object.assign({}, item.skippedParts));

  for (const inst of selection) {
    if (inst.partIndex != null)
      toSkip[inst.instanceIndex][inst.partIndex] = true;
    else
      toSkip[inst.instanceIndex] = true;
  }

  const result = [];

  for (let i = 0; i < displayList.length; ++i) {
    const item = displayList[i];

    if (toSkip[i] != true)
      result.push(Object.assign({}, item, { skippedParts: toSkip[i] }));
  }

  return result;
};
