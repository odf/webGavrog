module Materials exposing (netMaterial, paletteColor, tilingMaterial)

import Color exposing (Color)
import ColorDialog
import View3d.RendererCommon exposing (Material)


convertColor : ColorDialog.Color -> Color
convertColor { hue, saturation, lightness, alpha } =
    Color.hsla hue saturation lightness alpha


netMaterial : ColorDialog.Color -> Material
netMaterial color =
    { color = convertColor color, roughness = 0.5, metallic = 0.3 }


tilingMaterial : ColorDialog.Color -> Material
tilingMaterial color =
    { color = convertColor color, roughness = 0.5, metallic = 0.2 }


tau : Float
tau =
    (sqrt 5 - 1) / 2


frac : Float -> Float
frac x =
    x - toFloat (floor x)


paletteColor : ColorDialog.Color -> Int -> ColorDialog.Color
paletteColor baseColor index =
    { baseColor | hue = frac <| baseColor.hue + toFloat index * tau }
