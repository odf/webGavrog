module View3d.Scene exposing (RawSceneSpec, Scene, makeScene)

import Color exposing (Color)
import Math.Matrix4 as Mat4 exposing (Mat4)
import Math.Vector3 as Vec3 exposing (Vec3, vec3)
import View3d.Mesh as Mesh exposing (Mesh)
import View3d.Renderer as Renderer


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


type alias RawMeshSpec =
    { vertices : List RawVertexSpec
    , faces : List (List Int)
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
    , materialIndex : Int
    , transform : RawTransform
    , extraShift : RawVec3
    }


type alias RawSceneSpec =
    { meshes : List RawMeshSpec
    , materials : List RawMaterial
    , instances : List RawInstanceSpec
    }


type alias Instance =
    { material : Renderer.Material
    , transform : Mat4
    }


type alias MeshWithInstances =
    { mesh : Mesh Renderer.Vertex
    , instances : List Instance
    }


type alias Scene =
    List MeshWithInstances


defaultMaterial : Renderer.Material
defaultMaterial =
    { ambientColor = vec3 0 0 0
    , diffuseColor = vec3 0 0 0
    , specularColor = vec3 0 0 0
    , ka = 0
    , kd = 0
    , ks = 0
    , shininess = 0
    }


makeVec3 : RawVec3 -> Vec3
makeVec3 ( a, b, c ) =
    vec3 a b c


makeVec3Color : RawColor -> Vec3
makeVec3Color { hue, saturation, lightness } =
    let
        { red, green, blue, alpha } =
            Color.toRgba <| Color.hsl hue saturation lightness
    in
    vec3 red green blue


makeVertex : RawVertexSpec -> Renderer.Vertex
makeVertex v =
    { pos = makeVec3 v.pos
    , normal = makeVec3 v.normal
    }


makeMesh : RawMeshSpec -> Mesh Renderer.Vertex
makeMesh spec =
    Mesh.surface (List.map makeVertex spec.vertices) spec.faces


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


makeTransform : RawInstanceSpec -> Mat4
makeTransform { transform, extraShift } =
    let
        { basis, shift } =
            transform

        ( u, v, w ) =
            basis
    in
    Mat4.mul
        (Mat4.makeTranslate <|
            Vec3.add (makeVec3 shift) (makeVec3 extraShift)
        )
        (Mat4.makeBasis (makeVec3 u) (makeVec3 v) (makeVec3 w))


makeInstance : List Renderer.Material -> RawInstanceSpec -> Instance
makeInstance materials spec =
    { material =
        List.drop spec.materialIndex materials
            |> List.head
            |> Maybe.withDefault defaultMaterial
    , transform = makeTransform spec
    }


makeMeshWithInstances :
    List RawInstanceSpec
    -> List Renderer.Material
    -> Int
    -> Mesh Renderer.Vertex
    -> MeshWithInstances
makeMeshWithInstances instances materials index mesh =
    { mesh = mesh
    , instances =
        instances
            |> List.filter (\instance -> instance.meshIndex == index)
            |> List.map (makeInstance materials)
    }


makeScene : RawSceneSpec -> Scene
makeScene spec =
    let
        materials =
            List.map makeMaterial spec.materials
    in
    List.map makeMesh spec.meshes
        |> List.indexedMap (makeMeshWithInstances spec.instances materials)
