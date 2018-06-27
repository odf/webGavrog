module Scene exposing (RawSceneSpec, Scene, makeScene, boundingBoxForScene)

import Color exposing (Color)
import Math.Matrix4 as Mat4 exposing (Mat4)
import Math.Vector3 as Vec3 exposing (vec3, Vec3)
import Mesh exposing (..)
import Renderer exposing (Material, Vertex)


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
    { material : Material
    , transform : Mat4
    }


type alias MeshWithInstances =
    { mesh : Mesh Vertex
    , instances : List Instance
    }


type alias Scene =
    List MeshWithInstances


type alias Box =
    { minima : Vec3
    , maxima : Vec3
    }


makeVec3 : RawVec3 -> Vec3
makeVec3 ( a, b, c ) =
    vec3 a b c


makeVec3Color : RawColor -> Vec3
makeVec3Color { hue, saturation, lightness } =
    let
        { red, green, blue } =
            Color.toRgb <| Color.hsl hue saturation lightness
    in
        vec3 (toFloat red / 255) (toFloat green / 255) (toFloat blue / 255)


makeVertex : RawVertexSpec -> Vertex
makeVertex v =
    { pos = makeVec3 v.pos
    , normal = makeVec3 v.normal
    }


makeMesh : RawMeshSpec -> Mesh Vertex
makeMesh spec =
    if spec.isWireframe then
        wireframe (List.map makeVertex spec.vertices) spec.faces
    else
        mesh (List.map makeVertex spec.vertices) spec.faces


makeMaterial : RawMaterial -> Material
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


makeInstance : RawInstanceSpec -> Instance
makeInstance spec =
    { material = makeMaterial spec.material
    , transform = makeTransform spec.transform
    }


makeMeshWithInstances :
    List RawInstanceSpec
    -> Int
    -> Mesh Vertex
    -> MeshWithInstances
makeMeshWithInstances instances index mesh =
    { mesh = mesh
    , instances =
        instances
            |> List.filter (\instance -> instance.meshIndex == index)
            |> List.map makeInstance
    }


makeScene : RawSceneSpec -> Scene
makeScene spec =
    List.map makeMesh spec.meshes
        |> List.indexedMap (makeMeshWithInstances spec.instances)


pointSetForMesh : Mesh Vertex -> List Vec3
pointSetForMesh mesh =
    case mesh of
        Lines lines ->
            List.concatMap (\( u, v ) -> [ u, v ]) lines
                |> List.map .pos

        Triangles triangles ->
            List.concatMap (\( u, v, w ) -> [ u, v, w ]) triangles
                |> List.map .pos


pointSetForScene : Scene -> List Vec3
pointSetForScene scene =
    List.concatMap
        (\{ mesh, instances } ->
            let
                points =
                    pointSetForMesh mesh
            in
                instances
                    |> List.map .transform
                    |> List.concatMap
                        (\t -> List.map (\v -> Mat4.transform t v) points)
        )
        scene


boundingBoxForScene : Scene -> Box
boundingBoxForScene scene =
    let
        pointsAsRecords =
            pointSetForScene scene |> List.map Vec3.toRecord

        xs =
            List.map .x pointsAsRecords

        ys =
            List.map .y pointsAsRecords

        zs =
            List.map .z pointsAsRecords

        lo =
            \args -> List.minimum args |> Maybe.withDefault 0

        hi =
            \args -> List.maximum args |> Maybe.withDefault 0
    in
        Box
            (vec3 (lo xs) (lo ys) (lo zs))
            (vec3 (hi xs) (hi ys) (hi zs))
