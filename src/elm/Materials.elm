module Materials exposing (netMaterial, tileColor, tilingMaterial)

import Color
import ColorDialog
import Math.Vector3 as Vec3 exposing (Vec3, vec3)
import View3d.Renderer exposing (Material)


black : Vec3
black =
    vec3 0 0 0


white : Vec3
white =
    vec3 1 1 1


colorAsVector : ColorDialog.Color -> Vec3
colorAsVector { hue, saturation, lightness, alpha } =
    let
        { red, green, blue } =
            Color.toRgba <| Color.hsla hue saturation lightness alpha
    in
    vec3 red green blue


baseMaterial : Material
baseMaterial =
    { ambientColor = black
    , diffuseColor = black
    , specularColor = white
    , ka = 0.0
    , kd = 1.0
    , ks = 0.2
    , shininess = 15.0
    }


netMaterial : ColorDialog.Color -> Material
netMaterial color =
    { baseMaterial | diffuseColor = colorAsVector color, shininess = 50.0 }


tilingMaterial : ColorDialog.Color -> Material
tilingMaterial color =
    { baseMaterial | diffuseColor = colorAsVector color, shininess = 15.0 }


tau : Float
tau =
    (sqrt 5 - 1) / 2


frac : Float -> Float
frac x =
    x - toFloat (floor x)


tileColor : Float -> Int -> ColorDialog.Color
tileColor baseHue index =
    { hue = frac <| baseHue + toFloat index * tau
    , saturation = 1.0
    , lightness = 0.7
    , alpha = 1.0
    }