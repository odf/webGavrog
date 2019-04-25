module DecodeScene exposing (ElementType(..), Instance, Scene, decodeScene)

import Array exposing (Array)
import Color exposing (Color)
import Json.Decode as Decode
import Math.Matrix4 as Mat4 exposing (Mat4)
import Math.Vector3 as Vec3 exposing (Vec3, vec3)
import View3d.Mesh as Mesh exposing (Mesh)
import View3d.Renderer exposing (Material, Vertex)


type alias RawInstance =
    { elementType : ElementType
    , tileClassIndex : Maybe Int
    , tileBearingIndex : Maybe Int
    , iMesh : Int
    , iMat : Int
    , transform : Mat4
    }


type alias Instance =
    { elementType : ElementType
    , tileClassIndex : Maybe Int
    , tileBearingIndex : Maybe Int
    , material : Material
    , transform : Mat4
    }


type ElementType
    = TileFace
    | TileEdges
    | NetVertex
    | NetEdge
    | Unknown


type alias MeshWithInstances =
    { mesh : Mesh Vertex
    , instances : List Instance
    }


type alias Scene =
    List MeshWithInstances


defaultMaterial : Material
defaultMaterial =
    { ambientColor = vec3 0 0 0
    , diffuseColor = vec3 0 0 0
    , specularColor = vec3 0 0 0
    , ka = 0
    , kd = 0
    , ks = 0
    , shininess = 0
    }


decodeVec3 : Decode.Decoder Vec3
decodeVec3 =
    Decode.map3 vec3
        (Decode.index 0 Decode.float)
        (Decode.index 1 Decode.float)
        (Decode.index 2 Decode.float)


hslToVec : Float -> Float -> Float -> Vec3
hslToVec hue saturation lightness =
    let
        { red, green, blue, alpha } =
            Color.toRgba <| Color.hsl hue saturation lightness
    in
    vec3 red green blue


decodeColor : Decode.Decoder Vec3
decodeColor =
    Decode.map3 hslToVec
        (Decode.field "hue" Decode.float)
        (Decode.field "saturation" Decode.float)
        (Decode.field "lightness" Decode.float)


decodeVertex : Decode.Decoder Vertex
decodeVertex =
    Decode.map2 (\pos normal -> { pos = pos, normal = normal })
        (Decode.field "pos" decodeVec3)
        (Decode.field "normal" decodeVec3)


decodeMesh : Decode.Decoder (Mesh Vertex)
decodeMesh =
    Decode.map2 Mesh.surface
        (Decode.field "vertices" (Decode.list decodeVertex))
        (Decode.field "faces" (Decode.list (Decode.list Decode.int)))


decodeMaterial : Decode.Decoder Material
decodeMaterial =
    Decode.map7
        (\ambientColor diffuseColor specularColor ka kd ks shininess ->
            { ambientColor = ambientColor
            , diffuseColor = diffuseColor
            , specularColor = specularColor
            , ka = ka
            , kd = kd
            , ks = ks
            , shininess = shininess
            }
        )
        (Decode.field "ambientColor" decodeColor)
        (Decode.field "diffuseColor" decodeColor)
        (Decode.field "specularColor" decodeColor)
        (Decode.field "ka" Decode.float)
        (Decode.field "kd" Decode.float)
        (Decode.field "ks" Decode.float)
        (Decode.field "shininess" Decode.float)


decodeBasis : Decode.Decoder ( Vec3, Vec3, Vec3 )
decodeBasis =
    Decode.map3 (\u v w -> ( u, v, w ))
        (Decode.index 0 decodeVec3)
        (Decode.index 1 decodeVec3)
        (Decode.index 2 decodeVec3)


decodeTransform : Decode.Decoder Mat4
decodeTransform =
    Decode.map2
        (\( u, v, w ) shift ->
            Mat4.mul (Mat4.makeTranslate shift) (Mat4.makeBasis u v w)
        )
        (Decode.field "basis" decodeBasis)
        (Decode.field "shift" decodeVec3)


decodeElementType : String -> ElementType
decodeElementType s =
    case s of
        "tileFace" ->
            TileFace

        "tileEdges" ->
            TileEdges

        "netVertex" ->
            NetVertex

        "netEdge" ->
            NetEdge

        _ ->
            Unknown


decodeInstance : Decode.Decoder RawInstance
decodeInstance =
    Decode.map7
        (\elementType classIndex bearingIndex iMesh iMat transform shift ->
            { elementType = decodeElementType elementType
            , tileClassIndex = classIndex
            , tileBearingIndex = bearingIndex
            , iMesh = iMesh
            , iMat = iMat
            , transform = Mat4.mul (Mat4.makeTranslate shift) transform
            }
        )
        (Decode.field "type" Decode.string)
        (Decode.maybe <| Decode.field "tileClassIndex" Decode.int)
        (Decode.maybe <| Decode.field "tileBearingIndex" Decode.int)
        (Decode.field "meshIndex" Decode.int)
        (Decode.field "materialIndex" Decode.int)
        (Decode.field "transform" decodeTransform)
        (Decode.field "extraShift" decodeVec3)


resolveInstance : Array Material -> RawInstance -> Instance
resolveInstance materials inInstance =
    { elementType = inInstance.elementType
    , tileClassIndex = inInstance.tileClassIndex
    , tileBearingIndex = inInstance.tileBearingIndex
    , material =
        Array.get inInstance.iMat materials
            |> Maybe.withDefault defaultMaterial
    , transform = inInstance.transform
    }


meshWithInstances :
    List RawInstance
    -> List Material
    -> Int
    -> Mesh Vertex
    -> MeshWithInstances
meshWithInstances instances materials index mesh =
    let
        matArray =
            Array.fromList materials
    in
    { mesh = mesh
    , instances =
        instances
            |> List.filter (\instance -> instance.iMesh == index)
            |> List.map (resolveInstance matArray)
    }


decodeScene : Decode.Decoder Scene
decodeScene =
    Decode.map3
        (\meshes materials instances ->
            List.indexedMap (meshWithInstances instances materials) meshes
        )
        (Decode.field "meshes" (Decode.list decodeMesh))
        (Decode.field "materials" (Decode.list decodeMaterial))
        (Decode.field "instances" (Decode.list decodeInstance))
