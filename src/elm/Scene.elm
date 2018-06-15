module Scene exposing (RawSceneSpec, Scene, makeScene)

import Color exposing (Color)
import Math.Matrix4 as Mat4 exposing (Mat4)
import Math.Vector3 exposing (vec3, Vec3)
import Mesh exposing (..)
import Renderer


type alias RawVec3 =
    ( Float, Float, Float )


type alias RawColor =
    { hue : Float
    , saturation : Float
    , lightness : Float
    }


type alias RawVertexSpec =
    { pos : RawVec3
    , normal : RawVec3
    }


type alias RawFaceSpec =
    { vertices : List Int
    , color : RawColor
    }


type alias RawMeshSpec =
    { vertices : List RawVertexSpec
    , faces : List RawFaceSpec
    , isWireframe : Bool
    }


type alias RawMaterial =
    { ambientColor : RawColor
    , diffuseColor : RawColor
    , specularColor : RawColor
    , ka : Float
    , kd : Float
    , ks : Float
    , shininess : Float
    }


type alias RawTransform =
    { basis : ( RawVec3, RawVec3, RawVec3 )
    , shift : RawVec3
    }


type alias RawInstanceSpec =
    { meshIndex : Int
    , material : RawMaterial
    , transform : RawTransform
    }


type alias RawSceneSpec =
    { meshes : List RawMeshSpec
    , instances : List RawInstanceSpec
    }


type alias Instance =
    { mesh : Mesh
    , material : Renderer.Material
    , transform : Mat4
    }


type alias Scene =
    List Instance


makeVec3 : RawVec3 -> Vec3
makeVec3 ( a, b, c ) =
    vec3 a b c


makeColor : RawColor -> Color
makeColor { hue, saturation, lightness } =
    Color.hsl hue saturation lightness


makeVec3Color : RawColor -> Vec3
makeVec3Color { hue, saturation, lightness } =
    let
        { red, green, blue } =
            Color.toRgb <| Color.hsl hue saturation lightness
    in
        vec3 (toFloat red / 255) (toFloat green / 255) (toFloat blue / 255)


makeVertexSpec : RawVertexSpec -> VertexSpec
makeVertexSpec v =
    { pos = makeVec3 v.pos
    , normal = makeVec3 v.normal
    }


makeFaceSpec : RawFaceSpec -> FaceSpec
makeFaceSpec f =
    { vertices = f.vertices
    , color = makeColor f.color
    }


makeMesh : RawMeshSpec -> Mesh
makeMesh spec =
    if spec.isWireframe then
        wireframe
            (List.map makeVertexSpec spec.vertices)
            (List.map makeFaceSpec spec.faces)
    else
        mesh
            (List.map makeVertexSpec spec.vertices)
            (List.map makeFaceSpec spec.faces)


makeMaterial : RawMaterial -> Renderer.Material
makeMaterial mat =
    { ambientColor = makeVec3Color mat.ambientColor
    , diffuseColor = makeVec3Color mat.diffuseColor
    , specularColor = makeVec3Color mat.specularColor
    , ka = mat.ka
    , kd = mat.kd
    , ks = mat.ks
    , shininess = mat.shininess
    }


makeTransform : RawTransform -> Mat4
makeTransform { basis, shift } =
    let
        ( u, v, w ) =
            basis
    in
        Mat4.mul
            (Mat4.makeTranslate <| makeVec3 shift)
            (Mat4.makeBasis (makeVec3 u) (makeVec3 v) (makeVec3 w))


makeInstance : List Mesh -> RawInstanceSpec -> Maybe Instance
makeInstance meshes spec =
    meshes
        |> List.drop spec.meshIndex
        |> List.head
        |> Maybe.map
            (\mesh ->
                { mesh = mesh
                , material = makeMaterial spec.material
                , transform = makeTransform spec.transform
                }
            )


makeScene : RawSceneSpec -> Scene
makeScene spec =
    let
        meshes =
            List.map makeMesh spec.meshes
    in
        List.filterMap (makeInstance meshes) spec.instances
